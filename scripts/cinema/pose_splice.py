"""
pose_splice.py: join the clean solo dance shots of a long tracked stretch into one landmarks JSON for pose_retarget.py.

USAGE: python scripts/cinema/pose_splice.py refs/dance_pose_full.json refs/dance_pose.json
  then: python scripts/cinema/pose_retarget.py refs/dance_pose.json public/cinema/dance/routine.glb
The full JSON is pose_track.html run over one long stretch (from 99 s here). SHOTS are film times of the
shots where he dances alone, upper body in frame. Per shot: front/back flips dropped, shins folded back (a
squat hidden by the letterbox, read as a kneel) refilled; a 6-frame blend across each join; "bye" beats at
the three strongest straight-arm, hand-high pushes, 3 s apart.
"""
import json, sys
import numpy as np
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))
F, fps, T0 = d['frames'], d['fps'], 99.0
SHOTS = [(102.0, 104.4), (128.5, 130.6), (136.9, 142.5), (153.4, 156.0), (173.3, 174.7), (194.0, 196.5), (196.7, 198.4)]
BLEND = 6
LEGS = range(25, 33)

def arr(f, k):
    a = np.array(f[k], float)
    if k == 'world':
        a[LEGS, 3] = np.maximum(a[LEGS, 3], 0.35)  # legs below the letterbox: keep MediaPipe's guess, not a held pose
    return a

def frames_of(a, b):
    out = [F[i] for i in range(int(round((a - T0) * fps)), int(round((b - T0) * fps)) + 1)]
    # hold the nearest found pose over the odd missed frame
    last = next(f for f in out if f['world'])
    res = []
    for f in out:
        if f['world']: last = f
        res.append(last)
    return res

def facing(w, l, r):
    return np.degrees(np.arctan2((w[:, l, 2] - w[:, r, 2]), w[:, l, 0] - w[:, r, 0]))

def unflip(sh):
    """MediaPipe now and then flips him front to back for a frame or a few: drop those, interpolate across."""
    w = np.array([x for x, _ in sh]); im = np.array([y for _, y in sh])
    bad = np.zeros(len(w), bool)
    for l, r in ((23, 24), (11, 12)):
        y = facing(w, l, r)
        bad |= np.abs((y - np.median(y) + 180) % 360 - 180) > 75
    good = np.where(~bad)[0]
    t = np.arange(len(w))
    for A in (w, im):
        flat = A.reshape(len(A), -1)
        for c in range(flat.shape[1]):
            flat[bad, c] = np.interp(t[bad], good, flat[good, c])
    return list(zip(w, im)), int(bad.sum())

seq = []
for a, b in SHOTS:
    sh, nb = unflip([(arr(f, 'world'), arr(f, 'image')) for f in frames_of(a, b)])
    knee = 0
    for w, _ in sh:
        for leg in ((25, 27, 29, 31), (26, 28, 30, 32)):
            if w[leg[1], 1] - w[leg[0], 1] < 0.18:  # y down: a shin folded back is a kneel the letterbox hid; fill that leg from its neighbours
                w[list(leg), 3] = 0; knee += 1
    print(f'shot {a}-{b}: {nb} flipped frames dropped, {knee} folded legs filled')
    if seq:
        (w0, i0), (w1, i1) = seq[-1], sh[0]
        for k in range(1, BLEND + 1):
            s = k / (BLEND + 1); s = s * s * (3 - 2 * s)
            bw = w0 * (1 - s) + w1 * s; bw[:, 3] = np.minimum(w0[:, 3], w1[:, 3]); seq.append((bw, i0 * (1 - s) + i1 * s))
    seq += sh
n = len(seq)
W = np.array([w for w, _ in seq])
# byes: an arm straight out with the hand at or above shoulder height (the palm-out push), 3 s apart
r = np.zeros(n)
for sh_, el, wr in ((11, 13, 15), (12, 14, 16)):
    ext = np.linalg.norm(W[:, wr, :3] - W[:, sh_, :3], axis=1) / (np.linalg.norm(W[:, el, :3] - W[:, sh_, :3], axis=1) + np.linalg.norm(W[:, wr, :3] - W[:, el, :3], axis=1))
    up = W[:, sh_, 1] - W[:, wr, 1]  # y down
    r = np.maximum(r, ext + 1.5 * np.clip(up + 0.15, -0.3, 0.3))
r = np.convolve(r, np.ones(9) / 9, 'same')
r[-fps:] = 0
byes = []
for i in np.argsort(-r):
    if all(abs(i - j) > fps * 3 for j in byes): byes.append(int(i))
    if len(byes) == 3: break
byes = sorted(round(i / fps, 3) for i in byes)
out = {'source': d['source'], 'fps': fps, 'aspect': d['aspect'], 'from': 0, 'shots': SHOTS, 'byes': byes,
       'frames': [{'t': round(i / fps, 4), 'world': np.round(w, 5).tolist(), 'image': np.round(im, 5).tolist()} for i, (w, im) in enumerate(seq)]}
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print(n, 'frames', round(n / fps, 2), 's; byes', byes, [round(float(r[int(b * fps)]), 2) for b in byes])
