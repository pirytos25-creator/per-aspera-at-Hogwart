# Keyframed animation clips for the wizard rig (run after model.py).
# Every pose is described as world-space rotations (relative to the rest pose)
# and resolved down the hierarchy into local quaternions.
import bpy, math, os
from math import sin, cos, pi, acos, atan2, sqrt
from mathutils import Vector, Matrix, Quaternion

FPS = 30
scene = bpy.context.scene; scene.render.fps = FPS
rig = bpy.data.objects['WizardRig']; ARM = rig.data
REST = {b.name: b.matrix_local.to_3x3().normalized() for b in ARM.bones}
REST_I = {k: v.inverted() for k, v in REST.items()}
PAR = {b.name: (b.parent.name if b.parent else None) for b in ARM.bones}
ORDER = []
def _walk(b):
    ORDER.append(b.name)
    for c in b.children: _walk(c)
for b in ARM.bones:
    if b.parent is None: _walk(b)
HEAD_POS = {b.name: b.head_local.copy() for b in ARM.bones}
TAIL_POS = {b.name: b.tail_local.copy() for b in ARM.bones}
LEN = {b.name: b.length for b in ARM.bones}
I3 = Matrix.Identity(3)
def Rx(a): return Matrix.Rotation(a, 3, 'X')
def Ry(a): return Matrix.Rotation(a, 3, 'Y')
def Rz(a): return Matrix.Rotation(a, 3, 'Z')
def Rax(axis, a): return Matrix.Rotation(a, 3, Vector(axis).normalized())
def arc(a, b):
    return Vector(a).normalized().rotation_difference(Vector(b).normalized()).to_matrix()

for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'

def hinge(bone):  # forward-flex axis for an arm segment in rest pose
    d = (TAIL_POS[bone] - HEAD_POS[bone]).normalized()
    return d.cross(Vector((0, -1, 0))).normalized()

def smooth(x): x = max(0., min(1., x)); return x * x * (3 - 2 * x)
def ease(keys, t):
    """piecewise smoothstep through (time, value) keys"""
    if t <= keys[0][0]: return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1: return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0))
    return keys[-1][1]

RUNTIME = {'jaw', 'lid.L', 'lid.R', 'eye.L', 'eye.R', 'pony'}
BODY = [b.name for b in ARM.bones if b.name not in RUNTIME]

class Pose:
    def __init__(self):
        self.W = {}; self.rel = {}; self.loc = Vector(); self.blink = 1.
    def world(self, b, m): self.W[b] = m
    def relative(self, b, m): self.rel[b] = m
    def resolve(self):
        Wt = {}; out = {}
        for b in ORDER:
            p = PAR[b]; Wp = Wt[p] if p else I3
            W = self.W[b] if b in self.W else Wp @ self.rel.get(b, I3)
            Wt[b] = W
            local = REST_I[b] @ (Wp.inverted() @ W) @ REST[b]
            out[b] = local.to_quaternion()
        return out, Wt

def apply(pose, keyed=None):
    q, _ = pose.resolve()
    for pb in rig.pose.bones:
        pb.rotation_quaternion = q[pb.name]; pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    rig.pose.bones['hips'].location = REST_I['hips'] @ pose.loc

def record(name, frames, fn, keyed=None, loop=True):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = act
    bones = [b for b in (keyed or BODY) if b not in RUNTIME]
    for f in range(frames + (1 if loop else 0)):
        pose = fn(f / frames if loop else f / (frames - 1))
        apply(pose)
        for b in bones:
            pb = rig.pose.bones[b]
            pb.keyframe_insert('rotation_quaternion', frame=f)
            if b == 'hips': pb.keyframe_insert('location', frame=f)
    for fc in getattr(act, 'fcurves', []) or []:
        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    try:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    except Exception: pass
    return act

# ------------------------------------------------------------------ shared body pieces
L1, L2 = LEN['thigh.L'], LEN['shin.L']
HIP0 = HEAD_POS['hips']
def leg_ik(pose, side, H, A, yaw, heel, toe):
    s = 1 if side == 'L' else -1
    d = A - H; dist = d.length; maxr = (L1 + L2) * .9995
    if dist > maxr: A = H + d.normalized() * maxr; d = A - H; dist = maxr
    e1 = d.normalized(); f = Rz(yaw) @ Vector((0, -1, 0))
    perp = (f - e1 * f.dot(e1)).normalized()
    alpha = acos(max(-1, min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))))
    K = H + (e1 * cos(alpha) + perp * sin(alpha)) * L1
    rest1 = TAIL_POS[f'thigh.{side}'] - HEAD_POS[f'thigh.{side}']; rest2 = TAIL_POS[f'shin.{side}'] - HEAD_POS[f'shin.{side}']
    yawm = Rz(yaw)
    W1 = arc(yawm @ rest1, K - H) @ yawm
    W2 = arc(yawm @ rest2, A - K) @ yawm
    pose.world(f'thigh.{side}', W1); pose.world(f'shin.{side}', W2)
    pose.world(f'foot.{side}', yawm @ Rax(Vector((1, 0, 0)), heel))
    pose.world(f'toe.{side}', yawm @ Rax(Vector((1, 0, 0)), toe))

def hips_world(pose, off, yaw, roll, pitch):
    Wh = Rz(yaw) @ Ry(roll) @ Rx(pitch)
    pose.world('hips', Wh); pose.loc = off
    return Wh

def hip_joint(Wh, off, side):
    return HIP0 + off + Wh @ (HEAD_POS[f'thigh.{side}'] - HIP0)

def arms(pose, down, swingL, swingR, flexL, flexR, handL=0., handR=0., outL=0., outR=0.):
    for side, sw, fx, hd, out in (('L', swingL, flexL, handL, outL), ('R', swingR, flexR, handR, outR)):
        s = 1 if side == 'L' else -1
        pose.relative(f'upper_arm.{side}', Rx(sw) @ Ry(s * (down - out)))
        pose.relative(f'forearm.{side}', Rax(hinge(f'forearm.{side}'), fx))
        pose.relative(f'hand.{side}', Rax(hinge(f'forearm.{side}'), hd))

def torso(pose, spine=(0, 0, 0), chest=(0, 0, 0)):
    pose.relative('spine', Rz(spine[2]) @ Ry(spine[1]) @ Rx(spine[0]))
    pose.relative('chest', Rz(chest[2]) @ Ry(chest[1]) @ Rx(chest[0]))

def head_world(pose, yaw, pitch, roll=0.):
    pose.world('head', Rz(yaw) @ Ry(roll) @ Rx(pitch))

ROBE_CHAINS = {'F.L': (1, 'L', 0), 'F.R': (-1, 'R', 0), 'S.L': (1, 'L', 1), 'S.R': (-1, 'R', 1), 'B': (0, None, 2)}
def robe(pose, yaw, thighL, thighR, thighL_lag, thighR_lag, drag, flare=0., sway=0.):
    """thigh* are forward/back swing angles (positive = leg back); lag versions drive the hem."""
    for name, (s, side, kind) in ROBE_CHAINS.items():
        if kind == 0:   # front panels follow their own leg
            a1 = (thighL if side == 'L' else thighR) * .72 + drag * .55
            a2 = ((thighL_lag if side == 'L' else thighR_lag) - (thighL if side == 'L' else thighR)) * .55 + drag * .25
            r1 = s * (flare * .3); r2 = s * flare * .2
        elif kind == 1:
            a1 = (thighL if side == 'L' else thighR) * .35 + drag * .5
            a2 = ((thighL_lag if side == 'L' else thighR_lag) - (thighL if side == 'L' else thighR)) * .45 + drag * .2
            r1 = s * (flare * .9 + .02) - sway * .6; r2 = s * flare * .5 - sway * .5
        else:
            a1 = (thighL + thighR) * .25 + drag * 1.05
            a2 = ((thighL_lag + thighR_lag) - (thighL + thighR)) * .25 + drag * .45
            r1 = -sway * .5; r2 = -sway * .4
        W1 = Rz(yaw * .8) @ Rx(a1) @ Ry(r1)
        pose.world(f'robe_{name}1', W1)
        pose.relative(f'robe_{name}2', Rx(a2) @ Ry(r2))

def hat(pose, back, side=0.):
    pose.relative('hat1', Rx(-back * .6) @ Ry(side * .5))
    pose.relative('hat2', Rx(-back) @ Ry(side))

# ------------------------------------------------------------------ locomotion
LOCO = {
    'walk': dict(N=24, v=1.25, s=.60, c=-.015, lift=.085, base=-.05, bob=.022, run=False, sway=.016, roll=.045, yaw=.10, hpitch=.03,
                 lean=.02, arm=.30, down=.46, flex=.22, flexamp=.25, heel=.42, drag=.05, hat=.04),
    'jog':  dict(N=20, v=3.7, s=.34, c=.035, lift=.19, base=-.085, bob=.042, run=True, sway=.008, roll=.05, yaw=.15, hpitch=.07,
                 lean=.11, arm=.55, down=.33, flex=1.1, flexamp=.25, heel=.75, drag=.24, hat=.2),
    'run':  dict(N=18, v=7.5, s=.25, c=.13, lift=.3, base=-.1, bob=.055, run=True, sway=.006, roll=.05, yaw=.19, hpitch=.1,
                 lean=.22, arm=.85, down=.24, flex=1.4, flexamp=.15, heel=1.0, drag=.45, hat=.38),
}

def foot_track(psi, P, T):
    s = P['s']; D = P['v'] * s * T; c = P['c']
    if psi < s:
        u = psi / s; y = c - D / 2 + u * D
        hl = P['heel'] * max(0, (u - .55) / .45) ** 2
        z = .085 + .11 * sin(hl); y += .11 * (1 - cos(hl))
        heel_ang = hl; toe = 0.
        if u < .12: heel_ang = -.22 * (1 - u / .12)  # heel strike, toes up
    else:
        u = (psi - s) / (1 - s)
        y0 = c + D / 2 + .11 * (1 - cos(P['heel'])); y1 = c - D / 2
        y = y0 + (y1 - y0) * smooth(u)
        z0 = .085 + .11 * sin(P['heel'])
        z = .085 + (z0 - .085) * (1 - u) ** 2 + P['lift'] * sin(pi * min(1, u * 1.08)) ** 1.2
        heel_ang = P['heel'] * (1 - smooth(u * 1.6)) - .22 * smooth((u - .65) / .35)
        toe = -P['heel'] * (1 - smooth(u * 2))
    if psi < s: toe = -heel_ang if heel_ang > 0 else 0.
    return y, z, heel_ang, toe

def thigh_swing(phi, P, side):
    """forward(-)/back(+) swing estimate of a thigh at phase phi (for arms/robe)"""
    psi = (phi + (0 if side == 'L' else .5)) % 1
    y, z, _, _ = foot_track(psi, P, P['N'] / FPS)
    return atan2(y, .85)

def loco_pose(phi, P):
    T = P['N'] / FPS; pose = Pose(); s = P['s']
    peak = s / 2 + (.25 if P['run'] else 0)
    off = Vector((P['sway'] * cos(2 * pi * (phi - s / 2)), 0, P['base'] + P['bob'] * (.5 + .5 * cos(4 * pi * (phi - peak)))))
    yaw = -P['yaw'] * cos(2 * pi * phi); roll = -P['roll'] * cos(2 * pi * (phi - s / 2))
    Wh = hips_world(pose, off, yaw, roll, P['hpitch'])
    for side, o in (('L', 0), ('R', .5)):
        x = (1 if side == 'L' else -1) * .1
        y, z, heel, toe = foot_track((phi + o) % 1, P, T)
        leg_ik(pose, side, hip_joint(Wh, off, side), Vector((x, y, z)), yaw * .4, heel, toe)
    torso(pose, spine=(P['lean'] * .5 - P['hpitch'] * .5, -roll * .6, -yaw * .7), chest=(P['lean'] * .5, -roll * .3, -yaw * .8))
    head_world(pose, 0, -.02 - P['lean'] * .15, 0)
    pose.relative('neck', Rx(-P['lean'] * .2))
    lagφ = phi - .04
    aL = P['arm'] * cos(2 * pi * lagφ); aR = -aL
    flexL = P['flex'] + P['flexamp'] * max(0, -cos(2 * pi * lagφ)); flexR = P['flex'] + P['flexamp'] * max(0, cos(2 * pi * lagφ))
    arms(pose, P['down'], aL, aR - .05, flexL, flexR + .2, handL=.1, handR=.15 - .62 * max(0, flexR - .4), outL=0, outR=0)
    tL, tR = thigh_swing(phi, P, 'L'), thigh_swing(phi, P, 'R')
    tLl, tRl = thigh_swing(phi - .09, P, 'L'), thigh_swing(phi - .09, P, 'R')
    robe(pose, yaw, tL, tR, tLl, tRl, P['drag'] + .02 * sin(4 * pi * (phi - peak - .1)), flare=P['drag'] * .5 + .02, sway=roll * .8)
    hat(pose, P['hat'] + .05 * sin(4 * pi * (phi - peak - .15)), side=-roll * .5)
    return pose

for name, P in LOCO.items():
    record(name, P['N'], lambda phi, P=P: loco_pose(phi, P))

# ------------------------------------------------------------------ idle (4 s breathing, weight shift, glance, blinks)
def idle_pose(phi):
    pose = Pose(); t = phi * 4.0
    shift = sin(2 * pi * phi)
    off = Vector((.014 * shift, 0, -.018 - .004 * sin(4 * pi * phi)))
    roll = -.03 * shift
    Wh = hips_world(pose, off, .02 * sin(2 * pi * phi + .5), roll, .0)
    for side in 'LR':
        x = (1 if side == 'L' else -1) * .105
        leg_ik(pose, side, hip_joint(Wh, off, side), Vector((x, -.01 if side == 'L' else .03, .085)), (.08 if side == 'L' else -.12), 0, 0)
    breath = sin(2 * pi * phi * 2)
    torso(pose, spine=(.0, -roll * .7, -.01 * shift), chest=(-.012 * breath, -roll * .3, .015 * shift))
    look = .16 * sin(2 * pi * phi + .8) * smooth(abs(sin(2 * pi * phi + .8)) * 1.6)
    head_world(pose, look, -.03 + .025 * sin(4 * pi * phi + 1), .03 * shift)
    pose.relative('shoulder.L', Ry(.012 * breath)); pose.relative('shoulder.R', Ry(-.012 * breath))
    arms(pose, .5 + .02 * breath, .05 + .03 * sin(2 * pi * phi), -.12 + .03 * sin(2 * pi * phi + 1), .2 + .05 * shift, .55 + .05 * sin(2 * pi * phi + .3), handL=.12, handR=.25)
    robe(pose, 0, 0, 0, .0, .0, .015 * sin(2 * pi * phi - .6), flare=.01, sway=-.05 * sin(2 * pi * phi - .9))
    hat(pose, .02 * sin(2 * pi * phi - .7), side=.04 * sin(2 * pi * phi - .9))
    return pose
record('idle', 120, idle_pose)

# ------------------------------------------------------------------ talk (additive layer, 3 s loop; frame 0 is neutral)
TALK_BONES = ['spine', 'chest', 'neck', 'head', 'shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R']
def talk_pose(phi):
    pose = Pose(); t = phi * 3
    g1 = sin(pi * min(1, max(0, (t - .15) / 1.2))) ** 2          # open-hand gesture
    g2 = sin(pi * min(1, max(0, (t - 1.55) / 1.15))) ** 2        # second, smaller beat
    nod = sin(2 * pi * phi * 4) * .04 * (g1 + g2 * .7)
    pose.relative('upper_arm.L', Rx(-.45 * g1 - .28 * g2) @ Ry(-.12 * g1))
    pose.relative('forearm.L', Rax(hinge('forearm.L'), 1.0 * g1 + .7 * g2))
    pose.relative('hand.L', Rax(hinge('forearm.L'), -.35 * g1) @ Ry(.5 * g1))
    pose.relative('upper_arm.R', Rx(-.18 * g2))
    pose.relative('forearm.R', Rax(hinge('forearm.R'), .35 * g2))
    pose.relative('chest', Rz(.06 * g1 - .05 * g2) @ Rx(.02 * (g1 + g2)))
    pose.relative('head', Rx(nod) @ Ry(.05 * sin(2 * pi * phi * 2)))
    return pose
record('talk', 90, talk_pose, keyed=TALK_BONES)

# ------------------------------------------------------------------ cast (additive one-shot, 0.65 s): wind-up, strike, follow-through
CAST_BONES = ['spine', 'chest', 'neck', 'head', 'shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R', 'upper_arm.L', 'forearm.L', 'hat1', 'hat2']
def cast_pose(u):
    pose = Pose(); t = u * .65
    up = ease([(0, 0), (.14, .32), (.24, -1.45), (.40, -1.32), (.65, 0)], t)          # upper arm forward (-) / back (+)
    out = ease([(0, 0), (.14, .35), (.24, .05), (.40, .05), (.65, 0)], t)
    flex = ease([(0, 0), (.14, 1.35), (.24, .12), (.40, .25), (.65, 0)], t)
    flick = ease([(0, 0), (.14, -.35), (.22, -1.55), (.30, -1.2), (.42, -1.1), (.65, 0)], t)
    twist = ease([(0, 0), (.14, -.22), (.24, .2), (.42, .12), (.65, 0)], t)
    lean = ease([(0, 0), (.14, -.04), (.24, .1), (.42, .06), (.65, 0)], t)
    pose.relative('upper_arm.R', Rx(up) @ Ry(out))
    pose.relative('forearm.R', Rax(hinge('forearm.R'), flex))
    pose.relative('hand.R', Rax(hinge('forearm.R'), flick))
    pose.relative('shoulder.R', Rx(min(0, up) * .12))
    pose.relative('upper_arm.L', Rx(-twist * 1.4 + .1 * (up < -.5)) @ Ry(.15 * abs(twist)))
    pose.relative('forearm.L', Rax(hinge('forearm.L'), .35 * abs(twist) * 2))
    pose.relative('spine', Rz(twist * .5) @ Rx(lean * .5)); pose.relative('chest', Rz(twist * .7) @ Rx(lean * .5))
    pose.relative('head', Rz(-twist * .9) @ Rx(-lean * .6))
    hat(pose, lean * 1.5 - twist * .2)
    return pose
record('cast', 20, cast_pose, keyed=CAST_BONES, loop=False)

# ------------------------------------------------------------------ dodge (full body, 0.42 s): coil, burst forward, recover
def dodge_pose(u):
    pose = Pose()
    k = sin(pi * u) ** .8; burst = ease([(0, 0), (.25, 1), (.7, .8), (1, 0)], u)
    off = Vector((0, -.04 * burst, -.012 - .16 * k))
    Wh = hips_world(pose, off, -.12 * burst, 0, .28 * k)
    legL = Vector((.11, -.36 * burst - .01, .085)); legR = Vector((-.11, .3 * burst + .03, .085 + .12 * burst))
    leg_ik(pose, 'L', hip_joint(Wh, off, 'L'), legL, 0, 0, 0)
    leg_ik(pose, 'R', hip_joint(Wh, off, 'R'), legR, 0, .7 * burst, -.7 * burst)
    torso(pose, spine=(.22 * k, 0, .1 * burst), chest=(.2 * k, 0, .1 * burst))
    head_world(pose, 0, -.15 * k)
    arms(pose, .2 + .25 * (1 - k), .75 * k, .9 * k, .35 + .5 * k, .55 + .5 * k, outL=.35 * k, outR=.35 * k)
    robe(pose, -.1 * burst, .25 * k, .25 * k, .55 * k, .55 * k, .45 * k, flare=.25 * k, sway=0)
    hat(pose, .55 * k)
    return pose
record('dodge', 13, dodge_pose, loop=False)

exec(open(os.path.join(HERE, 'anim2.py')).read())
rig.animation_data.action = bpy.data.actions['idle']
print('ANIM OK', [a.name for a in bpy.data.actions])
