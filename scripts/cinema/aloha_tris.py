"""Blender: export the traveller's triangles (rest-pose position + UV per corner) for aloha.py.
blender -b --factory-startup --python scripts/cinema/aloha_tris.py -- <outdir>
"""
import bpy, sys, json
out = sys.argv[sys.argv.index('--') + 1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath='public/cinema/traveller.glb')
m = bpy.data.objects['char1']
mw = m.matrix_world
uv = m.data.uv_layers.active.data
V = m.data.vertices
tris = []
for p in m.data.polygons:
    L = list(p.loop_indices)
    for k in range(1, len(L) - 1):
        t = []
        for li in (L[0], L[k], L[k + 1]):
            co = mw @ V[m.data.loops[li].vertex_index].co
            t.append([round(co.x, 4), round(co.y, 4), round(co.z, 4), round(uv[li].uv[0], 5), round(uv[li].uv[1], 5)])
        tris.append(t)
json.dump(tris, open(out + '/tris.json', 'w'))
# Cross-sections for the armour: half-width and depth of the body at a few heights (|x| < 0.3 keeps the arms out).
vs = [mw @ v.co for v in V]
for z in (1.0, 1.1, 1.2, 1.3, 1.36):
    sl = [v for v in vs if abs(v.z - z) < 0.02 and abs(v.x) < 0.3]
    print('SECT', z, round(max(abs(v.x) for v in sl), 3), round(min(v.y for v in sl), 3), round(max(v.y for v in sl), 3))
hd = [v for v in vs if v.z > 1.45]
print('HEAD', [round(min(v[i] for v in hd), 3) for i in range(3)], [round(max(v[i] for v in hd), 3) for i in range(3)])
hand = [v for v in vs if v.x < -0.55]
print('RHAND', [round(min(v[i] for v in hand), 3) for i in range(3)], [round(max(v[i] for v in hand), 3) for i in range(3)])
print('TRIS', len(tris))
