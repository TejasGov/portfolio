"""Blender: export the traveller's faces (centre, UVs, texture colour) and its base-colour texture for aloha.py.
blender -b --factory-startup --python scripts/cinema/aloha_faces.py -- <outdir>
"""
import bpy, sys, json, colorsys
out = sys.argv[sys.argv.index('--') + 1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath='public/cinema/traveller.glb')
m = bpy.data.objects['char1']
img = bpy.data.images['Material_0_baseColor']
W, H = img.size
px = img.pixels[:]
def col(u, v):
    x = min(W - 1, max(0, int(u * W))); y = min(H - 1, max(0, int(v * H)))
    i = (y * W + x) * 4
    return px[i], px[i + 1], px[i + 2]
uv = m.data.uv_layers.active.data
faces = []
for p in m.data.polygons:
    c = m.matrix_world @ p.center
    us = [tuple(uv[li].uv) for li in p.loop_indices]
    cu = sum(a for a, b in us) / len(us); cv = sum(b for a, b in us) / len(us)
    r, g, b = col(cu, cv)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)  # linear values, fine for a coarse class
    faces.append({'c': [round(c.x, 3), round(c.y, 3), round(c.z, 3)], 'uv': [[round(a, 5), round(b, 5)] for a, b in us], 'hsv': [round(h, 3), round(s, 3), round(v, 3)], 'n': [round(p.normal.x, 2), round(p.normal.y, 2), round(p.normal.z, 2)]})
json.dump(faces, open(out + '/faces.json', 'w'))
print('FACES', len(faces))

img.filepath_raw = out + "/Material_0_baseColor.png"
img.file_format = "PNG"
img.save()
