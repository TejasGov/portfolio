"""Render the skinned suits posed by the traveller's own clips (a check for scripts/cinema/suit_skin.py).
blender -b --factory-startup --python suit_check.py -- <out_dir> <traveller.glb> <suit.glb> [<suit.glb> ...] [--body] [--clips a.glb,b.glb]
Each suit is bound to the traveller's armature (by bone name) and rendered at rest and in a few clip poses,
front and three-quarter, as <out_dir>/<suit>_<pose>_<view>.png. --body also shows his body (to spot poke-through);
--head shows only his head and neck (as the worlds do under a suit whose Meshy head was cut off).
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
BODY = '--body' in a
HEAD = '--head' in a
CLOSE = '--close' in a  # frame the head and shoulders
CLIPS = []
if '--clips' in a:
    i = a.index('--clips'); CLIPS = a[i + 1].split(','); del a[i:i + 2]
a = [x for x in a if x not in ('--body', '--close', '--head')]
OUT, TRAV, SUITS = a[0], a[1], a[2:]
os.makedirs(OUT, exist_ok=True)

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=TRAV)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = bpy.data.objects['char1']
for o in list(bpy.data.objects):
    if o not in (arm, body): bpy.data.objects.remove(o, do_unlink=True)
for c in CLIPS:  # extra clips on the same rig: keep their actions only
    keep = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=c)
    for o in list(bpy.data.objects):
        if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
for act in bpy.data.actions: act.use_fake_user = True
body.hide_render = not (BODY or HEAD)
if HEAD:  # drop every body vertex whose strongest bone is not his neck or head (landing.js's headOnly)
    import bmesh
    keep = {g.index for g in body.vertex_groups if g.name in ('neck', 'Head', 'head_end', 'headfront')}
    bm = bmesh.new(); bm.from_mesh(body.data)
    dl = bm.verts.layers.deform.active
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if max(v[dl].items(), key=lambda e: e[1], default=(-1, 0))[0] not in keep], context='VERTS')
    bm.to_mesh(body.data); bm.free()

suits = []
for path in SUITS:
    keep = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in keep]
    for o in new:
        if o.type == 'MESH' and o.name.startswith('suit_'):
            mw = o.matrix_world.copy()
            o.parent = arm; o.matrix_world = mw
            for m in o.modifiers:
                if m.type == 'ARMATURE': m.object = arm
            suits.append(o)
    for o in new:
        if o not in suits: bpy.data.objects.remove(o, do_unlink=True)

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 420, 560
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.18, 0.18, 0.2)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.8 if CLOSE else 2.3

POSES = [('rest', None, 0)]
for name, f in (('Idle', 0.5), ('Regular_Jump', 0.45), ('Combat_Stance', 0.5), ('Step_Hip_Hop_Dance', 0.3), ('Right_Hand_Sword_Slash', 0.5), ('Cheer_with_Both_Hands_Up', 0.5)):
    POSES.append((name, name, f))
for act in bpy.data.actions:
    if act.name not in [p[1] for p in POSES] and act.name not in ('Axe_Breathe_and_Look_Around', 'Casual_Walk', 'Chair_Sit_Idle_M', 'Confident_Strut', 'happy_jump_m', 'Idle', 'Shield_Push_Left', 'Sit_Hands_on_Head_Lean_Back', 'Stand_and_Chat', 'Sword_Parry', 'Walk', 'Wave_One_Hand'):
        POSES.append((act.name, act.name, 0.5))

arm.animation_data_create()
for s in suits:
    for o in suits: o.hide_render = o is not s
    for label, act, f in POSES:
        if act:
            A = bpy.data.actions[act]
            arm.animation_data.action = A
            if A.slots: arm.animation_data.action_slot = A.slots[0]
            fr = A.frame_range; sc.frame_set(int(fr[0] + f * (fr[1] - fr[0])))
        else:
            arm.animation_data.action = None
            sc.frame_set(0)
            for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        hips = arm.matrix_world @ arm.pose.bones['neck' if CLOSE else 'Hips'].head
        if hips.length > 5:  # a clip from another file: its hips travel in its own units; pin them
            for pb in arm.pose.bones: pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
            bpy.context.view_layer.update()
            hips = arm.matrix_world @ arm.pose.bones['neck' if CLOSE else 'Hips'].head
        for view, ang in (('f', 0), ('q', 40), ('b', 180)):
            if view == 'b' and label not in ('rest', 'Regular_Jump'): continue
            r = math.radians(ang)
            cam.location = hips + Vector((4 * math.sin(r), -4 * math.cos(r), 0.12))
            cam.rotation_euler = (math.pi / 2, 0, r)
            sc.render.filepath = os.path.join(OUT, f'{s.name}_{label}_{view}{"_close" if CLOSE else ""}.png')
            bpy.ops.render.render(write_still=True)
print('CHECKED', [s.name for s in suits], [p[0] for p in POSES])
