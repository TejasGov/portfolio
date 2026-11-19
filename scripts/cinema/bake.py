"""Bake the hall in two lighting states and export it.
blender -b hall.blend --python bake.py -- <outdir> <size> <samples>
Writes: hall.glb (one mesh, UV = the bake atlas), hall_show.png, hall_house.png (sRGB of radiance * GAIN).
"""
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
OUT, SIZE, SAMPLES = a[0], int(a[1]), int(a[2])
import json, time
GAINS = {}  # stored = srgb(radiance * gain); the web shader divides it back out
W = lambda x, y, z: Vector((x, -z, y))
sc = bpy.context.scene

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'HIP'
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'HIP'
sc.render.engine = 'CYCLES'
sc.cycles.device = 'GPU'
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 6

# ---------------------------------------------------------------- one mesh, one atlas
hall = [o for o in bpy.data.collections['hall'].objects if o.type == 'MESH']
for o in bpy.context.view_layer.objects:
    o.select_set(False)
for o in hall:
    o.select_set(True)
bpy.context.view_layer.objects.active = hall[0]
bpy.ops.object.join()
H = bpy.context.view_layer.objects.active
H.name = 'hall'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
while H.data.uv_layers:
    H.data.uv_layers.remove(H.data.uv_layers[0])
uv = H.data.uv_layers.new(name='bake')
H.data.uv_layers.active = uv
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
print('HALL tris', sum(len(p.vertices) - 2 for p in H.data.polygons), 'materials', len(H.data.materials))

# ---------------------------------------------------------------- light states
light_objs = {o.name: o for o in bpy.data.objects if o.type == 'LIGHT'}
mats = {m.name: m for m in bpy.data.materials}

def emission(name, strength):
    mats[name].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = strength

def add_light(kind, name, at, energy, color, size=None, aim=None):
    d = bpy.data.lights.new(name, kind)
    d.energy, d.color = energy, color
    if size:
        d.shape = 'RECTANGLE'
        d.size, d.size_y = size
    o = bpy.data.objects.new(name, d)
    sc.collection.objects.link(o)
    o.location = W(*at)
    if aim is not None:
        o.rotation_euler = (W(*aim) - W(*at)).to_track_quat('-Z', 'Y').to_euler()
    light_objs[name] = o
    return o

# Booth practical (both states), ceiling downlights (house only).
add_light('POINT', 'booth_bulb', (-1.0, 9.6, -14.2), 60, (1.0, 0.7, 0.45))
downs = []
for x in (-7.5, -2.5, 2.5, 7.5):
    for z in (-8, -3.5, 1, 5.5, 10):
        top = 12.2
        downs.append(add_light('AREA', f'down_{x}_{z}', (x, top, z), 260, (1.0, 0.8, 0.58), size=(0.9, 0.9), aim=(x, 0, z)))

def state(name):
    house = name == 'house'
    light_objs['screen_glow'].hide_render = house
    light_objs['projector'].hide_render = house
    for o in downs:
        o.hide_render = not house
    emission('screen', 0.12 if house else 1.4)
    emission('steplight', 18.0)
    emission('sconce', 26.0 if house else 9.0)
    emission('exit', 8.0)

# ---------------------------------------------------------------- bake
def bake(name):
    img = bpy.data.images.new('bake_' + name, SIZE, SIZE, float_buffer=True)
    for m in H.data.materials:
        nt = m.node_tree
        n = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
        n.name = 'BAKE'
        n.image = img
        for k in nt.nodes:
            k.select = False
        n.select = True
        nt.nodes.active = n
    b = sc.render.bake
    b.target = 'IMAGE_TEXTURES'
    b.margin = 12
    b.use_pass_direct = b.use_pass_indirect = True
    b.use_pass_diffuse = b.use_pass_glossy = b.use_pass_transmission = b.use_pass_emit = True
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    H.select_set(True)
    bpy.context.view_layer.objects.active = H
    bpy.ops.object.bake(type='COMBINED')
    px = np.empty(SIZE * SIZE * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgb = px.reshape(SIZE, SIZE, 4)[..., :3]
    # Light denoise: 3x3 box blur weighted toward the centre (the bake margin keeps islands from bleeding).
    pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
    acc = np.zeros_like(rgb)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            w = 4 if (dy, dx) == (1, 1) else 1
            acc += pad[dy:dy + SIZE, dx:dx + SIZE] * w
    rgb = acc / 12.0
    # Log encoding: the room's surfaces (~0.001-0.05) and its light fittings (up to ~100) both keep detail
    # in 8 bits. The web decodes r = (exp(c * L) - 1) / A with L = log(1 + RMAX * A).
    A, RMAX = 1000.0, 120.0
    srgb = np.log1p(np.clip(rgb, 0, RMAX) * A) / np.log1p(RMAX * A)
    GAINS[name] = {'a': A, 'rmax': RMAX}
    out = bpy.data.images.new('out_' + name, SIZE, SIZE, alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    o4 = np.ones((SIZE, SIZE, 4), dtype=np.float32)
    o4[..., :3] = srgb
    out.pixels.foreach_set(o4.ravel())
    out.filepath_raw = os.path.join(OUT, f'hall_{name}.png')
    out.file_format = 'PNG'
    out.save()
    print('BAKED', name, 'radiance percentiles', [round(float(np.percentile(rgb.max(axis=2), q)), 4) for q in (10, 50, 90, 99)])

for st in ('show', 'house'):
    state(st)
    t0 = time.time()
    bake(st)
    print('TIME', st, round(time.time() - t0, 1))
json.dump(GAINS, open(os.path.join(OUT, 'hall_gains.json'), 'w'))

# ---------------------------------------------------------------- export the mesh only
for o in bpy.context.view_layer.objects:
    o.select_set(False)
H.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'hall.glb'), use_selection=True, export_format='GLB',
                          export_normals=False, export_materials='NONE', export_texcoords=True, export_apply=True)
print('EXPORTED')
