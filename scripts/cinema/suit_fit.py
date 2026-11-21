"""Fit the Meshy suit (red and gold, T-pose) onto the traveller's rest skeleton and cut it into rigid per-bone pieces
for the dive (public/cinema/dive/suit.glb). bones.json comes from suit_bones.py (traveller.glb's rest bones, metres).
blender -b --factory-startup --python suit_fit.py -- <meshy suit.glb> <bones.json> <out.glb> <verts_out.npy>"""
import bpy, bmesh, sys, json, numpy as np
from mathutils import Vector, Matrix
SRC, BONES, OUT, VOUT = sys.argv[sys.argv.index('--')+1:]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=SRC)
m = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = m; m.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
m.data.transform(Matrix.Translation((0, 0, 0.903)))  # feet on the ground
dec = m.modifiers.new('d', 'DECIMATE'); dec.ratio = 0.14
bpy.ops.object.modifier_apply(modifier='d')
B = {k: np.array(v[0]) for k, v in json.load(open(BONES)).items()}

# Suit landmarks (measured off its silhouette) -> his bones; p = scale across the bone.
SEG = {}
def seg(name, sa, sb, ba, bb, p): SEG[name] = tuple(np.array(x, float) for x in (sa, sb, ba, bb)) + (p,)
seg('Hips',    (0,0,0.93), (0,0,1.208), (0,0.028,0.79), B['Spine02'], 1.0)
seg('Spine02', (0,0,1.208), (0,0,1.338), B['Spine02'], B['Spine01'], 1.04)
seg('Spine01', (0,0,1.338), (0,0,1.473), B['Spine01'], B['Spine'], 1.06)
seg('Spine',   (0,0,1.473), (0,0,1.56), B['Spine'], B['neck'], 1.04)
seg('Head',    (0,-0.01,1.56), (0,-0.01,1.81), (0,0.005,1.46), (0,0.005,1.745), 1.16)
for s, X in (('Left', 1), ('Right', -1)):
    f = lambda v: (X*v[0], v[1], v[2])
    seg(s+'Shoulder', f((0.04,0,1.47)), f((0.25,0.0,1.44)), B[s+'Shoulder'], B[s+'Arm'], 1.0)
    seg(s+'Arm',      f((0.25,0.02,1.44)), f((0.50,0.02,1.42)), B[s+'Arm'], B[s+'ForeArm'], 1.0)
    seg(s+'ForeArm',  f((0.50,0.02,1.42)), f((0.72,0.03,1.40)), B[s+'ForeArm'], B[s+'Hand'], 0.92)
    seg(s+'Hand',     f((0.72,0.03,1.40)), f((0.95,0.03,1.38)), B[s+'Hand'], B[s+'Hand'] + [X*0.2, 0, -0.01], 0.9)
    seg(s+'UpLeg',    f((0.11,0,0.97)), f((0.15,-0.03,0.54)), B[s+'UpLeg'], B[s+'Leg'], 0.8)
    seg(s+'Leg',      f((0.15,-0.03,0.54)), f((0.17,0.03,0.12)), B[s+'Leg'], B[s+'Foot'], 0.8)
    seg(s+'Foot',     f((0.17,0.03,0.12)), f((0.17,-0.16,0.03)), B[s+'Foot'], B[s+'Foot'] + [0, -0.20, -0.09], 0.82)
names = list(SEG)
TORSO = {'Hips', 'Spine02', 'Spine01', 'Spine'}

def mapping(sa, sb, ba, bb, p):
    u = Vector(sb - sa); L = u.length; u.normalize()
    v = Vector(bb - ba); Lb = v.length; v.normalize()
    S = Matrix.Identity(3) * p
    for i in range(3):
        for j in range(3): S[i][j] += (Lb / L - p) * u[i] * u[j]
    R = u.rotation_difference(v).to_matrix()
    return np.array(Matrix.Translation(Vector(ba)) @ (R @ S).to_4x4() @ Matrix.Translation(-Vector(sa)))

def dist(P):
    out = []
    for n in names:
        sa, sb = SEG[n][0], SEG[n][1]; d = sb - sa
        t = np.clip(((P - sa) @ d) / (d @ d), 0, 1)
        out.append(np.linalg.norm(P - (sa + t[:, None]*d), axis=1) - (0.06 * (P[:, 2] < 1.5) if n in TORSO else 0))  # the chest (not the collar) is the torso's
    return np.array(out)

me = m.data
cen = np.empty(len(me.polygons)*3, np.float32); me.polygons.foreach_get('center', cen); cen = cen.reshape(-1, 3)
lab = np.argmin(dist(cen), axis=0)
face = (lab == names.index('Head')) & (cen[:, 1] < -0.045) & (cen[:, 2] > 1.565) & (cen[:, 2] < 1.765)

# Warp each vertex by a smooth blend of the per-bone fits (as skinning does): no tears in the rest pose.
nv = len(me.vertices); V = np.empty(nv*3, np.float32); me.vertices.foreach_get('co', V); V = V.reshape(-1, 3).astype(float)
Dv = dist(V); W = np.exp(-((Dv - Dv.min(0)) / 0.035)**2); W /= W.sum(0)
Vh = np.c_[V, np.ones(nv)]
NV = sum(W[i][:, None] * (Vh @ mapping(*SEG[n]).T)[:, :3] for i, n in enumerate(names))
me.vertices.foreach_set('co', NV.astype(np.float32).ravel()); me.update()
names.append('Faceplate'); lab[face] = len(names) - 1
print({n: int((lab == i).sum()) for i, n in enumerate(names)})

bm = bmesh.new(); bm.from_mesh(me)
pieces = []
for i, n in enumerate(names):
    keep = set(np.nonzero(lab == i)[0].tolist())
    if not keep: continue
    nb = bm.copy(); nb.faces.ensure_lookup_table()
    bmesh.ops.delete(nb, geom=[f for f in nb.faces if f.index not in keep], context='FACES')
    nm = bpy.data.meshes.new('suit_' + n); nb.to_mesh(nm); nb.free()
    for mat in me.materials: nm.materials.append(mat)
    o = bpy.data.objects.new('suit_' + n, nm); bpy.context.collection.objects.link(o); pieces.append(o)
bm.free(); bpy.data.objects.remove(m, do_unlink=True)
np.save(VOUT, np.concatenate([np.array([v.co for v in o.data.vertices]) for o in pieces]))
print('tris', sum(len(o.data.polygons) for o in pieces))
for img in bpy.data.images:
    if img.size[0] > 1024 and 'Image_0' not in img.name: img.scale(1024, 1024)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6, export_image_format='WEBP', export_image_quality=85)
