import bpy, bmesh, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(os.path.join(HERE, 'model.py')).read())
exec(open(os.path.join(HERE, 'anim.py')).read())
rig = bpy.data.objects['WizardRig']
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)

# ---------------------------------------------------------------- LOD1: decimated copies for distant characters
LOD_RATIO = {'Head': .3, 'Robe': .35, 'Hood': .35, 'Torso': .35, 'Legs': .35, 'Neck': .4, 'Hand.L': .25, 'Hand.R': .25,
             'Eye.L': .35, 'Eye.R': .35, 'Hat': .4, 'Beard': .35, 'Wand': .5, 'Book': .5}
dg = bpy.context.evaluated_depsgraph_get()
for ob in [o for o in FINAL]:
    ratio = LOD_RATIO.get(ob.name, .3 if ob.name.startswith('Hair_') else .4)
    cp = ob.copy(); cp.data = ob.data.copy(); cp.name = ob.name + '_LOD1'; cp.data.name = cp.name
    COL.objects.link(cp)
    if cp.data.shape_keys: cp.shape_key_clear()
    cp.modifiers.clear()
    dec = cp.modifiers.new('dec', 'DECIMATE'); dec.ratio = ratio; dec.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(cp.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = cp.data; cp.modifiers.clear(); cp.data = me; me.name = cp.name; bpy.data.meshes.remove(old)
    for p in me.polygons: p.use_smooth = True
    m = cp.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    cp.parent = rig

# ---------------------------------------------------------------- LOD2: one merged mesh for far characters
# Every body part becomes a single skinned mesh with a single material. The per-corner colour keeps the baked
# shading in RGB and a palette slot in alpha; the game fills a 16-colour palette per character (skin, hair,
# robe, house colour...), so a far character costs one draw call instead of twenty-odd.
import numpy as np
PALETTE = ['M_Skin', 'M_Hair', 'M_Robe', 'M_Lining', 'M_Vest', 'M_Shirt', 'M_Trousers', 'M_Shoes', 'M_Lips',
           'M_EyeWhite', 'M_Iris', 'M_Pupil', 'M_Gold', 'M_Wand', 'M_Book', 'M_Page']
FAR_DROP = {'M_Lash', 'M_EyeGlint', 'M_Mouth', 'M_Teeth'}
FAR_PARTS = ['Head', 'Eye.L', 'Eye.R', 'Neck', 'Torso', 'Legs', 'Arm.L', 'Arm.R', 'Hand.L', 'Hand.R', 'Shoe.L', 'Shoe.R',
             'Robe', 'Hood', 'Sleeve.L', 'Sleeve.R', 'Wand']
far_mat = bpy.data.materials.new('M_Far')
far = []
for name in FAR_PARTS:
    src = bpy.data.objects[name + '_LOD1']
    cp = src.copy(); cp.data = src.data.copy(); cp.name = name + '_far'; COL.objects.link(cp); cp.modifiers.clear()
    me = cp.data
    names = [m.name for m in me.materials]
    bm = bmesh.new(); bm.from_mesh(me)
    doomed = [f for f in bm.faces if names[f.material_index] in FAR_DROP]
    if doomed: bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bm.to_mesh(me); bm.free()
    nl = len(me.loops)
    rgba = np.ones((nl, 4), dtype=np.float32)
    old = me.color_attributes.active_color
    if old is not None:
        if old.domain == 'CORNER':
            buf = np.empty(nl * 4, dtype=np.float32); old.data.foreach_get('color', buf); rgba = buf.reshape(-1, 4).copy()
        else:
            buf = np.empty(len(me.vertices) * 4, dtype=np.float32); old.data.foreach_get('color', buf)
            vi = np.empty(nl, dtype=np.int32); me.loops.foreach_get('vertex_index', vi); rgba = buf.reshape(-1, 4)[vi].copy()
    for poly in me.polygons:
        slot = PALETTE.index(names[poly.material_index])
        rgba[poly.loop_start:poly.loop_start + poly.loop_total, 3] = (slot + .5) / 16
        poly.material_index = 0
    for ca in list(me.color_attributes): me.color_attributes.remove(ca)
    col = me.color_attributes.new('Far', 'FLOAT_COLOR', 'CORNER'); col.data.foreach_set('color', rgba.ravel())
    me.color_attributes.active_color = col; me.color_attributes.render_color_index = 0
    me.materials.clear(); me.materials.append(far_mat)
    far.append(cp)
with bpy.context.temp_override(active_object=far[0], selected_editable_objects=far, object=far[0]):
    bpy.ops.object.join()
body_far = far[0]; body_far.name = 'Body_LOD2'; body_far.data.name = 'Body_LOD2'
for p in body_far.data.polygons: p.use_smooth = True
body_far.parent = rig
m = body_far.modifiers.new('Armature', 'ARMATURE'); m.object = rig
body_far.data.calc_loop_triangles(); print('FAR', len(body_far.data.vertices), 'verts', len(body_far.data.loop_triangles), 'tris')

tris = {0: 0, 1: 0}
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles(); tris[1 if ob.name.endswith(('_LOD1', '_LOD2')) else 0] += len(ob.data.loop_triangles)
print('TRIS', tris)
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(HERE, '..', '..', 'dist', 'assets', 'models', 'wizard-raw.glb')
kw = dict(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
          export_morph=True, export_morph_normal=False, export_morph_animation=False, export_apply=False, export_yup=True,
          export_texcoords=False, export_normals=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
          export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True, export_reset_pose_bones=True,
          export_def_bones=False, use_selection=False, export_cameras=False, export_lights=False, export_extras=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
dropped = [k for k in kw if k not in props and k != 'filepath']
kw = {k: v for k, v in kw.items() if k in props or k == 'filepath'}
print('unknown dropped:', dropped)
bpy.ops.export_scene.gltf(**kw)
print('EXPORT OK', out)
