"""Compress Meshy GLBs for the web with Blender's own glTF exporter (Draco geometry, WebP textures).
blender -b --factory-startup --python compress.py -- <out.glb> <max_texture_px> <in.glb> [<extra_anim.glb>=<ActionName> ...]

Extra GLBs given as path=Name contribute only their animation (same rig, same bone names), renamed (or
path=* to keep their names), so a character and all its clips ship as one file.
"""
import bpy, sys

a = sys.argv[sys.argv.index('--') + 1:]
OUT, MAXPX, SRC, EXTRA = a[0], int(a[1]), a[2], a[3:]

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=SRC)
keep = set(bpy.data.objects)

for spec in EXTRA:
    path, name = spec.split('=')
    before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    for act in set(bpy.data.actions) - before:
        if name != '*':  # path=* keeps the file's own clip names (a multi-clip file)
            act.name = name
        act.use_fake_user = True
    # Drop the extra file's own armature and mesh: only its clip is wanted.
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)

# Smaller textures: the films and the journey never show them larger than this.
for img in bpy.data.images:
    if img.size[0] > MAXPX or img.size[1] > MAXPX:
        img.scale(MAXPX, MAXPX)

has_anim = len(bpy.data.actions) > 0
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='WEBP', export_image_quality=82,
    export_animations=has_anim, export_animation_mode='ACTIONS',
)
print('COMPRESSED', OUT, 'actions', [x.name for x in bpy.data.actions])
