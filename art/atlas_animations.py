"""Six-second authored activities. All transforms use the actual part pivots."""
import bpy, math, json
from mathutils import Vector

FPS=30
LAST=181

def smooth(a,b,t):
    u=max(0,min(1,(t-a)/(b-a)));return u*u*(3-2*u)

def carriage(t):
    # A deliberate inspection pass: left end, far end, return to parked trolley.
    stops=[(0,0),(1.5,-3),(3.2,1.35),(4.6,-1.8),(6,0)]
    for (a,x),(b,y) in zip(stops,stops[1:]):
        if t<=b:return x+(y-x)*smooth(a,b,t)
    return 0

def garden_growth(t,offset=0):
    t=max(0,t-offset)
    growth=.15*smooth(.3,1.5,t) if t<4.6 else .15+.85*smooth(4.6,10.5,t)
    return growth*(1-smooth(13.2,15.8,t))

def garden_ripe(t,offset=0):
    t=max(0,t-offset)
    return smooth(9.8,12.2,t)*(1-smooth(13.2,15.8,t))

def bind_animations(groups,parts,meshes,height,output):
    scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=1;scene.frame_end=541
    rest={name:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for name,o in groups.items()}
    keyed={}
    for name,obj in groups.items():
        keyed[obj]=parts[name]['clip']
        loc,rot,scale=rest[name]
        for frame in range(1,LAST+1,2):
            t=(frame-1)/FPS;u=t/6;wave=math.sin(math.tau*u);lift=.5-.5*math.cos(math.tau*u)
            obj.location=loc;obj.rotation_euler=rot;obj.scale=scale
            if name=='workshop_carriage':obj.location.x+=carriage(t)
            elif name.startswith('workshop_wheel_'):obj.rotation_euler.y-=carriage(t)/.13
            elif name=='workshop_sling':obj.rotation_euler.y+=.095*wave*(.3+.7*lift)
            elif name.startswith('gallery_vent_'):
                side=int(name.rsplit('_',1)[1])//2;obj.rotation_euler.y+=(1 if side else -1)*math.radians(16)*lift
            elif name.startswith('archive_iris_'):
                obj.rotation_euler.y+=math.radians(65)*lift
            elif name=='communications_dish':
                obj.rotation_euler.z+=math.radians(26)*wave;obj.rotation_euler.y+=math.radians(9)*lift
            elif name=='communications_beacon':obj.scale*=1+.3*lift
            elif name.startswith('pavilion_door_'):
                opened=smooth(0,1.2,t)*(1-smooth(4.2,6,t))
                obj.location.x+=(-1 if name.endswith('left') else 1)*.85*opened
            elif name=='pavilion_exhibit':obj.rotation_euler.z+=math.radians(25)*wave*lift
            elif name=='camp_chime':
                obj.rotation_euler.x+=.09*wave;obj.rotation_euler.y+=.06*math.sin(math.tau*u*2)
            elif name.startswith('cultivated_sprinkler_'):
                obj.rotation_euler.z+=.38*wave
            elif name.startswith('cultivated_drop_'):
                side=-1 if '_left_' in name else 1;k=int(name.rsplit('_',1)[1]);p=(t/1.5+k/18)%1
                # The nozzle and water share the same swivel parent: emission
                # always starts at the moving nozzle, not a world-space guess.
                obj.location+=Vector((-side*(.24+p*3.1),.22*math.sin(k*.8)*p,.1+1.7*math.sin(math.pi*p)-p*.72))
                obj.rotation_euler.y=side*(.8-1.6*p)
                # An exact zero makes Blender's GLB exporter bake singular child
                # matrices. A sub-pixel rest scale keeps the attached drop intact.
                obj.scale*=max(.001,max(0,math.sin(math.pi*p))*(smooth(0,.45,t)*(1-smooth(5.5,6,t))))
            if name=='camp_canopy' or name.startswith('cultivated_crop_'):continue
            for channel in ['location','rotation_euler','scale']:obj.keyframe_insert(channel,frame=frame)
    for zone in ['camp_canopy']+[name for name in parts if name.startswith('cultivated_crop_')]:
        for obj in meshes.get(zone,[]):
            obj.shape_key_add(name='Basis',from_mix=False)
            crop=zone.startswith('cultivated_crop_')
            offset=int(zone.rsplit('_',1)[1])*.25 if crop else 0
            anchors=obj.data.attributes.get('plant_root') if crop else None
            if crop:
                compress=obj.shape_key_add(name='Seed to mature',from_mix=False)
                for i,v in enumerate(compress.data):
                    anchor=anchors.data[i].vector;v.co=anchor+(v.co-anchor)*.10
                for frame in range(1,542,2):
                    t=(frame-1)/FPS;compress.value=1-garden_growth(t,offset);compress.keyframe_insert('value',frame=frame)
                if obj.name.endswith('_flower'):
                    hidden=obj.shape_key_add(name='Fruit ripening',from_mix=False)
                    for i,v in enumerate(hidden.data):
                        center=anchors.data[i].vector+Vector((.025,.015,.50));v.co=center+(v.co-center)*.01
                    for frame in range(1,542,2):
                        t=(frame-1)/FPS;g=.1+.9*garden_growth(t,offset)
                        hidden.value=g*(1-garden_ripe(t,offset));hidden.keyframe_insert('value',frame=frame)
            keys=[obj.shape_key_add(name='Wind A',from_mix=False),obj.shape_key_add(name='Wind B',from_mix=False)]
            for index,key in enumerate(keys):
                key.slider_min=-1;key.slider_max=1
                for vertex_index,v in enumerate(key.data):
                    w=obj.matrix_world@v.co
                    if zone=='camp_canopy':
                        x=w.x-3;y=w.y+13
                        pinned=abs(math.sin(math.pi*x/1.95))*max(0,math.sin(math.pi*(y+1.7)/3.4))
                        v.co.z+=.2*pinned*math.sin(x*2.3+y*(1.4+index))
                    else:
                        root=anchors.data[vertex_index].vector.z
                        weight=max(0,min(1.3,(w.z-root)/.50))**1.7
                        v.co.x+=.06*weight*math.sin(w.y*1.5+index*1.8)
                        v.co.y+=.025*weight*math.cos(w.x*1.3+index*1.5)
                for frame in range(1,(542 if crop else LAST+1),2):
                    t=(frame-1)/FPS;key.value=math.sin(math.tau*t/6*(index+1))*(.1+.9*garden_growth(t,offset) if crop else 1)
                    key.keyframe_insert('value',frame=frame)
            keyed[obj.data.shape_keys]=parts[zone]['clip']
    # Shared track names merge the articulated parts into seven destination clips.
    for owner,clip in keyed.items():
        ad=owner.animation_data
        if not ad or not ad.action:continue
        action=ad.action;slot=ad.action_slot;action.name=clip+'-'+owner.name
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:point.interpolation='LINEAR'
        track=ad.nla_tracks.new();track.name=clip
        strip=track.strips.new(clip,1,action);strip.action_slot=slot
        ad.action=None
    scene.frame_set(1);bpy.context.view_layer.update()
    # Explicit mechanical checks across every sampled frame, not just the rest pose.
    contacts=[]
    trolley=groups['workshop_carriage'];sling=groups['workshop_sling']
    sling_local=sling.location.copy();maximum=0
    for frame in range(1,LAST+1,2):
        scene.frame_set(frame);bpy.context.view_layer.update()
        expected=trolley.matrix_world@Vector(sling_local)
        actual=sling.matrix_world.translation
        maximum=max(maximum,(actual-expected).length)
        assert -14.2<=trolley.matrix_world.translation.x<=-9.7
    assert maximum<1e-5,maximum
    scene.frame_set(1)
    contacts.append({'pair':'original trolley / suspended cable top','maximum_endpoint_residual':maximum,'tolerance':1e-5})
    # Conservative mast envelope includes its tapered legs and every cross brace.
    # Checking every dish/feed vertex across the whole action catches the 9.png
    # defect and protects against a future rest-pose-only collision fix.
    minimum_clearance=float('inf');dish=groups['communications_dish']
    for frame in range(1,LAST+1,2):
        scene.frame_set(frame);bpy.context.view_layer.update()
        for mesh in meshes['communications_dish']:
            for vertex in mesh.data.vertices:
                world=mesh.matrix_world@vertex.co
                if 1.65<=world.z<=5.5:
                    mast_radius=.65-(world.z-1.65)*.35/3.8
                    minimum_clearance=min(minimum_clearance,world.x-(15+mast_radius))
    assert minimum_clearance>.12,minimum_clearance
    contacts.append({'pair':'moving dish and feed / mast envelope','minimum_clearance':minimum_clearance,'required_clearance':.12})
    stem=next(o for o in meshes['cultivated_crop_0'] if o.name.endswith('_leaf3'))
    anchors=stem.data.attributes['plant_root'].data
    heights=[];root_error=0
    for frame in [1,106,286,376,451,526,541]:
        scene.frame_set(frame);bpy.context.view_layer.update()
        evaluated=stem.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
        heights.append({'frame':frame,'height':max(v.co.z-anchors[i].vector.z for i,v in enumerate(evaluated.vertices))})
        for i,v in enumerate(stem.data.vertices):
            if abs(v.co.z-anchors[i].vector.z)<1e-6:
                root_error=max(root_error,abs(evaluated.vertices[i].co.z-anchors[i].vector.z))
    assert root_error<1e-5,root_error
    assert heights[3]['height']>heights[0]['height']*4,heights
    contacts.append({'pair':'crop roots / bed surface','maximum_endpoint_residual':root_error,'sampled_heights':heights})
    scene.frame_set(1)
    (output/'mechanical-checks.json').write_text(json.dumps({'fps':FPS,'frames':[1,46,91,136,181],
        'contacts':contacts,'clips':sorted(set(keyed.values())),'parts':list(parts)},indent=2),encoding='utf-8')
