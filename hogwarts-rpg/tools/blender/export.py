import bpy, sys, os
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

tris = {0: 0, 1: 0}
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles(); tris[1 if ob.name.endswith('_LOD1') else 0] += len(ob.data.loop_triangles)
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
