"""Bake fixed landscape contact shadows for the software-renderer path.
The atlas is static geometry, so baking avoids expensive per-frame PCF sampling
without removing any of its close-up geometry.
"""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'workbench-private'/'atlas-art'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/ronghuang-atlas.glb'))
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    if o.name.startswith('terrain_land'):
        o.is_shadow_catcher=True
    else:
        o.visible_camera=False
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.use_nodes=True;p=scene.world.node_tree.nodes.get('Background');p.inputs['Color'].default_value=(.8,.85,.8,1);p.inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(-20,-25,40));l=bpy.context.object;l.data.energy=18000;l.data.size=10;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-.001,65));c=bpy.context.object;c.data.type='ORTHO';c.data.ortho_scale=43.5;c.rotation_euler=(Vector((0,0,0))-c.location).to_track_quat('-Z','Y').to_euler();scene.camera=c
scene.render.resolution_x=1024;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=str(OUT/'shadow-bake.png');bpy.ops.render.render(write_still=True)
print('SHADOW_BAKE_COMPLETE')
