"""Chapter Five's props from the Meshy models (Blender 5.2, run from E:/portfolio):
  B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; M=<folder with the Meshy GLBs>
  "$B" -b --factory-startup --python scripts/cinema/props.py -- axe   $M/axe1.glb $M/axe2.glb public/cinema/landing/axe.glb
  "$B" -b --factory-startup --python scripts/cinema/props.py -- stormbreaker $M/stormbreaker.glb public/cinema/landing/axe.glb  (replaces 'axe')
  "$B" -b --factory-startup --python scripts/cinema/props.py -- bike  $M/batpod.glb public/cinema/chase/bike.glb
  "$B" -b --factory-startup --python scripts/cinema/props.py -- rifle $M/rifle.glb public/cinema/ops/rifle.glb
  "$B" -b --factory-startup --python scripts/cinema/props.py -- relics $M/skeleton.glb public/cinema/dance/relics.glb

axe:   Stormbreaker. axe1's gnarled branch handle (its own blade and lanyard cut away), axe2's crescent blade on one
       side of the head and its square hammer block turned to stand out on the other, a forged cap on top.
       Procedural maps baked in numpy (1024 px): weathered silver-grey forged metal with engraved runes (in the
       normal, roughness and colour), dark bark with leather strap wraps round the grip. Node 'stormbreaker',
       origin at the grip, haft along +Y (glTF), blade towards +X, hammer towards -X.
bike:  the armoured bike at ~2.6 m, +Z forward (glTF), tyres on the ground (y = 0). Wheels cut out as their own
       nodes 'wheel_front' / 'wheel_back', each with its origin on its axle (spin about local X); the rest is 'bike'.
relics: the film's credit props, bare (dance.js writes the credits on them): nodes 'femur' (0.46 m, built from
       spheres and cylinders, voxel-welded), 'skull' and 'claws' (the skeleton's right forearm and hand, with three
       straight claws from the knuckles), each from the metal skeleton at 1.75 m tall. Each node's origin at its
       middle, its long axis along +X (glTF), the side that carries the credit facing +Z, its top +Y.
rifle: the assault rifle at 0.9 m, node 'rifle', origin in the middle of the pistol grip, barrel along +Z (glTF), top up (+Y).
Every output: Draco geometry, WebP maps at most 1024 px.
"""
import bpy, bmesh, sys, math, numpy as np
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
KIND, ARGS = a[0], a[1:]
rng = np.random.default_rng(7)


def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)


def load(path):
    keep = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    m = next(o for o in bpy.data.objects if o not in keep and o.type == 'MESH')
    for o in [o for o in bpy.data.objects if o not in keep and o is not m]: bpy.data.objects.remove(o, do_unlink=True)
    m.parent = None
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = m; m.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(m.data)  # weld the UV-seam splits
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005); bm.to_mesh(m.data); bm.free()
    return m


def co(m):
    v = np.empty(len(m.data.vertices) * 3); m.data.vertices.foreach_get('co', v); return v.reshape(-1, 3)


def set_co(m, V):
    m.data.vertices.foreach_set('co', V.astype(np.float32).ravel()); m.data.update()


def keep_faces(m, mask_fn):
    """Delete faces whose centre fails mask_fn(centres) -> bool array."""
    bm = bmesh.new(); bm.from_mesh(m.data); bm.faces.ensure_lookup_table()
    C = np.array([f.calc_center_median() for f in bm.faces])
    ok = mask_fn(C)
    bmesh.ops.delete(bm, geom=[f for f, k in zip(bm.faces, ok) if not k], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(m.data); bm.free(); m.data.update()


def decimate(m, tris):
    n = sum(len(p.vertices) - 2 for p in m.data.polygons)
    if n <= tris: return
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = m; m.select_set(True)
    d = m.modifiers.new('d', 'DECIMATE'); d.ratio = tris / n
    bpy.ops.object.modifier_apply(modifier='d')


def image(name, arr, color=True):
    """A float HxWx3/4 array (0..1, row 0 at the bottom) as a packed Blender image."""
    h, w = arr.shape[:2]
    if arr.shape[2] == 3: arr = np.dstack([arr, np.ones((h, w))])
    img = bpy.data.images.new(name, w, h, alpha=False, is_data=not color)  # colour space first: changing it later blanks the pixels
    img.pixels.foreach_set(np.clip(arr, 0, 1).astype(np.float32).ravel())
    img.pack()
    return img


def pbr(name, base, rough_metal=None, normal=None, metallic=0.0, roughness=0.5, color=(0.8, 0.8, 0.8)):
    """A Principled material the glTF exporter reads: base colour, (G roughness, B metallic) and normal maps."""
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree; P = nt.nodes['Principled BSDF']
    P.inputs['Metallic'].default_value = metallic; P.inputs['Roughness'].default_value = roughness
    P.inputs['Base Color'].default_value = (*color, 1)
    if base is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = base; nt.links.new(t.outputs['Color'], P.inputs['Base Color'])
    if rough_metal is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = rough_metal
        s = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(t.outputs['Color'], s.inputs['Color'])
        nt.links.new(s.outputs['Green'], P.inputs['Roughness']); nt.links.new(s.outputs['Blue'], P.inputs['Metallic'])
    if normal is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = normal
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])
    return mat


def normal_from_height(H, k):
    gy, gx = np.gradient(H)
    n = np.dstack([-gx * k, -gy * k, np.ones_like(H)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def noise(size, scale, octaves=4):
    """Smooth value noise in 0..1 (tileable), by upsampling random grids."""
    out = np.zeros((size, size))
    for o in range(octaves):
        g = max(2, int(scale * 2 ** o))
        r = rng.random((g, g))
        idx = np.arange(size) * g / size
        i0 = np.floor(idx).astype(int) % g; i1 = (i0 + 1) % g; f = idx - np.floor(idx); f = f * f * (3 - 2 * f)
        rows = r[i0] * (1 - f)[:, None] + r[i1] * f[:, None]
        out += (rows[:, i0] * (1 - f)[None, :] + rows[:, i1] * f[None, :]) / 2 ** o
    out -= out.min(); return out / out.max()


def set_uv(m, fn):
    """Per-loop UVs from fn(vertex coords) -> Nx2."""
    me = m.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    li = np.empty(len(me.loops), int); me.loops.foreach_get('vertex_index', li)
    U = fn(co(m))[li]
    uv.foreach_set('uv', U.astype(np.float32).ravel())


def export(objs, out):
    for o in bpy.data.objects: o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format='WEBP', export_image_quality=82)
    print('PROP', out, [(o.name, sum(len(p.vertices) - 2 for p in o.data.polygons) if o.type == 'MESH' else 0) for o in objs])


# ---------------------------------------------------------------------------------------------- Stormbreaker
RUNES = [  # Elder-Futhark-like strokes in a 0..1 cell
    [((0.3, 0), (0.3, 1)), ((0.3, 0.75), (0.7, 1)), ((0.3, 0.5), (0.7, 0.75))],
    [((0.5, 0), (0.5, 1)), ((0.5, 0.65), (0.15, 0.95)), ((0.5, 0.65), (0.85, 0.95))],
    [((0.3, 0), (0.3, 1)), ((0.3, 1), (0.7, 0.75)), ((0.7, 0.75), (0.3, 0.5)), ((0.3, 0.5), (0.7, 0.25)), ((0.7, 0.25), (0.3, 0))],
    [((0.2, 0), (0.2, 1)), ((0.8, 0), (0.8, 1)), ((0.2, 1), (0.8, 0.5)), ((0.8, 1), (0.2, 0.5))],
    [((0.5, 0), (0.5, 1)), ((0.2, 0.7), (0.8, 0.3))],
    [((0.25, 1), (0.75, 0)), ((0.75, 1), (0.25, 0))],
    [((0.5, 1), (0.2, 0.5)), ((0.2, 0.5), (0.5, 0)), ((0.5, 1), (0.8, 0.5)), ((0.8, 0.5), (0.5, 0))],
    [((0.3, 0), (0.3, 1)), ((0.3, 1), (0.75, 0.7)), ((0.75, 0.7), (0.3, 0.45)), ((0.3, 0.45), (0.75, 0))],
    [((0.5, 0), (0.5, 1)), ((0.5, 1), (0.85, 0.7)), ((0.5, 0.6), (0.15, 0.3))],
]


def engrave(H, x0, y0, cell, rune, width):
    """Cut a rune's strokes into the height field H (pixels; y up)."""
    ys, xs = np.mgrid[0:H.shape[0], 0:H.shape[1]]
    sl = (slice(max(0, int(y0 - width)), int(y0 + cell * 1.6 + width)), slice(max(0, int(x0 - width)), int(x0 + cell + width)))
    py, px = ys[sl], xs[sl]
    d = np.full(py.shape, 1e9)
    for (ax, ay), (bx, by) in rune:
        A = np.array([x0 + ax * cell, y0 + ay * cell * 1.6]); Bp = np.array([x0 + bx * cell, y0 + by * cell * 1.6])
        ab = Bp - A; t = np.clip(((px - A[0]) * ab[0] + (py - A[1]) * ab[1]) / (ab @ ab), 0, 1)
        d = np.minimum(d, np.hypot(px - A[0] - t * ab[0], py - A[1] - t * ab[1]))
    H[sl] = np.minimum(H[sl], np.clip(d / width, 0, 1) ** 0.6 - 1 + 1)  # 0 in the groove, 1 outside


def axe(p1, p2, out):
    S = 1024
    # The handle: axe1 minus its blade (x < -0.07) and its hanging lanyard; its axis from pommel to head.
    h = load(p1)
    zc = lambda x: 0.12 + (x + 0.07) * (0.45 - 0.12) / 1.02  # the branch's centre line (it rises towards the pommel)
    keep_faces(h, lambda C: (C[:, 0] > -0.07) & ~((C[:, 0] > 0.5) & (C[:, 0] < 0.8) & (C[:, 2] < zc(C[:, 0]) - 0.11)))
    V = co(h)
    top, bot = V[V[:, 0] < -0.04].mean(0), V[V[:, 0] > 0.92].mean(0)
    ax = Vector(top - bot).normalized()
    R = ax.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
    h.data.transform(R @ Matrix.Translation(-Vector(bot)))
    V = co(h); L = V[:, 2].max()
    # 0.70 m long, ~4.5 cm thick: a branch, not a log.
    s = 0.70 / L; V[:, 2] *= s; V[:, :2] *= s * 0.5
    set_co(h, V)
    decimate(h, 6000)

    # The head: axe2 above its grip (blade, haft collar with straps, block), scaled to the handle.
    hd = load(p2)
    keep_faces(hd, lambda C: C[:, 2] > -0.14)
    V = co(hd)
    blk = V[:, 2] > 0.69
    # Turn the hammer block a quarter about Y so it stands out on the side opposite the blade, level with it.
    piv = np.array([0.11, 0, 0.69])
    d = V[blk] - piv; V[blk] = piv + np.c_[d[:, 2], d[:, 1], -d[:, 0]] + [0.08 + 0.0, 0, -0.30]
    V[:, 0] -= 0.10  # haft on the axis
    k = 0.40  # axe2 units -> metres
    V *= k; V[:, 0] *= -1  # blade towards +X (Blender), block towards -X
    V[:, 2] += 0.70 - (-0.14 * k) - 0.06 * k * 0  # the head sits on top of the branch
    V[:, 2] -= 0.05
    set_co(hd, V)
    decimate(hd, 9000)

    # A forged cap where the block used to sit.
    Vt = co(hd); top = Vt[np.abs(Vt[:, 0]) < 0.03]; ztop = top[:, 2].max()
    rtop = np.hypot(*top[top[:, 2] > ztop - 0.01][:, :2].T).max() + 0.004
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=rtop, depth=0.024, location=(0, 0, ztop))
    cap = bpy.context.object
    print('HEAD', co(hd).min(0).round(3), co(hd).max(0).round(3), 'HANDLE', co(h).min(0).round(3), co(h).max(0).round(3))

    # ---- maps
    # Metal: planar UVs seen from the side (x, z), so the runes lie flat on the blade's faces.
    Vh = np.concatenate([co(hd), co(cap)])
    lo, size = Vh.min(0), (Vh.max(0) - Vh.min(0))[[0, 2]].max()
    planar = lambda P: np.c_[(P[:, 0] - lo[0]) / size, (P[:, 2] - lo[2]) / size]
    set_uv(hd, planar); set_uv(cap, planar)
    Hm = np.ones((S, S))
    # A column of runes down the blade's broad face, near the haft, and a short one on the block.
    blade_u = lambda x: (x - lo[0]) / size * S
    zr = lambda z: (z - lo[2]) / size * S
    BV = co(hd)
    bz = BV[BV[:, 0] > 0.04 * 1][:, 2]
    cell = S * 0.028
    y = zr(bz.max()) - cell * 2.6
    i = 0
    while y > zr(bz.min()) + cell * 1.5:
        engrave(Hm, blade_u(0.06), y, cell, RUNES[i % len(RUNES)], 2.2); y -= cell * 1.9; i += 1
    kz = BV[BV[:, 0] < -0.05][:, 2]
    y = zr(kz.mean()) + cell * 0.8
    for j in range(2):
        engrave(Hm, blade_u(-0.085), y, cell * 0.8, RUNES[(i + j * 3) % len(RUNES)], 1.8); y -= cell * 1.6
    rune = 1 - Hm
    scratches = np.zeros((S, S))
    for _ in range(220):
        x0, y0 = rng.random(2) * S; ang = rng.random() * math.pi; ln = rng.random() * 60 + 10
        t = np.linspace(0, 1, int(ln)); xs = (x0 + np.cos(ang) * ln * t).astype(int) % S; ys = (y0 + np.sin(ang) * ln * t).astype(int) % S
        scratches[ys, xs] = rng.random() * 0.6 + 0.4
    wear = noise(S, 6)
    hammer = noise(S, 40, 2)  # forge-hammered dimples
    Hmetal = Hm * 1.0 + hammer * 0.25 - scratches * 0.15
    grey = 0.55 + 0.12 * (wear - 0.5) - 0.18 * rune - 0.05 * (1 - hammer) + 0.06 * scratches
    mbase = np.dstack([grey * 0.97, grey * 0.98, grey * 1.02])
    mrm = np.dstack([np.zeros((S, S)), np.clip(0.32 + 0.25 * wear + 0.35 * rune - 0.1 * scratches, 0.15, 0.9), np.clip(1 - 0.6 * rune, 0, 1)])
    metal = pbr('stormbreaker_metal', image('sb_metal_base', mbase), image('sb_metal_rm', mrm, False), image('sb_metal_n', normal_from_height(Hmetal, 3.5), False))

    # Wood: cylindrical UVs (round the haft, along it); bark grooves along the grain, leather wraps over the grip.
    Vw = co(h); zl = Vw[:, 2].max()
    set_uv(h, lambda P: np.c_[(np.arctan2(P[:, 1], P[:, 0]) / (2 * math.pi)) % 1.0, P[:, 2] / zl])
    u = np.linspace(0, 1, S)[None, :].repeat(S, 0); v = np.linspace(0, 1, S)[:, None].repeat(S, 1)
    grain = noise(S, 3, 3)[:, ::1]
    streak = np.sin((u * 26 + noise(S, 4, 2) * 3.0) * 2 * math.pi) * 0.5 + 0.5
    Hb = 0.55 * streak ** 3 + 0.3 * grain + 0.15 * noise(S, 30, 2)
    bark = np.dstack([0.20 + 0.10 * Hb, 0.12 + 0.07 * Hb, 0.07 + 0.04 * Hb]) * (0.75 + 0.25 * noise(S, 5, 3))[..., None]
    rough = 0.82 - 0.15 * Hb
    # Wraps: diagonal leather bands from 0.08 to 0.42 of the haft (the grip), with a dark seam between turns.
    zone = (v > 0.08) & (v < 0.42)
    turn = ((u + v * 0.70 / 0.03) % 1.0)
    band = zone & (turn < 0.82)
    leather = np.dstack([0.13 + 0 * u, 0.075 + 0 * u, 0.045 + 0 * u]) * (0.85 + 0.3 * noise(S, 12, 2))[..., None]
    base = np.where(band[..., None], leather, bark)
    Hw = np.where(band, 0.9 + 0.1 * np.sin(turn / 0.82 * math.pi), np.where(zone, 0.2, Hb * 0.8))
    rough = np.where(band, 0.55, rough)
    wrm = np.dstack([np.zeros((S, S)), rough, np.zeros((S, S))])
    wood = pbr('stormbreaker_wood', image('sb_wood_base', base), image('sb_wood_rm', wrm, False), image('sb_wood_n', normal_from_height(Hw, 6.0), False))

    for o, mt in ((hd, metal), (cap, metal), (h, wood)):
        o.data.materials.clear(); o.data.materials.append(mt)
    # The head's haft collar (straps round it in axe2) is wood too: faces near the axis between blade and block.
    bm = bmesh.new(); bm.from_mesh(hd.data)
    hd.data.materials.append(wood)
    for f in bm.faces:
        c = f.calc_center_median()
        if abs(c.x) < 0.075 * k * 1.05 * 1.0 + 0.004: f.material_index = 1
    bm.to_mesh(hd.data); bm.free()

    for o in bpy.context.selected_objects: o.select_set(False)
    for o in (h, hd, cap): o.select_set(True)
    bpy.context.view_layer.objects.active = h
    bpy.ops.object.join()
    h.name = h.data.name = 'stormbreaker'
    # Origin at the grip: 0.13 m up the haft from the pommel.
    h.data.transform(Matrix.Translation((0, 0, -0.13)))
    export([h], out)


# ---------------------------------------------------------------------------------------------- Stormbreaker (Meshy)
def stormbreaker(src, out):
    """The Meshy Stormbreaker (crescent blade, square hammer, branch haft with a leather wrap; PBR maps).
    In the Meshy file: haft along +Z, 1.9 units, blade toward -X, the wrap at z -0.69..-0.19, the lowest blade
    point at z 0.03. Out: 'stormbreaker', origin at the middle of the wrap, haft +Y (glTF), blade +X, ~0.95 m,
    the plain branch between the wrap and the blade lengthened 2.5x (the head is not stretched).
    Materials 'stormbreaker_wood' and 'stormbreaker_metal' (the head) share the Meshy maps; the metal one
    carries an emissive map of the painted runes (1024 px) with emissive factor ~0 (light it in three.js
    by setting material.emissive)."""
    m = load(src)
    V = co(m)
    zg, z0, z1, f, s = -0.44, -0.16, 0.02, 2.5, 0.44
    ring = V[np.abs(V[:, 2] - zg) < 0.04]
    g = (ring.min(0) + ring.max(0)) / 2
    V[:, 2] = np.where(V[:, 2] < z0, V[:, 2], np.where(V[:, 2] < z1, z0 + (V[:, 2] - z0) * f, V[:, 2] + (f - 1) * (z1 - z0)))
    V -= [g[0], g[1], zg]
    V[:, :2] *= -1  # a half turn about Z: the blade to +X
    V *= s
    set_co(m, V)
    decimate(m, 16000)

    mat = m.data.materials[0]
    nt = mat.node_tree
    base = next(n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
    w, h = base.size
    px = np.empty(w * h * 4, np.float32); base.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    # Metal or wood per face: the base colour at its UV centre (grey metal above the wrap; bark, leather, leaves are not).
    me = m.data
    uv = np.empty(len(me.loops) * 2); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    ls = np.empty(len(me.polygons), int); me.polygons.foreach_get('loop_start', ls)
    lt = np.empty(len(me.polygons), int); me.polygons.foreach_get('loop_total', lt)
    U = np.add.reduceat(uv, ls) / lt[:, None]
    c = px[np.clip((U[:, 1] % 1) * h, 0, h - 1).astype(int), np.clip((U[:, 0] % 1) * w, 0, w - 1).astype(int), :3]
    sat = c.max(1) - c.min(1)
    C = np.array([p.center for p in me.polygons])
    metal = (sat < 0.09) & (c.mean(1) > 0.18) & (C[:, 2] > (z1 + (f - 1) * (z1 - z0) - zg) * s - 0.02)  # above the blade's foot
    # Runes: the pale blue strokes painted on the blade, as an emissive mask (1024 px, a little soft).
    r, gg, b = px[..., 0], px[..., 1], px[..., 2]
    mk = ((b - r > 0.05) & ((r + gg + b) / 3 > 0.55)).astype(np.float32)
    mk = mk.reshape(h // 2, 2, w // 2, 2).max((1, 3))
    for _ in range(2): mk = np.maximum(mk, 0.5 * (np.roll(mk, 1, 0) + np.roll(mk, -1, 1)))
    rune = image('stormbreaker_runes', np.dstack([mk, mk, mk]))
    wood = mat.copy(); wood.name = 'stormbreaker_wood'; mat.name = 'stormbreaker_metal'
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = rune
    P = nt.nodes['Principled BSDF']
    nt.links.new(t.outputs['Color'], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = 0.001
    # metal first: three.js names the primitives stormbreaker_1 (metal) and stormbreaker_2, as landing.js expects
    me.materials.clear(); me.materials.append(mat); me.materials.append(wood)
    me.polygons.foreach_set('material_index', (~metal).astype(int)); me.update()
    for img in bpy.data.images:
        mx = 2048 if img == base else 1024
        if img.size[0] > mx: img.scale(mx, mx)
    m.name = me.name = 'stormbreaker'
    V = co(m)
    blk = V[V[:, 0] < -0.10]  # the hammer block (-X): its middle is the head's centre on the haft
    print('AXE len', round(np.ptp(V[:, 2]), 3), 'z', V[:, 2].min().round(3), V[:, 2].max().round(3), 'x', V[:, 0].min().round(3), V[:, 0].max().round(3),
          'head centre z', round(float((blk[:, 2].min() + blk[:, 2].max()) / 2), 3), 'metal faces', int(metal.sum()), 'of', len(metal))
    export([m], out)


# ---------------------------------------------------------------------------------------------- the rifle
def rifle(src, out):
    m = load(src)  # the Meshy file: muzzle toward -X, 0.957 long, the pistol grip's middle at x 0.19, z -0.055
    V = co(m) - [0.19, 0, -0.055]
    V = np.c_[-V[:, 1], V[:, 0], V[:, 2]] * (0.9 / 0.957)  # a quarter turn about Z: the muzzle to -Y (glTF +Z)
    set_co(m, V)
    decimate(m, 12000)
    for img in bpy.data.images:
        if img.size[0] > 1024: img.scale(1024, 1024)
    m.name = m.data.name = 'rifle'
    export([m], out)


# ---------------------------------------------------------------------------------------------- the bike
def bike(src, out):
    m = load(src)
    V = co(m)
    # Front (the long fork) is -X in the Meshy file; turn it to -Y (glTF +Z), scale to 2.6 m, tyres on the floor.
    s = 2.6 / np.ptp(V[:, 0])
    m.data.transform(Matrix.Rotation(math.pi / 2, 4, 'Z') @ Matrix.Scale(s, 4))
    V = co(m); V[:, 2] -= V[:, 2].min(); V[:, 0] -= (V[:, 0].max() + V[:, 0].min()) / 2; set_co(m, V)
    for img in bpy.data.images:
        if img.size[0] > 1024: img.scale(1024, 1024)
    V = co(m)
    ys = V[:, 1]
    objs = [m]
    for name, sign in (('wheel_front', -1), ('wheel_back', 1)):
        end = ys.min() if sign < 0 else ys.max()
        r = V[(ys - end) * sign > -0.45][:, 2].max() / 2  # the tyre's top over two (tyres sit on the floor)
        hub = np.array([0, end - sign * r, r])
        C = np.array([p.center for p in m.data.polygons])
        d = np.hypot(C[:, 1] - hub[1], C[:, 2] - hub[2])
        far = np.zeros(len(m.data.vertices), bool)  # a face reaching outside the tyre belongs to the frame
        P = co(m); far[np.hypot(P[:, 1] - hub[1], P[:, 2] - hub[2]) > 1.03 * r] = True
        lv = np.empty(len(m.data.loops), int); m.data.loops.foreach_get('vertex_index', lv)
        ls = np.empty(len(m.data.polygons), int); m.data.polygons.foreach_get('loop_start', ls)
        out_f = np.maximum.reduceat(far[lv].astype(int), ls).astype(bool)
        sel = (d > 0.56 * r) & (d < 1.03 * r) & (np.abs(C[:, 0]) < 0.22) & ~out_f  # tyre and rim; forks ride outside
        print(name, 'hub', hub.round(3), 'r', round(r, 3), 'faces', int(sel.sum()))
        for o in bpy.context.selected_objects: o.select_set(False)
        bpy.context.view_layer.objects.active = m; m.select_set(True)
        before = set(bpy.data.objects)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_mode(type='FACE'); bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        m.data.polygons.foreach_set('select', sel); m.data.update()
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
        w = next(o for o in bpy.data.objects if o not in before)
        w.name = w.data.name = name
        # Origin on the axle, so the wheel spins about its local X.
        w.data.transform(Matrix.Translation(-Vector(hub))); w.location = Vector(hub)
        decimate(w, 3000)
        objs.append(w)
    decimate(m, 18000)
    m.name = m.data.name = 'bike'
    export(objs, out)


# ---------------------------------------------------------------------------------------------- the relics
def relics(src, out):
    m = load(src)
    V = co(m)
    V *= 1.75 / np.ptp(V[:, 2]); V[:, 2] -= V[:, 2].min(); set_co(m, V)
    parts = []

    def piece(name, mask_fn, place):
        """A copy of the skeleton cut to the faces mask_fn keeps, holes filled, moved by place(V) -> V."""
        o = m.copy(); o.data = m.data.copy(); bpy.context.collection.objects.link(o)
        keep_faces(o, mask_fn)
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.holes_fill(bm, edges=bm.edges, sides=0); bm.to_mesh(o.data); bm.free()
        o.name = o.data.name = name
        return o

    # The skull, from the neck up (the face is -Y in Blender, +Z in glTF).
    skull = piece('skull', lambda C: C[:, 2] > 1.47, None)
    # The right forearm and hand (+X), hanging; then three claws along the hand from the knuckles.
    arm = piece('claws', lambda C: (C[:, 0] > 0.215) & (C[:, 2] > 0.57) & (C[:, 2] < 1.08), None)
    A = co(arm)
    tip = A[A[:, 2].argmin()]
    hand = A[A[:, 2] < tip[2] + 0.2]
    wrist = hand[hand[:, 2] > tip[2] + 0.15].mean(0)
    knuck = hand[(hand[:, 2] > tip[2] + 0.06) & (hand[:, 2] < tip[2] + 0.1)].mean(0)
    dirv = Vector(tip - wrist).normalized()
    claws = []
    for j in (-1, 0, 1):
        bm = bmesh.new()
        L, w, t = 0.30, 0.014, 0.004
        prof = [(-w / 2, -t / 2), (w / 2, -t / 2), (w / 2, t / 2), (-w / 2, t / 2)]
        base = [bm.verts.new((x, y, 0)) for x, y in prof]
        mid = [bm.verts.new((x, y, L * 0.85)) for x, y in prof]
        pt = bm.verts.new((0, 0, L))
        for i in range(4):
            bm.faces.new((base[i], base[(i + 1) % 4], mid[(i + 1) % 4], mid[i]))
            bm.faces.new((mid[i], mid[(i + 1) % 4], pt))
        bm.faces.new(list(reversed(base)))
        me = bpy.data.meshes.new('claw'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('claw', me); bpy.context.collection.objects.link(o)
        rot = Vector((0, 0, 1)).rotation_difference(dirv).to_matrix().to_4x4()
        o.matrix_world = Matrix.Translation(Vector(knuck) + Vector((0, j * 0.022, 0)) - dirv * 0.03) @ rot
        claws.append(o)
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in [arm] + claws: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.join(); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    A = co(arm); c = (A.max(0) + A.min(0)) / 2
    # Fingers and claws to +X, the back of the hand (+X, hanging) to the camera (-Y), front-to-back to up.
    set_co(arm, np.stack([-(A[:, 2] - c[2]), -(A[:, 0] - c[0]), A[:, 1] - c[1]], 1))
    S = co(skull); set_co(skull, S - (S.max(0) + S.min(0)) / 2)

    # The femur: a shaft flaring to its ends, two condyles at the knee, the neck, head and trochanter at the hip.
    bits = []
    def add(op, loc, rot=(0, 0, 0), scale=(1, 1, 1), **kw):
        op(location=loc, rotation=rot, **kw); o = bpy.context.active_object; o.scale = scale; bits.append(o)
    cyl, cone, ball = bpy.ops.mesh.primitive_cylinder_add, bpy.ops.mesh.primitive_cone_add, bpy.ops.mesh.primitive_uv_sphere_add
    R = (0, math.pi / 2, 0)
    add(cyl, (0, 0, 0), R, radius=0.0165, depth=0.32, vertices=24)
    add(cone, (0.165, 0, 0), R, radius1=0.0165, radius2=0.03, depth=0.05, vertices=24)
    add(cone, (-0.165, 0, 0), (0, -math.pi / 2, 0), radius1=0.0165, radius2=0.025, depth=0.05, vertices=24)
    add(ball, (0.2, 0.004, 0.022), scale=(1.1, 1, 1), radius=0.029)
    add(ball, (0.2, 0.004, -0.022), scale=(1.1, 1, 1), radius=0.027)
    add(ball, (0.195, 0.0, 0), scale=(1, 0.8, 1.3), radius=0.026)
    add(cyl, (-0.205, 0, 0.022), (0, math.radians(40), 0), radius=0.016, depth=0.06, vertices=20)
    add(ball, (-0.228, 0, 0.045), radius=0.026)
    add(ball, (-0.2, 0.002, -0.016), scale=(1.3, 1, 1), radius=0.022)
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in bits: o.select_set(True)
    bpy.context.view_layer.objects.active = bits[0]
    bpy.ops.object.join(); femur = bpy.context.active_object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    r = femur.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = 0.0025
    sm = femur.modifiers.new('s', 'SMOOTH'); sm.factor = 0.8; sm.iterations = 6
    bpy.ops.object.modifier_apply(modifier='r'); bpy.ops.object.modifier_apply(modifier='s')
    F = co(femur); set_co(femur, F - (F.max(0) + F.min(0)) / 2)
    femur.name = femur.data.name = 'femur'

    for o, n in ((femur, 5000), (skull, 9000), (arm, 7000)):
        decimate(o, n)
        o.data.materials.clear()
        for p in o.data.polygons: p.use_smooth = True
        print('SIZE', o.name, np.ptp(co(o), 0).round(3))
    bpy.data.objects.remove(m, do_unlink=True)
    export([femur, skull, arm], out)



clear()
{'axe': axe, 'stormbreaker': stormbreaker, 'rifle': rifle, 'bike': bike, 'relics': relics}[KIND](*ARGS)
