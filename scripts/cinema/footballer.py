"""The final's footballers (Meshy-rigged, with their own skeleton and 4 clips) for the web, Blender 5.2, from E:/portfolio:
  blender -b --factory-startup --python scripts/cinema/footballer.py -- <in player_anim.glb> public/cinema/final/player.glb
  blender -b --factory-startup --python scripts/cinema/footballer.py -- <in captain_anim.glb> public/cinema/final/captain.glb --ten
Keeps the armature, the one skinned mesh and its clips (Victory_Cheer, Cheer_with_Both_Hands_Up, happy_jump_m,
Cheer_with_Both_Hands); drops the importer's bone-shape icosphere; maps at most 1024 px; Draco + WebP.
--ten paints a white block "10" on the back of his shirt in the base colour (projected from behind onto the faces that
face backward, so it also lies on the sheer robe's back over the shirt).
"""
import bpy, sys, numpy as np

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, TEN = a[0], a[1], '--ten' in a
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for o in list(bpy.data.objects):
    if o.type not in ('ARMATURE', 'MESH') or o.name.startswith('Icosphere'): bpy.data.objects.remove(o, do_unlink=True)
for act in bpy.data.actions: act.use_fake_user = True
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)


def glyph10(u, z, zc=1.2, H=0.22):
    """A block '10' seen from behind: u to the viewer's right, z up (metres); True inside the strokes."""
    t, s = zc + H / 2, 0.03
    one = (np.abs(u + 0.045) < s / 2) & (np.abs(z - zc) < H / 2)
    one |= (u > -0.09) & (u < -0.045) & (z > t - 0.035) & (z < t) & (z - (t - 0.035) > (-0.045 - u) * 0.5)  # its flag
    one |= (np.abs(u + 0.045) < 0.035) & (z > zc - H / 2) & (z < zc - H / 2 + s * 0.9)  # its foot
    def box(a, b): return ((u - 0.06) / a) ** 4 + ((z - zc) / b) ** 4 <= 1
    zero = box(0.045, H / 2) & ~box(0.045 - s, H / 2 - s)
    return one | zero


if TEN:
    m = next(o for o in bpy.data.objects if o.type == 'MESH')
    me = m.data
    nt = me.materials[0].node_tree
    img = next(n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    me.calc_loop_triangles()
    W = m.matrix_world
    P = np.array([W @ v.co for v in me.vertices])
    uvd = me.uv_layers.active.data
    painted = 0
    for tri in me.loop_triangles:
        c = P[list(tri.vertices)].mean(0)
        n = (W.to_3x3() @ tri.normal).normalized()
        if n.y < 0.35 or abs(c[0]) > 0.16 or not (1.04 < c[2] < 1.36): continue  # faces looking backward, on his back
        T3 = P[list(tri.vertices)]
        T2 = np.array([uvd[l].uv[:] for l in tri.loops]) * [w, h]
        lo, hi = np.floor(T2.min(0)).astype(int), np.ceil(T2.max(0)).astype(int) + 1
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0]), np.arange(lo[1], hi[1]))
        q = np.c_[xs.ravel() + 0.5, ys.ravel() + 0.5]
        Mx = np.array([T2[1] - T2[0], T2[2] - T2[0]]).T
        if abs(np.linalg.det(Mx)) < 1e-9: continue
        bc = np.linalg.solve(Mx, (q - T2[0]).T).T
        inside = (bc[:, 0] >= -0.02) & (bc[:, 1] >= -0.02) & (bc.sum(1) <= 1.02)
        p3 = T3[0] + bc[:, :1] * (T3[1] - T3[0]) + bc[:, 1:] * (T3[2] - T3[0])
        hit = inside & glyph10(-p3[:, 0], p3[:, 2])
        xi, yi = (q[hit, 0]).astype(int) % w, (q[hit, 1]).astype(int) % h
        px[yi, xi, :3] = 0.93
        painted += int(hit.sum())
    img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
    print('TEN texels', painted)

for o in bpy.data.objects: o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_skins=True,
    export_animations=True, export_animation_mode='ACTIONS',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_image_format='WEBP', export_image_quality=82)
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
V = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
print('FOOTBALLER', OUT, 'height', round(float(np.ptp(V[:, 2])), 3), 'clips', [x.name for x in bpy.data.actions])
