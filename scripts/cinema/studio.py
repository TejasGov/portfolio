"""Studio render of GLBs: blender -b --factory-startup --python studio.py -- outdir a.glb b.glb ..."""
import bpy, sys, os, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out, files = a[0], a[1:]
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'HIP'
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'HIP'

for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'HIP'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'HIP'
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 720
    sc.view_settings.view_transform = 'AgX'
    bpy.ops.import_scene.gltf(filepath=f)
    meshes = [o for o in sc.objects if o.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    ctr, size = (lo + hi) / 2, max(hi - lo)
    world = bpy.data.worlds.new('w'); sc.world = world
    world.color = (0.18, 0.18, 0.2)
    for name, loc, en, col in (('key', (2, -2, 2.5), 900, (1, 0.95, 0.9)), ('fill', (-2.5, -1, 1), 250, (0.8, 0.85, 1)), ('rim', (0, 3, 2), 600, (0.7, 0.8, 1))):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = en * size * size; L.color = col; L.size = size
        o = bpy.data.objects.new(name, L); sc.collection.objects.link(o)
        o.location = ctr + Vector(loc) * size
        o.rotation_euler = (ctr - o.location).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.angle = math.radians(35)
    cam.location = ctr + Vector((1.3, -1.9, 0.75)).normalized() * size * 2.0
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    name = os.path.splitext(os.path.basename(f))[0]
    sc.render.filepath = os.path.join(out, f'studio_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('STUDIO', name, 'tris', tris, 'size', tuple(round(v, 3) for v in (hi - lo)))
