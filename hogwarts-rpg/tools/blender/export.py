import bpy, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(os.path.join(HERE, 'model.py')).read())
exec(open(os.path.join(HERE, 'anim.py')).read())
rig = bpy.data.objects['WizardRig']
tris = 0
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles(); tris += len(ob.data.loop_triangles)
print('TRIS', tris)
rig.animation_data.action = None
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(HERE, '..', '..', 'dist', 'assets', 'models', 'wizard.glb')
kw = dict(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
          export_morph=False, export_apply=False, export_yup=True, export_texcoords=True, export_normals=True,
          export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True, export_reset_pose_bones=True,
          export_def_bones=False, use_selection=False, export_cameras=False, export_lights=False, export_extras=False)
import inspect
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
kw = {k: v for k, v in kw.items() if k in props or k == 'filepath'}
print('unknown dropped:', [k for k in ['export_animation_mode', 'export_force_sampling', 'export_optimize_animation_size'] if k not in props])
bpy.ops.export_scene.gltf(**kw)
print('EXPORT OK', out)
