"""Skin a Meshy fan-art suit (T-pose, ~1.9 m) to the traveller's own skeleton, for Chapter Five.

README: how to rebuild public/cinema/suits/<name>.glb (Blender 5.2, run from E:/portfolio)
  B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
  "$B" -b --factory-startup --python scripts/cinema/suit_skin.py -- <name> <meshy suit.glb> public/cinema/traveller.glb public/cinema/suits/<name>.glb
  name is spider | thor | bat | deadpool | stealth (the Meshy inputs are spider.glb, thor.glb, batsuit.glb, deadpool.glb,
  stealth.glb).
  Check the result posed by his own clips with scripts/cinema/suit_check.py (renders a contact sheet).

What it does
  1. Fit: the suit's landmarks (fingertips, shoulder line, chest width, crotch, neck, top of head, leg line) are
     measured off the mesh, his joints are carried into the suit by the same landmarks, and every vertex is
     warped by suit_fit.py's smooth blend of per-bone fits (segment suit joint -> his bone, scaled across the
     bone by his girth over the suit's, a little inflated so no skin pokes through).
  2. Thor and stealth: the Meshy head (and Thor's hair and beard) are cut off above the collar (his own head shows).
  3. Skin: vertex weights from his skinned body by Data Transfer (nearest face, interpolated), capes re-weighted
     to the spine with a falloff from the shoulders (so a cape follows the torso, not the legs), then smoothed,
     limited to 4 bones and normalised.
  4. Export: his armature (same bone names, same rest pose, no clips) and the one skinned mesh suit_<name>,
     Draco geometry, WebP maps (base colour 2048 px, the other maps 1024 px).
"""
import bpy, bmesh, sys, numpy as np
from mathutils import Vector, Matrix

NAME, SRC, TRAV, OUT = sys.argv[sys.argv.index('--') + 1:][:4]
CAPE = NAME in ('thor', 'bat')
FACES = 26000  # triangles kept after decimation

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=TRAV)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = bpy.data.objects['char1']
for o in list(bpy.data.objects):
    if o not in (arm, body): bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
arm.animation_data_clear()
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
dg = bpy.context.evaluated_depsgraph_get()
B = {b.name: np.array(arm.matrix_world @ b.head_local) for b in arm.data.bones}
Tv = np.array([body.matrix_world @ v.co for v in body.data.vertices])

bpy.ops.import_scene.gltf(filepath=SRC)
suit = next(o for o in bpy.data.objects if o.type == 'MESH' and o is not body)
for o in list(bpy.data.objects):
    if o.type != 'MESH' and o.type != 'ARMATURE': bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = suit
for o in bpy.context.selected_objects: o.select_set(False)
suit.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = suit.data
Vs = np.array([v.co for v in me.vertices])
me.transform(Matrix.Translation((0, 0, -Vs[:, 2].min())))  # feet on the ground
bm = bmesh.new(); bm.from_mesh(me)  # weld the UV-seam splits, so decimation and weights never open a crack
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005); bm.to_mesh(me); bm.free()
dec = suit.modifiers.new('d', 'DECIMATE'); dec.ratio = min(1, FACES / sum(len(p.vertices) - 2 for p in me.polygons))
bpy.ops.object.modifier_apply(modifier='d')
me = suit.data


def verts(m):
    a = np.empty(len(m.vertices) * 3); m.vertices.foreach_get('co', a); return a.reshape(-1, 3)


# ------------------------------------------------------------------ landmarks (same routine on him and on the suit)
def measure(V):
    L = {}
    fx = (V[:, 0].max() - V[:, 0].min()) / 2
    col = V[(np.abs(V[:, 0]) < 0.05) & (V[:, 1] < 0.0)]  # the centre line, in front of any gear on the back
    L['fx'], L['H'] = fx, col[:, 2].max()
    def armz(x):
        s = V[(np.abs(np.abs(V[:, 0]) - x) < 0.012) & (V[:, 2] > 0.55 * L['H'])]
        return float(np.median(s[:, 2]))
    L['armz'] = armz
    L['sh'] = armz(0.45 * fx)
    zc = L['sh'] - 0.08 * L['H']  # under the armpit
    s = V[(np.abs(V[:, 2] - zc) < 0.025) & (V[:, 1] < 0) & (np.abs(V[:, 0]) < 0.4 * fx)]
    L['chest'] = np.abs(s[:, 0]).max()
    mid = V[(np.abs(V[:, 0]) < 0.025) & (np.abs(V[:, 1]) < 0.05) & (V[:, 2] > 0.3 * L['H'])]
    L['crotch'] = mid[:, 2].min()  # the lowest point of the body on the centre line
    L['neck'] = 0.855 * L['H']  # mid-neck on a lifelike figure (his own is set from his bones below)
    s = V[(np.abs(V[:, 2] - 0.25 * L['H']) < 0.01) & (V[:, 0] > 0.02) & (np.abs(V[:, 1]) < 0.08) & (V[:, 0] < 0.2)]
    L['legx'] = float(np.median(s[:, 0]))
    feet = V[(V[:, 2] < 0.06) & (np.abs(V[:, 0]) < 0.22)]  # not a cape's hem
    L['toe'] = feet[:, 1].min()
    return L


Lt, Ls = measure(Tv), measure(verts(me))
Lt['neck'] = (B['neck'][2] + B['Head'][2]) / 2
print('LAND', NAME, {k: round(float(v), 3) for k, v in Ls.items() if k != 'armz'}, 'him', {k: round(float(v), 3) for k, v in Lt.items() if k != 'armz'})


def to_suit(p, kind):
    """One of his joints, carried into the suit by the landmarks."""
    x, y, z = p
    zk = [0, Lt['crotch'], Lt['sh'], Lt['neck'], Lt['H']]
    zv = [0, Ls['crotch'], Ls['sh'], Ls['neck'], Ls['H']]
    if kind == 'arm':
        ax = abs(x)
        sx = np.interp(ax, [0, Lt['chest'], Lt['fx']], [0, Ls['chest'], Ls['fx']])
        if ax > Lt['chest']:
            sz = Ls['armz'](sx) + (z - Lt['armz'](ax))
        else:
            sz = np.interp(z, zk, zv)
        return np.array([np.sign(x) * sx, y, sz])
    if kind == 'leg':
        return np.array([x * Ls['legx'] / Lt['legx'], y if y > -0.06 else y * Ls['toe'] / Lt['toe'], np.interp(z, zk, zv)])
    return np.array([x, y, np.interp(z, zk, zv)])


# Segments: his bone -> the next joint, and the same two points in the suit.
SEG = {}
def seg(name, ba, bb, kind):
    SEG[name] = [to_suit(ba, kind), to_suit(bb, kind), np.array(ba, float), np.array(bb, float), 1.0]
seg('Hips', B['Hips'] - [0, 0, 0.12], B['Spine02'], 'torso')
seg('Spine02', B['Spine02'], B['Spine01'], 'torso')
seg('Spine01', B['Spine01'], B['Spine'], 'torso')
seg('Spine', B['Spine'], B['neck'], 'torso')
seg('neck', B['neck'], B['Head'], 'torso')
seg('Head', B['Head'], [B['Head'][0], B['Head'][1], Lt['H']], 'torso')
for s, X in (('Left', 1), ('Right', -1)):
    seg(s + 'Shoulder', B[s + 'Shoulder'], B[s + 'Arm'], 'arm')
    seg(s + 'Arm', B[s + 'Arm'], B[s + 'ForeArm'], 'arm')
    seg(s + 'ForeArm', B[s + 'ForeArm'], B[s + 'Hand'], 'arm')
    seg(s + 'Hand', B[s + 'Hand'], [X * Lt['fx'], B[s + 'Hand'][1], B[s + 'Hand'][2] - 0.01], 'arm')
    seg(s + 'UpLeg', B[s + 'UpLeg'], B[s + 'Leg'], 'leg')
    seg(s + 'Leg', B[s + 'Leg'], B[s + 'Foot'], 'leg')
    seg(s + 'Foot', B[s + 'Foot'], [B[s + 'Foot'][0], Lt['toe'], 0.03], 'leg')
names = list(SEG)


# ------------------------------------------------------------------ the warp (suit_fit.py's)
def mapping(sa, sb, ba, bb, p):
    u = Vector(sb - sa); L = u.length; u.normalize()
    v = Vector(bb - ba); Lb = v.length; v.normalize()
    S = Matrix.Identity(3) * p
    for i in range(3):
        for j in range(3): S[i][j] += (Lb / L - p) * u[i] * u[j]
    R = u.rotation_difference(v).to_matrix()
    return np.array(Matrix.Translation(Vector(ba)) @ (R @ S).to_4x4() @ Matrix.Translation(-Vector(sa)))


def dist(P, ends):
    out = []
    for n in names:
        a, b = SEG[n][ends[0]], SEG[n][ends[1]]; d = b - a
        t = np.clip(((P - a) @ d) / (d @ d), 0, 1)
        out.append(np.linalg.norm(P - (a + t[:, None] * d), axis=1))
    return np.array(out)


V = verts(me)
# Girth: the suit keeps its own build, shrunk to his height; the mask or cowl takes his (large) head's size.
Ds, Dt = dist(V, (0, 1)), dist(Tv, (2, 3))
k = Lt['H'] / Ls['H']
for n in names: SEG[n][4] = k
ls, lt, i = Ds.argmin(0), Dt.argmin(0), names.index('Head')
rs, rt = np.percentile(Ds[i][ls == i], 40), np.percentile(Dt[i][lt == i], 40)
SEG['Head'][4] = SEG['neck'][4] = float(np.clip(1.04 * rt / rs, k, 1.3))
if NAME == 'spider':
    # A fitted mask, not a hood: scale the mask evenly by his head's girth (rather than stretching it up to the
    # top of his hair into an egg), and give the neck its own, slimmer girth so it narrows under the jaw.
    sa, sb, ba = SEG['Head'][0], SEG['Head'][1], SEG['Head'][2]
    SEG['Head'][3] = ba + (SEG['Head'][3] - ba) / np.linalg.norm(SEG['Head'][3] - ba) * SEG['Head'][4] * np.linalg.norm(sb - sa)
    j = names.index('neck')
    if (ls == j).any() and (lt == j).any():
        SEG['neck'][4] = float(np.clip(1.04 * np.percentile(Dt[j][lt == j], 40) / np.percentile(Ds[j][ls == j], 40), k, SEG['Head'][4]))
print('GIRTH', {n: round(SEG[n][4], 2) for n in names})

W = np.exp(-((Ds - Ds.min(0)) / 0.035) ** 2); W /= W.sum(0)
Vh = np.c_[V, np.ones(len(V))]
NV = sum(W[i][:, None] * (Vh @ mapping(*SEG[n]).T)[:, :3] for i, n in enumerate(names))
me.vertices.foreach_set('co', NV.astype(np.float32).ravel()); me.update()

# ------------------------------------------------------------------ Thor, stealth: off with the Meshy head (his own shows)
if NAME in ('thor', 'stealth'):
    bm = bmesh.new(); bm.from_mesh(me)
    cut = B['neck'][2] + 0.035
    head = [f for f in bm.faces if (c := f.calc_center_median()).z > cut and abs(c.x) < 0.13 and c.y < 0.09]
    if NAME == 'stealth':
        # No hood or cape: the whole head goes, and the Meshy neck's bare skin above the collar (any face that is not
        # the black suit, by its base colour), so only his own neck shows over the collar.
        img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
        iw, ih = img.size; px = np.empty(iw * ih * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(ih, iw, 4)
        uvl = bm.loops.layers.uv.active
        def lum(f):
            u = sum((l[uvl].uv for l in f.loops), Vector((0, 0))) / len(f.loops)
            return px[int(u.y % 1 * (ih - 1)), int(u.x % 1 * (iw - 1)), :3].mean()
        head = [f for f in bm.faces if (c := f.calc_center_median()).z > B['neck'][2] - 0.07 and abs(c.x) < 0.13
                and (c.z > cut or lum(f) > 0.22)]
    bmesh.ops.delete(bm, geom=head, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()

# ------------------------------------------------------------------ skin
for o in bpy.context.selected_objects: o.select_set(False)
bpy.context.view_layer.objects.active = suit; suit.select_set(True)
for g in body.vertex_groups: suit.vertex_groups.new(name=g.name)
dt = suit.modifiers.new('dt', 'DATA_TRANSFER')
dt.object = body; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier='dt')

G = {g.name: g.index for g in suit.vertex_groups}
nv = len(me.vertices)
Wm = np.zeros((nv, len(G)))
for v in me.vertices:
    for e in v.groups: Wm[v.index, e.group] = e.weight
V = verts(me)

if CAPE:
    # The cape: whatever hangs well clear of his legs, arms and torso (by distance from his bones). It hangs
    # from the spine: his own weights at the shoulders, the spine chain from ~25 cm down, so it follows his
    # torso and never his legs.
    def near(keys): return np.min([Db[i] for i, n in enumerate(names) if any(n.endswith(k) for k in keys)], 0)
    def ramp(x, a, b): x = np.clip((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x)
    Db = dist(V, (2, 3))
    c = ramp(near(('UpLeg', 'Leg', 'Foot')), 0.10, 0.14) * ramp(near(('Hips', 'Spine02', 'Spine01', 'Spine')), 0.13, 0.17)         * ramp(near(('Shoulder', 'Arm', 'Hand')), 0.10, 0.14) * (V[:, 2] < Lt['sh'] - 0.02)
    t = ramp(Lt['sh'] - 0.03 - V[:, 2], 0, 0.25) * c
    chain = np.zeros(len(G))
    chain[G['Spine']] = 0.55; chain[G['Spine01']] = 0.3; chain[G['Spine02']] = 0.15
    Wm = (1 - t[:, None]) * Wm + t[:, None] * chain
    print('CAPE verts', int((c > 0.5).sum()), 'of', nv)

# Smooth over the mesh (armpits, crotch, cape edges), then keep the 4 strongest and normalise.
adj = [[] for _ in range(nv)]
for e in me.edges: a, b = e.vertices; adj[a].append(b); adj[b].append(a)
for _ in range(4):
    Wn = np.array([Wm[nb].mean(0) if nb else Wm[i] for i, nb in enumerate(adj)])
    Wm = 0.5 * Wm + 0.5 * Wn
# Gear on his back (the katanas, welded to the suit): the back rides the torso and clavicles only, so the
# handles never bend with an arm or the head (the back of the mask keeps its head weights).
if NAME == 'deadpool':
    keep = [G[n] for n in ('Hips', 'Spine02', 'Spine01', 'Spine', 'LeftShoulder', 'RightShoulder')]
    yb = np.clip((V[:, 1] - 0.07) / 0.04, 0, 1)
    back = yb * (V[:, 2] > Lt['crotch'] + 0.1) * (np.abs(V[:, 0]) < Lt['chest'] + 0.02)
    back[(V[:, 2] > B['Head'][2] - 0.02) & (np.abs(V[:, 0]) < 0.09)] = 0
    hilt = np.clip((V[:, 2] - B['LeftArm'][2] - 0.06) / 0.04, 0, 1) * (np.abs(V[:, 0]) > 0.09) * (V[:, 1] > 0.08)
    Wk = np.zeros_like(Wm); Wk[:, keep] = Wm[:, keep]; Wk[Wk.sum(1) < 1e-6, G['Spine']] = 1
    Wk /= Wk.sum(1, keepdims=True)
    Wm = (1 - back[:, None]) * Wm + back[:, None] * Wk
    Wh = np.zeros_like(Wm); Wh[:, G['Spine']] = 0.8; Wh[:, G['Spine01']] = 0.2  # the hilts: rigid on the chest
    Wm = (1 - hilt[:, None]) * Wm + hilt[:, None] * Wh
if NAME == 'spider':
    # The mask is rigid on his head: from just under the Head joint up, all Head (his hair's neck and spine
    # weights stretched the back of the mask into a hood whenever he looked down).
    h = np.clip((V[:, 2] - (B['Head'][2] - 0.04)) / 0.06, 0, 1) * (np.abs(V[:, 0]) < Lt['chest'])
    h = h * h * (3 - 2 * h)
    Wr = np.zeros_like(Wm); Wr[:, G['Head']] = 1
    Wm = (1 - h[:, None]) * Wm + h[:, None] * Wr
top = np.argsort(-Wm, 1)[:, 4:]
np.put_along_axis(Wm, top, 0, 1)
Wm /= np.maximum(Wm.sum(1, keepdims=True), 1e-8)
assert (Wm.sum(1) > 0.99).all(), 'unweighted vertices'
for g in suit.vertex_groups: g.remove(range(nv))
for gi, g in enumerate(suit.vertex_groups):
    for i in np.nonzero(Wm[:, gi] > 1e-4)[0]: g.add([int(i)], float(Wm[i, gi]), 'REPLACE')

# ------------------------------------------------------------------ his armature, the suit in char1's place
me.transform(body.matrix_world.inverted())
suit.parent = arm; suit.matrix_parent_inverse = Matrix.Identity(4); suit.matrix_basis = body.matrix_basis.copy()
mod = suit.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
suit.name = me.name = 'suit_' + NAME
mat = me.materials[0]; mat.name = 'suit_' + NAME
bpy.data.objects.remove(body, do_unlink=True)
for o in list(bpy.data.objects):
    if o not in (arm, suit): bpy.data.objects.remove(o, do_unlink=True)

# Stealth: markers on his Hips bone for the vault's hang lines (bone-local; wearSuit copies meshes only, so a world
# reads marker.position / quaternion and adds its own Object3D to his Hips bone). The harness is a sit harness:
# its belt at z ~0.86 m; 'harness_ring' on the back of the belt (the lift point face down), 'harness_front' its
# front belay loop.
if NAME == 'stealth':
    bpy.context.view_layer.update()
    Vw = np.array([suit.matrix_world @ v.co for v in me.vertices])
    band = Vw[(np.abs(Vw[:, 0]) < 0.03) & (np.abs(Vw[:, 2] - 0.86) < 0.02)]
    for nm, y in (('harness_ring', band[:, 1].max()), ('harness_front', band[:, 1].min())):
        e = bpy.data.objects.new(nm, None); bpy.context.collection.objects.link(e)
        e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = 'Hips'
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation((0, float(y), 0.86))
        print('MARKER', nm, (0, round(float(y), 3), 0.86))

# Maps: base colour 2048, the others 1024.
for n in mat.node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image:
        base = any(l.to_socket.name == 'Base Color' for out in n.outputs for l in out.links)
        px = 2048 if base else 1024
        if n.image.size[0] > px: n.image.scale(px, px)
        print('MAP', n.image.name, 'base' if base else 'other', tuple(n.image.size))

for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_animations=False, export_skins=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='WEBP', export_image_quality=82)
print('SKINNED', OUT, 'verts', nv, 'tris', sum(len(p.vertices) - 2 for p in me.polygons))
