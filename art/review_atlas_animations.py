"""Fresh GLB import, mechanism frames from two cameras and continuous connector checks."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'workbench-private/atlas-seasons-20261011/critical-frames';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/ronghuang-atlas.glb'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=800;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.75,.8,.73,1);bg.inputs['Strength'].default_value=.8
for pos,power,size in [((-20,-25,40),18000,25),((20,15,30),9000,20)]:
    bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.size=size
    light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera
owners=[o for o in bpy.data.objects if o.animation_data]+[m.shape_keys for m in bpy.data.meshes if m.shape_keys and m.shape_keys.animation_data]
def activate(key):
    for owner in owners:
        ad=owner.animation_data
        ad.action=None
        for track in ad.nla_tracks:track.mute=track.name!=key
    scene.frame_set(1);bpy.context.view_layer.update()
views={'skills':(-12,6.2,2,9),'character':(0,-.6,1.6,9),'works':(13,10.2,2,8),
 'timeline':(-11,-10.2,2.6,6),'recent':(3,-13,1.8,7),'friends':(15,-3,3.5,8),'about':(0,14,1,12)}
records=[]
for key,(x,y,z,scale) in views.items():
    only=next((v.split('=',1)[1].split(',') for v in sys.argv if v.startswith('--only=')),None)
    if only and key not in only:continue
    activate(key)
    for view,offset in [('overview',(0,-12,8)),('detail',(8,-10,7))]:
        camera.location=Vector((x,y,z))+Vector(offset)
        camera.rotation_euler=(Vector((x,y,z))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
        for frame in ([1,106,286,376,451,526,541] if key=='about' else [1,46,91,136,181]):
            scene.frame_set(frame);scene.render.filepath=str(OUT/f'{key}-{view}-{frame:03}.png')
            bpy.ops.render.render(write_still=True)
            records.append({'clip':key,'view':view,'frame':frame,'file':scene.render.filepath})
(OUT/'frames.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print('ANIMATION_CRITICAL_FRAMES_COMPLETE',len(records))
