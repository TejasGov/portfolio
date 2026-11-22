"""
pose_retarget.py: tracked pose landmarks -> the traveller's dance clip (a clips-only GLB on his rig).

The dance world (src/novel/cinema/dance.js) plays public/cinema/dance/routine.glb by scroll. This script
makes it from a landmarks JSON, written by either
  - scripts/cinema/pose_track.html (MediaPipe PoseLandmarker run frame by frame on a local video), or
  - scripts/cinema/pose_keyed.py (the hand-keyed placeholder routine, in the same format).

USAGE (from the repo root; Python 3 with numpy, nothing else)
  1. Put your own copy of the clip at refs/dance.mp4. With the dev server running, open
       http://localhost:5173/scripts/cinema/pose_track.html?src=/refs/dance.mp4&from=127&to=162
     press Track, and Save when it is done: that downloads dance_pose.json (also window.__pose).
     Move it to refs/dance_pose.json.
  2. python scripts/cinema/pose_retarget.py refs/dance_pose.json public/cinema/dance/routine.glb
  The placeholder: python scripts/cinema/pose_keyed.py refs/dance_keyed.json, then step 2 on that file.

JSON in: { fps, aspect (video width / height), frames: [{ t, world: [[x, y, z, visibility] x 33] | null,
  image: [[x, y, z, visibility] x 33] | null }], hits?: [{ t, side }], byes?: [t], end?: t }
  world: MediaPipe world landmarks (metres, origin between the hips, y down, z towards the camera < 0).
  image: MediaPipe normalised image landmarks (x, y in 0..1 of the frame).
GLB out: his armature (Armature, scale 0.01, then Hips and its children with their rest transforms) and one
  animation, "Bye_Bye_Bye": Hips translation plus a rotation per moving bone, 30 fps, rotations stored as
  normalised int16. extras on the animation: { hits, byes, end } in seconds (hits found from the hands'
  speed when the JSON has none), which the world times its henchmen, sound effects and captions to.

How: landmarks are cleaned (missing frames and low-visibility points filled across time, camera cuts
rejoined by turning the next shot about the vertical so the body's facing carries on), smoothed with a
Savitzky-Golay filter, then each bone's world rotation is the rest rotation turned by the frame that maps
its rest direction and bend-plane normal onto the tracked ones (spine and neck share the twist between the
pelvis and the shoulders and the head). The hips' height keeps his lowest foot on the floor; across the
floor he moves with his planted foot (stance-driven, so a planted foot never slides) and, with both feet
off the floor, with the hips' drift in the picture.
"""
import json, math, struct, sys
import numpy as np

TRAVELLER = 'public/cinema/traveller.glb'
FPS = 30

# MediaPipe pose landmark indices
NOSE, L_EAR, R_EAR = 0, 7, 8
L_SH, R_SH, L_EL, R_EL, L_WR, R_WR = 11, 12, 13, 14, 15, 16
L_PINKY, R_PINKY, L_INDEX, R_INDEX = 17, 18, 19, 20
L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANK, R_ANK = 23, 24, 25, 26, 27, 28
L_HEEL, R_HEEL, L_FOOT, R_FOOT = 29, 30, 31, 32
HEAD_PITCH = math.radians(11)  # the nose sits a little below the ears in a level head

X, Y, Z = np.eye(3)


# ------------------------------------------------------------------ maths
def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-9)


def q2m(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def m2q(m):
    t = np.trace(m)
    if t > 0:
        s = math.sqrt(t + 1) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, s / 4]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [s / 4, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, s / 4, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = math.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, s / 4, (m[1, 0] - m[0, 1]) / s]
    q = np.array(q)
    return q / np.linalg.norm(q)


def slerp_m(a, b, k):
    qa, qb = m2q(a), m2q(b)
    if qa @ qb < 0:
        qb = -qb
    d = min(1.0, qa @ qb)
    th = math.acos(d)
    if th < 1e-5:
        q = qa
    else:
        q = (math.sin((1 - k) * th) * qa + math.sin(k * th) * qb) / math.sin(th)
    return q2m(q / np.linalg.norm(q))


def basis(d, n):
    e1 = unit(d)
    e2 = unit(n - (n @ e1) * e1)
    return np.stack([e1, e2, np.cross(e1, e2)], 1)


def frame_map(d, n, d0, n0):
    """The rotation taking the rest pair (d0, n0) onto (d, n)."""
    return basis(d, n) @ basis(d0, n0).T


def arc(a, b, limit=math.pi):
    """The shortest rotation taking direction a onto b, at most `limit` radians."""
    a, b = unit(a), unit(b)
    ax = np.cross(a, b)
    s, c = np.linalg.norm(ax), float(np.clip(a @ b, -1, 1))
    if s < 1e-8:
        return np.eye(3)
    ang = min(math.atan2(s, c), limit)
    k = ax / s
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def savgol(x, window, order=3):
    """Savitzky-Golay smoothing along axis 0 (edges padded with their end values)."""
    k = window // 2
    A = np.vander(np.arange(-k, k + 1), order + 1, increasing=True)
    c = np.linalg.pinv(A)[0]
    pad = np.concatenate([np.repeat(x[:1], k, 0), x, np.repeat(x[-1:], k, 0)])
    out = np.zeros_like(x)
    for i, w in enumerate(c):
        out += w * pad[i:i + len(x)]
    return out


# ------------------------------------------------------------------ his rig
def read_glb_json(path):
    b = open(path, 'rb').read()
    n = struct.unpack_from('<I', b, 12)[0]
    return json.loads(b[20:20 + n])


class Rig:
    def __init__(self, path):
        j = read_glb_json(path)
        nodes = j['nodes']
        self.joints = [nodes[i]['name'] for i in j['skins'][0]['joints']]
        idx = {nodes[i]['name']: i for i in j['skins'][0]['joints']}
        self.parent = {}
        for i, nd in enumerate(nodes):
            for c in nd.get('children', []):
                self.parent[nodes[c]['name']] = nodes[i]['name'] if nodes[i]['name'] in idx else None
        self.t = {n: np.array(nodes[idx[n]].get('translation', [0, 0, 0]), float) for n in self.joints}
        self.r = {n: q2m(np.array(nodes[idx[n]].get('rotation', [0, 0, 0, 1]), float)) for n in self.joints}
        self.s = {n: nodes[idx[n]].get('scale', [1, 1, 1]) for n in self.joints}
        self.order = []  # parents before children
        seen = set()
        while len(self.order) < len(self.joints):
            for n in self.joints:
                if n not in seen and (self.parent.get(n) is None or self.parent[n] in seen):
                    self.order.append(n)
                    seen.add(n)
        self.rest_R, self.rest_P = self.fk(self.r, self.t['Hips'])

    def fk(self, local_r, hips_t):
        """World (armature-space, cm) rotations and positions for local rotations and the hips' place."""
        R, P = {}, {}
        for n in self.order:
            p = self.parent.get(n)
            t = hips_t if n == 'Hips' else self.t[n]
            if p is None:
                R[n], P[n] = local_r[n], np.array(t, float)
            else:
                R[n], P[n] = R[p] @ local_r[n], P[p] + R[p] @ t
        return R, P


# ------------------------------------------------------------------ landmarks
def load_landmarks(path):
    d = json.load(open(path))
    fr = d['frames']
    n = len(fr)
    W = np.full((n, 33, 3), np.nan)
    I = np.full((n, 33, 3), np.nan)
    for i, f in enumerate(fr):
        if f.get('world'):
            w = np.array(f['world'], float)
            ok = w[:, 3] >= 0.3 if w.shape[1] > 3 else np.ones(33, bool)
            # MediaPipe: y down, z towards the camera negative -> y up, him facing +z.
            W[i, ok] = w[ok, :3] * np.array([1, -1, -1])
        if f.get('image'):
            im = np.array(f['image'], float)
            I[i] = im[:, :3] * np.array([d.get('aspect', 1), -1, -1])
    t = np.array([f['t'] for f in fr], float)
    t -= t[0]
    return d, t, W, I


def fill(a, t):
    """Fill NaN samples of each channel by interpolating across time (ends held)."""
    out = a.reshape(len(a), -1).copy()
    for c in range(out.shape[1]):
        v = out[:, c]
        ok = ~np.isnan(v)
        if ok.sum() == 0:
            v[:] = 0
        elif not ok.all():
            v[~ok] = np.interp(t[~ok], t[ok], v[ok])
    return out.reshape(a.shape)


def rejoin_cuts(W, jump=math.radians(50)):
    """A camera cut turns the tracked body at once: turn each new shot so his facing carries on."""
    yaw = np.arctan2(-(W[:, L_HIP, 2] - W[:, R_HIP, 2]), W[:, L_HIP, 0] - W[:, R_HIP, 0])
    off, cuts = 0.0, 0
    for i in range(1, len(W)):
        d = (yaw[i] - yaw[i - 1] + math.pi) % (2 * math.pi) - math.pi
        if abs(d) > jump:
            off -= d
            cuts += 1
        if off:
            W[i] = W[i] @ rot_y(off).T
    return cuts


# ------------------------------------------------------------------ the retarget
def retarget(rig, W):
    n = len(W)
    RR = rig.rest_R
    P0 = rig.rest_P
    d0 = lambda a, b: unit(P0[b] - P0[a])
    rest = {
        'LeftArm': (d0('LeftArm', 'LeftForeArm'), d0('LeftForeArm', 'LeftHand')),
        'RightArm': (d0('RightArm', 'RightForeArm'), d0('RightForeArm', 'RightHand')),
        'LeftUpLeg': (d0('LeftUpLeg', 'LeftLeg'), d0('LeftLeg', 'LeftFoot')),
        'RightUpLeg': (d0('RightUpLeg', 'RightLeg'), d0('RightLeg', 'RightFoot')),
    }
    # Hands and feet point at their next joint (a hand has no child: along its forearm).
    hand0 = {s: d0(f'{s}ForeArm', f'{s}Hand') for s in ('Left', 'Right')}
    foot0 = {s: d0(f'{s}Foot', f'{s}ToeBase') for s in ('Left', 'Right')}
    limbs = [  # bone, child, joints (root, mid, end), bend sense (arms fold forward, knees back)
        ('LeftArm', 'LeftForeArm', (L_SH, L_EL, L_WR), 1), ('RightArm', 'RightForeArm', (R_SH, R_EL, R_WR), 1),
        ('LeftUpLeg', 'LeftLeg', (L_HIP, L_KNEE, L_ANK), -1), ('RightUpLeg', 'RightLeg', (R_HIP, R_KNEE, R_ANK), -1),
    ]
    prev_n = {}
    out = []
    for f in range(n):
        w = W[f]
        hip_mid, sh_mid = (w[L_HIP] + w[R_HIP]) / 2, (w[L_SH] + w[R_SH]) / 2
        up = unit(sh_mid - hip_mid)
        Qh = frame_map(unit(Y + up), w[L_HIP] - w[R_HIP], Y, X)  # the pelvis takes half the lean
        Qc = frame_map(up, w[L_SH] - w[R_SH], Y, X)
        ear = (w[L_EAR] + w[R_EAR]) / 2
        side = unit(w[L_EAR] - w[R_EAR])
        fwd = unit(w[NOSE] - ear)
        fwd = unit(fwd * math.cos(HEAD_PITCH) + np.cross(fwd, side) * math.sin(HEAD_PITCH))  # level the nose
        Qhd = frame_map(np.cross(fwd, side), side, Y, X)
        Q = {'Hips': Qh, 'Spine02': slerp_m(Qh, Qc, 1 / 3), 'Spine01': slerp_m(Qh, Qc, 2 / 3), 'Spine': Qc,
             'LeftShoulder': Qc, 'RightShoulder': Qc, 'neck': slerp_m(Qc, Qhd, 0.5), 'Head': Qhd}
        for bone, child, (a, b, c), sense in limbs:
            u, l = w[b] - w[a], w[c] - w[b]
            du, dl = rest[bone]
            body_fwd = (Qc if sense > 0 else Qh) @ Z * sense
            n0 = unit(np.cross(du, Z * sense))
            cr = np.cross(u, l)
            bend = np.linalg.norm(cr) / max(1e-9, np.linalg.norm(u) * np.linalg.norm(l))
            fb = prev_n.get(bone)
            if fb is None:
                fb = np.cross(u, body_fwd)
            fb = unit(fb - (fb @ unit(u)) * unit(u))
            k = min(1.0, max(0.0, (bend - 0.2) / 0.3))  # nearly straight: the bend plane is noise, keep the last one
            nn = unit(k * unit(cr) + (1 - k) * fb)
            prev_n[bone] = nn
            Q[bone] = frame_map(u, nn, du, n0)
            Q[child] = frame_map(l, nn, dl, n0)
        for s, wr, idx, pk in (('Left', L_WR, L_INDEX, L_PINKY), ('Right', R_WR, R_INDEX, R_PINKY)):
            carried = Q[f'{s}ForeArm']
            Q[f'{s}Hand'] = arc(carried @ hand0[s], (w[idx] + w[pk]) / 2 - w[wr], math.radians(70)) @ carried
        for s, ank, toe in (('Left', L_ANK, L_FOOT), ('Right', R_ANK, R_FOOT)):
            carried = Q[f'{s}Leg']
            Q[f'{s}Foot'] = arc(carried @ foot0[s], w[toe] - w[ank], math.radians(60)) @ carried
            Q[f'{s}ToeBase'] = Q[f'{s}Foot']
        # World rotations, then local ones.
        Rw = {b: Q[b] @ RR[b] if b in Q else None for b in rig.joints}
        loc = {}
        for b in rig.order:
            p = rig.parent.get(b)
            if Rw[b] is None:  # not driven (head_end, headfront): rides its parent at rest
                Rw[b] = (Rw[p] if p else np.eye(3)) @ rig.r[b]
            loc[b] = (Rw[p].T @ Rw[b]) if p else Rw[b]
        out.append(loc)
    return out


def root_path(rig, locs, I, fps):
    """The hips' place per frame (armature cm): lowest foot on the floor, planted feet never slide."""
    n = len(locs)
    feet = ['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase']
    h0 = rig.t['Hips']
    rest_h = np.array([rig.rest_P[k][1] for k in feet])
    F = np.zeros((n, 4, 3))
    for f in range(n):
        _, P = rig.fk(locs[f], np.zeros(3))
        F[f] = [P[k] for k in feet]
    lift = F[:, :, 1] - rest_h[None]  # each contact point's height over its rest height, hips at 0
    hy = -lift.min(1)
    gy = F[:, :, 1] + hy[:, None] - rest_h[None]  # height off the floor
    # Image drift for airborne frames: the hips' motion in the picture, in metres via the torso's size.
    drift = np.zeros((n, 2))
    if not np.isnan(I).all():
        im = fill(I, np.arange(n, dtype=float))
        hip = (im[:, L_HIP] + im[:, R_HIP]) / 2
        torso = np.linalg.norm((im[:, L_SH] + im[:, R_SH]) / 2 - hip, axis=1)
        scale = 50.0 / max(1e-6, float(np.median(torso)))  # cm per picture unit (a torso is ~50 cm)
        drift[1:, 0] = np.diff(hip[:, 0]) * scale
    xz = np.zeros((n, 2))
    for f in range(1, n):
        foot_xz = lambda k: F[k, :, [0, 2]].T
        c = np.clip(1 - np.maximum(gy[f], gy[f - 1]) / 4.0, 0, 1)  # within 4 cm of the floor: planted
        c = np.array([max(c[0], c[1]), max(c[0], c[1]), max(c[2], c[3]), max(c[2], c[3])]) * (np.minimum(gy[f], gy[f - 1]) < 4)
        if c.sum() > 1e-6:
            d = -(c[:, None] * (foot_xz(f) - foot_xz(f - 1))).sum(0) / c.sum()
        else:
            d = drift[f]
        xz[f] = xz[f - 1] + d
    xz = savgol(xz, 7, 2)
    return np.stack([h0[0] + xz[:, 0], hy, h0[2] + xz[:, 1]], 1), gy


def find_hits(rig, locs, path, fps):
    """Hits: peaks of a hand's speed (the skeleton swings in his right), at least 0.5 s apart."""
    n = len(locs)
    H = np.zeros((n, 2, 3))
    for f in range(n):
        _, P = rig.fk(locs[f], path[f])
        H[f] = [P['LeftHand'], P['RightHand']]
    v = np.linalg.norm(np.diff(H, axis=0), axis=2) * fps / 100  # m/s
    v = np.vstack([v[:1], v])
    hits, last = [], -1e9
    thr = max(2.5, np.percentile(v, 92))
    for f in range(2, n - 2):
        for s in (1, 0):
            if v[f, s] > thr and v[f, s] == v[f - 2:f + 3, s].max() and f / fps - last > 0.5:
                hits.append({'t': round(f / fps, 3), 'side': 'right' if s else 'left'})
                last = f / fps
    return hits


# ------------------------------------------------------------------ the GLB
def write_glb(rig, path, locs, root, fps, extras):
    n = len(locs)
    times = np.arange(n, dtype=np.float32) / fps
    moving = [b for b in rig.joints if b not in ('head_end', 'headfront')]
    bins, views, accs = [], [], []
    off = 0

    def add(arr, comp, typ, norm=False, minmax=False):
        nonlocal off
        raw = arr.tobytes()
        pad = (-len(raw)) % 4
        bins.append(raw + b'\0' * pad)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': arr.shape[0], 'type': typ}
        if norm:
            a['normalized'] = True
        if minmax:
            a['min'], a['max'] = [float(arr.min())], [float(arr.max())]
        accs.append(a)
        off += len(raw) + pad
        return len(accs) - 1

    t_acc = add(times, 5126, 'SCALAR', minmax=True)
    names = ['Armature'] + rig.order
    node_of = {b: i + 1 for i, b in enumerate(rig.order)}
    nodes = [{'name': 'Armature', 'scale': [0.01] * 3, 'children': [node_of['Hips']]}]
    for b in rig.order:
        nd = {'name': b, 'translation': rig.t[b].tolist(), 'rotation': m2q(rig.r[b]).tolist(), 'scale': list(rig.s[b])}
        kids = [node_of[c] for c in rig.order if rig.parent.get(c) == b]
        if kids:
            nd['children'] = kids
        nodes.append(nd)
    samplers, channels = [], []
    tr = add(root.astype(np.float32), 5126, 'VEC3')
    samplers.append({'input': t_acc, 'output': tr, 'interpolation': 'LINEAR'})
    channels.append({'sampler': 0, 'target': {'node': node_of['Hips'], 'path': 'translation'}})
    for b in moving:
        q = np.array([m2q(l[b]) for l in locs])
        for i in range(1, n):  # keep each next quaternion on the near side for a smooth blend
            if q[i] @ q[i - 1] < 0:
                q[i] = -q[i]
        qi = np.round(np.clip(q, -1, 1) * 32767).astype(np.int16)
        acc = add(qi, 5122, 'VEC4', norm=True)
        samplers.append({'input': t_acc, 'output': acc, 'interpolation': 'LINEAR'})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': node_of[b], 'path': 'rotation'}})
    blob = b''.join(bins)
    gl = {
        'asset': {'version': '2.0', 'generator': 'scripts/cinema/pose_retarget.py'},
        'scene': 0, 'scenes': [{'name': 'Scene', 'nodes': [0]}], 'nodes': nodes,
        'animations': [{'name': 'Bye_Bye_Bye', 'samplers': samplers, 'channels': channels, 'extras': extras}],
        'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}],
    }
    js = json.dumps(gl, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + blob
    open(path, 'wb').write(out)
    return len(out)


def main(src, dst):
    rig = Rig(TRAVELLER)
    d, t, W, I = load_landmarks(src)
    W = fill(W, t)
    cuts = 0 if d.get('faced') else rejoin_cuts(W)  # pose_splice.py already turns each shot to face front
    # Resample to FPS, then smooth (about a sixth of a second either way: jitter out, a punch still snaps).
    T = np.arange(0, t[-1] + 1e-9, 1 / FPS)
    rs = lambda A: np.stack([np.interp(T, t, c) for c in A.reshape(len(A), -1).T], 1).reshape((len(T),) + A.shape[1:])
    W = savgol(rs(W), 11, 3)
    I = rs(I) if not np.isnan(I).all() else np.full((len(T), 33, 3), np.nan)
    locs = retarget(rig, W)
    root, gy = root_path(rig, locs, I, FPS)
    hits = d.get('hits') or find_hits(rig, locs, root, FPS)
    extras = {'hits': hits, 'byes': d.get('byes', []), 'end': d.get('end', float(T[-1])), 'fps': FPS, 'cuts': cuts}
    size = write_glb(rig, dst, locs, root, FPS, extras)
    # Self-check: the floor is kept (no foot below it, one on it in most frames) and the rest pose round-trips.
    assert gy.min() > -0.5, 'a foot went through the floor'
    assert (gy.min(1) < 1.0).mean() > 0.9, 'his feet left the floor too often'
    print(f'{dst}: {len(T)} frames, {T[-1]:.2f} s, {len(hits)} hits, {cuts} cuts, {size / 1024:.0f} KB')


def self_test():
    """A still dancer standing like his rest pose must give back his rest pose."""
    rig = Rig(TRAVELLER)
    P = rig.rest_P
    w = np.zeros((33, 3))
    put = {L_SH: 'LeftArm', R_SH: 'RightArm', L_EL: 'LeftForeArm', R_EL: 'RightForeArm', L_WR: 'LeftHand', R_WR: 'RightHand',
           L_HIP: 'LeftUpLeg', R_HIP: 'RightUpLeg', L_KNEE: 'LeftLeg', R_KNEE: 'RightLeg', L_ANK: 'LeftFoot', R_ANK: 'RightFoot',
           L_FOOT: 'LeftToeBase', R_FOOT: 'RightToeBase'}
    for k, b in put.items():
        w[k] = P[b] / 100
    hand = lambda s: P[f'{s}Hand'] / 100 + unit(P[f'{s}Hand'] - P[f'{s}ForeArm']) * 0.08
    w[L_INDEX] = w[L_PINKY] = hand('Left')
    w[R_INDEX] = w[R_PINKY] = hand('Right')
    head = P['Head'] / 100
    w[L_EAR], w[R_EAR] = head + [0.07, 0.05, 0], head + [-0.07, 0.05, 0]
    w[NOSE] = head + [0, 0.05, 0.1]
    w[NOSE] = w[NOSE] + (0, -math.tan(HEAD_PITCH) * 0.1, 0)
    # The rest torso is not quite square: compare limbs and the angle error, not exactness, for the spine.
    loc = retarget(rig, w[None])[0]
    err = {b: math.degrees(math.acos(np.clip((np.trace(loc[b].T @ rig.r[b]) - 1) / 2, -1, 1))) for b in rig.joints}
    return err


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        err = self_test()
        print(' '.join(f'{b} {e:.1f}' for b, e in err.items()))
        assert max(err.values()) < 8, 'a still dancer in his rest pose should give back his rest pose'
        print('ok')
    else:
        main(sys.argv[1], sys.argv[2])
