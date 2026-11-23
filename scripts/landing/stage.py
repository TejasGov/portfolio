"""Build, light and bake the landing demo's stage (the stone circle) and export it for the web.
blender -b --factory-startup --python scripts/landing/stage.py -- <outdir> <size> <samples>
Writes: stage.glb (two meshes, 'floor' and 'stones', with normals; UV0 = each one's light-map atlas), stage_stones.png
(size x size) and stage_floor.png (2048): light only, every surface baked as flat grey, log-encoded as
scripts/cinema/bake.py does; the web multiplies in photo-scanned textures. stage_meta.json: the decode gains, the
lanterns' positions (for the flicker) and where each standing stone meets the floor (for the grass). STAGE_PREVIEW=1 also renders preview*.png.
Coordinates are written in web space (y up, the camera out on +z) and converted with W().

The scene: a ring of weathered trilithons (uprights joined by lintels, two lintels fallen) round a sunken pool, open
toward the camera, two great dark stones framing the foreground, a lower broken ring beyond. The pool's rim is laid
from rough stone blocks. Two uprights carry an iron lantern. Light: moonlight from high behind, a broad cool fill
from the camera's side, the bust's own glow (a point light where the web floats it), the lanterns' flames.
The rock: cracked, pitted, streaked and edge-worn (procedural, baked with the light, so the detail is in the bake).
"""
import bpy, bmesh, sys, os, math, json, random, time
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
OUT, SIZE, SAMPLES = a[0], int(a[1]), int(a[2])
os.makedirs(OUT, exist_ok=True)
random.seed(23)
W = lambda x, y, z: Vector((x, -z, y))  # web (y up, +z toward the camera) -> Blender (z up)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'HIP'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'HIP'
    sc.cycles.device = 'GPU' if any(d.use for d in prefs.devices) else 'CPU'
except Exception:
    sc.cycles.device = 'CPU'
print('DEVICE', sc.cycles.device)
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 4

world = bpy.data.worlds.new('sky')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.014, 0.03, 1)
sc.world = world


# ---------------------------------------------------------------- materials
def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def ramp(nt, src, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (*col, 1)
    nt.links.new(src, r.inputs['Fac'])
    return r


def mul(nt, a, b, kind='MULTIPLY'):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    m.blend_type = kind
    m.inputs['Factor'].default_value = 1.0
    nt.links.new(a, m.inputs[6])
    nt.links.new(b, m.inputs[7])
    return m.outputs[2]


def rock(name, base, tint=(0.93, 0.96, 1.0)):
    """Weathered stone: broad tone, dark stains, vertical rain streaks, worn bright edges, cracks; a bump built from the
    cracks and two scales of grain. All of it bakes into the light map, so the web gets the detail for free."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.86
    tc = nt.nodes.new('ShaderNodeTexCoord').outputs['Object']
    c = lambda k: tuple(base * k * t for t in tint)
    broad = nt.nodes.new('ShaderNodeTexNoise')
    broad.inputs['Scale'].default_value = 0.35
    broad.inputs['Detail'].default_value = 6
    nt.links.new(tc, broad.inputs['Vector'])
    col = ramp(nt, broad.outputs['Fac'], [(0.28, c(0.45)), (0.5, c(1.0)), (0.74, c(1.6))]).outputs['Color']
    stain = nt.nodes.new('ShaderNodeTexNoise')
    stain.inputs['Scale'].default_value = 2.2
    stain.inputs['Detail'].default_value = 5
    nt.links.new(tc, stain.inputs['Vector'])
    col = mul(nt, col, ramp(nt, stain.outputs['Fac'], [(0.45, (0.62, 0.62, 0.62)), (0.62, (1, 1, 1))]).outputs['Color'])
    stretch = nt.nodes.new('ShaderNodeMapping')
    stretch.inputs['Scale'].default_value = (7, 7, 0.6)  # streaks run down the stone (Blender z is up)
    nt.links.new(tc, stretch.inputs['Vector'])
    streak = nt.nodes.new('ShaderNodeTexNoise')
    streak.inputs['Scale'].default_value = 1.0
    streak.inputs['Detail'].default_value = 4
    nt.links.new(stretch.outputs['Vector'], streak.inputs['Vector'])
    col = mul(nt, col, ramp(nt, streak.outputs['Fac'], [(0.35, (0.78, 0.8, 0.84)), (0.6, (1, 1, 1))]).outputs['Color'])
    edge = nt.nodes.new('ShaderNodeNewGeometry').outputs['Pointiness']
    col = mul(nt, col, ramp(nt, edge, [(0.5, (1, 1, 1)), (0.58, (1.6, 1.6, 1.6))]).outputs['Color'])
    # Fissures: a few thin, wandering cracks running down the stone (a contour of noise stretched along the height).
    tall = nt.nodes.new('ShaderNodeMapping')
    tall.inputs['Scale'].default_value = (1.4, 1.4, 0.22)
    nt.links.new(tc, tall.inputs['Vector'])
    fis = nt.nodes.new('ShaderNodeTexNoise')
    fis.inputs['Scale'].default_value = 1.0
    fis.inputs['Detail'].default_value = 6
    fis.inputs['Distortion'].default_value = 0.6
    nt.links.new(tall.outputs['Vector'], fis.inputs['Vector'])
    crackline = ramp(nt, fis.outputs['Fac'], [(0.485, (1, 1, 1)), (0.5, (0, 0, 0)), (0.515, (1, 1, 1))]).outputs['Color']
    col = mul(nt, col, ramp(nt, fis.outputs['Fac'], [(0.48, (1, 1, 1)), (0.5, (0.3, 0.3, 0.3)), (0.52, (1, 1, 1))]).outputs['Color'])
    # Pitting: small dark hollows weathered into the face.
    pits = nt.nodes.new('ShaderNodeTexVoronoi')
    pits.inputs['Scale'].default_value = 7
    pits.inputs['Randomness'].default_value = 1.0
    nt.links.new(tc, pits.inputs['Vector'])
    col = mul(nt, col, ramp(nt, pits.outputs['Distance'], [(0.0, (0.55, 0.55, 0.55)), (0.12, (1, 1, 1))]).outputs['Color'])
    nt.links.new(col, bsdf.inputs['Base Color'])
    grain = nt.nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 9
    grain.inputs['Detail'].default_value = 14
    grain.inputs['Roughness'].default_value = 0.62
    nt.links.new(tc, grain.inputs['Vector'])
    fine = nt.nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = 45
    fine.inputs['Detail'].default_value = 8
    nt.links.new(tc, fine.inputs['Vector'])
    h = nt.nodes.new('ShaderNodeMath')
    h.operation = 'MULTIPLY_ADD'
    nt.links.new(grain.outputs['Fac'], h.inputs[0])
    h.inputs[1].default_value = 0.5
    nt.links.new(fine.outputs['Fac'], h.inputs[2])
    hc = nt.nodes.new('ShaderNodeMath')
    hc.operation = 'MULTIPLY_ADD'
    nt.links.new(crackline, hc.inputs[0])  # the cracks cut in
    hc.inputs[1].default_value = 0.45
    nt.links.new(h.outputs[0], hc.inputs[2])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.9
    bump.inputs['Distance'].default_value = 0.06
    nt.links.new(hc.outputs[0], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


ROCK = rock('rock', 0.11)
RIM = rock('rim', 0.075)
FLOOR = bpy.data.materials.new('floor')  # the web draws the slabs; the floor only carries light
FLOOR.use_nodes = True
FLOOR.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.09, 0.095, 0.105, 1)
IRON = bpy.data.materials.new('iron')
IRON.use_nodes = True
IRON.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.025, 0.022, 0.02, 1)
IRON.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.55
GLASS = bpy.data.materials.new('lantern_glass')  # the flame behind the glass: it bakes as emission
GLASS.use_nodes = True
_e = GLASS.node_tree.nodes.new('ShaderNodeEmission')
_e.inputs['Color'].default_value = (1.0, 0.62, 0.3, 1)
_e.inputs['Strength'].default_value = 4
GLASS.node_tree.links.new(_e.outputs[0], GLASS.node_tree.nodes['Material Output'].inputs[0])
CHUNK = bpy.data.textures.new('chunk', 'CLOUDS')  # big lumps and hollows
CHUNK.noise_scale = 0.9
CHUNK.noise_depth = 3
FACET = bpy.data.textures.new('facet', 'VORONOI')  # flat broken facets, like split stone
FACET.noise_scale = 0.45
CHIPS = bpy.data.textures.new('chips', 'CLOUDS')  # the rim's chipped edges: finer
CHIPS.noise_scale = 0.14
CHIPS.noise_depth = 3


# ---------------------------------------------------------------- geometry
def weather(o, levels, displace, decimate=1.0):
    """Subdivide, then push the surface about: (texture, strength) pairs, applied in order."""
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('sub', 'SUBSURF')
    mod.subdivision_type = 'SIMPLE'
    mod.levels = levels
    bpy.ops.object.modifier_apply(modifier='sub')
    for tex, strength in displace:
        mod = o.modifiers.new('d', 'DISPLACE')
        mod.texture = tex
        mod.texture_coords = 'GLOBAL'
        mod.strength = strength
        bpy.ops.object.modifier_apply(modifier='d')
    if decimate < 1:  # keep the sculpted silhouette, drop the flat-area triangles (the bake carries the fine detail)
        mod = o.modifiers.new('dec', 'DECIMATE')
        mod.ratio = decimate
        bpy.ops.object.modifier_apply(modifier='dec')


def block(name, x, y, z, w, d, h, yaw, mat, tilt=(0, 0), bevel=0.0, rough=None):
    """A box centred at web (x, y, z), w across, d deep and h tall, turned by yaw about the vertical; rough =
    (levels, [(texture, strength), ...]) weathers it."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=W(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, d, h)
    o.rotation_euler = (tilt[0], tilt[1], yaw)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier='bevel')
    if rough:
        weather(o, *rough)
    o.data.materials.append(mat)
    return o


STONE = (3, [(CHUNK, 0.3), (FACET, 0.12)], 0.22)


FEET = []  # where each standing stone meets the floor (web x, z, width, depth, yaw): the web grows grass there


def upright(name, x, z, w, d, h, yaw, tilt=(0, 0)):
    FEET.append([round(x, 3), round(z, 3), round(w, 3), round(d, 3), round(yaw, 4)])
    return block(name, x, h / 2, z, w, d, h, yaw, ROCK, tilt, bevel=0.16, rough=STONE)


def sector(name, r1, r2, a0, a1, h, n=8):
    """One block of the pool's rim: a curved slab between radii r1 and r2, angles a0..a1 (Blender's xy plane)."""
    bm = bmesh.new()
    prof = [(r1, 0), (r2, 0), (r2, h), (r1, h)]
    cols = []
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        cols.append([bm.verts.new((r * math.cos(t), r * math.sin(t), zz)) for r, zz in prof])
    for i in range(n):
        A, B = cols[i], cols[i + 1]
        for k in range(4):
            bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    bm.faces.new(cols[0][::-1])
    bm.faces.new(cols[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    for k in bpy.context.view_layer.objects:
        k.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = 0.035
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier='bevel')
    weather(o, 2, [(CHIPS, 0.05)], 0.5)
    o.data.materials.append(RIM)
    return o


def prim(kind, loc, yaw, mat, **kw):
    """A primitive at web loc, turned by yaw about the vertical (kw: its size)."""
    getattr(bpy.ops.mesh, f'primitive_{kind}_add')(location=W(*loc), **kw)
    o = bpy.context.active_object
    o.rotation_euler[2] += yaw
    o.data.materials.append(mat)
    return o


LANTERN_Y = 2.3


def lantern(k, at, o0, yaw):
    """An iron lantern on a scrolled bracket, out from a stone's face: returns its parts."""
    out = o0 + 0.42  # the lantern's axis, out from the face
    y = LANTERN_Y
    P = []
    P.append(prim('cylinder', at(out, y), yaw, GLASS, vertices=6, radius=0.092, depth=0.24))
    frame = prim('cylinder', at(out, y), yaw, IRON, vertices=6, radius=0.1, depth=0.26)
    mod = frame.modifiers.new('bars', 'WIREFRAME')
    mod.thickness = 0.014
    bpy.ops.object.modifier_apply(modifier='bars')
    P.append(frame)
    P.append(prim('cylinder', at(out, y - 0.14), yaw, IRON, vertices=6, radius=0.125, depth=0.03))
    P.append(prim('cone', at(out, y - 0.185), yaw, IRON, vertices=6, radius1=0.02, radius2=0.1, depth=0.06))
    P.append(prim('cylinder', at(out, y + 0.14), yaw, IRON, vertices=6, radius=0.14, depth=0.025))
    P.append(prim('cone', at(out, y + 0.2), yaw, IRON, vertices=6, radius1=0.14, radius2=0.03, depth=0.11))
    P.append(prim('uv_sphere', at(out, y + 0.262), yaw, IRON, segments=10, ring_count=6, radius=0.028))
    ring = prim('torus', at(out, y + 0.31), yaw, IRON, major_radius=0.034, minor_radius=0.007, major_segments=16, minor_segments=6)
    ring.rotation_euler[0] = math.pi / 2
    P.append(ring)
    P.append(block(f'plate{k}', *at(o0 - 0.01, y + 0.3), 0.12, 0.03, 0.36, yaw, IRON, bevel=0.008))
    P.append(block(f'arm{k}', *at(o0 + 0.24, y + 0.45), 0.035, 0.52, 0.035, yaw, IRON))
    stay = block(f'stay{k}', *at(o0 + 0.13, y + 0.3), 0.028, 0.36, 0.028, yaw, IRON)
    stay.rotation_euler[0] -= math.radians(40)  # from low on the plate up to the arm
    P.append(stay)
    scroll = prim('torus', at(out, y + 0.39), yaw, IRON, major_radius=0.05, minor_radius=0.008, major_segments=20, minor_segments=6)
    scroll.rotation_euler[0] = math.pi / 2
    scroll.rotation_euler[2] = yaw + math.pi / 2
    P.append(scroll)
    for o in P:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        o.select_set(False)
    return P


# ---------------------------------------------------------------- the circle
parts = []
R = 8.4  # the inner ring's radius (to the stones' centres)
N = 14   # uprights, spread over 300 degrees: the gap faces the camera
# Seven a side, from 150 degrees round to 26 either side of straight back: the sky stays open behind the bust's head.
ANG = [math.radians(-150 + 124 * i / 6) for i in range(7)] + [math.radians(26 + 124 * i / 6) for i in range(7)]
LANTERN_ON = (3, 10)
FALLEN = {2, 6, 11}  # no lintel over the gap behind the bust (6); two more have fallen: a ruin, not a set
tops, lanterns = [], []
for i, ang in enumerate(ANG):
    w, d = random.uniform(1.7, 2.1), random.uniform(0.95, 1.15)
    h = random.uniform(4.7, 5.2)
    x, z = R * math.sin(ang), -R * math.cos(ang)
    tilt = (0, 0) if i in LANTERN_ON else (math.radians(random.uniform(-1.5, 1.5)), math.radians(random.uniform(-1.5, 1.5)))
    if i in LANTERN_ON:
        lanterns.append((x, z, ang, d))
    parts.append(upright(f'up{i}', x, z, w, d, h, -ang, tilt))
    tops.append(h)
for i in range(N - 1):
    if i in FALLEN:
        continue
    a0, a1 = ANG[i], ANG[i + 1]
    am = (a0 + a1) / 2
    chord = 2 * R * math.sin((a1 - a0) / 2)
    top = max(tops[i], tops[i + 1])
    Rm = R * math.cos((a1 - a0) / 2)
    parts.append(block(f'lintel{i}', Rm * math.sin(am), top + 0.38, -Rm * math.cos(am), chord + 0.9, 1.0, 0.76, -am, ROCK,
                       (math.radians(random.uniform(-1.5, 1.5)), math.radians(random.uniform(-2.5, 2.5))), bevel=0.12, rough=STONE))
# Two great dark stones framing the foreground, and a lower broken ring far beyond.
for k, sx in enumerate((-1, 1)):
    parts.append(upright(f'frame{k}', sx * 7.8, 8.6, 2.6, 1.6, 9.5, sx * math.radians(14)))
for i in range(18):
    ang = math.radians(-155 + 310 * i / 17 + random.uniform(-4, 4))
    Ro = random.uniform(17, 20)
    parts.append(upright(f'outer{i}', Ro * math.sin(ang), -Ro * math.cos(ang), random.uniform(1.0, 1.8), random.uniform(0.6, 0.9),
                         random.uniform(2.0, 4.5), -ang, (math.radians(random.uniform(-6, 6)), math.radians(random.uniform(-6, 6)))))
# The pool's rim: 22 rough blocks with thin joints.
for i in range(22):
    a0 = 2 * math.pi * i / 22 + 0.006
    a1 = 2 * math.pi * (i + 1) / 22 - 0.006
    parts.append(sector(f'rim{i}', 2.35, random.uniform(2.95, 3.1), a0, a1, random.uniform(0.15, 0.22)))
# The lanterns, on the inner faces of two uprights.
lantern_at = []
for k, (x, z, ang, d) in enumerate(lanterns):
    nx, nz = -math.sin(ang), math.cos(ang)  # the stone's inner face, toward the centre
    at = lambda out, y, x=x, z=z, nx=nx, nz=nz: (x + nx * out, y, z + nz * out)
    o0 = d / 2 + 0.2  # clear of the weathered face
    lantern_at.append([round(v, 3) for v in at(o0 + 0.42, LANTERN_Y)])
    parts += lantern(k, at, o0, -ang)

for o in bpy.context.view_layer.objects:
    o.select_set(False)
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
stones = bpy.context.view_layer.objects.active
stones.name = 'stones'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.002, area_weight=0.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
print('STONES tris', sum(len(p.vertices) - 2 for p in stones.data.polygons))

# ---------------------------------------------------------------- the floor: one disk, UV from above
FR = 30.0
bpy.ops.mesh.primitive_circle_add(vertices=128, radius=FR, fill_type='TRIFAN', location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = 'floor'
floor.data.materials.append(FLOOR)
bm = bmesh.new()
bm.from_mesh(floor.data)
uvl = bm.loops.layers.uv.new('bake')
for f in bm.faces:
    for loop in f.loops:
        c = loop.vert.co
        loop[uvl].uv = (c.x / (2 * FR) + 0.5, c.y / (2 * FR) + 0.5)
bm.to_mesh(floor.data)


# ---------------------------------------------------------------- light
def lamp(kind, name, loc, energy, color, size):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size
    else:
        d.shadow_soft_size = size
    o = bpy.data.objects.new(name, d)
    o.location = loc
    sc.collection.objects.link(o)
    return o


def aim(o, at):
    o.rotation_euler = (at - o.location).normalized().to_track_quat('-Z', 'Y').to_euler()


lamp('POINT', 'bust', W(0, 3.2, 0), 380, (0.7, 0.85, 1.0), 1.0)  # the bust's own glow
for k, c in enumerate(lantern_at):
    lamp('POINT', f'lantern{k}', W(*c), 140, (1.0, 0.6, 0.28), 0.12)  # a flame's warm, close light
moon = lamp('SUN', 'moon', W(0, 10, 0), 0.9, (0.6, 0.72, 1.0), 0)
moon.data.angle = math.radians(2)
moon.rotation_euler = W(0.35, -0.75, 0.55).normalized().to_track_quat('-Z', 'Y').to_euler()  # from high behind
aim(lamp('AREA', 'fill', W(0, 6, 24), 1500, (0.65, 0.75, 1.0), 22), W(0, 3, 0))  # soft sky from the camera's side

# ---------------------------------------------------------------- bake
A, RMAX = 400.0, 10.0  # the web decodes r = (exp(c * L) - 1) / A, L = log(1 + RMAX * A)


GREY = 0.25  # every surface bakes as this flat grey, so the map is light alone (x GREY); the web divides it back out


def flatten(o):
    """The light map must carry light, not colour or bump: the web brings its own photo textures and normal maps."""
    for m in o.data.materials:
        nt = m.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        if not bsdf:
            continue  # the lanterns' glass: emission, kept
        for socket in ('Base Color', 'Normal'):
            for l in list(bsdf.inputs[socket].links):
                nt.links.remove(l)
        bsdf.inputs['Base Color'].default_value = (GREY, GREY, GREY, 1)


def bake(o, name, size):
    flatten(o)
    img = bpy.data.images.new('bake_' + name, size, size, float_buffer=True)
    for m in o.data.materials:
        nt = m.node_tree
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        for k in nt.nodes:
            k.select = False
        n.select = True
        nt.nodes.active = n
    b = sc.render.bake
    b.target = 'IMAGE_TEXTURES'
    b.margin = 8
    b.use_pass_direct = b.use_pass_indirect = True
    b.use_pass_diffuse = b.use_pass_glossy = b.use_pass_transmission = b.use_pass_emit = True
    for k in bpy.context.view_layer.objects:
        k.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    t0 = time.time()
    bpy.ops.object.bake(type='COMBINED')
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgb = px.reshape(size, size, 4)[..., :3]
    pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')  # light denoise: 3x3, weighted to the centre
    acc = np.zeros_like(rgb)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            acc += pad[dy:dy + size, dx:dx + size] * (6 if (dy, dx) == (1, 1) else 1)
    rgb = acc / 14.0
    enc = np.log1p(np.clip(rgb, 0, RMAX) * A) / np.log1p(RMAX * A)
    out = bpy.data.images.new('out_' + name, size, size, alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    o4 = np.ones((size, size, 4), dtype=np.float32)
    o4[..., :3] = enc
    out.pixels.foreach_set(o4.ravel())
    out.filepath_raw = os.path.join(OUT, f'stage_{name}.png')
    out.file_format = 'PNG'
    out.save()
    print('BAKED', name, round(time.time() - t0, 1), 's; radiance percentiles',
          [round(float(np.percentile(rgb.max(axis=2), q)), 4) for q in (10, 50, 90, 99)])


bake(stones, 'stones', SIZE)
bake(floor, 'floor', 2048)
json.dump({'a': A, 'rmax': RMAX, 'grey': GREY, 'lanterns': lantern_at, 'feet': FEET}, open(os.path.join(OUT, 'stage_meta.json'), 'w'))

for k in bpy.context.view_layer.objects:
    k.select_set(False)
stones.select_set(True)
floor.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'stage.glb'), use_selection=True, export_format='GLB',
                          export_normals=True, export_materials='NONE', export_texcoords=True, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
print('EXPORTED')

# ---------------------------------------------------------------- previews from the web's rest camera (not exported)
if os.environ.get('STAGE_PREVIEW'):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.9, location=W(0, 3.2, 0))
    glow = bpy.data.materials.new('glow')
    glow.use_nodes = True
    e = glow.node_tree.nodes.new('ShaderNodeEmission')
    e.inputs['Strength'].default_value = 3
    glow.node_tree.links.new(e.outputs[0], glow.node_tree.nodes['Material Output'].inputs[0])
    bpy.context.active_object.data.materials.append(glow)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.sensor_fit = 'VERTICAL'
    sc.render.resolution_x, sc.render.resolution_y = 1376, 768
    sc.cycles.samples = 96
    for name, at_, look, fov in (('preview', (0, 1.8, 13.5), (0, 2.4, 0), 38), ('preview_close', (2.5, 1.6, 4.5), (5.5, 2.2, -4.5), 40)):
        cam.location = W(*at_)
        aim(cam, W(*look))
        cam.data.angle = math.radians(fov)
        sc.render.filepath = os.path.join(OUT, f'{name}.png')
        bpy.ops.render.render(write_still=True)
    print('PREVIEW')
