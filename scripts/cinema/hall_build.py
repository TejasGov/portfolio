"""Build the cinema hall (architecture only) and save hall.blend.
Coordinates match src/lab/beam.js: +Y up, the screen at +Z, the booth wall at -Z.
Blender is Z-up, so we build in Blender space (x, y=-z_web, z=y_web) via W().
run: blender -b --factory-startup --python hall_build.py -- <outdir>
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUT, exist_ok=True)

def W(x, y, z):
    """web (x, y-up, z-toward-screen) -> blender (x, y, z-up)."""
    return Vector((x, -z, y))

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

ROWS, ROW_D, ROW_H, Z0 = 15, 1.02, 0.346, 4.4
BOOTH_Z, SCREEN_Z, WALL_X, CEIL = -11.5, 15.5, 11.0, 12.5

# ------------------------------------------------------------------ materials
def mat(name, color, rough=0.8, emit=None, strength=0.0, noise=0.0, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if noise:
        # Fabric / carpet variation: noise darkens and lightens the base colour a little.
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 60.0
        tex.inputs['Detail'].default_value = 8.0
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.inputs['Factor'].default_value = noise
        mix.inputs['A'].default_value = (*color, 1)
        mix.inputs['B'].default_value = (color[0] * 1.8, color[1] * 1.8, color[2] * 1.8, 1)
        nt.links.new(tex.outputs['Fac'], mix.inputs['Factor'])
        nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    return m

M = {
    'carpet': mat('carpet', (0.03, 0.012, 0.016), 0.95, noise=0.35),
    'riser': mat('riser', (0.022, 0.012, 0.016), 0.95, noise=0.3),
    'wall': mat('wall', (0.012, 0.013, 0.017), 0.9),
    'panel': mat('panel', (0.035, 0.04, 0.055), 0.92, noise=0.25),
    'ceiling': mat('ceiling', (0.01, 0.011, 0.014), 0.9),
    'baffle': mat('baffle', (0.03, 0.033, 0.042), 0.85),
    'booth': mat('booth', (0.03, 0.032, 0.04), 0.85, noise=0.2),
    'masking': mat('masking', (0.004, 0.004, 0.005), 0.98),
    'screen': mat('screen', (0.75, 0.77, 0.8), 0.9, emit=(0.62, 0.74, 1.0), strength=1.4),
    'curtain': mat('curtain', (0.32, 0.02, 0.04), 0.7, noise=0.3),
    'steplight': mat('steplight', (1, 0.6, 0.3), 0.5, emit=(1.0, 0.55, 0.22), strength=18.0),
    'sconce': mat('sconce', (1, 0.7, 0.4), 0.5, emit=(1.0, 0.62, 0.32), strength=10.0),
    'exit': mat('exit', (0.2, 1, 0.4), 0.5, emit=(0.15, 1.0, 0.35), strength=8.0),
    'door': mat('door', (0.02, 0.02, 0.025), 0.6),
    'brass': mat('brass', (0.6, 0.42, 0.18), 0.35, metal=1.0),
}

coll = bpy.data.collections.new('hall')
bpy.context.scene.collection.children.link(coll)
bake_only = bpy.data.collections.new('bake_only')  # seat proxies: cast shadows in the bake, never exported
bpy.context.scene.collection.children.link(bake_only)

def box(name, center, size, material, c=coll):
    """Axis-aligned box, center/size given in web space."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        # Scale per axis (web x -> blender x, web z -> blender y, web y -> blender z) without swapping
        # coordinates: a swap would mirror the box and turn its normals inward, which ruins baking.
        v.co = Vector((v.co.x * size[0], v.co.y * size[2], v.co.z * size[1]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = W(*center)
    me.materials.append(material)
    c.objects.link(o)
    return o

# ------------------------------------------------------------------ stadium rake
# Each row is a platform; its riser faces the screen. Rows run the full width between the walls.
for r in range(ROWS):
    z_front = Z0 + 0.5 - r * ROW_D
    top = r * ROW_H
    box(f'step_{r:02d}', (0, top / 2 - 0.05, z_front - ROW_D / 2), (WALL_X * 2, top + 0.1, ROW_D), M['carpet'])
# Back landing up to the booth wall.
last_top = (ROWS - 1) * ROW_H
z_back = Z0 + 0.5 - ROWS * ROW_D
box('landing', (0, last_top / 2 - 0.05, (z_back + BOOTH_Z) / 2), (WALL_X * 2, last_top + 0.1, z_back - BOOTH_Z), M['carpet'])
# Flat front floor to the screen.
box('front_floor', (0, -0.1, (Z0 + 0.5 + SCREEN_Z) / 2), (WALL_X * 2, 0.2, SCREEN_Z - Z0 - 0.5), M['carpet'])

# Aisle step lights: little warm strips on the nose of every riser, centre aisle and both side aisles.
for r in range(1, ROWS):
    z_front = Z0 + 0.5 - r * ROW_D
    for x in (-0.55, 0.55, -10.3, 10.3):
        box(f'steplight_{r}_{x}', (x, r * ROW_H - 0.05, z_front + 0.005), (0.22, 0.02, 0.01), M['steplight'])

# ------------------------------------------------------------------ walls, ceiling
box('wall_L', (-WALL_X - 0.1, CEIL / 2, (BOOTH_Z + SCREEN_Z) / 2), (0.2, CEIL, SCREEN_Z - BOOTH_Z), M['wall'])
box('wall_R', (WALL_X + 0.1, CEIL / 2, (BOOTH_Z + SCREEN_Z) / 2), (0.2, CEIL, SCREEN_Z - BOOTH_Z), M['wall'])
box('ceiling', (0, CEIL + 0.1, (BOOTH_Z + SCREEN_Z) / 2), (WALL_X * 2 + 0.4, 0.2, SCREEN_Z - BOOTH_Z), M['ceiling'])
# Acoustic baffles under the ceiling, across the room.
z = BOOTH_Z + 1.2
while z < SCREEN_Z - 1.0:
    box(f'baffle_{z:.1f}', (0, CEIL - 0.35, z), (WALL_X * 2, 0.7, 0.14), M['baffle'])
    z += 1.6

# Fabric acoustic panels on both side walls, with warm uplights grazing them from the floor.
z = BOOTH_Z + 0.9
i = 0
while z < SCREEN_Z - 3.0:
    for s in (-1, 1):
        floor_y = max(0.0, min(last_top, (Z0 + 0.5 - z) / ROW_D * ROW_H))
        h = CEIL - 1.2 - floor_y
        box(f'panel_{i}_{s}', (s * (WALL_X - 0.08), floor_y + 0.25 + h / 2, z), (0.12, h, 1.25), M['panel'])
        box(f'uplight_{i}_{s}', (s * (WALL_X - 0.2), floor_y + 0.12, z), (0.08, 0.04, 0.5), M['sconce'])
    z += 1.42
    i += 1

# ------------------------------------------------------------------ booth wall + ports
# The booth wall has a real projection window (the camera flies out through it) and a small dummy port.
WX, WY, WW, WH = 0.9, 7.6, 1.4, 0.86
box('booth_wall_l', ((-WALL_X + WX - WW / 2) / 2, CEIL / 2, BOOTH_Z - 0.1), (WALL_X + WX - WW / 2, CEIL, 0.2), M['booth'])
box('booth_wall_r', ((WALL_X + WX + WW / 2) / 2, CEIL / 2, BOOTH_Z - 0.1), (WALL_X - WX - WW / 2, CEIL, 0.2), M['booth'])
box('booth_wall_b', (WX, (WY - WH / 2) / 2, BOOTH_Z - 0.1), (WW, WY - WH / 2, 0.2), M['booth'])
box('booth_wall_t', (WX, (CEIL + WY + WH / 2) / 2, BOOTH_Z - 0.1), (WW, CEIL - WY - WH / 2, 0.2), M['booth'])
for n, x, y, w, h in (('win', WX, WY, WW, WH), ('port_b', -2.8, WY, 0.62, 0.34)):
    box(n + '_frame_t', (x, y + h / 2 + 0.03, BOOTH_Z + 0.03), (w + 0.12, 0.06, 0.08), M['brass'])
    box(n + '_frame_b', (x, y - h / 2 - 0.03, BOOTH_Z + 0.03), (w + 0.12, 0.06, 0.08), M['brass'])
    box(n + '_frame_l', (x - w / 2 - 0.03, y, BOOTH_Z + 0.03), (0.06, h, 0.08), M['brass'])
    box(n + '_frame_r', (x + w / 2 + 0.03, y, BOOTH_Z + 0.03), (0.06, h, 0.08), M['brass'])
# The booth: a small concrete room behind the wall, where the projector lives.
BF, BB, BX0, BX1, BC = 6.3, BOOTH_Z - 4.6, -4.2, 5.2, 10.4
box('booth_floor', ((BX0 + BX1) / 2, BF - 0.1, (BOOTH_Z + BB) / 2), (BX1 - BX0, 0.2, BOOTH_Z - BB), M['booth'])
box('booth_ceil', ((BX0 + BX1) / 2, BC + 0.1, (BOOTH_Z + BB) / 2), (BX1 - BX0, 0.2, BOOTH_Z - BB), M['booth'])
box('booth_back', ((BX0 + BX1) / 2, (BF + BC) / 2, BB - 0.1), (BX1 - BX0, BC - BF, 0.2), M['booth'])
box('booth_side_l', (BX0 - 0.1, (BF + BC) / 2, (BOOTH_Z + BB) / 2), (0.2, BC - BF, BOOTH_Z - BB), M['booth'])
box('booth_side_r', (BX1 + 0.1, (BF + BC) / 2, (BOOTH_Z + BB) / 2), (0.2, BC - BF, BOOTH_Z - BB), M['booth'])
# Film-can shelves on the back wall, a work lamp over them.
for k in range(3):
    box(f'shelf_{k}', (-1.6, BF + 0.9 + k * 0.62, BB + 0.3), (3.0, 0.04, 0.42), M['door'])
    for j in range(7):
        box(f'can_{k}_{j}', (-2.9 + j * 0.42, BF + 0.98 + k * 0.62, BB + 0.3), (0.36, 0.1, 0.36), M['brass'])
box('worklamp', (-1.6, BF + 2.9, BB + 0.25), (0.5, 0.06, 0.18), M['sconce'])

# ------------------------------------------------------------------ screen end
box('screen_wall', (0, CEIL / 2, SCREEN_Z + 0.3), (WALL_X * 2, CEIL, 0.2), M['masking'])
box('screen', (0, 4.15, SCREEN_Z), (18.0, 7.5, 0.05), M['screen'])
# Curtains: pleated velvet on both sides of the screen.
for s in (-1, 1):
    me = bpy.data.meshes.new(f'curtain_{s}')
    bm = bmesh.new()
    cols, rows = 60, 2
    width, height = 2.2, 10.5
    verts = []
    for j in range(rows):
        row = []
        for k in range(cols + 1):
            t = k / cols
            x = s * (9.2 + t * width)
            zz = SCREEN_Z - 0.15 - 0.09 * math.sin(t * math.pi * 14) - 0.05 * math.sin(t * math.pi * 37)
            y = 0 if j == 0 else height
            row.append(bm.verts.new(W(x, y, zz)))
        verts.append(row)
    for k in range(cols):
        bm.faces.new((verts[0][k], verts[0][k + 1], verts[1][k + 1], verts[1][k]))
    bm.normal_update()
    if sum(f.normal.y for f in bm.faces) < 0:  # face the hall (web -z = blender +y)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f'curtain_{s}', me)
    me.materials.append(M['curtain'])
    coll.objects.link(o)
# Exit doors and signs by the screen.
for s in (-1, 1):
    box(f'door_{s}', (s * (WALL_X - 0.02), 1.1, SCREEN_Z - 2.0), (0.06, 2.2, 1.6), M['door'])
    box(f'exit_{s}', (s * (WALL_X - 0.06), 2.6, SCREEN_Z - 2.0), (0.04, 0.22, 0.6), M['exit'])
# Wall sconces down both sides, above the panels' midline.
for k in range(6):
    zz = 6 - k * 3.2
    for s in (-1, 1):
        floor_y = max(0.0, min(last_top, (Z0 + 0.5 - zz) / ROW_D * ROW_H))
        box(f'sconce_{k}_{s}', (s * (WALL_X - 0.2), floor_y + 3.4, zz), (0.1, 0.5, 0.25), M['sconce'])

# ------------------------------------------------------------------ seat proxies (bake only)
for r in range(ROWS):
    for c in range(22):
        # Same layout as the web (src/novel/cinema/world.js SEATS): 11 recliners each side of a centre aisle.
        x = (c - 10.5) * 0.78 + (0.45 if c >= 11 else -0.45)
        zz = Z0 - r * ROW_D + x * x * 0.004
        y = r * ROW_H
        box(f'seatp_{r}_{c}', (x, y + 0.5, zz - 0.05), (0.72, 1.0, 0.76), M['riser'], c=bake_only)

# ------------------------------------------------------------------ lights for the bake
def light(kind, name, at, energy, color, size=None, rot=None, spot=None):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if size and kind == 'AREA':
        d.shape = 'RECTANGLE'
        d.size, d.size_y = size
    if kind == 'SPOT' and spot:
        d.spot_size, d.spot_blend = spot
    o = bpy.data.objects.new(name, d)
    o.location = W(*at)
    if rot:
        o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    return o

# The projected film washes the room from the screen.
light('AREA', 'screen_glow', (0, 4.15, SCREEN_Z - 0.2), 900, (0.62, 0.74, 1.0), size=(18, 7.5), rot=(math.radians(90), 0, 0))
# Projector spill: a narrow cool spot from the main port toward the screen.
sp = light('SPOT', 'projector', (0.9, 7.6, BOOTH_Z + 0.3), 3500, (0.8, 0.88, 1.0), spot=(math.radians(32), 0.4))
sp.rotation_euler = (W(0, 3.6, 15) - W(0.9, 7.6, BOOTH_Z)).to_track_quat('-Z', 'Y').to_euler()

bpy.context.scene.world = bpy.data.worlds.new('dark')
bpy.context.scene.world.color = (0.0008, 0.0009, 0.0013)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hall.blend'))
print('BUILT', len(coll.objects), 'objects')
