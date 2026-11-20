# python scripts/cinema/aloha.py <outdir with faces.json, tris.json, Material_0_baseColor.png, print.png> public/cinema/traveller_aloha.webp
# print.png: an original aloha textile swatch (Meshy text-to-image, nano-banana-pro).
"""The aloha shirt texture: an original print laid into the shirt's UV islands, then, painted by 3D
position (a rest-pose position map rasterised from the mesh), an open V neck, a camp collar, and a
button placket, so the T-shirt reads as a button-up beach shirt. Blender coords: front is -y, up is z."""
import json, sys, colorsys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
d, out = sys.argv[1], sys.argv[2]
base = Image.open(f'{d}/Material_0_baseColor.png').convert('RGB')
W, H = base.size
b = np.asarray(base).astype(np.float32) / 255
faces = json.load(open(f'{d}/faces.json'))
tris = json.load(open(f'{d}/tris.json'))
def cream(h, s, v): return not (s < 0.12 and v > 0.5) and s < 0.45 and v > 0.55
def skin(h, s, v): return s >= 0.45 and v > 0.3
mask = Image.new('L', (W, H), 0)
dr = ImageDraw.Draw(mask)
skins = []
for f in faces:
    x, y, z = f['c']
    if cream(*f['hsv']) and 0.6 < z < 1.45 and abs(x) < 0.5:
        dr.polygon([(u * W, (1 - v) * H) for u, v in f['uv']], fill=255)
    if skin(*f['hsv']) and 1.36 < z < 1.46 and abs(x) < 0.08:
        u, v = np.mean(f['uv'], axis=0)
        skins.append(b[min(H - 1, int((1 - v) * H)), min(W - 1, int(u * W))])
mask = mask.filter(ImageFilter.MaxFilter(5))
m = np.asarray(mask) > 127
skin_rgb = np.median(np.array(skins), axis=0)

# Rest-pose position map over the shirt's islands.
pos = np.zeros((H, W, 3), np.float32)
has = np.zeros((H, W), bool)
for t in tris:
    P = np.array([a[:3] for a in t], np.float32)
    if not (0.55 < P[:, 2].mean() < 1.5 and abs(P[:, 0].mean()) < 0.55): continue
    UV = np.array([[a[3] * W, (1 - a[4]) * H] for a in t], np.float32)
    x0, y0 = np.floor(UV.min(0)).astype(int); x1, y1 = np.ceil(UV.max(0)).astype(int)
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    px, py = xs + 0.5, ys + 0.5
    (ax, ay), (bx, by), (cx, cy) = UV
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9: continue
    w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
    w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
    w2 = 1 - w0 - w1
    inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
    q = np.stack([w0, w1, w2], -1) @ P
    pos[ys[inside], xs[inside]] = q[inside]
    has[ys[inside], xs[inside]] = True
for _ in range(4):  # grow into the island padding
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        src = np.roll(np.roll(has, dy, 0), dx, 1)
        fill = ~has & src
        pos[fill] = np.roll(np.roll(pos, dy, 0), dx, 1)[fill]
        has |= fill

lum = b @ np.array([0.299, 0.587, 0.114], np.float32)
ref = np.median(lum[m])
shade = np.clip(lum / ref, 0.5, 1.12)[..., None]
tile = Image.open(f'{d}/print.png').convert('RGB').resize((260, 260), Image.LANCZOS)
pat = Image.new('RGB', (W, H))
for ty in range(0, H, 260):
    for tx in range(0, W, 260):
        pat.paste(tile, (tx, ty))  # ~5 cm blossoms on the body
p = np.asarray(pat).astype(np.float32) / 255
res = np.where(m[..., None], p, b)

X, Y, Z = pos[..., 0], pos[..., 1], pos[..., 2]
front = Y < -0.015
ZB, ZT = 1.13, 1.42  # the V: its point, and the neckline
k = np.clip((Z - ZB) / (ZT - ZB), 0, 1)
vw = k * 0.085  # half-width of the opening
lw = np.clip(k * 1.6, 0, 1) * 0.05  # each lapel widens from the point of the V
ax = np.abs(X)
opening = m & has & front & (Z > ZB) & (ax < vw)
lapel = m & has & front & ~opening & (Z > ZB) & (ax < vw + lw)
lapel_edge = m & has & front & (Z > ZB + 0.02) & (ax >= vw + lw) & (ax < vw + lw + 0.008)
back_collar = m & has & ~front & (Z > 1.365) & (ax < 0.11)
back_edge = m & has & ~front & (Z > 1.352) & (Z <= 1.365) & (ax < 0.11)
collar = lapel | back_collar
edge = lapel_edge | back_edge
placket = m & has & front & (Z < ZB) & (Z > 0.6) & (np.abs(X - 0.004) < 0.017)
seam = placket & (np.abs(np.abs(X - 0.004) - 0.017) < 0.0035)
zk = np.round((ZB - 0.04 - Z) / 0.09) * 0.09
btn_d = np.hypot(X - 0.004, (ZB - 0.04 - Z) - zk)
button = placket & (btn_d < 0.0105) & (Z < ZB - 0.02)
res = np.where(collar[..., None], np.clip(p * 1.08 + 0.03, 0, 1), res)  # the collar: same cloth, catching more light
res = np.where(edge[..., None], p * 0.45, res)  # the shadow under the collar's edge
res = np.where(seam[..., None], p * 0.55, res)  # placket stitching
res = np.where(button[..., None], np.array([0.95, 0.92, 0.85], np.float32), res)
res = np.where((button & (btn_d > 0.0078))[..., None], np.array([0.55, 0.5, 0.45], np.float32), res)
res = np.where(m[..., None], np.clip(res * shade, 0, 1), res)
res = np.where(opening[..., None], np.clip(skin_rgb * np.clip(lum / max(np.median(lum[opening]) if opening.any() else ref, 1e-3), 0.6, 1.15)[..., None] * 0.92, 0, 1), res)
img = Image.fromarray((res * 255).astype(np.uint8))
img.save(out, 'WEBP', quality=88)
img.save(f'{d}/aloha.png')
print('opening px', int(opening.sum()), 'collar px', int(collar.sum()), 'buttons px', int(button.sum()), 'skin', skin_rgb.round(3))
