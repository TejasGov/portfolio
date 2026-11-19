"""Render hall.blend from a web-space camera. blender -b hall.blend --python preview.py -- out.png cx cy cz tx ty tz [samples]"""
import bpy, sys, math
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out = a[0]
cx, cy, cz, tx, ty, tz = map(float, a[1:7])
samples = int(a[7]) if len(a) > 7 else 64
W = lambda x, y, z: Vector((x, -z, y))

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'HIP'
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'HIP'
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'GPU'
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1280, 800
sc.view_settings.view_transform = 'AgX'
sc.view_settings.exposure = 1.0

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.sensor_fit = 'VERTICAL'
cam.data.angle = math.radians(42)
cam.location = W(cx, cy, cz)
cam.rotation_euler = (W(tx, ty, tz) - W(cx, cy, cz)).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
