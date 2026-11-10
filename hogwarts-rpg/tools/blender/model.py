# Blender (bpy) build script, version 2: stylised wizard for Szlaki Magii.
# One rigged body serves every student and professor. The face has a jaw, eyelids,
# rotating eyeballs and shape keys for expressions and face variety; hands have fingers.
# Character faces -Y in Blender (the glTF exporter turns this into +Z, as the game expects).
import bpy, bmesh, math
from math import sin, cos, pi, exp, atan2, sqrt, radians
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
def mat(name, color, rough=.8, metal=0., emit=0., double=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(color), 1)
        b.inputs['Emission Strength'].default_value = emit
    m.use_backface_culling = not double
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

def oriented_ellipsoid(name, c, axes, radii, material, seg=(16, 10)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1)
    M3 = Matrix((tuple(axes[0] * radii[0]), tuple(axes[1] * radii[1]), tuple(axes[2] * radii[2]))).transposed()
    for v in bm.verts: v.co = Vector(c) + M3 @ v.co
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
    if subdiv:
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

def g2(a, b, ra, rb): return exp(-((a / ra) ** 2 + (b / rb) ** 2))
def sm(x): x = max(0., min(1., x)); return x * x * (3 - 2 * x)

def sweep(name, pts, widths, thick, material, normal_fn, ring=6, caps=True):
    """Flattened tube along pts; widths across, thick along normal_fn(p) (outward)."""
    bm = bmesh.new(); prev = None; first = None; n = len(pts)
    for i, p in enumerate(pts):
        T = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        N = normal_fn(p); N = (N - T * N.dot(T)).normalized(); B = T.cross(N).normalized()
        w = widths[i] if isinstance(widths, (list, tuple)) else widths
        th = thick[i] if isinstance(thick, (list, tuple)) else thick
        ringv = [bm.verts.new(p + B * cos(q / ring * 2 * pi) * w + N * sin(q / ring * 2 * pi) * th) for q in range(ring)]
        if prev:
            for q in range(ring): bm.faces.new((prev[q], prev[(q + 1) % ring], ringv[(q + 1) % ring], ringv[q]))
        else: first = ringv
        prev = ringv
    if caps:
        bm.faces.new(list(reversed(first))); bm.faces.new(prev)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    return from_bm(name, bm, material)

def orient(ob, center=None, direction=None):
    """Make an open shell face away from center (or along direction); closed meshes get consistent outward normals."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    if center is None and direction is None:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        bm.normal_update(); score = 0.
        for f in bm.faces:
            ref = (f.calc_center_median() - Vector(center)) if center is not None else Vector(direction)
            score += f.normal.dot(ref) * f.calc_area()
        if score < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free(); return ob

def set_part(ob, tag):
    a = ob.data.attributes.new('part', 'INT', 'POINT')
    a.data.foreach_set('value', [tag] * len(ob.data.vertices))
    return ob

# ------------------------------------------------------------------ materials (names are the runtime contract)
M = dict(
    skin=mat('M_Skin', '#c9a385', .52),
    hair=mat('M_Hair', '#3a2c26', .68),
    robe=mat('M_Robe', '#202c35', .9),
    lining=mat('M_Lining', '#547da9', .72),
    vest=mat('M_Vest', '#353c3d', .84),
    shirt=mat('M_Shirt', '#ddd8c9', .8),
    trousers=mat('M_Trousers', '#26292b', .85),
    shoes=mat('M_Shoes', '#191514', .34),
    gold=mat('M_Gold', '#c2a062', .3, .85),
    wand=mat('M_Wand', '#5e4029', .5),
    white=mat('M_EyeWhite', '#efe9e1', .18),
    iris=mat('M_Iris', '#4b3a28', .22),
    pupil=mat('M_Pupil', '#0b0908', .12),
    glint=mat('M_EyeGlint', '#ffffff', .1, 0, 2.0),
    lips=mat('M_Lips', '#b07466', .42),
    lash=mat('M_Lash', '#17110e', .7),
    mouth=mat('M_Mouth', '#3b1715', .9),
    teeth=mat('M_Teeth', '#e9e3d3', .3),
    book=mat('M_Book', '#5c3423', .6),
    page=mat('M_Page', '#e8ddc3', .85),
)
PART = dict(skin=0, brow=1, lipU=2, lipL=3, lidU_L=4, lidU_R=5, lidL=6, lash_L=7, lash_R=8, membrane=9, teethU=10, teethL=11, ear=12)

# ------------------------------------------------------------------ skeleton layout (metres)
J = {}
J['hips'] = (Vector((0, 0, .95)), Vector((0, 0, 1.08)))
J['spine'] = (Vector((0, 0, 1.08)), Vector((0, 0, 1.25)))
J['chest'] = (Vector((0, 0, 1.25)), Vector((0, 0, 1.45)))
J['neck'] = (Vector((0, .005, 1.47)), Vector((0, .008, 1.565)))
J['head'] = (Vector((0, .008, 1.565)), Vector((0, .008, 1.80)))
for s, side in ((1, 'L'), (-1, 'R')):
    S = Vector((s * .18, .0, 1.435)); E = Vector((s * .305, .012, 1.19)); W = Vector((s * .40, -.012, .965))
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

# ------------------------------------------------------------------ head surface
HC = Vector((0, .008, 1.668))
NOSE = [(1.6258, 0.), (1.6314, .002), (1.6360, .009), (1.6410, .017), (1.6470, .021), (1.6544, .0198), (1.6663, .0145), (1.6829, .0088), (1.7004, .0044), (1.7160, 0.)]
NOSEW = [(1.6258, .006), (1.6350, .0102), (1.6433, .011), (1.6553, .009), (1.6737, .007), (1.7013, .0064), (1.7197, .008)]
# Faces 2.0: larger eyes set lower and closer together, a wider mouth, fuller cheeks and a firmer chin.
# ED / EX are the shifts from the first layout; expression keys and brows follow them.
EYE_Z = 1.6765; EYE_X = .0368; EYE_R = .0152
ED = EYE_Z - 1.684; EX = EYE_X - .0405
MOUTH_Z = 1.6085; MOUTH_W = .0255

def head_shape(p):
    x, y, z = p
    sx, sy, sz = .089, .104, .122
    taper = 1 - .25 * max(0, -z) ** 1.5
    yy = y * (1.05 if y > 0 else 1.0)
    if y < -.5: yy = -.5 + (y + .5) * .62           # flatter face plane
    w = Vector((x * sx * taper, yy * sy * (1 - .13 * max(0, -z) ** 2), z * sz * (.94 if z < 0 else 1.))) + HC
    if y > 0 and z < -.2: w.y -= .022 * y * min(1, (-z - .2) / .55)      # skull tucks in above the neck
    w.x *= 1 + .062 * exp(-(((z + .5) / .22) ** 2 + ((y - .05) / .45) ** 2))  # jaw angle
    if y < 0:
        X, Z = w.x, w.z
        k = min(1, -y / .32)
        out = 0.
        out += .0062 * g2(X, Z - (1.709 + ED), .05, .0085)                              # brow ridge
        out += .84 * catmull(NOSE, Z) * exp(-(X / catmull(NOSEW, Z)) ** 2)       # nose
        out += .0055 * (g2(X - .0124, Z - 1.6425, .005, .0056) + g2(X + .0124, Z - 1.6425, .005, .0056))  # alae
        out += .0062 * g2(X, Z - 1.6085, .03, .016)                               # muzzle
        out += .0116 * g2(X, Z - 1.558, .023, .015)                              # chin
        out -= .0026 * g2(X, Z - 1.5855, .019, .0048)                             # mentolabial sulcus
        out += .0078 * g2(abs(X) - .05, Z - 1.625, .024, .021)                   # cheeks
        out -= .014 * g2(abs(X) - EYE_X, Z - EYE_Z, .0255, .019)               # deep eye sockets
        out -= .0011 * g2(X, Z - 1.6235, .0032, .0048)                            # philtrum
        out -= .0012 * g2(abs(X) - .03, Z - 1.6175, .004, .012)                   # nasolabial hint
        w.y -= out * k
        w.x += math.copysign(.0035, X) * g2(abs(X) - .066, Z - 1.666, .018, .014) * k   # cheekbones
    return w

bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=60, v_segments=40, radius=1)
for v in bm.verts: v.co = head_shape(v.co)
skin = set_part(from_bm('HeadSkin', bm, M['skin']), PART['skin'])
bvh_head = BVHTree.FromObject(skin, bpy.context.evaluated_depsgraph_get())

def surf_y(tree, x, z, start=-.5):
    hit = tree.ray_cast(Vector((x, start, z)), Vector((0, 1, 0)))
    return hit[0].y if hit[0] else None

FRONT = lambda p: Vector((0, -1, 0))
def face_normal(p):
    hit = bvh_head.ray_cast(Vector((p.x, -.5, p.z)), Vector((0, 1, 0)))
    return -hit[1] if hit[0] else Vector((0, -1, 0))

head_parts = [skin]
# ears
for s in (1, -1):
    e = ellipsoid(f'Ear{s}', (s * .0905, .02, 1.664), (.0105, .02, .031), M['skin'], rot=(0, 0, s * -.32), seg=(14, 10))
    for v in e.data.vertices:   # cupped: the outer face is hollowed a little
        d = (v.co.x - s * .0905) * s
        if d > 0: v.co.x -= s * d * .45 * sm(1 - abs(v.co.z - 1.664) / .03)
    head_parts.append(set_part(e, PART['ear']))

# eyes: proper eyeballs rotating on the eye bones; the visible shape comes from the lids
EYE_C = {}
eye_objs = {}
for s, side in ((1, 'L'), (-1, 'R')):
    ex = s * EYE_X; sy_ = surf_y(bvh_head, ex, EYE_Z)
    c = Vector((ex, sy_ + EYE_R * .42, EYE_Z)); EYE_C[side] = c
    J[f'eye.{side}'] = (c.copy(), c + Vector((0, -.03, 0)))
    J[f'lid.{side}'] = (c.copy(), c + Vector((.012, 0, 0)))
    parts = [ellipsoid(f'EyeBall{side}', tuple(c), (EYE_R, EYE_R, EYE_R), M['white'], seg=(18, 12))]
    def eye_cap(name, r, alpha, material, c=c, ring=16, rows=4, lift=0.):
        def fn(u, v):
            a = alpha * (.04 + .96 * v); t = u * 2 * pi
            d = Vector((sin(a) * cos(t), -cos(a), sin(a) * sin(t)))
            return c + d * (r + lift * (1 - v))
        ob = grid(name, fn, ring, rows, closed_u=True, material=material, uv=False)
        return orient(ob, center=c)
    parts.append(eye_cap(f'Iris{side}', EYE_R * 1.004, math.asin(.0081 / EYE_R), M['iris'], lift=EYE_R * .035))
    parts.append(eye_cap(f'Pupil{side}', EYE_R * 1.006, math.asin(.0033 / EYE_R), M['pupil'], lift=EYE_R * .04))
    parts.append(ellipsoid(f'Glint{side}', tuple(c + Vector((s * .0031, -EYE_R * 1.05, .0034))), (.0015, .0005, .0015), M['glint'], seg=(8, 6)))
    eye_objs[side] = parts

# lids: shells around the eyeball. Upper lid rotates on lid.L/R to blink; lower lid stays.
def lid_shell(name, side, upper, rr):
    s = 1 if side == 'L' else -1; c = EYE_C[side]
    TH = radians(78)
    def edge(th):
        q = (abs(th) / TH) ** 2.2
        outer = (th * s) / TH          # +1 on the outer corner
        if upper: return radians(28) - radians(30) * q + radians(4) * outer * q
        return radians(-23) + radians(21) * q + radians(4) * outer * q
    def fn(u, v):
        th = -TH + u * 2 * TH
        e = edge(th)
        phi = e + (radians(100) - e) * v if upper else e - (e + radians(98)) * v
        d = Vector((sin(th) * cos(phi), -cos(th) * cos(phi), sin(phi)))
        return c + d * rr
    ob = orient(grid(name, fn, 20, 7, material=M['skin'], uv=False), center=c)
    return ob, edge

for s, side in ((1, 'L'), (-1, 'R')):
    up, edge_u = lid_shell(f'LidU{side}', side, True, EYE_R * 1.085)
    lo, edge_l = lid_shell(f'LidL{side}', side, False, EYE_R * 1.07)
    head_parts.append(set_part(up, PART['lidU_' + side])); head_parts.append(set_part(lo, PART['lidL']))
    c = EYE_C[side]; TH = radians(74)
    pts = []
    for i in range(15):
        th = -TH + i / 14 * 2 * TH; ph = edge_u(th) + radians(2)
        d = Vector((sin(th) * cos(ph), -cos(th) * cos(ph), sin(ph)))
        pts.append(c + d * EYE_R * 1.12 + Vector((0, 0, .0004)))
    w = [.00075 + .0006 * sin(pi * i / 14) for i in range(15)]
    lash = sweep(f'Lash{side}', pts, w, .00045, M['lash'], lambda p, c=c: (p - c).normalized() + Vector((0, 0, .9)), ring=5)
    head_parts.append(set_part(lash, PART['lash_' + side]))

# brows
for s in (1, -1):
    pts = []; ws = []; ts = []
    for i in range(11):
        t = i / 10; X = s * (.0125 + t * .053)
        Z = 1.7045 + ED * .8 + .0068 * sin(pi * min(1, t * 1.25)) - .002 * max(0, t - .8) / .2
        Y = surf_y(bvh_head, X, Z) - .0016
        pts.append(Vector((X, Y, Z))); ws.append(.0052 - .0032 * t ** 1.3); ts.append(.0019 - .0007 * t)
    head_parts.append(set_part(sweep(f'Brow{s}', pts, ws, ts, M['hair'], lambda p: face_normal(p), ring=6), PART['brow']))

# lips, mouth membrane and teeth
def lip_curve(upper, n=15):
    pts = []; rs = []
    for i in range(n):
        t = i / (n - 1); X = -MOUTH_W + 2 * MOUTH_W * t; q = 1 - (X / MOUTH_W) ** 2
        if upper:
            Z = MOUTH_Z + .0021 + .0013 * q - .0009 * exp(-(X / .0045) ** 2); r = .0012 + .0033 * q ** .7
        else:
            Z = MOUTH_Z - .0026 - .0013 * q; r = .0012 + .0041 * q ** .8
        Y = surf_y(bvh_head, X, Z) - r * .5
        pts.append(Vector((X, Y, Z))); rs.append(r)
    return pts, rs
for upper, tag in ((True, 'lipU'), (False, 'lipL')):
    pts, rs = lip_curve(upper)
    head_parts.append(set_part(sweep('Lip' + tag, pts, rs, [r * .8 for r in rs], M['lips'], FRONT, ring=8), PART[tag]))
membrane = grid('Membrane', lambda u, v: Vector((-MOUTH_W * .97 + 2 * MOUTH_W * .97 * u, 0, MOUTH_Z + .0012 - .0042 * v)), 16, 4, material=M['mouth'], uv=False)
for vtx in membrane.data.vertices: vtx.co.y = surf_y(bvh_head, vtx.co.x, vtx.co.z) - .0009
orient(membrane, direction=(0, -1, 0))
head_parts.append(set_part(membrane, PART['membrane']))
for upper, tag in ((True, 'teethU'), (False, 'teethL')):
    z0, z1 = (MOUTH_Z - .0008, MOUTH_Z - .0036) if upper else (MOUTH_Z - .0062, MOUTH_Z - .0086)
    t = grid('Teeth' + tag, lambda u, v, z0=z0, z1=z1: Vector((-.0165 + .033 * u, 0, z0 + (z1 - z0) * v)), 12, 2, material=M['teeth'], uv=False)
    for vtx in t.data.vertices: vtx.co.y = surf_y(bvh_head, vtx.co.x, vtx.co.z) - .0013 + .0035 * (vtx.co.x / .0165) ** 2
    orient(t, direction=(0, -1, 0))
    head_parts.append(set_part(t, PART[tag]))

# ------------------------------------------------------------------ body
def flat_y(f):
    def post(co): co.y *= f; return co
    return post
torso = skin_mesh('Torso',
    [(0, 0, .9), (0, 0, 1.05), (0, 0, 1.22), (0, 0, 1.37), (0, .005, 1.47), (.155, 0, 1.425), (-.155, 0, 1.425)],
    [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5), (3, 6)],
    [.14, .128, .15, .158, .064, .072, .072], M['vest'], post=flat_y(.74))
neck = skin_mesh('Neck', [(0, .01, 1.43), (0, .014, 1.6)], [(0, 1)], [.077, .066], M['skin'], subdiv=2, post=flat_y(.88))
legs = skin_mesh('Legs',
    [(0, 0, .97), (.095, 0, .9), (.1, -.008, .495), (.1, .012, .045), (-.095, 0, .9), (-.1, -.008, .495), (-.1, .012, .045)],
    [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
    [.105, .086, .064, .05, .086, .064, .05], M['trousers'], subdiv=1)

WAND_DIR = Vector((-.08, -1, -.18)).normalized()
def hand_frame(side):
    s = 1 if side == 'L' else -1
    E, W = J[f'forearm.{side}']
    d = (W - E).normalized()
    n = Vector((-s, 0, 0)); n = (n - d * n.dot(d)).normalized()
    f = Vector((0, -1, 0)); f = (f - d * f.dot(d) - n * f.dot(n)).normalized()
    return W, d, n, f

def finger_chain(base, d, n, lengths, curls, spread):
    axis = d.cross(n).normalized()
    di = Quaternion(n, spread) @ d
    pts = [base.copy()]; p = base.copy()
    for L, a in zip(lengths, curls):
        di = Quaternion(axis, a) @ di
        p = p + di * L; pts.append(p.copy())
    return pts

limbs = []
for s, side in ((1, 'L'), (-1, 'R')):
    S, E = J[f'upper_arm.{side}']; W = J[f'forearm.{side}'][1]
    limbs.append(skin_mesh(f'Arm.{side}', [tuple(S + Vector((-s * .035, 0, -.05))), tuple(E), tuple(W)], [(0, 1), (1, 2)], [.05, .044, .033], M['shirt']))
    W, d, n, f = hand_frame(side); grip = side == 'R'
    parts = [oriented_ellipsoid(f'Palm.{side}', W + d * .043 + n * .001, (f, d, n), (.031, .042, .0125), M['skin'], seg=(16, 10))]
    FING = [(.0245, (.025, .017, .014), .085), (.0082, (.028, .018, .015), .02), (-.0082, (.026, .017, .014), -.05), (-.0235, (.02, .014, .012), -.13)]
    for i, (off, lens, spread) in enumerate(FING):
        if grip: curls = (1.3 + .05 * i, 1.55, .95)
        else: curls = (.32 + .07 * i, .48 + .05 * i, .3)
        base = W + d * .074 + f * off * (.92 if grip else 1) + n * .0015
        pts = finger_chain(base, d, n, lens, curls, 0 if grip else spread)
        rad = [.0079 - .0004 * i, .0072 - .0004 * i, .0065 - .0004 * i, .0057 - .0004 * i]
        parts.append(skin_mesh(f'Finger{i}.{side}', [tuple(p) for p in pts], [(k, k + 1) for k in range(3)], rad, M['skin'], subdiv=1))
    if grip:
        t0 = W + d * .03 + f * .021 + n * .011; tdir = (f * .78 + d * .45 + n * .25).normalized()
        tp = [t0, t0 + tdir * .022]; tdir2 = (f * .9 + d * .35).normalized(); tp.append(tp[-1] + tdir2 * .019); tp.append(tp[-1] + tdir2 * .016)
    else:
        t0 = W + d * .024 + f * .022 + n * .008; tdir = (d * .55 + f * .62 + n * .5).normalized()
        tp = [t0, t0 + tdir * .023]; tdir2 = (Quaternion(d.cross(n), .25) @ tdir); tp.append(tp[-1] + tdir2 * .019); tp.append(tp[-1] + tdir2 * .015)
    parts.append(skin_mesh(f'Thumb.{side}', [tuple(p) for p in tp], [(0, 1), (1, 2), (2, 3)], [.0098, .0088, .0078, .0068], M['skin'], subdiv=1))
    limbs.append(('Hand', side, parts))
    sh = skin_mesh(f'Shoe.{side}', [(s * .1, .04, .045), (s * .1, -.05, .036), (s * .1, -.155, .03)], [(0, 1), (1, 2)], [.04, .043, .031], M['shoes'])
    for v in sh.data.vertices:
        v.co.z = max(v.co.z, .004) if v.co.z > .004 else .004 + (v.co.z - .004) * .1
    limbs.append(sh)

bvh_torso = BVHTree.FromObject(torso, bpy.context.evaluated_depsgraph_get())
details = []
ty = surf_y(bvh_torso, 0, 1.33)
details.append(ellipsoid('TieKnot', (0, surf_y(bvh_torso, 0, 1.445) - .012, 1.445), (.02, .012, .018), M['lining'], seg=(12, 8)))
details.append(ellipsoid('Tie', (0, ty - .006, 1.33), (.021, .006, .11), M['lining'], rot=(-.08, 0, 0), seg=(12, 10)))
for i in range(4):
    details.append(ellipsoid(f'TieStripe{i}', (0, ty - .0118, 1.40 - i * .045), (.017, .0012, .0026), M['gold'], rot=(-.08, .35, 0), seg=(8, 4)))
for s in (1, -1):
    cy = surf_y(bvh_torso, s * .03, 1.455)
    details.append(ellipsoid(f'Collar{s}', (s * .036, cy - .008, 1.462), (.03, .007, .022), M['shirt'], rot=(0, s * .5, 0), seg=(12, 6)))
for i in range(4):
    z = 1.27 - i * .07; details.append(ellipsoid(f'Button{i}', (.052, surf_y(bvh_torso, .052, z) - .003, z), (.008, .004, .008), M['gold'], seg=(8, 6)))

# ------------------------------------------------------------------ robe
ROBE = [  # t, z, rx, ry, gap
    (0.00, (.10, .300, .262, .90)),
    (0.30, (.60, .238, .205, .70)),
    (0.55, (.96, .196, .160, .52)),
    (0.66, (1.10, .183, .150, .44)),
    (0.80, (1.27, .203, .158, .40)),
    (0.93, (1.41, .212, .149, .44)),
    (1.00, (1.50, .2, .092, .58)),
]
def robe_point(u, t, inset=0.):
    z, rx, ry, gap = catmull(ROBE, t)
    a = gap / 2 + u * (2 * pi - gap)
    fold = (.012 * sin(a * 9 + .6) + .0065 * sin(a * 15 + 1.3) + .004 * sin(a * 23) + .003 * sin(a * 31 + 2.)) * (1 - t) ** 1.3
    r_x, r_y = rx + fold - inset, ry + fold - inset
    if t > .93:  # yoke: shoulders slope down to the sleeves
        k = (t - .93) / .07
        z = z - .065 * k * abs(sin(a)) ** 1.5
    if t < .05: z -= .015 * (1 - t / .05) * (.5 - .5 * cos(a))   # back hem hangs slightly lower
    return Vector((sin(a) * r_x, -cos(a) * r_y, z))

robe = grid('Robe', robe_point, 50, 24, material=M['robe'])
robe.data.materials.append(M['lining'])
solidify(robe, .011)

facings = []
for s in (1, -1):
    pts = []
    for k in range(25):
        t = k / 24
        p = robe_point(0 if s > 0 else 1, t); pts.append(p + Vector((0, -.004, 0)))
    bm = bmesh.new()
    prev = None
    for i, p in enumerate(pts):
        w = .022 if i < 22 else .022 + (i - 21) * .006
        ring = []
        tdir = (pts[min(i + 1, 24)] - pts[max(i - 1, 0)]).normalized()
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

# hood folded on the back
def hood_pt(u, v):
    a = (u - .5) * radians(200)
    top = Vector((sin(a) * .098, .025 + cos(a) * .082, 1.462 + .01 * cos(a)))
    bot = Vector((sin(a) * .1 * (1 - .25 * v), .13 + .03 * cos(a), 1.2))
    p = top.lerp(bot, v ** .9)
    bulge = sin(pi * v) * (.045 * cos(a * .8) + .004)
    p += Vector((0, bulge, 0))
    p.z -= .03 * (1 - cos(a)) * v
    return p
hood = grid('Hood', hood_pt, 26, 12, material=M['robe'])
hood.data.materials.append(M['lining']); solidify(hood, .009)

sleeves = []
for s, side in ((1, 'L'), (-1, 'R')):
    S, E = J[f'upper_arm.{side}']; W = J[f'forearm.{side}'][1]
    d2 = (W - E).normalized(); C = W - d2 * .008
    path = [S + Vector((-s * .03, 0, -.045)), E, W - d2 * .045, C]
    lens = [0] + [(path[i + 1] - path[i]).length for i in range(3)]; cum = np.cumsum(lens); total = cum[-1]
    def along(v, path=path, cum=cum, total=total):
        L = v * total; i = min(int(np.searchsorted(cum, L, side='right')) - 1, 2)
        f = (L - cum[i]) / max(1e-6, cum[i + 1] - cum[i]); return path[i].lerp(path[i + 1], f), (path[i + 1] - path[i]).normalized()
    def sleeve_point(u, v, s=s, along=along):
        c, tdir = along(v)
        ref = Vector((0, -1, 0)); x = ref.cross(tdir).normalized(); y = tdir.cross(x).normalized()
        r = catmull([(0, .072), (.42, .07), (.82, .084), (1, .108)], v)
        ang = u * 2 * pi
        r *= 1 + .05 * sin(ang * 5 + v * 4) * v
        p = c + x * cos(ang) * r + y * sin(ang) * r * .92
        hang = max(0, (v - .7) / .3) ** 2 * .035 * (.5 + .5 * cos(ang - pi / 2 * s))
        return p + Vector((0, 0, -hang))
    sl = grid(f'Sleeve.{side}', sleeve_point, 22, 14, closed_u=True, material=M['robe'])
    sl.data.materials.append(M['lining'])
    solidify(sl, .009)
    sleeves.append(sl)

# ------------------------------------------------------------------ hair: sculpted shells with strand grooves + loose locks
def hairline_short(p):
    ang = math.atan2(p.x, -(p.y - HC.y)); a = abs(ang)
    front, side, back = 1.737, 1.674, 1.625
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

def clump(name, ctrl, width=.042, thick=.016, curl=0., taper=.75, hold=0., grooves=True):
    keys = [(i / (len(ctrl) - 1), tuple(c)) for i, c in enumerate(ctrl)]
    n = 10; ring = 7
    P = [Vector(catmull(keys, i / (n - 1))) for i in range(n)]
    bm = bmesh.new(); prev = None
    for i, p in enumerate(P):
        t = i / (n - 1)
        T = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).normalized()
        N = (p - HC); N = (N - T * N.dot(T)).normalized()
        B = T.cross(N).normalized()
        w = width * min(1, (t / .15)) ** .5 * ((1 - max(0, t - hold) / (1 - hold)) ** taper) + .0012
        th = thick * (w / width) + .0008
        rot = Matrix.Rotation(curl * t, 3, T)
        verts = []
        for q in range(ring):
            ang = q / ring * 2 * pi
            gr = (1 + .18 * cos(ang * 4)) if grooves else 1
            off = B * cos(ang) * w + N * sin(ang) * th * gr
            verts.append(bm.verts.new(p + rot @ off))
        if prev:
            for q in range(ring): bm.faces.new((prev[q], prev[(q + 1) % ring], verts[(q + 1) % ring], verts[q]))
        else:
            bm.faces.new(list(reversed(verts)))
        prev = verts
    tip = bm.verts.new(P[-1] + (P[-1] - P[-2]).normalized() * .005)
    for q in range(ring): bm.faces.new((prev[q], prev[(q + 1) % ring], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    return from_bm(name, bm, M['hair'])

def D(x, y, z): return Vector((x, y, z))
CROWN = D(.12, .35, 1)

def surf_dir(az, e):
    return Vector((sin(az) * cos(e), -cos(az) * cos(e), sin(e)))

def hair_shell(name, hairline, thick, flow=CROWN, groove=.0013, freq=44, jag=.005, jag_freq=17, nu=76, nv=20, bumps=0.):
    """Shell grid aligned to the hairline: rows run from the (wavy) hairline up to the crown."""
    fc = flow.normalized(); a1 = fc.orthogonal().normalized(); a2 = fc.cross(a1)
    def e0(az):
        probe = HC + surf_dir(az, 0) * .1
        z0 = hairline(probe) - jag * (.5 + .5 * sin(az * jag_freq))
        lo, hi = -1.2, 1.5
        for _ in range(28):
            mid = (lo + hi) / 2; d = surf_dir(az, mid)
            if (HC + d * head_r(d)).z < z0: lo = mid
            else: hi = mid
        return lo
    E0 = [e0(-pi + 2 * pi * i / nu) for i in range(nu)]
    def fn(u, v):
        i = int(round(u * nu)) % nu; az = -pi + 2 * pi * u
        e = E0[i] + (pi / 2 - .001 - E0[i]) * v ** .85
        d = surf_dir(az, e); p = HC + d * head_r(d); n = d
        tang = n - fc * n.dot(fc); ang = atan2(tang.dot(a2), tang.dot(a1))
        dist = math.acos(max(-1., min(1., n.dot(fc))))
        g = groove * sin(ang * freq + 2.2 * sin(ang * 3 + 1)) * sm(dist / .55)
        if bumps: g += bumps * (sin(n.x * 47 + 1) * sin(n.y * 43) * sin(n.z * 41 + 2))
        edge = sm(v / .08)                   # the rim tucks in towards the scalp
        return p + n * ((thick(n) + g) * (.35 + .65 * edge))
    ob = grid(name, fn, nu, nv, closed_u=True, material=M['hair'], uv=False)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.0004)
    edges = [e for e in bm.edges if e.is_boundary]
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in ret['geom']:
        if isinstance(v, bmesh.types.BMVert):
            d = (v.co - HC).normalized(); v.co = HC + d * (head_r(d) - .0025)
    bm.to_mesh(ob.data); bm.free()
    for p_ in ob.data.polygons: p_.use_smooth = True
    return orient(ob, center=HC)

def thick_short(n): return .0085 + .0085 * sm((n.z + .15) / .85) + .003 * max(0., n.y)
def thick_thin(n): return .0055 + .003 * sm((n.z + .1) / .8)

hair = {}
# short: soft volume, side-swept fringe locks breaking the hairline
hs = [hair_shell('Hair_Short', hairline_short, thick_short)]
for j in range(7):
    t = j / 6; x = -.85 + t * 1.7
    start = D(.2 + x * .3, .25, 1); end = D(x * .62 - .14, -1, .42 + .12 * abs(x) ** 2)
    hs.append(clump(f'ShortLock{j}', head_path(start, end, .014, .008, n=6), .05, .011, curl=-.2))
for s in (1, -1):
    for j in range(2):
        start = D(s * .5, -.2 + j * .45, .7); end = D(s, -.25 + j * .5, .12)
        hs.append(clump(f'ShortSide{s}{j}', head_path(start, end, .012, .006, n=5), .045, .01, curl=s * .2))
hair['Hair_Short'] = hs

# long: centre part, hair falling to the shoulder blades and framing the face
def hairline_long(p):
    h = hairline_short(p)
    ang = abs(math.atan2(p.x, -(p.y - HC.y)))
    return h - .03 * sm((ang - .9) / .6)
ROBE_Z = None
def robe_r(z, a):
    lo, hi = 0., 1.
    for _ in range(30):
        mid = (lo + hi) / 2
        if catmull(ROBE, mid)[0] < z: lo = mid
        else: hi = mid
    _, rx, ry, _ = catmull(ROBE, lo)
    return 1 / sqrt((sin(a) / rx) ** 2 + (cos(a) / ry) ** 2)
hl = [hair_shell('Hair_Long', hairline_long, lambda n: .007 + .007 * sm((n.z + .1) / .8), flow=D(0, .05, 1), freq=52)]
def curtain_pt(u, v):
    a = -radians(122) + u * radians(244)
    d0 = Vector((sin(a), cos(a), .18)).normalized()
    top = on_head(d0, .009)
    length = .21 + .05 * cos(a) ** 2 + .012 * sin(u * 23)
    out = Vector((sin(a), cos(a), 0))
    p = top + out * (.02 * v + .012 * sin(pi * v)) + Vector((0, .018 * v * max(0, cos(a)), -length * v))
    p += out * .0016 * sin(u * 64 + v * 2.5)
    if p.z < 1.52:
        r = robe_r(p.z, a) + .012; cur = Vector((p.x, p.y, 0)).length
        if cur < r: p.x, p.y = p.x * r / cur, p.y * r / cur
    return p
ct = grid('LongCurtain', curtain_pt, 50, 11, material=M['hair']); solidify(ct, .006, 0); hl.append(orient(ct))
for s in (1, -1):
    for j in range(3):
        start = D(s * .06, -.1 + j * .1, 1); end = D(s * (.8 + j * .1), -.75 + j * .2, .35 - j * .12)
        hl.append(clump(f'LongPart{s}{j}', head_path(start, end, .007, .005, n=6), .04, .007, curl=s * .15))
hair['Hair_Long'] = hl

# bun: hair pulled back into a knot
BUN = D(0, .112, 1.745)
hb = [hair_shell('Hair_Bun', lambda p: hairline_short(p) + .002, thick_thin, flow=(BUN - HC), freq=60, jag=.002)]
bun = ellipsoid('Bun', tuple(BUN + Vector((0, .02, 0))), (.05, .042, .05), M['hair'], seg=(28, 18))
for v in bun.data.vertices:
    r = v.co - (BUN + Vector((0, .02, 0))); a = atan2(r.x, r.z)
    v.co += r.normalized() * .0022 * sin(a * 9 + r.y * 120)
hb.append(bun)
for j in range(3):
    a0 = j / 3 * 2 * pi; c = BUN + Vector((0, .022, 0))
    pts = [c + Vector((sin(a0 + k * 1.1) * .05, .004 * k - .008, cos(a0 + k * 1.1) * .05)) for k in range(6)]
    hb.append(clump(f'BunWrap{j}', pts, .03, .014, hold=.5, taper=.5))
hair['Hair_Bun'] = hb

# ponytail
PONY = D(0, .118, 1.68)
hp = [hair_shell('Hair_Pony', lambda p: hairline_short(p) + .002, thick_thin, flow=(PONY - HC), freq=60, jag=.002)]
hp.append(ellipsoid('PonyTie', tuple(PONY + Vector((0, .012, 0))), (.016, .014, .016), M['lining'], seg=(10, 8)))
for j in range(6):
    a = j / 6 * 2 * pi
    root = PONY + Vector((sin(a) * .007, .02, cos(a) * .007))
    pts = [root, root + Vector((sin(a) * .013, .03, -.04)), root + Vector((sin(a) * .017, .036, -.11)), root + Vector((sin(a) * .011, .028, -.19)), root + Vector((sin(a) * .005, .02, -.25))]
    hp.append(clump(f'PonyTail{j}', pts, .024, .016, hold=.35, taper=.8))
hair['Hair_Pony'] = hp

# curly: a thick rounded mass of curls
hc = [hair_shell('Hair_Curly', lambda p: hairline_short(p) - .006, lambda n: .02 + .012 * sm((n.z + .1) / .8), groove=.0, bumps=.0035, jag=.008)]
rng = np.random.default_rng(7)
for j in range(95):
    th = rng.uniform(0, 2 * pi); ph = rng.uniform(-.25, 1.0)
    d = D(sin(th) * cos(ph * pi / 2), cos(th) * cos(ph * pi / 2), sin(ph * pi / 2))
    p = on_head(d, .02 + .012 * max(0, d.z))
    if p.z < hairline_short(p) - .006: continue
    R = .0075 + .002 * rng.uniform(); rr = .0058
    def tor_pt(u, v, p=p, R=R, rr=rr, q=Quaternion(Vector(rng.normal(size=3)).normalized(), rng.uniform(0, 3))):
        a = u * 2 * pi; b = v * 2 * pi
        loc = Vector(((R + rr * cos(b)) * cos(a), (R + rr * cos(b)) * sin(a), rr * sin(b)))
        return p + q @ loc
    hc.append(grid(f'Curl{j}', tor_pt, 6, 4, closed_u=True, material=M['hair'], uv=False))
hair['Hair_Curly'] = hc

# ------------------------------------------------------------------ beard, hat, wand, book
# beard: a shell following the jaw from the sideburns, under the lip and chin, with a short rounded tail
def beard_z_top(az):
    k = sm(abs(az) / 1.35) ** 1.45
    return (MOUTH_Z - .0105) * (1 - k) + 1.662 * k
def az_elev_for_z(az, z0):
    lo, hi = -1.45, .9
    for _ in range(26):
        mid = (lo + hi) / 2; d = surf_dir(az, mid)
        if (HC + d * head_r(d)).z < z0: lo = mid
        else: hi = mid
    return hi
BEARD_LEN = .045
def beard_pt(u, v):
    az = -1.72 + u * 3.44
    e0 = az_elev_for_z(az, beard_z_top(az)); e1 = -1.38
    vf = min(v / .78, 1.)
    e = e0 + (e1 - e0) * vf ** .85
    d = surf_dir(az, e); p = HC + d * head_r(d)
    t = (.0025 + .0105 * sm(vf * 1.4)) * sm(v / .06 + .15) + .0011 * sin(az * 38 + 3 * vf)
    p = p + d * t
    if v > .78:
        k = (v - .78) / .22; front = max(0., 1 - (az / 1.15) ** 2)
        p = p + Vector((0, -.006 * front * k, -BEARD_LEN * front * k ** .9))
        p.x *= 1 - .35 * k * front
    return p
beard_sh = grid('Beard_Main', beard_pt, 44, 16, material=M['hair'], uv=False)
solidify(beard_sh, .004, 0)
bd = [orient(beard_sh)]
for s_ in (1, -1):
    pts = []; ws = []
    for i in range(9):
        t = i / 8; X = s_ * (.002 + .034 * t)
        Z = MOUTH_Z + .0068 - .006 * t ** 2.2
        pts.append(Vector((X, surf_y(bvh_head, X, Z) - .0038, Z))); ws.append(.0066 * (1 - .5 * t))
    bd.append(sweep(f'Moustache{s_}', pts, ws, .0036, M['hair'], face_normal, ring=6))
ht = []
brim = grid('Hat_Brim', lambda u, v: Vector((sin(u * 2 * pi) * (.11 + v * .095), .02 + cos(u * 2 * pi) * (.12 + v * .092), 1.785 - .018 * v * v + .012 * sin(u * 6 * pi) * v)), 36, 6, closed_u=True, material=M['robe'])
brim.data.materials.append(M['robe']); solidify(brim, .008, 0); ht.append(brim)
def cone_pt(u, v):
    r = .108 * (1 - v) ** 1.15 + .004
    bend = Vector((0, .1 * v ** 2.2, 0))
    a = u * 2 * pi
    crumple = 1 + .05 * sin(v * 12) * (v > .4)
    return Vector((sin(a) * r * crumple, .02 + cos(a) * r * crumple, 1.78 + v * .42 - .05 * v ** 3)) + bend
ht.append(grid('Hat_Cone', cone_pt, 28, 18, closed_u=True, material=M['robe']))
ht.append(grid('Hat_Band', lambda u, v: Vector((sin(u * 2 * pi) * (.111 - v * .008), .02 + cos(u * 2 * pi) * (.111 - v * .008), 1.788 + v * .04)), 28, 2, closed_u=True, material=M['lining']))
ht.append(ellipsoid('Hat_Buckle', (0, -.095, 1.808), (.022, .006, .018), M['gold'], seg=(10, 6)))

Wr, dR, nR, fR = hand_frame('R')
grip = Wr + dR * .06 + nR * .0125
J['wand'] = (grip - WAND_DIR * .03, grip + WAND_DIR * .30)
J['wand_tip'] = (grip + WAND_DIR * .30, grip + WAND_DIR * .33)
def wand_pt(u, v):
    p = J['wand'][0].lerp(J['wand'][1], v)
    r = .0115 if v < .3 else .0085 * (1 - (v - .3) / .7) + .0035
    if v < .3: r += .002 * sin(v * 60) ** 2
    x = WAND_DIR.cross(Vector((0, 0, 1))).normalized(); y = x.cross(WAND_DIR).normalized()
    return p + x * cos(u * 2 * pi) * r + y * sin(u * 2 * pi) * r
wand = grid('Wand', wand_pt, 10, 16, closed_u=True, material=M['wand'])
wand_parts = [wand]
for i in range(3):
    wand_parts.append(ellipsoid(f'WandRing{i}', tuple(J['wand'][0] + WAND_DIR * (.035 + i * .028)), (.0135, .0135, .0135), M['gold'], seg=(10, 6)))

# open book resting on the left palm (shown while reading)
Wl, dL, nL, fL = hand_frame('L')
bc = Wl + dL * .055 + nL * .03
book = []
for s in (1, -1):
    def page_pt(u, v, s=s):
        across = fL * s * (.004 + u * .085); along = dL * (-.06 + v * .12)
        return bc + across + along + nL * (.012 * sin(pi * u) ** .6 - .004 * u)
    pg = grid(f'Pages{s}', page_pt, 8, 4, material=M['page'], uv=False); solidify(pg, .012, 0); book.append(pg)
    def cover_pt(u, v, s=s):
        across = fL * s * (u * .092); along = dL * (-.065 + v * .13)
        return bc + across + along - nL * (.003 + .002 * u)
    cv = grid(f'Cover{s}', cover_pt, 4, 2, material=M['book'], uv=False); solidify(cv, .004, 0); book.append(cv)

# ------------------------------------------------------------------ head assembly, expressions, face variety
headm_parts = head_parts
with bpy.context.temp_override(active_object=headm_parts[0], selected_editable_objects=headm_parts, object=headm_parts[0]):
    bpy.ops.object.join()
headm = headm_parts[0]; headm.name = 'Head'; headm.data.name = 'Head'
for p in headm.data.polygons: p.use_smooth = True
NV = len(headm.data.vertices)
PTAG = np.zeros(NV, dtype=np.int32); headm.data.attributes['part'].data.foreach_get('value', PTAG)
CO0 = np.array([v.co[:] for v in headm.data.vertices])

def keyshape(name, fn):
    if not headm.data.shape_keys: headm.shape_key_add(name='Basis', from_mix=False)
    k = headm.shape_key_add(name=name, from_mix=False)
    for i in range(NV):
        p = Vector(CO0[i]); q = fn(p.copy(), int(PTAG[i]))
        k.data[i].co = q
    return k

LIDS = (PART['lidU_L'], PART['lidU_R'], PART['lash_L'], PART['lash_R'])
def front(p): return sm((HC.y - .02 - p.y) / .04)
def rot_x(p, c, a):
    r = p - c; return c + Vector((r.x, r.y * cos(a) - r.z * sin(a), r.y * sin(a) + r.z * cos(a)))
def eye_side(p): return 'L' if p.x > 0 else 'R'

def k_smile(p, t):
    if t in LIDS: return p
    f = front(p)
    for s in (1, -1):
        w = g2(p.x - s * MOUTH_W, p.z - MOUTH_Z, .017, .012) * f
        p.z += .0042 * w; p.y += .0016 * w; p.x += s * .0022 * w
    if t == PART['lipU']: p.z += .0006
    w2 = g2(abs(p.x) - .046, p.z - 1.628, .019, .016) * f
    p.z += .0022 * w2; p.y -= .0017 * w2
    if t == PART['lidL']: p = rot_x(p, EYE_C[eye_side(p)], radians(-7))
    return p
def k_frown(p, t):
    if t in LIDS: return p
    f = front(p)
    for s in (1, -1):
        w = g2(p.x - s * MOUTH_W, p.z - MOUTH_Z, .016, .011) * f
        p.z -= .0034 * w; p.x += s * .0009 * w
    if t == PART['lipL']: p.y -= .0008 * (1 - (p.x / MOUTH_W) ** 2)
    w3 = g2(p.x, p.z - 1.565, .02, .014) * f; p.z += .0012 * w3      # chin tightens
    return p
def brow_w(p, t):
    return 1. if t == PART['brow'] else .75 * g2(abs(p.x) - (.04 + EX), p.z - (1.712 + ED), .034, .017) * front(p) if t == PART['skin'] else 0.
def k_browUp(p, t):
    if t in (PART['lidU_L'], PART['lidU_R']): p.z += .0005; return p
    p.z += .0046 * brow_w(p, t)
    return p
def inner(p): return exp(-((abs(p.x) - .012) / .02) ** 2)
def k_browAngry(p, t):
    w = brow_w(p, t)
    if w:
        fi = inner(p); p.z -= .0044 * fi * w; p.x -= math.copysign(.0019, p.x) * fi * w; p.z += .0012 * (1 - fi) * w
    if t == PART['skin']:
        g = g2(p.x, p.z - (1.704 + ED), .012, .01) * front(p); p.y -= .0012 * g; p.z -= .0016 * g
    return p
def k_browSad(p, t):
    w = brow_w(p, t)
    if w:
        fi = inner(p); p.z += .005 * fi * w - .0012 * (1 - fi) * w
    return p
def mouth_w(p, t):
    if t in LIDS or t in (PART['lidL'], PART['brow']): return 0.
    return g2(p.x, p.z - MOUTH_Z, .029, .014) * front(p)
def k_mouthO(p, t):
    w = mouth_w(p, t)
    p.x -= p.x * .33 * w; p.y -= .0042 * w; p.z += (MOUTH_Z - p.z) * .18 * w
    return p
def k_mouthWide(p, t):
    w = mouth_w(p, t)
    p.x += p.x * .15 * w; p.y += .001 * w; p.z += (MOUTH_Z - p.z) * .12 * w
    return p
def k_squint(p, t):
    if t == PART['lidL']: return rot_x(p, EYE_C[eye_side(p)], radians(-9))
    if t == PART['skin']:
        w = g2(abs(p.x) - (.043 + EX), p.z - (1.664 + ED), .02, .01) * front(p); p.z += .0016 * w
    return p
# identity (set once per character)
def below_eyes(p): return sm((1.662 + ED - p.z) / .05)
def k_soft(p, t):
    if t in LIDS or t == PART['lidL']: return p
    p.x *= 1 - .075 * below_eyes(p) * sm((HC.y + .06 - p.y) / .12)
    if t in (PART['lipU'], PART['lipL']):
        c = MOUTH_Z + (.0028 if t == PART['lipU'] else -.0035); p.z = c + (p.z - c) * 1.18; p.y -= .0008
    if t == PART['skin']:
        p.y += .0045 * g2(p.x, p.z - 1.642, .015, .026) * front(p)       # smaller nose
        p.y += .0028 * g2(p.x, p.z - 1.553, .02, .015) * front(p)        # softer chin
    if t == PART['brow']: p.z += .0007
    return p
def k_old(p, t):
    if t in LIDS: return p
    f = front(p)
    if t == PART['skin']:
        p.z -= .003 * g2(abs(p.x) - .05, p.z - 1.618, .022, .03) * f            # cheeks sag
        p.x += math.copysign(.0032, p.x) * g2(abs(p.x) - .05, p.z - 1.578, .016, .016) * f  # jowls
        p.y -= .0016 * g2(abs(p.x) - (.041 + EX), p.z - (1.667 + ED), .014, .0045) * f       # eye bags
        p.x -= math.copysign(.0035, p.x) * g2(abs(p.x) - .082, p.z - 1.7, .015, .02)       # hollow temples
        tip = g2(p.x, p.z - 1.636, .012, .012) * f; p.z -= .0024 * tip; p.y -= .0012 * tip   # longer nose
    for s in (1, -1):
        w = g2(p.x - s * MOUTH_W, p.z - MOUTH_Z, .015, .01) * f; p.z -= .0016 * w
    if t == PART['brow']: p.z -= .0014
    if t in (PART['lipU'], PART['lipL']):
        c = MOUTH_Z; p.z = c + (p.z - c) * .82; p.y += .0006
    return p
def k_broad(p, t):
    if t in LIDS or t == PART['lidL']: return p
    b = below_eyes(p); p.x *= 1 + .1 * b
    if t == PART['skin']: p.x += p.x * .14 * g2(p.x, p.z - 1.638, .016, .02) * front(p)
    return p
def k_nose(p, t):
    if t != PART['skin']: return p
    w = g2(p.x, p.z - 1.645, .016, .03) * front(p); p.y -= .0055 * w; p.z -= .0018 * g2(p.x, p.z - 1.636, .012, .01) * front(p)
    return p
for name, fn in (('smile', k_smile), ('frown', k_frown), ('browUp', k_browUp), ('browAngry', k_browAngry), ('browSad', k_browSad),
                 ('mouthO', k_mouthO), ('mouthWide', k_mouthWide), ('squint', k_squint),
                 ('faceSoft', k_soft), ('faceOld', k_old), ('faceBroad', k_broad), ('faceNose', k_nose)):
    keyshape(name, fn)

# head weights (computed before scaling): head / neck / jaw / eyelids
JAW_PIV = Vector((0, HC.y + .022, 1.646))
def head_weights(P, T):
    W = {}
    neck = np.clip((1.585 - P[:, 2]) / .05, 0, 1) * np.clip((P[:, 1] - (HC.y - .045)) / .05, 0, 1)
    neck = neck * neck * (3 - 2 * neck)
    jaw = np.clip((MOUTH_Z + .0012 - P[:, 2]) / .013, 0, 1) * np.clip((HC.y + .035 - P[:, 1]) / .05, 0, 1)
    jaw = jaw * jaw * (3 - 2 * jaw)
    jaw = np.where(T == PART['lipL'], 1., np.where(T == PART['teethL'], 1., np.where(T == PART['lipU'], .08, np.where(T == PART['teethU'], 0., jaw))))
    mem = T == PART['membrane']
    jaw = np.where(mem, np.clip((MOUTH_Z + .0012 - P[:, 2]) / .0042, 0, 1), jaw)
    jaw = jaw * (1 - neck * .85)
    head = 1 - jaw - neck * (1 - jaw)
    W['jaw'] = jaw; W['neck'] = neck * (1 - jaw); W['head'] = np.clip(head, 0, 1)
    for side in 'LR':
        m = (T == PART['lidU_' + side]) | (T == PART['lash_' + side])
        W[f'lid.{side}'] = m.astype(float)
        for k in ('jaw', 'neck', 'head'): W[k] = np.where(m, 0., W[k])
    return W
HEAD_W = head_weights(CO0, PTAG)

# ------------------------------------------------------------------ proportions: head scale relative to the neck
HEAD_S = 1.1; PIV = Vector((0, .008, 1.55)); DROP = Vector((0, 0, -.026))
def hscale(p): return PIV + (Vector(p) - PIV) * HEAD_S + DROP
eye_list = [o for side in 'LR' for o in eye_objs[side]]
head_objs = [o for objs in hair.values() for o in objs] + bd + ht + eye_list
for o in head_objs:
    for v in o.data.vertices: v.co = hscale(v.co)
for kb in headm.data.shape_keys.key_blocks:
    for d in kb.data: d.co = hscale(d.co)
for v in headm.data.vertices: v.co = hscale(v.co)
for k in ('eye.L', 'eye.R', 'lid.L', 'lid.R'):
    J[k] = (hscale(J[k][0]), hscale(J[k][1]))
J['jaw'] = (hscale(JAW_PIV), hscale(Vector((0, HC.y - .07, 1.572))))
J['head'] = (J['head'][0] + DROP, hscale(J['head'][1]))
J['neck'] = (J['neck'][0], J['neck'][1] + DROP)

# ------------------------------------------------------------------ robe & hat secondary bones
for name, u in (('F.L', .08), ('F.R', .92), ('S.L', .27), ('S.R', .73), ('B', .5)):
    p0, p1, p2 = robe_point(u, .52), robe_point(u, .28), robe_point(u, 0.0)
    inward = Vector((p0.x, p0.y, 0)).normalized() * .03
    J[f'robe_{name}1'] = (p0 - inward, p1 - inward)
    J[f'robe_{name}2'] = (p1 - inward, p2 - inward)
J['hat1'] = (hscale((0, .02, 1.84)), hscale((0, .05, 1.98)))
J['hat2'] = (hscale((0, .05, 1.98)), hscale((0, .1, 2.15)))
J['pony'] = (hscale(PONY + Vector((0, .02, 0))), hscale(PONY + Vector((0, .04, -.12))))

PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck', 'wand': 'hand.R', 'wand_tip': 'wand',
          'hat1': 'head', 'hat2': 'hat1', 'jaw': 'head', 'pony': 'head'}
for side in 'LR':
    PARENT.update({f'shoulder.{side}': 'chest', f'upper_arm.{side}': f'shoulder.{side}', f'forearm.{side}': f'upper_arm.{side}',
                   f'hand.{side}': f'forearm.{side}', f'thigh.{side}': 'hips', f'shin.{side}': f'thigh.{side}', f'foot.{side}': f'shin.{side}',
                   f'toe.{side}': f'foot.{side}', f'eye.{side}': 'head', f'lid.{side}': 'head'})
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
    Dm = np.stack([seg_dist(P, *bone_seg[b]) * sc(b) for b in bones], 1)
    Wm = 1. / (Dm + .012) ** power
    idx = np.argsort(-Wm, 1)[:, :top]
    groups = {b: ob.vertex_groups.new(name=b) for b in bones}
    for vi in range(len(P)):
        ws = Wm[vi, idx[vi]]; ws = ws / ws.sum()
        for bi, w in zip(idx[vi], ws):
            if w > .01: groups[bones[bi]].add([vi], float(w), 'REPLACE')

def explicit_weights(ob, W):
    groups = {b: ob.vertex_groups.new(name=b) for b in W}
    n = len(ob.data.vertices)
    for b, arr in W.items():
        g = groups[b]
        for i in range(n):
            if arr[i] > .005: g.add([i], float(arr[i]), 'REPLACE')

TORSO_B = ['hips', 'spine', 'chest', 'neck', 'shoulder.L', 'shoulder.R', 'upper_arm.L', 'upper_arm.R']
ROBE_B = ['hips', 'spine', 'chest', 'shoulder.L', 'shoulder.R', 'upper_arm.L', 'upper_arm.R'] + [f'robe_{n}{i}' for n in ('F.L', 'F.R', 'S.L', 'S.R', 'B') for i in (1, 2)]

def join(objs, name):
    if len(objs) == 1:
        objs[0].name = name; objs[0].data.name = name; return objs[0]
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, object=objs[0]):
        bpy.ops.object.join()
    objs[0].name = name; objs[0].data.name = name
    for p in objs[0].data.polygons: p.use_smooth = True
    return objs[0]

FINAL = []
def finish(ob):
    ob.parent = rig
    m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    FINAL.append(ob)

explicit_weights(headm, HEAD_W); finish(headm)
for side in 'LR':
    e = join(eye_objs[side], f'Eye.{side}'); weight(e, None, rigid=f'eye.{side}'); finish(e)
neck.name = 'Neck'; weight(neck, ['neck', 'head', 'chest'], scale={'head': 1.3}); finish(neck)
body = join([torso] + details, 'Torso'); weight(body, TORSO_B, scale={'upper_arm.L': 1.6, 'upper_arm.R': 1.6}); finish(body)
weight(legs, ['hips', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R'], scale={'hips': 1.3}); finish(legs)
for item in limbs:
    if isinstance(item, tuple):
        _, side, parts = item
        h = join(parts, f'Hand.{side}'); weight(h, [f'hand.{side}', f'forearm.{side}'], scale={f'forearm.{side}': 2.2}); finish(h)
        continue
    ob = item; side = ob.name[-1]
    if ob.name.startswith('Arm'): weight(ob, [f'shoulder.{side}', f'upper_arm.{side}', f'forearm.{side}', f'hand.{side}', 'chest'], scale={'chest': 1.8})
    else: weight(ob, [f'foot.{side}', f'toe.{side}', f'shin.{side}'], scale={f'shin.{side}': 1.4})
    finish(ob)
arm_mask = lambda P: np.where(P[:, 2] > 1.36, 1.6, 40.)
def chain_mask(P):
    k = np.clip((P[:, 2] - .86) / .2, 0, 1); k = k * k * (3 - 2 * k)
    return 1 + 25 * k
CHAIN_SC = {f'robe_{n}1': chain_mask for n in ('F.L', 'F.R', 'S.L', 'S.R', 'B')}
robe_all = join([robe] + facings, 'Robe'); weight(robe_all, ROBE_B, power=3., scale={'upper_arm.L': arm_mask, 'upper_arm.R': arm_mask, **CHAIN_SC}); finish(robe_all)
weight(hood, ['chest', 'spine', 'neck', 'shoulder.L', 'shoulder.R'], scale={'spine': 1.4, 'neck': 1.5}); finish(hood)
for sl in sleeves:
    side = sl.name[-1]
    weight(sl, [f'shoulder.{side}', f'upper_arm.{side}', f'forearm.{side}', f'hand.{side}', 'chest'], scale={'chest': 1.7, f'hand.{side}': 1.6}); finish(sl)
for name, objs in hair.items():
    h = join(objs, name)
    if name == 'Hair_Pony':
        pony = lambda P: np.where(P[:, 2] < hscale(PONY).z - .015, .55, 30.)
        weight(h, ['head', 'neck', 'pony'], scale={'neck': 2.2, 'pony': pony})
    else: weight(h, ['head', 'neck'], scale={'neck': 2.2 if name != 'Hair_Long' else 1.25})
    finish(h)
beard = join(bd, 'Beard'); weight(beard, ['head', 'neck', 'jaw'], scale={'neck': 2., 'jaw': .9}); finish(beard)
hat = join(ht, 'Hat'); weight(hat, ['head', 'hat1', 'hat2'], scale={'head': .7}); finish(hat)
wandm = join(wand_parts, 'Wand'); weight(wandm, None, rigid='wand'); finish(wandm)
bookm = join(book, 'Book'); weight(bookm, None, rigid='hand.L'); finish(bookm)

# ------------------------------------------------------------------ baked ambient occlusion + skin tones in vertex colours
def tree_of(objs):
    verts = []; polys = []; off = 0
    for o in objs:
        me = o.data
        verts += [v.co.copy() for v in me.vertices]
        polys += [[i + off for i in p.vertices] for p in me.polygons]
        off += len(me.vertices)
    return BVHTree.FromPolygons(verts, polys)

def hemi(n_samples=24):
    out = []; g = (1 + 5 ** .5) / 2
    for i in range(n_samples):
        u = (i + .5) / n_samples; phi = 2 * pi * i / g
        r = sqrt(u); out.append(Vector((r * cos(phi), r * sin(phi), sqrt(max(0, 1 - u)))))
    return out
HEMI = hemi(24)

def bake_ao(ob, tree, dist=.1, strength=.8, tint=None):
    me = ob.data; cols = []
    for v in me.vertices:
        n = v.normal; t = n.orthogonal().normalized(); b = n.cross(t)
        occ = 0.
        for s in HEMI:
            d = t * s.x + b * s.y + n * s.z
            hit = tree.ray_cast(v.co + n * .0015, d, dist)
            if hit[0] is not None: occ += 1 - (hit[3] / dist) ** .7
        ao = 1 - strength * occ / len(HEMI)
        c = (ao, ao, ao)
        if tint: c = tint(v.co, c)
        cols.append(c)
    attr = me.color_attributes.new('Color', 'BYTE_COLOR', 'POINT')
    for i, c in enumerate(cols): attr.data[i].color = (*c, 1.)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find('Color')

byname = {o.name: o for o in FINAL}
BODY = [byname[n] for n in ('Head', 'Neck', 'Torso', 'Legs', 'Arm.L', 'Arm.R', 'Hand.L', 'Hand.R', 'Shoe.L', 'Shoe.R', 'Robe', 'Hood', 'Sleeve.L', 'Sleeve.R')]
body_tree = tree_of(BODY)
HS = HEAD_S
def face_tint(co, c):
    p = PIV + (co - PIV - DROP) / HS     # back to head-design coordinates
    r, g, b = c
    blush = .55 * g2(abs(p.x) - .05, p.z - 1.632, .02, .018) + .35 * g2(p.x, p.z - 1.638, .009, .01)
    r *= 1 + .05 * blush; g *= 1 - .07 * blush; b *= 1 - .08 * blush
    # the short gap between nose and lip bakes very dark; lift it so it does not read as a smudge
    lift = 1 + .5 * g2(p.x, p.z - 1.6205, .013, .0075)
    r *= lift; g *= lift; b *= lift
    sock = g2(abs(p.x) - EYE_X, p.z - (EYE_Z + .004), .02, .013)
    r *= 1 - .06 * sock; g *= 1 - .08 * sock; b *= 1 - .05 * sock
    return (min(1, r), min(1, g), min(1, b))
for o in BODY:
    bake_ao(o, body_tree, dist=.09 if o.name in ('Head', 'Neck') else .12, strength=.75, tint=face_tint if o.name == 'Head' else None)
for side in 'LR':
    bake_ao(byname[f'Eye.{side}'], tree_of([byname['Head']]), dist=.02, strength=.9,
            tint=lambda co, c: (c[0], c[1] * (1 - .05 * (1 - c[1])), c[2] * (1 - .05 * (1 - c[2]))))
for n in ('Hair_Short', 'Hair_Long', 'Hair_Bun', 'Hair_Pony', 'Hair_Curly', 'Beard'):
    bake_ao(byname[n], tree_of([byname[n], byname['Head'], byname['Neck'], byname['Torso'], byname['Robe'], byname['Hood']]), dist=.035, strength=.45)
bake_ao(byname['Hat'], tree_of([byname['Hat']]), dist=.06, strength=.6)
for n in ('Wand', 'Book'): bake_ao(byname[n], tree_of([byname[n]]), dist=.03, strength=.5)

print('BUILD OK', len(bpy.data.objects), 'objects')
