"""The traveller's rest-pose body vertices and bone heads in metres, for suit_fit.py.
blender -b --factory-startup --python suit_bones.py -- <traveller.glb> <verts_out.npy> <bones_out.json>"""
import bpy, sys, numpy as np, json
a = sys.argv[sys.argv.index('--')+1:]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=a[0])
dg = bpy.context.evaluated_depsgraph_get()
arm = [o for o in bpy.data.objects if o.type=='ARMATURE'][0]
arm.data.pose_position = 'REST'; dg.update()
for o in bpy.data.objects: print(o.name, o.type, o.parent.name if o.parent else None, [m.type for m in o.modifiers] if o.type=='MESH' else '')
vs=[]
for o in bpy.data.objects:
    if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers):
        e=o.evaluated_get(dg); me=e.to_mesh()
        co=np.array([e.matrix_world @ v.co for v in me.vertices]); vs.append(co); e.to_mesh_clear()
        print(o.name, co.min(0).round(3), co.max(0).round(3))
v=np.concatenate(vs); zmin=v[:,2].min(); h=v[:,2].max()-zmin; k=1.72/h
print('height', h, 'zmin', zmin, 'k', k)
v[:,2]-=zmin; v*=k
np.save(a[1], v)
bones={}
for b in arm.data.bones:
    hd=np.array(arm.matrix_world@b.head_local); tl=np.array(arm.matrix_world@b.tail_local)
    hd[2]-=zmin; tl[2]-=zmin; bones[b.name]=[[float(x) for x in hd*k],[float(x) for x in tl*k]]
json.dump(bones, open(a[2],'w'))
for n,(hd,tl) in bones.items(): print(n, [round(x,3) for x in hd])
