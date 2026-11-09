# Blender (bpy) build script: stylised Hogwarts wizard, rigged, for Szlaki Magii.
# Character faces -Y in Blender (glTF exporter turns this into +Z, as the game expects).
import bpy, bmesh, math
from math import sin, cos, pi, exp
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
import numpy as np

scene = bpy.context.scene
COL = scene.collection

# ------------------------------------------------------------------ helpers
def lin(c):
    c = c.lstrip('#'); v = [int(c[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in v)

MATS = {}
def mat(name, color, rough=.8, metal=0., emit=0.):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(color), 1)
        b.inputs['Emission Strength'].default_value = emit
    MATS[name] = m
    return m

def new_obj(name, me):
    ob = bpy.data.objects.new(name, me); COL.objects.link(ob); return ob

def from_bm(name, bm, material=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = new_obj(name, me)
    if material: me.materials.append(material)
    for p in me.polygons: p.use_smooth = True
    return ob

def bake(ob):
    """Apply all modifiers through the depsgraph (no operators needed)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data; ob.modifiers.clear(); ob.data = me; me.name = ob.name
    bpy.data.meshes.remove(old)
    for p in me.polygons: p.use_smooth = True

def ellipsoid(name, center, radii, material, rot=(0, 0, 0), seg=(20, 12)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1)
    R = Matrix.LocRotScale(Vector(center), Matrix.Rotation(rot[2], 3, 'Z') @ Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[0], 3, 'X'), Vector(radii))
    bmesh.ops.transform(bm, matrix=R, verts=bm.verts)
    return from_bm(name, bm, material)

def skin_mesh(name, verts, edges, radii, material, subdiv=2, post=None):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, edges, [])
    ob = new_obj(name, me)
    ob.modifiers.new('skin', 'SKIN')
    layer = me.skin_vertices[0] if len(me.skin_vertices) else me.skin_vertices.new()
    for i, r in enumerate(radii):
        r = r if isinstance(r, (tuple, list)) else (r, r)
        layer.data[i].radius = r
    layer.data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = subdiv; sub.render_levels = subdiv
    bake(ob)
    if post:
        for v in ob.data.vertices: v.co = post(v.co.copy())
    ob.data.materials.append(material)
    return ob

def grid(name, fn, nu, nv, closed_u=False, material=None, uv=True):
    """fn(u,v)->Vector; u across (columns), v along (rows)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap') if uv else None
    cols = nu if closed_u else nu + 1
    vs = [[bm.verts.new(fn((i / nu), j / nv)) for i in range(cols)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            i2 = (i + 1) % cols if closed_u else i + 1
            f = bm.faces.new((vs[j][i], vs[j][i2], vs[j + 1][i2], vs[j + 1][i]))
            if uv:
                for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    loop[uvl].uv = (a / nu, b / nv)
    bm.normal_update()
    return from_bm(name, bm, material)

def catmull(keys, t):
    """keys: list of (t, value or tuple) sorted by t; smooth interpolation."""
    ts = [k[0] for k in keys]
    if t <= ts[0]: return keys[0][1]
    if t >= ts[-1]: return keys[-1][1]
    i = max(j for j in range(len(ts) - 1) if ts[j] <= t)
    p0 = keys[max(i - 1, 0)][1]; p1 = keys[i][1]; p2 = keys[i + 1][1]; p3 = keys[min(i + 2, len(keys) - 1)][1]
    s = (t - ts[i]) / (ts[i + 1] - ts[i])
    def cr(a, b, c, d):
        return 0.5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s ** 3)
    if isinstance(p1, tuple): return tuple(cr(a, b, c, d) for a, b, c, d in zip(p0, p1, p2, p3))
    return cr(p0, p1, p2, p3)

def solidify(ob, thick, inner_mat_slot=1):
    m = ob.modifiers.new('solid', 'SOLIDIFY'); m.thickness = thick; m.offset = -1
    m.material_offset = inner_mat_slot; m.material_offset_rim = inner_mat_slot; m.use_even_offset = True
    bake(ob)

# ------------------------------------------------------------------ materials (names are the runtime contract)
M = dict(
    skin=mat('M_Skin', '#c6a183', .55),
    hair=mat('M_Hair', '#342824', .62),
    robe=mat('M_Robe', '#202c35', .88),
    lining=mat('M_Lining', '#547da9', .7),
    vest=mat('M_Vest', '#353c3d', .82),
    shirt=mat('M_Shirt', '#d8d3c3', .8),
    trousers=mat('M_Trousers', '#26292b', .85),
    shoes=mat('M_Shoes', '#191514', .38),
    gold=mat('M_Gold', '#c2a062', .32, .85),
    wand=mat('M_Wand', '#5e4029', .55),
    white=mat('M_EyeWhite', '#f1ece3', .25),
    iris=mat('M_Iris', '#4b3a28', .25),
    pupil=mat('M_Pupil', '#0d0b0a', .15),
    glint=mat('M_EyeGlint', '#ffffff', .1, 0, 2.0),
    lips=mat('M_Lips', '#a26f60', .5),
)

# ------------------------------------------------------------------ skeleton layout (metres)
J = {}
J['hips'] = (Vector((0, 0, .95)), Vector((0, 0, 1.08)))
J['spine'] = (Vector((0, 0, 1.08)), Vector((0, 0, 1.25)))
J['chest'] = (Vector((0, 0, 1.25)), Vector((0, 0, 1.45)))
J['neck'] = (Vector((0, .005, 1.47)), Vector((0, .008, 1.565)))
J['head'] = (Vector((0, .008, 1.565)), Vector((0, .008, 1.80)))
for s, side in ((1, 'L'), (-1, 'R')):
    S = Vector((s * .175, .0, 1.435)); E = Vector((s * .30, .012, 1.19)); W = Vector((s * .395, -.012, .965))
    hand_dir = (W - E).normalized()
    J[f'shoulder.{side}'] = (Vector((s * .03, 0, 1.415)), S)
    J[f'upper_arm.{side}'] = (S, E)
    J[f'forearm.{side}'] = (E, W)
    J[f'hand.{side}'] = (W, W + hand_dir * .085)
    Hp = Vector((s * .095, 0, .92)); K = Vector((s * .1, -.008, .495)); A = Vector((s * .1, .015, .085))
    J[f'thigh.{side}'] = (Hp, K)
    J[f'shin.{side}'] = (K, A)
    J[f'foot.{side}'] = (A, Vector((s * .1, -.085, .03)))
    J[f'toe.{side}'] = (Vector((s * .1, -.085, .03)), Vector((s * .1, -.145, .025)))
    J[f'eye.{side}'] = (Vector((s * .041, -.09, 1.682)), Vector((s * .041, -.12, 1.682)))

# ------------------------------------------------------------------ head
HC = Vector((0, .008, 1.668))
def head_shape(p):
    x, y, z = p
    taper = 1 - .2 * max(0, -z) ** 1.6
    sx, sy, sz = .097, .106, .124
    yy = y * (1.06 if y > 0 else 1.0)
    if y < -.55: yy = -.55 + (y + .55) * .7   # flatter face plane
    w = Vector((x * sx * taper, yy * sy * (1 - .12 * max(0, -z) ** 2), z * sz)) + HC
    if y < 0:
        bump = lambda cx, cz, rx, rz: exp(-(((w.x - cx) / rx) ** 2 + ((w.z - cz) / rz) ** 2))
        w.y -= .015 * bump(0, 1.644, .014, .02)           # nose
        w.y -= .007 * bump(0, 1.634, .018, .01)           # nose tip / nostrils
        w.y -= .006 * bump(0, 1.706, .05, .01)            # brow ridge
        w.y -= .007 * (bump(.055, 1.628, .025, .02) + bump(-.055, 1.628, .025, .02))  # cheeks
        w.y -= .009 * bump(0, 1.562, .025, .016)          # chin
        w.y += .006 * (bump(.041, 1.684, .018, .012) + bump(-.041, 1.684, .018, .012))  # eye sockets
    return w

bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=38, v_segments=26, radius=1)
for v in bm.verts: v.co = head_shape(v.co)
head = from_bm('Head', bm, M['skin'])
bvh_head = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())

def surf_y(tree, x, z, start=-.5):
    hit = tree.ray_cast(Vector((x, start, z)), Vector((0, 1, 0)))
    return hit[0].y if hit[0] else None

parts_head = [head]
for s in (1, -1):
    parts_head.append(ellipsoid(f'Ear{s}', (s * .097, .018, 1.662), (.013, .021, .032), M['skin'], rot=(0, 0, s * -.35), seg=(14, 10)))
    ex = s * .041; ey = surf_y(bvh_head, ex, 1.682) + .006
    eyes = []
    eyes.append(ellipsoid(f'EyeW{s}', (ex, ey, 1.682), (.0205, .0095, .0146), M['white'], seg=(16, 10)))
    eyes.append(ellipsoid(f'Iris{s}', (ex, ey - .0074, 1.6815), (.011, .0036, .011), M['iris'], seg=(14, 8)))
    eyes.append(ellipsoid(f'Pupil{s}', (ex, ey - .0101, 1.6815), (.0054, .0016, .0056), M['pupil'], seg=(10, 6)))
    eyes.append(ellipsoid(f'Glint{s}', (ex + .004, ey - .0115, 1.6865), (.0021, .0008, .0021), M['glint'], seg=(8, 6)))
    for e in eyes: e['bone'] = f'eye.{s > 0 and "L" or "R"}'
    brow_y = surf_y(bvh_head, s * .043, 1.705)
    b = ellipsoid(f'Brow{s}', (s * .043, brow_y - .003, 1.7055), (.023, .005, .0045), M['hair'], rot=(0, s * .14, 0), seg=(12, 6))
    b['tag'] = 'brow'; parts_head.append(b)
    parts_head += eyes
my = surf_y(bvh_head, 0, 1.597)
parts_head.append(ellipsoid('LipU', (0, my - .001, 1.6), (.024, .0055, .0042), M['lips'], seg=(14, 6)))
parts_head.append(ellipsoid('LipL', (0, my + .0005, 1.5915), (.02, .006, .0048), M['lips'], seg=(14, 6)))

# ------------------------------------------------------------------ body
def flat_y(f):
    def post(co): co.y *= f; return co
    return post
torso = skin_mesh('Torso',
    [(0, 0, .9), (0, 0, 1.05), (0, 0, 1.22), (0, 0, 1.37), (0, .005, 1.47), (.15, 0, 1.425), (-.15, 0, 1.425)],
    [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5), (3, 6)],
    [.14, .128, .148, .155, .062, .07, .07], M['vest'], post=flat_y(.74))
neck = skin_mesh('Neck', [(0, .006, 1.44), (0, .008, 1.585)], [(0, 1)], [.053, .05], M['skin'], subdiv=2)
legs = skin_mesh('Legs',
    [(0, 0, .97), (.095, 0, .9), (.1, -.008, .495), (.1, .012, .045), (-.095, 0, .9), (-.1, -.008, .495), (-.1, .012, .045)],
    [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
    [.105, .086, .064, .05, .086, .064, .05], M['trousers'])
arms = []
for s, side in ((1, 'L'), (-1, 'R')):
    S, E = J[f'upper_arm.{side}']; W = J[f'forearm.{side}'][1]
    arms.append(skin_mesh(f'Arm.{side}', [tuple(S + Vector((-s * .035, 0, -.05))), tuple(E), tuple(W)], [(0, 1), (1, 2)], [.05, .044, .034], M['shirt']))
    # hand: mitten + thumb, palm facing the body; right hand closes round the wand
    d = (W - E).normalized(); fwd = Vector((0, -1, 0)); fist = side == 'R'
    P = W + d * .045; F = W + d * (.075 if fist else .098)
    T0 = W + d * .02 + fwd * .018; T1 = W + d * (.05 if fist else .062) + fwd * (.034 if fist else .042)
    h = skin_mesh(f'Hand.{side}', [tuple(W), tuple(P), tuple(F), tuple(T0), tuple(T1)], [(0, 1), (1, 2), (0, 3), (3, 4)],
                  [.028, .034, .026 if fist else .021, .015, .012], M['skin'])
    for v in h.data.vertices:  # flatten across the palm (x)
        v.co.x = W.x + (v.co.x - W.x) * (.72 if fist else .58)
    arms.append(h)
    sh = skin_mesh(f'Shoe.{side}', [(s * .1, .04, .045), (s * .1, -.05, .036), (s * .1, -.155, .03)], [(0, 1), (1, 2)], [.04, .043, .031], M['shoes'])
    for v in sh.data.vertices:
        v.co.z = max(v.co.z, .004) if v.co.z > .004 else .004 + (v.co.z - .004) * .1
    arms.append(sh)

bvh_torso = BVHTree.FromObject(torso, bpy.context.evaluated_depsgraph_get())
details = []
ty = surf_y(bvh_torso, 0, 1.33)
details.append(ellipsoid('TieKnot', (0, surf_y(bvh_torso, 0, 1.445) - .012, 1.445), (.02, .012, .018), M['lining'], seg=(12, 8)))
details.append(ellipsoid('Tie', (0, ty - .006, 1.33), (.021, .006, .11), M['lining'], rot=(-.08, 0, 0), seg=(12, 10)))
for i in range(4):
    details.append(ellipsoid(f'TieStripe{i}', (0, ty - .0118, 1.40 - i * .045), (.017, .0012, .0026), M['gold'], rot=(-.08, .35, 0), seg=(8, 4)))
for s in (1, -1):
    cy = surf_y(bvh_torso, s * .03, 1.455)
    details.append(ellipsoid(f'Collar{s}', (s * .028, cy - .01, 1.455), (.025, .006, .016), M['shirt'], rot=(0, s * .55, 0), seg=(12, 6)))
for i in range(4):
    z = 1.27 - i * .07; details.append(ellipsoid(f'Button{i}', (.052, surf_y(bvh_torso, .052, z) - .003, z), (.008, .004, .008), M['gold'], seg=(8, 6)))

# ------------------------------------------------------------------ robe
ROBE = [  # t, z, rx, ry, gap
    (0.00, (.10, .300, .262, .90)),
    (0.30, (.60, .238, .205, .70)),
    (0.55, (.96, .196, .160, .52)),
    (0.66, (1.10, .183, .150, .44)),
    (0.80, (1.27, .200, .156, .40)),
    (0.93, (1.41, .208, .147, .44)),
    (1.00, (1.50, .196, .09, .58)),
]
def robe_point(u, t, inset=0.):
    z, rx, ry, gap = catmull(ROBE, t)
    a = gap / 2 + u * (2 * pi - gap)
    fold = (.011 * sin(a * 9 + .6) + .006 * sin(a * 15 + 1.3) + .004 * sin(a * 23)) * (1 - t) ** 1.4
    r_x, r_y = rx + fold - inset, ry + fold - inset
    if t > .93:  # yoke: shoulders slope down to the sleeves
        k = (t - .93) / .07
        z = z - .065 * k * abs(sin(a)) ** 1.5
    if t < .05: z -= .015 * (1 - t / .05) * (.5 - .5 * cos(a))   # back hem hangs slightly lower
    return Vector((sin(a) * r_x, -cos(a) * r_y, z))

robe = grid('Robe', robe_point, 54, 28, material=M['robe'])
robe.data.materials.append(M['lining'])
solidify(robe, .011)

# front facings (lining turned outwards) + crest
facings = []
for s in (1, -1):
    pts = []
    for k in range(25):
        t = k / 24; z, rx, ry, gap = catmull(ROBE, t); a = gap / 2 - .015
        if s < 0: a = -a
        p = robe_point(0 if s > 0 else 1, t); pts.append(p + Vector((0, -.004, 0)))
    bm = bmesh.new()
    prev = None
    for i, p in enumerate(pts):
        w = .022 if i < 22 else .022 + (i - 21) * .006
        ring = []
        n = Vector((s, 0, 0)); tdir = (pts[min(i + 1, 24)] - pts[max(i - 1, 0)]).normalized()
        side = tdir.cross(Vector((0, 1, 0))).normalized() * s
        for q in range(6):
            ang = q / 6 * 2 * pi
            off = side * (cos(ang) * w * .5) + Vector((0, -1, 0)) * (sin(ang) * .0045)
            ring.append(bm.verts.new(p + off + side * w * .4))
        if prev:
            for q in range(6): bm.faces.new((prev[q], prev[(q + 1) % 6], ring[(q + 1) % 6], ring[q]))
        prev = ring
    facings.append(from_bm(f'Facing{s}', bm, M['lining']))
cp = robe_point(.1, .82); cn = Vector((cp.x, cp.y, 0)).normalized()
crest_rot = (0, 0, math.atan2(cn.x, -cn.y))
facings.append(ellipsoid('CrestRim', tuple(cp + cn * .006), (.034, .006, .042), M['gold'], rot=crest_rot, seg=(14, 8)))
facings.append(ellipsoid('Crest', tuple(cp + cn * .011), (.027, .004, .034), M['lining'], rot=crest_rot, seg=(14, 8)))

# sleeves (bell sleeves along the arm, lined)
sleeves = []
for s, side in ((1, 'L'), (-1, 'R')):
    S, E = J[f'upper_arm.{side}']; W = J[f'forearm.{side}'][1]
    d2 = (W - E).normalized(); C = W - d2 * .008
    path = [S + Vector((-s * .03, 0, -.045)), E, W - d2 * .045, C]
    lens = [0] + [ (path[i + 1] - path[i]).length for i in range(3)]; cum = np.cumsum(lens); total = cum[-1]
    def along(v):
        L = v * total; i = min(int(np.searchsorted(cum, L, side='right')) - 1, 2)
        f = (L - cum[i]) / max(1e-6, cum[i + 1] - cum[i]); return path[i].lerp(path[i + 1], f), (path[i + 1] - path[i]).normalized()
    def sleeve_point(u, v, s=s, along=along):
        c, tdir = along(v)
        ref = Vector((0, -1, 0)); x = ref.cross(tdir).normalized(); y = tdir.cross(x).normalized()
        r = catmull([(0, .072), (.42, .07), (.82, .084), (1, .108)], v)
        ang = u * 2 * pi
        p = c + x * cos(ang) * r + y * sin(ang) * r * .92
        # bell hangs lower on the outer/underside
        hang = max(0, (v - .7) / .3) ** 2 * .035 * (.5 + .5 * cos(ang - pi / 2 * s))
        return p + Vector((0, 0, -hang))
    sl = grid(f'Sleeve.{side}', sleeve_point, 28, 18, closed_u=True, material=M['robe'])
    sl.data.materials.append(M['lining'])
    solidify(sl, .009)
    sleeves.append(sl)

# ------------------------------------------------------------------ hair styles (tapered strand clumps)
def cap(name, hairline, grow=1.05, crown=.01):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=22, radius=1)
    for v in bm.verts:
        p = head_shape(v.co); off = (p - HC)
        v.co = HC + off * grow + Vector((0, 0, crown * max(0, off.z / .124)))
    kill = [v for v in bm.verts if v.co.z < hairline(v.co)]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    return from_bm(name, bm, M['hair'])

def hairline_short(p):
    ang = math.atan2(p.x, -(p.y - HC.y)); a = abs(ang)
    front, side, back = 1.724, 1.672, 1.625
    if a < pi / 2: return front + (side - front) * (a / (pi / 2)) ** 1.4
    return side + (back - side) * ((a - pi / 2) / (pi / 2))

def head_r(d):
    hit = bvh_head.ray_cast(HC, d.normalized())
    return (hit[0] - HC).length if hit[0] else .11

def on_head(d, lift):
    d = d.normalized(); return HC + d * (head_r(d) + lift)

def slerp(a, b, t):
    a = a.normalized(); b = b.normalized(); return (a * (1 - t) + b * t).normalized()

def head_path(d0, d1, lift0=.03, lift1=.01, n=7, tail=()):
    pts = [on_head(slerp(d0, d1, i / (n - 1)), lift0 + (lift1 - lift0) * (i / (n - 1)) ** .8) for i in range(n)]
    for off in tail: pts.append(pts[-1] + Vector(off))
    return pts

def clump(name, ctrl, width=.042, thick=.016, curl=0., taper=.75, hold=0.):
    keys = [(i / (len(ctrl) - 1), tuple(c)) for i, c in enumerate(ctrl)]
    n = 11; ring = 5
    P = [Vector(catmull(keys, i / (n - 1))) for i in range(n)]
    bm = bmesh.new(); prev = None
    for i, p in enumerate(P):
        t = i / (n - 1)
        T = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).normalized()
        N = (p - HC); N = (N - T * N.dot(T)).normalized()
        B = T.cross(N).normalized()
        w = width * min(1, (t / .18)) ** .5 * ((1 - max(0, t - hold) / (1 - hold)) ** taper) + .0015
        th = thick * (w / width) + .001
        rot = Matrix.Rotation(curl * t, 3, T)
        verts = []
        for q in range(ring):
            ang = q / ring * 2 * pi
            off = B * cos(ang) * w + N * sin(ang) * th
            verts.append(bm.verts.new(p + rot @ off))
        if prev:
            for q in range(ring): bm.faces.new((prev[q], prev[(q + 1) % ring], verts[(q + 1) % ring], verts[q]))
        else:
            bm.faces.new(list(reversed(verts)))
        prev = verts
    tip = bm.verts.new(P[-1] + (P[-1] - P[-2]).normalized() * .006)
    for q in range(ring): bm.faces.new((prev[q], prev[(q + 1) % ring], tip))
    bm.normal_update()
    return from_bm(name, bm, M['hair'])

def D(x, y, z): return Vector((x, y, z))
CROWN = D(.12, .35, 1)      # part a little to the character's left, towards the back
hair = {}

def fringe(prefix, n=8, sweep=-.35, z_end=.27, lift=.03, width=.046):
    out = []
    for j in range(n):
        t = j / (n - 1); x = -.95 + t * 1.9
        start = D(.15 + x * .25, .1, 1)
        end = D(x * .62 + sweep * .3, -1, z_end + .16 * abs(x) ** 2)
        out.append(clump(f'{prefix}{j}', head_path(start, end, lift, .012), width, curl=sweep * .6))
    return out

def sides(prefix, n=4, extend=None, z_end=-.12):
    out = []
    for s in (1, -1):
        for j in range(n):
            t = j / max(1, n - 1)
            start = D(s * .25, .15 + t * .5, 1)
            end = D(s * 1, -.35 + t * .7, z_end - .1 * t)
            tail = () if not extend else ((s * .006, .004, -extend * .5), (s * .01, .01, -extend))
            out.append(clump(f'{prefix}{s}{j}', head_path(start, end, .03, .012, tail=tail), .05, curl=s * .3, hold=.55 if extend else 0, taper=.6))
    return out

def back(prefix, n=7, extend=None, z_end=-.55):
    out = []
    for j in range(n):
        t = j / (n - 1); a = -1.3 + t * 2.6
        start = D(.08 + sin(a) * .2, .4, 1)
        end = D(sin(a) * .9, cos(a), z_end)
        tail = () if not extend else ((sin(a) * .01, .012, -extend * .45), (sin(a) * .02, .02, -extend))
        out.append(clump(f'{prefix}{j}', head_path(start, end, .03, .01, tail=tail), .055 if not extend else .062, hold=.6 if extend else 0, taper=.6))
    return out

def crown(prefix, n=6):
    out = []
    for j in range(n):
        a = j / n * 2 * pi
        end = D(sin(a) * .7, cos(a) * .7 + .2, .55)
        out.append(clump(f'{prefix}{j}', head_path(CROWN, end, .034, .026, n=5), .05, .02))
    return out

hs = [cap('Hair_Short', hairline_short)]
hs += fringe('ShortFringe') + sides('ShortSide') + back('ShortBack') + crown('ShortCrown')
hair['Hair_Short'] = hs

hl = [cap('Hair_Long', lambda p: hairline_short(p) - (.025 if p.y > HC.y else 0))]
hl += fringe('LongFringe', 7, sweep=.0, width=.05) + sides('LongSide', 4, extend=.15) + back('LongBack', 9, extend=.21, z_end=-.35) + crown('LongCrown')
hair['Hair_Long'] = hl

BUN = D(0, .112, 1.745)
hb = [cap('Hair_Bun', lambda p: hairline_short(p) + .003)]
for j in range(14):
    a = -pi * .92 + j / 13 * pi * 1.84
    start = D(sin(a) * .95, -cos(a) * .95, .3 - .8 * (abs(a) / pi) ** 1.5)
    pts = head_path(start, (BUN - HC), .012, .028, n=6)
    pts[-1] = BUN + (pts[-2] - BUN).normalized() * .03
    hb.append(clump(f'BunPull{j}', pts, .05, .012))
hb.append(ellipsoid('Bun', tuple(BUN + Vector((0, .02, 0))), (.05, .042, .05), M['hair'], seg=(18, 12)))
for j in range(3):  # smooth spiral wraps around the bun
    a0 = j / 3 * 2 * pi; c = BUN + Vector((0, .02, 0))
    pts = [c + Vector((sin(a0 + k * 1.1) * .05, .004 * k - .01, cos(a0 + k * 1.1) * .05)) for k in range(6)]
    hb.append(clump(f'BunWrap{j}', pts, .034, .016, hold=.5, taper=.5))
hair['Hair_Bun'] = hb

# ------------------------------------------------------------------ beard, hat, wand
bd = []
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=20, radius=1)
for v in bm.verts:
    x, y, z = v.co
    zz = z if z > 0 else z * (1.6 + .4 * (1 - abs(x)))
    w = Vector((x * .088 * (1 - .25 * max(0, -z)), -.05 + y * .062 - .02 * max(0, -z), 1.54 + zz * .1))
    w.y += .006 * sin(x * 25) * max(0, -z)
    if w.z > 1.612: w.z = 1.612 - (w.z - 1.612) * .1
    v.co = w
bd.append(from_bm('Beard_Main', bm, M['hair']))
for s in (1, -1):
    bd.append(ellipsoid(f'Moustache{s}', (s * .024, surf_y(bvh_head, s * .02, 1.615) - .008, 1.612), (.03, .012, .011), M['hair'], rot=(0, s * -.35, 0), seg=(12, 8)))

ht = []
brim = grid('Hat_Brim', lambda u, v: Vector((sin(u * 2 * pi) * (.11 + v * .095), .02 + cos(u * 2 * pi) * (.12 + v * .092), 1.785 - .018 * v * v + .012 * sin(u * 6 * pi) * v)), 36, 6, closed_u=True, material=M['robe'])
brim.data.materials.append(M['robe']); solidify(brim, .008, 0); ht.append(brim)
def cone_pt(u, v):
    r = .108 * (1 - v) ** 1.15 + .004
    bend = Vector((0, .1 * v ** 2.2, 0)) + Vector((0, 0, 0))
    a = u * 2 * pi
    crumple = 1 + .05 * sin(v * 12) * (v > .4)
    return Vector((sin(a) * r * crumple, .02 + cos(a) * r * crumple, 1.78 + v * .42 - .05 * v ** 3)) + bend
ht.append(grid('Hat_Cone', cone_pt, 28, 18, closed_u=True, material=M['robe']))
ht.append(grid('Hat_Band', lambda u, v: Vector((sin(u * 2 * pi) * (.111 - v * .008), .02 + cos(u * 2 * pi) * (.111 - v * .008), 1.788 + v * .04)), 28, 2, closed_u=True, material=M['lining']))
ht.append(ellipsoid('Hat_Buckle', (0, -.095, 1.808), (.022, .006, .018), M['gold'], seg=(10, 6)))

hand_R = J['hand.R']
grip = hand_R[0] + (hand_R[1] - hand_R[0]) * .55 + Vector((0, -.004, 0))
wdir = Vector((-.08, -1, -.18)).normalized()
J['wand'] = (grip - wdir * .03, grip + wdir * .30)
J['wand_tip'] = (grip + wdir * .30, grip + wdir * .33)
def wand_pt(u, v):
    p = J['wand'][0].lerp(J['wand'][1], v)
    r = .0115 if v < .3 else .0085 * (1 - (v - .3) / .7) + .0035
    if v < .3: r += .002 * sin(v * 60) ** 2
    x = wdir.cross(Vector((0, 0, 1))).normalized(); y = x.cross(wdir).normalized()
    return p + x * cos(u * 2 * pi) * r + y * sin(u * 2 * pi) * r
wand = grid('Wand', wand_pt, 10, 16, closed_u=True, material=M['wand'])
wand_parts = [wand]
for i in range(3):
    wand_parts.append(ellipsoid(f'WandRing{i}', tuple(J['wand'][0] + wdir * (.035 + i * .028)), (.0135, .0135, .0135), M['gold'], seg=(10, 6)))

# ------------------------------------------------------------------ bigger, friendlier head (stylised proportions)
HEAD_S = 1.2; PIV = Vector((0, .008, 1.548)); DROP = Vector((0, 0, -.022))
def hscale(p): return PIV + (Vector(p) - PIV) * HEAD_S + DROP
head_objs = parts_head + [o for objs in hair.values() for o in objs] + bd + ht
for o in head_objs:
    for v in o.data.vertices: v.co = hscale(v.co)
for k in ('eye.L', 'eye.R'):
    J[k] = (hscale(J[k][0]), hscale(J[k][1]))
J['head'] = (J['head'][0] + DROP, hscale(J['head'][1]))
J['neck'] = (J['neck'][0], J['neck'][1] + DROP)
# ------------------------------------------------------------------ robe & hat secondary bones
def on_robe(u, t): return robe_point(u, t)
for name, u in (('F.L', .08), ('F.R', .92), ('S.L', .27), ('S.R', .73), ('B', .5)):
    p0, p1, p2 = on_robe(u, .52), on_robe(u, .28), on_robe(u, 0.0)
    inward = Vector((p0.x, p0.y, 0)).normalized() * .03
    J[f'robe_{name}1'] = (p0 - inward, p1 - inward)
    J[f'robe_{name}2'] = (p1 - inward, p2 - inward)
J['hat1'] = (hscale((0, .02, 1.84)), hscale((0, .05, 1.98)))
J['hat2'] = (hscale((0, .05, 1.98)), hscale((0, .1, 2.15)))

PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck', 'wand': 'hand.R', 'wand_tip': 'wand', 'hat1': 'head', 'hat2': 'hat1'}
for side in 'LR':
    PARENT.update({f'shoulder.{side}': 'chest', f'upper_arm.{side}': f'shoulder.{side}', f'forearm.{side}': f'upper_arm.{side}',
                   f'hand.{side}': f'forearm.{side}', f'thigh.{side}': 'hips', f'shin.{side}': f'thigh.{side}', f'foot.{side}': f'shin.{side}',
                   f'toe.{side}': f'foot.{side}', f'eye.{side}': 'head'})
for n in ('F.L', 'F.R', 'S.L', 'S.R', 'B'):
    PARENT[f'robe_{n}1'] = 'hips'; PARENT[f'robe_{n}2'] = f'robe_{n}1'

arm_data = bpy.data.armatures.new('WizardRig')
rig = new_obj('WizardRig', arm_data)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
order = ['hips'] + [k for k in J if k != 'hips']
for name in order:
    h, t = J[name]
    b = arm_data.edit_bones.new(name); b.head = h; b.tail = t; b.roll = 0; eb[name] = b
for name, par in PARENT.items():
    if par:
        eb[name].parent = eb[par]
        eb[name].use_connect = False
for n in ('upper_arm', 'forearm', 'hand', 'shin', 'foot', 'toe'):
    for side in 'LR': pass
bpy.ops.object.mode_set(mode='OBJECT')

# ------------------------------------------------------------------ skin weights
bone_seg = {n: (np.array(arm_data.bones[n].head_local), np.array(arm_data.bones[n].tail_local)) for n in J}
def seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)

def weight(ob, bones, power=4., scale=None, top=3, rigid=None):
    me = ob.data
    P = np.array([v.co[:] for v in me.vertices])
    if rigid:
        g = ob.vertex_groups.new(name=rigid); g.add(list(range(len(P))), 1.0, 'REPLACE'); return
    def sc(b):
        v = (scale or {}).get(b, 1.)
        return v(P) if callable(v) else v
    D = np.stack([seg_dist(P, *bone_seg[b]) * sc(b) for b in bones], 1)
    W = 1. / (D + .012) ** power
    idx = np.argsort(-W, 1)[:, :top]
    groups = {b: ob.vertex_groups.new(name=b) for b in bones}
    for vi in range(len(P)):
        ws = W[vi, idx[vi]]; ws = ws / ws.sum()
        for bi, w in zip(idx[vi], ws):
            if w > .01: groups[bones[bi]].add([vi], float(w), 'REPLACE')

TORSO_B = ['hips', 'spine', 'chest', 'neck', 'shoulder.L', 'shoulder.R', 'upper_arm.L', 'upper_arm.R']
ROBE_B = ['hips', 'spine', 'chest', 'shoulder.L', 'shoulder.R', 'upper_arm.L', 'upper_arm.R'] + [f'robe_{n}{i}' for n in ('F.L', 'F.R', 'S.L', 'S.R', 'B') for i in (1, 2)]

def join(objs, name):
    if len(objs) == 1:
        objs[0].name = name; return objs[0]
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, object=objs[0]):
        bpy.ops.object.join()
    objs[0].name = name; objs[0].data.name = name
    return objs[0]

def finish(ob):
    ob.parent = rig
    m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = rig

# eyes are rigid to their eye bone, so the eye can blink by scaling
eye_objs = {'L': [], 'R': []}
rest_head = []
for p in parts_head:
    if 'bone' in p.keys(): eye_objs[p['bone'][-1]].append(p)
    else: rest_head.append(p)
for side in 'LR':
    e = join(eye_objs[side], f'Eye.{side}'); weight(e, None, rigid=f'eye.{side}'); finish(e)

headm = join(rest_head, 'Head'); weight(headm, ['head', 'neck'], scale={'neck': 1.6}); finish(headm)
neck.name = 'Neck'; weight(neck, ['neck', 'head', 'chest'], scale={'head': 1.3}); finish(neck)
body = join([torso] + details, 'Torso'); weight(body, TORSO_B, scale={'upper_arm.L': 1.6, 'upper_arm.R': 1.6}); finish(body)
weight(legs, ['hips', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R'], scale={'hips': 1.3}); finish(legs)
for ob in arms:
    side = ob.name[-1]
    if ob.name.startswith('Arm'): weight(ob, [f'shoulder.{side}', f'upper_arm.{side}', f'forearm.{side}', f'hand.{side}', 'chest'], scale={'chest': 1.8})
    elif ob.name.startswith('Hand'): weight(ob, [f'hand.{side}', f'forearm.{side}'], scale={f'forearm.{side}': 1.5})
    else: weight(ob, [f'foot.{side}', f'toe.{side}', f'shin.{side}'], scale={f'shin.{side}': 1.4})
    finish(ob)
arm_mask = lambda P: np.where(P[:, 2] > 1.36, 1.6, 40.)   # arms only pull the shoulder yoke
def chain_mask(P):  # hem chains fade out smoothly above the hips so the waist never tears
    k = np.clip((P[:, 2] - .86) / .2, 0, 1); k = k * k * (3 - 2 * k)
    return 1 + 25 * k
CHAIN_SC = {f'robe_{n}1': chain_mask for n in ('F.L', 'F.R', 'S.L', 'S.R', 'B')}
robe_all = join([robe] + facings, 'Robe'); weight(robe_all, ROBE_B, power=3., scale={'upper_arm.L': arm_mask, 'upper_arm.R': arm_mask, **CHAIN_SC}); finish(robe_all)
for sl in sleeves:
    side = sl.name[-1]
    weight(sl, [f'shoulder.{side}', f'upper_arm.{side}', f'forearm.{side}', f'hand.{side}', 'chest'], scale={'chest': 1.7, f'hand.{side}': 1.6}); finish(sl)
for name, objs in hair.items():
    h = join(objs, name); weight(h, ['head', 'neck'], scale={'neck': 2.2 if name != 'Hair_Long' else 1.25}); finish(h)
beard = join(bd, 'Beard'); weight(beard, ['head', 'neck'], scale={'neck': 2.}); finish(beard)
hat = join(ht, 'Hat'); weight(hat, ['head', 'hat1', 'hat2'], scale={'head': .7}); finish(hat)
wandm = join(wand_parts, 'Wand'); weight(wandm, None, rigid='wand'); finish(wandm)

print('BUILD OK', len(bpy.data.objects), 'objects')
