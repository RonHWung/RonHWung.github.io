"""Fresh-import visual QA with lighting scaled to a 42-unit landscape.
The generic asset tool's small-prop lighting is retained separately as evidence;
this script produces usable landscape and district close-up inspection views.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'workbench-private'/'atlas-art'/'landscape-evidence';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/ronghuang-atlas.glb'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.world.use_nodes=True
background=scene.world.node_tree.nodes.get('Background');background.inputs['Color'].default_value=(.74,.79,.73,1);background.inputs['Strength'].default_value=.8
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for pos,power,size in [((-25,-18,45),18000,28),((25,20,28),9000,22)]:
    bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.size=size;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();c=bpy.context.object;c.data.type='ORTHO';scene.camera=c
views=[('hero',(31,-44,38),(0,0,.5),51),('front',(0,-55,5),(0,0,1.5),46),('back',(0,55,5),(0,0,1.5),46),('left',(-55,0,5),(0,0,1.5),46),('right',(55,0,5),(0,0,1.5),46),('top',(0,-.01,65),(0,0,0),46)]
for name,(x,y) in {'pavilion':(0,0),'workshop':(-12,6.2),'gallery':(13,10.2),'archive':(-11,-10.2),'camp':(3,-13),'communications':(15,-3)}.items():
    views.append((name,(x+9,y-12,11),(x,y,1.3),12))
for name,pos,target,scale in views:
    c.location=pos;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
(OUT/'evidence.json').write_text(json.dumps({'source':'public/models/ronghuang-atlas.glb','fresh_import':True,'lighting':'area energy scaled for 41.53-unit landscape plus world fill','views':[v[0] for v in views]},indent=2),encoding='utf-8')
print('LANDSCAPE_REVIEW_COMPLETE')
