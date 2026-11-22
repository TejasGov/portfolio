"""
pose_keyed.py: the hand-keyed placeholder "Bye Bye Bye" routine, written as landmarks in the same JSON
format as scripts/cinema/pose_track.html, so it goes through the same retarget:

  python scripts/cinema/pose_keyed.py refs/dance_keyed.json
  python scripts/cinema/pose_retarget.py refs/dance_keyed.json public/cinema/dance/routine.glb

It is keyed by beat from the dance's well-known moves (arm rolls, the flat-palm "bye" push and the
double point, the hip swivel and step-together, a spin), with the skeleton swung in his right hand for
the hits. When the owner's own clip is tracked (pose_retarget.py's usage), its routine replaces this one.
A simple body (his proportions) is posed by hip, chest, head, hand and foot targets with two-bone IK and
read off as MediaPipe's 33 world and image landmarks.
"""
import json, math, sys
import numpy as np

BEAT = 60 / 86.5  # the song's half-time beat, seconds
FPS = 30
# His proportions (metres, from traveller.glb's rest pose)
SH, UARM, FARM, HAND = 0.18, 0.215, 0.21, 0.08
HIPW, THIGH, SHIN, TORSO = 0.067, 0.39, 0.315, 0.39
ANKLE_UP, TOE, HEEL = 0.09, 0.15, 0.05

# ------------------------------------------------------------------ poses
# Hands in the chest's frame (x his left, y up, z forward, origin between the shoulders) with an elbow
# pole; feet on the floor in the world (x, z, lift, yaw degrees).
L_HIP = ((0.21, -0.36, -0.04), (1, 0, -0.3))
L_SIDE = ((0.28, -0.5, 0.05), (1, 0, -0.5))
R_READY = ((-0.3, 0.06, 0.06), (-0.3, -1, -0.4))  # fist at the shoulder, the skeleton held up like a bat
R_BACK = ((-0.42, 0.12, -0.28), (-0.2, -1, -0.5))  # wound up behind
R_HITF = ((-0.25, 0.0, 0.58), (0, -1, 0))  # forehand, through the front
R_THRU = ((0.38, -0.05, 0.4), (0, -1, 0))  # follow-through across his body
R_WIDE = ((-0.62, 0.02, 0.2), (0, -1, 0))  # backhand, out wide to his right
R_HIGH = ((-0.16, 0.58, -0.02), (-1, 0, 0))  # overhead
R_SLAM = ((-0.18, -0.12, 0.56), (-1, -0.5, 0))
PUSH_IN = ((0.14, -0.02, 0.24), (1, -1, 0))  # the flat palm drawn back...
PUSH_OUT = ((0.12, 0.02, 0.63), (1, -1, 0))  # ...and pushed out: "bye"
POINT_L = ((0.16, -0.06, 0.6), (0.5, -1, 0))
POINT_R = ((-0.16, -0.06, 0.6), (-0.5, -1, 0))
L_OUT = ((0.5, -0.08, 0.18), (0, -1, -0.3))
L_HIGHPOINT = ((0.22, 0.1, 0.6), (0.5, -1, 0))

BASE = dict(hip=(0, 0.92, 0), yaw=0, roll=0, lean=4, side=0, twist=0, hyaw=0, hpitch=0,
            lh=L_HIP, rh=R_READY, lf=(0.16, 0, 0, 8), rf=(-0.16, 0, 0, -8))

keys = []  # (beat, pose dict)
hits, byes = [], []


def key(b, **kw):
    prev = dict(keys[-1][1]) if keys else dict(BASE)
    prev.update(kw)
    keys.append((b, prev))


def feet(x, w=0.16, z=0.0, yaw=0):
    """Both feet flat, centred on x, w apart, turned with the hips."""
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    return dict(lf=(x + w * c, z - w * s, 0, 8 + yaw), rf=(x - w * c, z + w * s, 0, -8 + yaw))


def bounce(b0, n, x=0, yaw=0):
    """Shoulder bounces and head nods on the beat, standing."""
    for i in range(n):
        key(b0 + i, hip=(x, 0.9, 0), hpitch=8, lean=6, **feet(x, yaw=yaw))
        key(b0 + i + 0.5, hip=(x, 0.93, 0), hpitch=-4, lean=2, **feet(x, yaw=yaw))


def step_together(b0, x0, dx):
    """Step out to the side and bring the other foot in: two beats."""
    x1 = x0 + dx
    out = 1 if dx > 0 else -1  # +x is his left
    lead = 'lf' if out > 0 else 'rf'
    key(b0, hip=(x0, 0.9, 0), roll=0, **feet(x0))
    key(b0 + 0.35, **{lead: (x0 + out * 0.16 + dx * 0.5, 0, 0.12, out * 8)}, hip=(x0 + dx * 0.2, 0.91, 0), roll=-4 * out)
    key(b0 + 0.75, **{lead: (x1 + out * 0.3, 0, 0, out * 8)}, hip=(x0 + dx * 0.6, 0.88, 0), roll=4 * out, hpitch=6)
    trail = 'rf' if out > 0 else 'lf'
    key(b0 + 1.25, **{trail: (x1 + out * 0.02, 0, 0.1, -out * 8)}, hip=(x1, 0.92, 0), roll=0, hpitch=-3)
    key(b0 + 1.75, hip=(x1, 0.9, 0), **feet(x1), hpitch=5)
    return x1


def swing_fore(b, x, side='right'):
    key(b - 0.5, rh=R_BACK, twist=-30, yaw=-10, lean=8, hip=(x, 0.88, 0))
    key(b, rh=R_HITF, twist=5, yaw=0, lean=12, hip=(x, 0.86, 0.05), hpitch=10)
    hits.append({'t': round(b * BEAT, 3), 'side': side, 'kind': 'fore'})
    key(b + 0.35, rh=R_THRU, twist=38, yaw=12, lean=10)
    key(b + 0.9, rh=R_READY, twist=0, yaw=0, lean=4, hip=(x, 0.91, 0), hpitch=0)


def swing_back(b, x):
    key(b - 0.5, rh=R_THRU, twist=35, yaw=10, lean=8, hip=(x, 0.88, 0))
    key(b, rh=R_WIDE, twist=-25, yaw=-15, lean=6, hip=(x, 0.87, 0), hyaw=-25)
    hits.append({'t': round(b * BEAT, 3), 'side': 'right', 'kind': 'back'})
    key(b + 0.35, rh=((-0.55, 0.1, -0.15), (0, -1, 0)), twist=-40, yaw=-25)
    key(b + 0.9, rh=R_READY, twist=0, yaw=0, hyaw=0, hip=(x, 0.91, 0))


def bye(b0, x):
    """The flat-palm push three times, then the double point."""
    byes.append(round(b0 * BEAT, 3))
    for i in range(3):
        key(b0 + i - 0.25, lh=PUSH_IN, rh=R_READY, lean=2, hip=(x, 0.91, 0), hpitch=0, hyaw=0)
        key(b0 + i, lh=PUSH_OUT, lean=8, hip=(x, 0.88, 0), hpitch=6, twist=-12)
        key(b0 + i + 0.5, lh=((0.13, 0.0, 0.56), (1, -1, 0)), twist=-6, hpitch=0)
    key(b0 + 2.8, lh=PUSH_IN, rh=((-0.14, -0.04, 0.3), (-0.5, -1, 0)), twist=0)
    key(b0 + 3, lh=POINT_L, rh=POINT_R, lean=14, hip=(x, 0.85, 0.04), hpitch=8)
    key(b0 + 3.5, lh=((0.16, -0.1, 0.52), (0.5, -1, 0)), rh=((-0.16, -0.1, 0.52), (-0.5, -1, 0)), lean=10, hip=(x, 0.88, 0.02))


def arm_rolls(b0, n, x):
    """Forearms rolling round each other in front of the chest, twice a beat, hips swaying."""
    steps = n * 8
    for i in range(steps + 1):
        a = i / 4 * math.pi * 2 / 2  # two rolls per beat
        b = b0 + i / 8
        L = ((0.05 + 0.08 * math.cos(a), -0.12 + 0.08 * math.sin(a), 0.3), (1, -1, 0))
        R = ((-0.05 - 0.08 * math.cos(a), -0.12 - 0.08 * math.sin(a), 0.32), (-1, -1, 0))
        sway = math.sin(i / 8 * math.pi)
        key(b, lh=L, rh=R, hip=(x + 0.05 * sway, 0.89, 0), roll=5 * sway, twist=8 * sway, hpitch=4 * math.cos(i / 4 * math.pi))


def swivel(b0, n, x):
    """The hip swivel: knees bent, hips turning side to side on each half beat, arms out."""
    for i in range(n * 2 + 1):
        s = 1 if i % 2 else -1
        key(b0 + i / 2, hip=(x, 0.84, 0), yaw=22 * s, twist=-18 * s, roll=6 * s, lh=L_OUT, rh=R_READY,
            lf=(x + 0.22, 0, 0, 20), rf=(x - 0.22, 0, 0, -20), hpitch=0, hyaw=10 * s)


def spin(b0, dur, x, hit_at=()):
    """A full turn on his left foot, the skeleton held out wide so it sweeps round."""
    n = 12
    for i in range(n + 1):
        f = i / n
        yaw = 360 * (f * f * (3 - 2 * f))
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        rx, rz = -0.3 * c, 0.3 * s  # his right foot sweeps round the left
        key(b0 + f * dur, yaw=yaw, hip=(x + 0.08, 0.9 + 0.03 * math.sin(f * math.pi), 0), rh=R_WIDE, lh=L_OUT, twist=0,
            lf=(x + 0.14, 0, 0, yaw), rf=(x + 0.14 + rx, rz, 0.06 * math.sin(f * math.pi), yaw), hyaw=0, roll=0)
    for h in hit_at:
        hits.append({'t': round(h * BEAT, 3), 'side': 'right', 'kind': 'spin'})
    key(b0 + dur + 0.01, yaw=0, **feet(x))


def kick(b, x):
    key(b - 0.4, rf=(x - 0.14, 0.15, 0.3, 0), hip=(x, 0.92, -0.04), lean=-6, lh=L_OUT, rh=R_READY)
    key(b, rf=(x - 0.1, 0.62, 0.62, 0), hip=(x, 0.93, -0.08), lean=-14, hpitch=-6)
    hits.append({'t': round(b * BEAT, 3), 'side': 'front', 'kind': 'kick'})
    key(b + 0.4, rf=(x - 0.16, 0.12, 0.2, -8), hip=(x, 0.91, 0), lean=4)
    key(b + 0.8, **feet(x), lh=L_HIP)


def slam(b, x):
    key(b - 0.6, rh=R_HIGH, lean=-4, hip=(x, 0.93, 0), hpitch=-10)
    key(b, rh=R_SLAM, lean=24, hip=(x, 0.8, 0.06), hpitch=12)
    hits.append({'t': round(b * BEAT, 3), 'side': 'front', 'kind': 'slam'})
    key(b + 0.5, lean=18, hip=(x, 0.82, 0.04))
    key(b + 1.0, rh=R_READY, lean=4, hip=(x, 0.91, 0), hpitch=0)


# ------------------------------------------------------------------ the routine
key(0, **feet(0, w=0.2))
for i, hy in enumerate((0, 30, -30, 0)):  # sizing them up
    key(i * 0.5 + 0.25, hyaw=hy, hpitch=4 * (i % 2))
bounce(2, 2)
swing_fore(4.5, 0)
x = step_together(5.5, 0, -0.35)
swing_back(8, x)
key(9.1, lh=L_HIP, rh=R_READY, **feet(x))
bye(9.5, x)
key(13.3, lh=L_HIP, rh=R_READY)
arm_rolls(13.5, 2, x)
x = step_together(15.75, x, 0.5)
kick(18, x)
slam(19.5, x)
swivel(20.6, 2, x)
spin(22.8, 1.6, x, hit_at=(23.4, 24.0))
key(25, lh=L_HIP, rh=R_READY, hip=(x, 0.91, 0), hpitch=0)
bye(25.6, x)
swing_fore(30, x)
swing_back(31.5, x)
swing_fore(33, x)
swivel(34.2, 1, x)
arm_rolls(35.4, 2, x)
x = step_together(37.6, x, -0.3)
kick(40, x)
slam(41.5, x)
key(42.7, lh=L_HIP, rh=R_READY, **feet(x))
bye(43.2, x)
spin(47.2, 1.4, x, hit_at=(47.9,))
# The final pose: feet wide, the skeleton raised high, the left hand pointing out at the audience.
key(49.4, hip=(x, 0.86, 0), **feet(x, w=0.26), rh=R_HIGH, lh=L_HIGHPOINT, lean=0, twist=-10, hpitch=-4, hyaw=0, roll=-3)
POSED = 50.0
key(POSED, hip=(x, 0.87, 0), rh=((-0.22, 0.62, 0.04), (-1, 0, 0)), lh=((0.24, 0.12, 0.62), (0.5, -1, 0)), hpitch=-6)
END = 51.5
key(END, hip=(x, 0.87, 0))
assert all(a[0] < b[0] for a, b in zip(keys, keys[1:])), 'keys out of order'


# ------------------------------------------------------------------ to landmarks
def sample(t):
    """The pose at beat t: keys interpolated with Catmull-Rom per value."""
    bs = [k[0] for k in keys]
    i = max(0, min(len(keys) - 2, np.searchsorted(bs, t, 'right') - 1))
    k0, k1, k2, k3 = keys[max(0, i - 1)], keys[i], keys[i + 1], keys[min(len(keys) - 1, i + 2)]
    u = 0 if k2[0] == k1[0] else min(1, max(0, (t - k1[0]) / (k2[0] - k1[0])))

    def cr(a, b, c, d):
        a, b, c, d = (np.array(v, float) for v in (a, b, c, d))
        m1 = (c - a) / max(1e-6, k2[0] - k0[0]) * (k2[0] - k1[0])
        m2 = (d - b) / max(1e-6, k3[0] - k1[0]) * (k2[0] - k1[0])
        u2, u3 = u * u, u * u * u
        return (2 * u3 - 3 * u2 + 1) * b + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * c + (u3 - u2) * m2

    out = {}
    for name in k1[1]:
        v = [k[1][name] for k in (k0, k1, k2, k3)]
        if isinstance(v[0], tuple) and isinstance(v[0][0], tuple):
            out[name] = tuple(cr(*[x[j] for x in v]) for j in range(2))
        else:
            out[name] = cr(*v)
    return out


def rot(axis, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    x, y, z = axis
    return np.array([[c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
                     [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
                     [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]])


def ik(root, target, a, b, pole):
    d = target - root
    L = np.linalg.norm(d)
    L = min(max(L, abs(a - b) + 1e-3), (a + b) * 0.999)
    dn = d / max(1e-9, np.linalg.norm(d))
    p = pole - (pole @ dn) * dn
    p /= max(1e-9, np.linalg.norm(p))
    ca = (a * a + L * L - b * b) / (2 * a * L)
    mid = root + a * (ca * dn + math.sqrt(max(0, 1 - ca * ca)) * p)
    end = root + dn * L
    return mid, end


def landmarks(P):
    w = np.zeros((33, 3))
    Ry = rot((0, 1, 0), float(P['yaw']))
    Rh = Ry @ rot((0, 0, 1), -float(P['roll']))
    Rc = Rh @ rot((0, 1, 0), float(P['twist'])) @ rot((1, 0, 0), float(P['lean'])) @ rot((0, 0, 1), -float(P['side']))
    hip = np.array(P['hip'])
    hip[1] = 0.79 - (0.93 - hip[1]) * 1.1  # keyed as a hips height; his legs reach 0.8 m, so knees bend below that
    w[23], w[24] = hip + Rh @ [HIPW, 0, 0], hip - Rh @ [HIPW, 0, 0]
    chest = hip + Rc @ [0, TORSO, 0]
    w[11], w[12] = chest + Rc @ [SH, 0, 0], chest - Rc @ [SH, 0, 0]
    Rhd = Rc @ rot((0, 1, 0), float(P['hyaw'])) @ rot((1, 0, 0), float(P['hpitch']))
    head = chest + Rc @ [0, 0.2, 0]
    w[7], w[8] = head + Rhd @ [0.075, 0, -0.01], head - Rhd @ [0.075, 0, 0.01]
    w[0] = head + Rhd @ [0, -0.1 * math.tan(math.radians(11)), 0.1]
    for s, (sh, el, wr, pk, ix, th) in ((1, (11, 13, 15, 17, 19, 21)), (-1, (12, 14, 16, 18, 20, 22))):
        tgt, pole = P['lh'] if s > 0 else P['rh']
        e, h = ik(w[sh], chest + Rc @ np.array(tgt), UARM, FARM, Rc @ np.array(pole, float))
        w[el], w[wr] = e, h
        fd = (h - e) / np.linalg.norm(h - e)
        w[ix] = h + fd * HAND + Rc @ [0, 0, 0.01]
        w[pk] = h + fd * HAND * 0.85 - Rc @ [0, 0, 0.01]
        w[th] = h + fd * 0.03
    for s, (hp, kn, an, he, ft) in ((1, (23, 25, 27, 29, 31)), (-1, (24, 26, 28, 30, 32))):
        fx, fz, lift, fyaw = P['lf'] if s > 0 else P['rf']
        fwd = rot((0, 1, 0), float(fyaw)) @ [0, 0, 1]
        ankle = np.array([fx, ANKLE_UP + lift, fz]) - fwd * 0.03
        k, a = ik(w[hp], ankle, THIGH, SHIN, Rh @ [0, 0, 1] + fwd)
        w[kn], w[an] = k, a
        w[ft] = a + fwd * TOE - [0, ANKLE_UP - 0.02, 0]
        w[he] = a - fwd * HEEL - [0, ANKLE_UP - 0.01, 0]
    for i in range(33):  # unkeyed points (eyes, mouth) at the head
        if not w[i].any():
            w[i] = head
    return w


def main(dst):
    frames = []
    n = int(END * BEAT * FPS) + 1
    for f in range(n):
        t = f / FPS
        w = landmarks(sample(t / BEAT))
        hip = (w[23] + w[24]) / 2
        world = (w - hip) * [1, -1, -1]  # MediaPipe's convention: origin between the hips, y down, z to camera < 0
        image = np.stack([0.5 + w[:, 0] / 3, 0.5 - (w[:, 1] - 1) / 3, -w[:, 2] / 3], 1)  # a 3 m tall square frame
        frames.append({'t': round(t, 4), 'world': np.hstack([world, np.ones((33, 1))]).round(4).tolist(),
                       'image': np.hstack([image, np.ones((33, 1))]).round(4).tolist()})
    json.dump({'source': 'pose_keyed.py (hand-keyed placeholder)', 'fps': FPS, 'aspect': 1, 'frames': frames,
               'hits': hits, 'byes': byes, 'end': round(POSED * BEAT, 3)}, open(dst, 'w'))
    print(f'{dst}: {n} frames, {n / FPS:.1f} s, {len(hits)} hits at', [h["t"] for h in hits], 'byes', byes)


if __name__ == '__main__':
    main(sys.argv[1])
