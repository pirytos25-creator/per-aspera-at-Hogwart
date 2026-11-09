import bpy, sys, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
from mathutils import Vector, Quaternion
bpy.ops.wm.read_factory_settings(use_empty=True)
exec(open(os.path.join(HERE, 'model.py')).read())
exec(open(os.path.join(HERE, 'anim.py')).read()) if '--anim' in sys.argv else None

def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

TOGGLE = ('Hair_Short', 'Hair_Long', 'Hair_Bun', 'Hair_Pony', 'Hair_Curly', 'Beard', 'Hat', 'Book')
VAR = arg('--var', 'Hair_Short')
for ob in bpy.data.objects:
    if ob.name in TOGGLE or ob.name.endswith('_LOD1'):
        ob.hide_render = ob.name not in VAR.split(',')
# --keys smile=1,browUp=.5  (shape keys on the head)
if arg('--keys'):
    kb = bpy.data.objects['Head'].data.shape_keys.key_blocks
    for kv in arg('--keys').split(','):
        k, v = kv.split('='); kb[k].value = float(v)
# --pose jaw=.2,lid=.5  (runtime-driven face bones)
rig = bpy.data.objects['WizardRig']
if arg('--pose'):
    for kv in arg('--pose').split(','):
        k, v = kv.split('='); v = float(v)
        names = ['lid.L', 'lid.R'] if k == 'lid' else [k]
        for n in names:
            pb = rig.pose.bones[n]; pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = Quaternion((0, 1, 0), v) if k == 'lid' else Quaternion((1, 0, 0), v)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = (520, 700) if not ('--face' in sys.argv) else (560, 560)
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
# vertex colours (baked AO) multiply the base colour, as in the game
for m in bpy.data.materials:
    if not m.use_nodes or not m.name.startswith('M_'): continue
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1
    mix.inputs[6].default_value = b.inputs['Base Color'].default_value
    nt.links.new(vc.outputs['Color'], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs['Base Color'])

cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam_d.lens = 60
OUT = arg('--out', '/tmp/prev')
views = {'front': 0, 'three': -35, 'side': -90, 'back': 180, 'left': 35}
FRAMES = [int(x) for x in arg('--frames').split(',')] if arg('--frames') else [None]
ACTION = arg('--action')
if ACTION:
    rig.animation_data.action = bpy.data.actions[ACTION]
    try: rig.animation_data.action_slot = bpy.data.actions[ACTION].slots[0]
    except Exception: pass
VIEWS = arg('--views', ','.join(views)).split(',')
CLOSE = '--close' in sys.argv; FACE = '--face' in sys.argv
for f in FRAMES:
    if f is not None: scene.frame_set(f)
    for v in VIEWS:
        a = math.radians(views[v]); dist = .62 if FACE else 1.3 if CLOSE else 4.6
        target = Vector((0, 0, 1.67 if FACE else 1.66 if CLOSE else 1.0))
        cam.location = target + Vector((math.sin(a) * dist, -math.cos(a) * dist, .02 if FACE else .05 if CLOSE else .25))
        d = target - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{OUT}_{v}{"" if f is None else "_%03d" % f}.png'
        bpy.ops.render.render(write_still=True)
print('PREVIEW DONE')
