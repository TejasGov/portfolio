"""
pose_splice.py: join every shot of a long tracked stretch where he is the one tracked (dancing or fighting),
in film order and on the music's beat, into one landmarks JSON for pose_retarget.py.

USAGE: python scripts/cinema/pose_splice.py refs/dance_pose_full.json refs/dance.mp4 refs/dance_pose.json
  then: python scripts/cinema/pose_retarget.py refs/dance_pose.json public/cinema/dance/routine.glb
The full JSON is pose_track.html run over one long stretch (from film time T0). SHOTS are film times of the
shots where the tracker holds him (not a foe he's fighting): checked by eye against the tracked skeleton drawn
over the frames, and by the red of his suit under the tracked torso.

The beat: the film's audio is read only for its timing (onset strength -> tempo and each shot's local beat
phase); nothing of it is kept. Each shot is trimmed to whole beats and resampled to exactly that many beats
at BPM, so the spliced routine sits on one even grid from t = 0 and a track written at BPM stays on his steps.
Per shot: front/back flips dropped, folded shins (a squat hidden by the letterbox) refilled, the whole shot
turned upright (a high or low camera tilts the tracked body), and the first BLEND frames eased in from the last
shot's pose (in place, so the grid never shifts). "bye" beats at the three strongest straight-arm, hand-high
pushes, 3 s apart.
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import stft

src, video, dst = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(src))
F, fps, T0 = d['frames'], d['fps'], 99.0
BPM = 172.5
P = 60 / BPM
# Film seconds: the dance in the trees, the punches, the overhead brawl among the fallen, the dance shots, the
# crouched fight, the wide fight by the light doors, the last stand among the bodies, and the closing dance.
SHOTS = [(100.75, 104.55), (116.5, 117.95), (118.1, 124.55, 'crane'), (128.5, 130.7), (136.85, 142.55), (153.35, 156.0),
         (159.0, 160.25), (160.3, 162.7), (171.1, 172.55), (173.3, 174.75), (174.8, 176.0), (183.8, 185.7),
         (188.6, 190.3), (193.35, 196.5), (196.65, 198.9)]
BLEND = 5
LEGS = range(25, 33)


# ------------------------------------------------------------------ the beat (timing only)
def beat_grid():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(T0), '-t', str(len(F) / fps + 1), '-i', video,
                          '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16) / 32768
    hop = 256
    _, _, Z = stft(x, 22050, nperseg=1024, noverlap=1024 - hop)
    M = np.log1p(100 * np.abs(Z))
    flux = np.maximum(0, np.diff(M, axis=1)).sum(0)
    flux = (flux - flux.mean()) / flux.std()
    return flux, np.arange(len(flux)) * hop / 22050  # envelope, its times (s from T0)


FLUX, FT = beat_grid()


def local_beats(a, b):
    """The beats in film time over a..b: the phase that best fits the onsets within 3 s either side."""
    m = (FT >= a - T0 - 3) & (FT <= b - T0 + 3)
    ph = np.linspace(0, P, 240, endpoint=False)
    sc = [np.sum(FLUX[m] * np.cos(2 * np.pi * (FT[m] - p) / P)) for p in ph]
    p0 = T0 + ph[int(np.argmax(sc))]
    k0, k1 = int(np.ceil((a - p0) / P)), int(np.floor((b - p0) / P))
    return p0 + k0 * P, k1 - k0  # first beat in the shot, whole beats that fit


# ------------------------------------------------------------------ one shot's landmarks
def arr(f, k):
    a = np.array(f[k], float)
    if k == 'world':
        a[LEGS, 3] = np.maximum(a[LEGS, 3], 0.35)  # legs below the letterbox: keep MediaPipe's guess, not a held pose
    return a


def sample(t):
    """World and image landmarks at film time t (linear between tracked frames; a missed frame takes its neighbour)."""
    x = (t - T0) * fps
    i = int(np.clip(np.floor(x), 0, len(F) - 2)); u = x - i
    near = lambda j: next(F[k] for r in range(len(F)) for k in (j - r, j + r) if 0 <= k < len(F) and F[k]['world'])
    fa, fb = near(i), near(i + 1)
    return [arr(fa, k) * (1 - u) + arr(fb, k) * u for k in ('world', 'image')]


def facing(w, l, r):
    return np.degrees(np.arctan2((w[:, l, 2] - w[:, r, 2]), w[:, l, 0] - w[:, r, 0]))


def unflip(w, im):
    """MediaPipe now and then flips him front to back for a frame or a few: drop those, interpolate across."""
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
    return int(bad.sum())


def rot(axis, ang):
    axis = axis / np.linalg.norm(axis)
    K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K


def upright(w, crane):
    """Face the shot front (each shot's camera sees him from its own side; the film frames him facing it): his
    median hip facing turned to the camera. A craning shot is also levelled frame by frame: his feet-to-shoulders
    line, averaged over a second and a half either way (over a dancer's feet, whatever his torso does), stood
    straight up as the camera rises. Other shots keep their tilt: with his legs under the letterbox MediaPipe
    guesses them, and a level camera needs no help."""
    tilt = 0.0
    if crane:
        ax = (w[:, 11, :3] + w[:, 12, :3]) / 2 - (w[:, 27, :3] + w[:, 28, :3]) / 2
        k = np.ones(int(1.5 * fps) * 2 + 1)
        pad = np.pad(ax, ((len(k) // 2, len(k) // 2), (0, 0)), mode='edge')
        ax = np.stack([np.convolve(pad[:, c], k, 'valid') for c in range(3)], 1)
        want = np.array([0, -1.0, 0])  # MediaPipe: y down
        for i in range(len(w)):
            u = ax[i] / np.linalg.norm(ax[i]); v = np.cross(u, want)
            a = float(np.arctan2(np.linalg.norm(v), u @ want))
            if a > 1e-4: w[i, :, :3] = w[i, :, :3] @ rot(v, a).T
            tilt = max(tilt, np.degrees(a))
    yaw = np.radians(np.median(facing(w, 23, 24)))  # 0 when his left hip is at +x, i.e. facing the camera
    w[:, :, :3] = w[:, :, :3] @ rot(np.array([0, 1.0, 0]), yaw).T
    left = np.median(facing(w, 23, 24))
    assert abs(left) < 5, f'shot not turned to the front ({left:.0f} deg)'
    return tilt


seq, used = [], []
for a, b, *crane in SHOTS:
    t0, nb = local_beats(a, b)
    if nb < 2:
        print(f'shot {a}-{b}: under two beats, skipped'); continue
    n = int(round(nb * P * fps))  # exactly nb beats on the output grid
    ts = t0 + np.arange(n) * (nb * P / n) * (1 / 1)  # film times spread evenly over the shot's beats
    S = [sample(t) for t in ts]
    w = np.array([x for x, _ in S]); im = np.array([y for _, y in S])
    flips = unflip(w, im)
    tilt = upright(w, bool(crane))
    knee = 0
    for f in w:
        for leg in ((25, 27, 29, 31), (26, 28, 30, 32)):
            if f[leg[1], 1] - f[leg[0], 1] < 0.18:  # y down: a shin folded back is a kneel the letterbox hid; fill that leg from its neighbours
                f[list(leg), 3] = 0; knee += 1
    if seq:  # ease in from the last shot's pose over this shot's first frames
        w0, i0 = seq[-1]
        for k in range(BLEND):
            s = (k + 1) / (BLEND + 1); s = s * s * (3 - 2 * s)
            vis = np.minimum(w0[:, 3], w[k, :, 3])
            w[k] = w0 * (1 - s) + w[k] * s; w[k, :, 3] = vis
            im[k] = i0 * (1 - s) + im[k] * s
    seq += list(zip(w, im))
    used.append([round(t0, 3), nb])
    print(f'shot {a}-{b}: {nb} beats from {t0:.2f}, {flips} flipped frames, {knee} folded legs, levelled {tilt:.0f} deg')

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
out = {'source': d['source'], 'fps': fps, 'aspect': d['aspect'], 'from': 0, 'shots': used, 'byes': byes, 'bpm': BPM, 'faced': True,
       'frames': [{'t': round(i / fps, 4), 'world': np.round(w, 5).tolist(), 'image': np.round(im, 5).tolist()} for i, (w, im) in enumerate(seq)]}
json.dump(out, open(dst, 'w'), separators=(',', ':'))
assert abs(n / fps - sum(b for _, b in used) * P) < 1.5 / fps, 'the routine is off the beat grid'
print(n, 'frames', round(n / fps, 2), 's,', sum(b for _, b in used), 'beats; byes', byes)
