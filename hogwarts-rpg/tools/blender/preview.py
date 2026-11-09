import bpy, sys, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(os.path.join(HERE, 'model.py')).read())
exec(open(os.path.join(HERE, 'anim.py')).read()) if '--anim' in sys.argv else None

VAR = sys.argv[sys.argv.index('--var') + 1] if '--var' in sys.argv else 'Hair_Short'
for ob in bpy.data.objects:
    if ob.name in ('Hair_Short', 'Hair_Long', 'Hair_Bun', 'Beard', 'Hat'):
        ob.hide_render = ob.name not in VAR.split(',')

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 520, 700
scene.render.film_transparent = False
world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.32, .35, .4, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .8
def light(kind, loc, energy, rot=None, size=1):
    d = bpy.data.lights.new(kind, kind); d.energy = energy
    if kind == 'AREA': d.size = size
    o = bpy.data.objects.new(kind, d); scene.collection.objects.link(o); o.location = loc
    if rot: o.rotation_euler = rot
    return o
light('SUN', (2, -3, 4), 3.2, rot=(math.radians(50), 0, math.radians(-30)))
light('AREA', (-2, -1.5, 2), 120, rot=(math.radians(60), 0, math.radians(-120)), size=2)
light('AREA', (0, 2.5, 2.4), 150, rot=(math.radians(-60), 0, 0), size=2)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
floor = bpy.context.object; fm = bpy.data.materials.new('floor'); fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.18, .17, .16, 1); floor.data.materials.append(fm)

cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam_d.lens = 60
OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '/tmp/prev'
views = {'front': 0, 'three': -35, 'side': -90, 'back': 180}
FRAMES = [int(x) for x in sys.argv[sys.argv.index('--frames') + 1].split(',')] if '--frames' in sys.argv else [None]
ACTION = sys.argv[sys.argv.index('--action') + 1] if '--action' in sys.argv else None
if ACTION:
    rig = bpy.data.objects['WizardRig']; rig.animation_data.action = bpy.data.actions[ACTION]
    try: rig.animation_data.action_slot = bpy.data.actions[ACTION].slots[0]
    except Exception: pass
VIEWS = sys.argv[sys.argv.index('--views') + 1].split(',') if '--views' in sys.argv else list(views)
CLOSE = '--close' in sys.argv
for f in FRAMES:
    if f is not None: scene.frame_set(f)
    for v in VIEWS:
        a = math.radians(views[v]); dist = 1.3 if CLOSE else 4.6
        target = Vector((0, 0, 1.66 if CLOSE else 1.0))
        cam.location = target + Vector((math.sin(a) * dist, -math.cos(a) * dist, .05 if CLOSE else .25))
        d = target - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{OUT}_{v}{"" if f is None else "_%03d" % f}.png'
        bpy.ops.render.render(write_still=True)
print('PREVIEW DONE')
