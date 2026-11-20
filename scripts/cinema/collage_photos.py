"""Download Commons files and turn them into collage pieces.
usage: python process_cast.py jobs.json
jobs: [{"key": "ranbir", "title": "File:....jpg", "mode": "head"|"full"|"object"|"torn"}]
  head   -> people sticker cropped to head & shoulders, white rim   -> <key>-s.webp
  full   -> people sticker, whole figure, white rim                  -> <key>-s.webp
  object -> object sticker (general model), white rim                -> <key>-s.webp
  torn   -> torn-paper print with a white border                     -> <key>-t.webp
Raw downloads are kept in raw2/ (untrusted data; only PIL reads them).
"""
import io, json, os, random, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageFilter, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')  # downloaded originals (gitignored)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'novel', 'collage')
UA = {'User-Agent': 'portfolio-collage-builder/1.0 (personal website; python-urllib)'}
os.makedirs(RAW, exist_ok=True)
_sessions = {}


def session(name):
    from rembg import new_session
    if name not in _sessions:
        _sessions[name] = new_session(name)
    return _sessions[name]


def fetch(title, key):
    path = os.path.join(RAW, key + '.jpg')
    if os.path.exists(path) and os.path.getsize(path) > 10000:
        return path
    name = title.replace('File:', '', 1).replace(' ', '_')
    url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(name) + '?width=1280'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                data = r.read()
            Image.open(io.BytesIO(data)).verify()
            open(path, 'wb').write(data)
            return path
        except Exception as e:  # noqa: BLE001 - retry transient network errors
            print('  retry', key, e)
            time.sleep(20 + attempt * 20)
    raise RuntimeError('download failed: ' + key)


def cutout(img, people):
    from rembg import remove
    if people:
        return remove(img, session=session('u2net_human_seg'), alpha_matting=True,
                      alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=12,
                      alpha_matting_erode_size=8)
    return remove(img, session=session('isnet-general-use'))


def sticker(rgba, rim_frac=0.022):
    a = rgba.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    w = rgba.width
    r = max(3, int(w * rim_frac))
    pad = r + 4
    canvas = Image.new('RGBA', (rgba.width + pad * 2, rgba.height + pad * 2), (0, 0, 0, 0))
    big = Image.new('L', canvas.size, 0)
    big.paste(a, (pad, pad))
    rim = big.filter(ImageFilter.MaxFilter(r * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v > 128 else 0)
    white = Image.new('RGBA', canvas.size, (252, 250, 244, 255))
    white.putalpha(rim)
    canvas.alpha_composite(white)
    canvas.alpha_composite(rgba, (pad, pad))
    return canvas


def torn(img):
    img = img.convert('RGB')
    img.thumbnail((1200, 1200))
    w, h = img.size
    b = int(min(w, h) * 0.035)
    W, H = w + b * 2, h + b * 2
    paper = Image.new('RGBA', (W, H), (250, 247, 238, 255))
    paper.paste(img, (b, b))
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    amp = min(W, H) * 0.012

    def walk(n):
        v, out = 0.0, []
        for _ in range(n):
            v = v * 0.86 + random.uniform(-1, 1)
            out.append(v)
        m = max(1e-6, max(abs(x) for x in out))
        return [x / m * amp for x in out]

    step = 6
    top = walk(W // step + 2); bot = walk(W // step + 2); lef = walk(H // step + 2); rig = walk(H // step + 2)
    pts = [(i * step, amp + top[i]) for i in range(W // step + 1)]
    pts += [(W - amp + rig[i], i * step) for i in range(H // step + 1)]
    pts += [(W - i * step, H - amp + bot[i]) for i in range(W // step + 1)]
    pts += [(amp + lef[i], H - i * step) for i in range(H // step + 1)]
    d.polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    paper.putalpha(mask)
    return paper


def run(job):
    key, mode = job['key'], job['mode']
    src = Image.open(fetch(job['title'], key)).convert('RGB')
    if mode == 'torn':
        out = torn(src)
        name = key + '-t.webp'
    else:
        src.thumbnail((1400, 1400))
        cut = cutout(src, people=mode in ('head', 'full') and job.get('model') != 'isnet')
        # Keep the figure, drop stray scraps of background the matting let through.
        import numpy as np
        from skimage.measure import label
        arr = np.array(cut)
        lab = label(arr[..., 3] > 40)
        if lab.max() > 1:
            sizes = np.bincount(lab.ravel())[1:]
            keep = np.isin(lab, np.flatnonzero(sizes >= sizes.max() * 0.15) + 1)
            arr[..., 3] = np.where(keep, arr[..., 3], 0)
            cut = Image.fromarray(arr)
        bbox = cut.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
        cut = cut.crop(bbox)
        if mode == 'head':
            # Head and shoulders: keep the top of the figure, about as tall as it is wide.
            hh = min(cut.height, int(cut.width * job.get('ratio', 1.05)))
            cut = cut.crop((0, 0, cut.width, hh))
            # Fade the hard crop line at the bottom into the rim.
            a = cut.getchannel('A')
            fade = Image.linear_gradient('L').resize((cut.width, max(1, int(hh * 0.08))))
            fade = ImageChops.invert(fade)
            a.paste(ImageChops.multiply(a.crop((0, hh - fade.height, cut.width, hh)), fade), (0, hh - fade.height))
            cut.putalpha(a)
        out = sticker(cut)
        name = key + '-s.webp'
    out.thumbnail((job.get('max', 760), job.get('max', 760)))
    out.save(os.path.join(OUT, name), 'WEBP', quality=84, method=6)
    print('ok', name, out.size)


if __name__ == '__main__':
    jobs = json.load(open(sys.argv[1], encoding='utf-8'))
    only = set(sys.argv[2:])
    for j in jobs:
        if only and j['key'] not in only:
            continue
        try:
            run(j)
        except Exception as e:  # noqa: BLE001 - report and continue with the rest
            print('FAIL', j['key'], e)
