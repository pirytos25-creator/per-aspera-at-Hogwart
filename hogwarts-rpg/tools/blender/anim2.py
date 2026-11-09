# Second set of clips (run after anim.py, same globals): spell gestures, reactions,
# directional dodges, strafing, sitting, reading and conversation gestures.
# Additive clips are authored relative to the rest pose; the game uses the 'ref'
# clip (rest pose) as their reference, so looping additive poses can hold a shape.
from mathutils import Quaternion

UPPER = ['spine', 'chest', 'neck', 'head', 'shoulder.L', 'shoulder.R', 'upper_arm.L', 'forearm.L', 'hand.L',
         'upper_arm.R', 'forearm.R', 'hand.R', 'hat1', 'hat2']
ARM_L = ['shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L']
ARM_R = ['shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R']

def qmix(m, w):
    """Blend a rotation matrix from identity by weight w."""
    return Quaternion().slerp(m.to_quaternion(), max(0., min(1., w))).to_matrix()

def forearm_axis(side):
    return (TAIL_POS[f'forearm.{side}'] - HEAD_POS[f'forearm.{side}']).normalized()

def rel(pose, bone, m, w=1.):
    pose.relative(bone, qmix(m, w))

record('ref', 2, lambda u: Pose(), loop=False)

# ------------------------------------------------------------------ strafing (phase-driven like walk; left heel strike first)
def strafe_pose(phi, P, m):
    """m: movement direction in the XY plane (unit); the body keeps facing -Y."""
    T = P['N'] / FPS; pose = Pose(); s = P['s']
    peak = s / 2
    off = Vector((0, 0, P['base'] + P['bob'] * (.5 + .5 * cos(4 * pi * (phi - peak)))))
    roll = -P['roll'] * cos(2 * pi * (phi - s / 2))
    Wh = hips_world(pose, off, 0, roll, .02)
    for side, o in (('L', 0), ('R', .5)):
        x = (1 if side == 'L' else -1) * .12
        y, z, heel, toe = foot_track((phi + o) % 1, P, T)
        swing = (phi + o) % 1 >= s
        lane = -.05 if (swing and side == ('R' if m.x > 0 else 'L')) else 0.     # pass in front, never through
        A = Vector((x, .01 + lane, 0)) - Vector((m.x, m.y, 0)) * y
        A.z = z
        leg_ik(pose, side, hip_joint(Wh, off, side), A, 0, heel * .5, toe * .5)
    torso(pose, spine=(.03, -roll * .5, 0), chest=(.02, -roll * .3, 0))
    head_world(pose, 0, -.03, roll * .3)
    arms(pose, .45, .05, -.08, .3, .55, handL=.1, handR=.2, outL=.06, outR=.06)
    tL, tR = thigh_swing(phi, P, 'L') * .4, thigh_swing(phi, P, 'R') * .4
    robe(pose, 0, tL, tR, tL * .8, tR * .8, .06, flare=.05, sway=-m.x * .25 + roll)
    hat(pose, .05, side=m.x * .2)
    return pose
STRAFE = dict(N=22, v=1.5, s=.58, c=0., lift=.07, base=-.045, bob=.016, run=False, roll=.04, heel=.3)
record('strafe_l', STRAFE['N'], lambda phi: strafe_pose(phi, STRAFE, Vector((1, 0, 0))))
record('strafe_r', STRAFE['N'], lambda phi: strafe_pose(phi, STRAFE, Vector((-1, 0, 0))))

# ------------------------------------------------------------------ wand gestures (additive, right arm leads)
def wand_arm(pose, gx, gy, flex=.25, flick=-1.35, twist=0., w=1.):
    pitch = -1.25 - .55 * gy; yaw = .47 - .5 * gx
    rel(pose, 'upper_arm.R', Rz(yaw) @ Rx(pitch), w)
    rel(pose, 'forearm.R', Rax(hinge('forearm.R'), flex), w)
    rel(pose, 'hand.R', Rax(hinge('forearm.R'), flick) @ Rax(forearm_axis('R'), twist), w)
    rel(pose, 'shoulder.R', Rx(-.12 * max(0, gy + .3)) @ Ry(-.06 * gx), w)

def body_follow(pose, gx, lean, w=1.):
    rel(pose, 'spine', Rz(-.12 * gx) @ Rx(.06 * lean), w)
    rel(pose, 'chest', Rz(-.18 * gx) @ Rx(.06 * lean), w)
    rel(pose, 'head', Rz(.2 * gx) @ Rx(-.05 * lean), w)
    rel(pose, 'upper_arm.L', Rx(.25 + .1 * lean) @ Ry(.22), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), .55), w)
    hat(pose, .05 * lean)

def envelope(u, a, b):
    return smooth(u / a) * (1 - smooth((u - b) / (1 - b)))

def gesture(name, dur, path, a=.18, b=.8, keyed=UPPER):
    frames = max(8, int(round(dur * FPS)))
    def fn(u):
        pose = Pose(); w = envelope(u, a, b)
        g = path(u)
        wand_arm(pose, g[0], g[1], g[2], g[3], g[4] if len(g) > 4 else 0., w)
        body_follow(pose, g[0], g[5] if len(g) > 5 else 0., w)
        return pose
    record(name, frames, fn, keyed=keyed, loop=False)

def seg_path(points, u):
    """piecewise-smooth through (u, gx, gy, flex, flick, twist, lean) keys"""
    return tuple(ease([(p[0], p[k]) for p in points], u) for k in range(1, 7))

# Lumos: wand rises to the sky and draws a small loop at the top
gesture('spell_raise', .9, lambda u: seg_path([(0, .2, -.3, .4, -1.2, 0, 0), (.25, .15, .2, .2, -.6, 0, -.2), (.45, .05, 1.05, .1, -.15, 0, -.5),
                                                (.6, .2, 1.15, .1, -.1, .3, -.5), (.72, -.05, 1.0, .1, -.15, 0, -.4), (.85, .05, 1.05, .1, -.15, 0, -.4), (1, .05, 1.0, .1, -.2, 0, -.3)], u), a=.15, b=.82)
# Wingardium Leviosa: swish across, then flick upwards
gesture('spell_swish', .85, lambda u: seg_path([(0, .9, .1, .5, -1.3, 0, 0), (.22, .9, .15, .45, -1.35, 0, 0), (.5, -.55, -.12, .35, -1.4, 0, .2),
                                                 (.62, -.45, .0, .3, -1.2, 0, .2), (.72, .1, .75, .15, -.45, 0, -.2), (1, .1, .7, .15, -.5, 0, -.1)], u), a=.15, b=.8)
# Protego: wand held across the body, left palm out (holds while the shield lasts)
def shield_path(u):
    k = smooth(u / .45)
    return (-.55 * k, -.05 * k, .3 + .9 * k, -1.35 + .9 * k, .9 * k, .4 * k)
def shield_fn(u):
    pose = Pose(); g = shield_path(u); w = 1.
    wand_arm(pose, g[0], g[1], g[2], g[3], g[4], w)
    k = smooth(u / .45)
    rel(pose, 'upper_arm.L', Rz(-.35 * k) @ Rx(-1.15 * k) @ Ry(.1 * k))
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), .5 * k))
    rel(pose, 'hand.L', Rax(hinge('forearm.L'), -.9 * k) @ Rax(forearm_axis('L'), .5 * k))
    rel(pose, 'chest', Rx(.08 * k)); rel(pose, 'spine', Rx(.05 * k)); rel(pose, 'head', Rx(-.06 * k))
    hat(pose, .08 * k)
    return pose
record('spell_shield', 18, shield_fn, keyed=UPPER, loop=False)
# Expelliarmus: cocked across the body, slash, then a full thrust
gesture('spell_slash', .75, lambda u: seg_path([(0, -.2, .1, .4, -1.2, 0, 0), (.22, -.95, .7, 1.35, -.6, .2, -.3), (.42, .85, -.3, .2, -1.4, 0, .5),
                                                 (.55, .1, .15, .05, -1.45, 0, .7), (.7, .1, .15, .08, -1.45, 0, .55), (1, .1, .1, .2, -1.4, 0, .3)], u), a=.12, b=.78)
# Circle (fire charm / lesson gesture), finished with a thrust
def circle_path(u):
    if u < .72:
        th = pi / 2 + 2 * pi * smooth(u / .72) * 1.0
        return (.55 * cos(th), .12 + .5 * sin(th), .3, -1.35, 0, .1)
    k = smooth((u - .72) / .14)
    return (.0, .12 + .5 * (1 - k) + .1 * k, .3 - .25 * k, -1.4, 0, .1 + .5 * k)
gesture('spell_circle', 1.1, circle_path, a=.14, b=.84)
# Zigzag (transfiguration lesson gesture)
gesture('spell_zigzag', 1.1, lambda u: seg_path([(0, -.6, .55, .3, -1.3, 0, 0), (.15, -.6, .55, .3, -1.3, 0, 0), (.35, .6, .55, .25, -1.35, 0, .1),
                                                  (.58, -.6, -.45, .3, -1.35, 0, .2), (.8, .6, -.45, .25, -1.4, 0, .3), (1, .3, -.1, .2, -1.2, 0, .1)], u), a=.12, b=.84)

# ------------------------------------------------------------------ conversation gestures and stances (additive)
def wave_fn(u):
    pose = Pose(); w = envelope(u, .2, .82)
    rel(pose, 'upper_arm.L', Ry(-1.85) @ Rx(-.35), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), 1.25 + .38 * sin(2 * pi * 3 * u)), w)
    rel(pose, 'hand.L', Rax(hinge('forearm.L'), -.2 + .2 * sin(2 * pi * 3 * u + .6)), w)
    rel(pose, 'head', Ry(-.08) @ Rz(.06), w); rel(pose, 'chest', Ry(-.04), w)
    return pose
record('wave', 48, wave_fn, keyed=UPPER, loop=False)

def point_fn(u):
    pose = Pose(); w = envelope(u, .2, .8)
    rel(pose, 'upper_arm.L', Rz(-.42) @ Rx(-1.38), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), .08), w)
    rel(pose, 'hand.L', Rax(hinge('forearm.L'), -.15), w)
    rel(pose, 'chest', Rz(.1), w); rel(pose, 'head', Rz(.12), w)
    return pose
record('point', 42, point_fn, keyed=UPPER, loop=False)

record('nod', 27, lambda u: (lambda p: (rel(p, 'head', Rx(.17 * sin(2 * pi * 2 * u) * envelope(u, .1, .85))), rel(p, 'neck', Rx(.05 * sin(2 * pi * 2 * u))), p)[-1])(Pose()), keyed=['head', 'neck'], loop=False)

def shrug_fn(u):
    pose = Pose(); w = envelope(u, .25, .7)
    rel(pose, 'shoulder.L', Ry(-.2), w); rel(pose, 'shoulder.R', Ry(.2), w)
    rel(pose, 'upper_arm.L', Ry(.25) @ Rx(-.15), w); rel(pose, 'upper_arm.R', Ry(-.25) @ Rx(-.15), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), 1.15), w); rel(pose, 'forearm.R', Rax(hinge('forearm.R'), 1.0), w)
    rel(pose, 'hand.L', Rax(forearm_axis('L'), -1.1), w); rel(pose, 'hand.R', Rax(forearm_axis('R'), 1.1), w)
    rel(pose, 'head', Ry(.12) @ Rx(-.04), w)
    return pose
record('shrug', 36, shrug_fn, keyed=UPPER, loop=False)

def laugh_fn(u):
    pose = Pose(); w = envelope(u, .12, .75); b = sin(2 * pi * 5.5 * u)
    rel(pose, 'chest', Rx(-.05 + .04 * b), w); rel(pose, 'spine', Rx(.03 * b), w)
    rel(pose, 'head', Rx(-.16 + .05 * b), w)
    rel(pose, 'shoulder.L', Ry(-.06 - .05 * b), w); rel(pose, 'shoulder.R', Ry(.06 + .05 * b), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), .5), w)
    return pose
record('laugh', 45, laugh_fn, keyed=UPPER, loop=False)

def think_fn(u):
    pose = Pose(); breathe = sin(2 * pi * u)
    rel(pose, 'upper_arm.L', Rz(-.55) @ Rx(-.75))
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), 2.15 + .03 * breathe))
    rel(pose, 'hand.L', Rax(hinge('forearm.L'), -.35) @ Rax(forearm_axis('L'), .6))
    rel(pose, 'upper_arm.R', Rz(.45) @ Rx(-.25))
    rel(pose, 'forearm.R', Rax(hinge('forearm.R'), 1.3))
    rel(pose, 'head', Ry(.1 + .02 * breathe) @ Rx(.05) @ Rz(.06))
    return pose
record('think', 90, think_fn, keyed=UPPER)

def guard_fn(u):
    pose = Pose(); b = sin(2 * pi * u)
    wand_arm(pose, .05, -.42 + .02 * b, .55, -1.15, .1)
    rel(pose, 'upper_arm.L', Rx(-.35) @ Ry(.3)); rel(pose, 'forearm.L', Rax(hinge('forearm.L'), .7))
    rel(pose, 'chest', Rz(-.08) @ Rx(.05)); rel(pose, 'spine', Rx(.04)); rel(pose, 'head', Rz(.08) @ Rx(-.04))
    hat(pose, .04)
    return pose
record('guard', 60, guard_fn, keyed=UPPER)

def book_hold(pose, w=1., turn=0.):
    rel(pose, 'upper_arm.L', Rz(-.25) @ Rx(-.42) @ Ry(.2), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), 1.55), w)
    rel(pose, 'hand.L', Rax(forearm_axis('L'), -1.45) @ Rax(hinge('forearm.L'), -.25), w)
    rel(pose, 'upper_arm.R', Rz(.35 + .25 * turn) @ Rx(-.32 - .1 * turn), w)
    rel(pose, 'forearm.R', Rax(hinge('forearm.R'), 1.35 + .2 * turn), w)
    rel(pose, 'head', Rx(.32) @ Rz(.04 * turn), w); rel(pose, 'neck', Rx(.1), w)
def read_fn(u):
    pose = Pose(); turn = sin(pi * smooth((u - .78) / .14)) if u > .78 else 0.
    book_hold(pose, 1., turn)
    return pose
record('read', 180, read_fn, keyed=UPPER)

def cheer_fn(u):
    pose = Pose(); w = envelope(u, .2, .78); b = sin(2 * pi * 2 * u)
    rel(pose, 'upper_arm.L', Ry(-2.2) @ Rx(-.4), w); rel(pose, 'upper_arm.R', Ry(2.2) @ Rx(-.4), w)
    rel(pose, 'forearm.L', Rax(hinge('forearm.L'), .35 + .15 * b), w); rel(pose, 'forearm.R', Rax(hinge('forearm.R'), .35 - .15 * b), w)
    rel(pose, 'head', Rx(-.18), w); rel(pose, 'chest', Rx(-.08), w)
    return pose
record('cheer', 42, cheer_fn, keyed=UPPER, loop=False)

# ------------------------------------------------------------------ full-body: reactions
def stand(pose, off=None, yaw=0., roll=0., pitch=0., feet=None, heel=(0, 0)):
    off = off or Vector((0, 0, -.015))
    Wh = hips_world(pose, off, yaw, roll, pitch)
    for i, side in enumerate('LR'):
        x = (1 if side == 'L' else -1) * .105
        A = feet[side] if feet else Vector((x, .01, .085))
        leg_ik(pose, side, hip_joint(Wh, off, side), A, 0, heel[i], -heel[i] * .5)
    return Wh

def hit_front_fn(u):
    pose = Pose(); k = ease([(0, 0), (.12, 1), (.45, .55), (1, 0)], u)
    stand(pose, Vector((0, .07 * k, -.015 - .05 * k)), 0, 0, -.08 * k, feet={'L': Vector((.105, .01, .085)), 'R': Vector((-.105, .01 + .18 * k, .085))})
    torso(pose, spine=(-.22 * k, 0, .05 * k), chest=(-.22 * k, 0, .06 * k))
    head_world(pose, .08 * k, .32 * k)
    arms(pose, .45 - .3 * k, -.45 * k, -.35 * k, .3 + .5 * k, .5 + .4 * k, outL=.35 * k, outR=.35 * k)
    robe(pose, 0, -.1 * k, .2 * k, -.15 * k, .3 * k, -.15 * k, flare=.1 * k)
    hat(pose, -.25 * k)
    return pose
record('hit_front', 16, hit_front_fn, loop=False)

def hit_back_fn(u):
    pose = Pose(); k = ease([(0, 0), (.12, 1), (.45, .55), (1, 0)], u)
    stand(pose, Vector((0, -.06 * k, -.015 - .06 * k)), 0, 0, .12 * k, feet={'L': Vector((.105, .01 - .2 * k, .085)), 'R': Vector((-.105, .01, .085))})
    torso(pose, spine=(.3 * k, 0, 0), chest=(.25 * k, 0, 0))
    head_world(pose, 0, -.25 * k)
    arms(pose, .45, .5 * k, .45 * k, .4, .6, outL=.25 * k, outR=.25 * k)
    robe(pose, 0, -.2 * k, -.1 * k, -.3 * k, -.15 * k, .3 * k, flare=.12 * k)
    hat(pose, .3 * k)
    return pose
record('hit_back', 16, hit_back_fn, loop=False)

def lying(pose, breath=0., lift=0.):
    off = Vector((0, 0, .11 - .95 + lift)); Wh = hips_world(pose, off, 0, 0, -1.53)
    for side in 'LR':
        x = (1 if side == 'L' else -1) * .13
        leg_ik(pose, side, hip_joint(Wh, off, side), Vector((x, -.84, .07)), 0, -.9, .3)
    torso(pose, spine=(-.02 + .01 * breath, 0, 0), chest=(-.02 - .02 * breath, 0, 0))
    pose.relative('head', Rx(.28))
    arms(pose, -.35, -.15, -.15, .25, .35, outL=.55, outR=.55)
    robe(pose, 0, 0, 0, 0, 0, 0, flare=.05)
    hat(pose, -.6)

def knock_fn(u):
    pose = Pose()
    if u < .62:
        k = smooth(u / .62); dip = sin(pi * min(1, u / .4)) * .25
        off = Vector((0, .05 * k, -.015 - .62 * k ** 1.6 - .1 * dip))
        Wh = hips_world(pose, off, 0, 0, -1.25 * k ** 1.3)
        for i, side in enumerate('LR'):
            x = (1 if side == 'L' else -1) * (.105 + .02 * k)
            A = Vector((x, .01 - .55 * k ** 1.2, .085 + .22 * sin(pi * k) * (1 if side == 'L' else .6)))
            leg_ik(pose, side, hip_joint(Wh, off, side), A, 0, -.5 * k, 0)
        torso(pose, spine=(-.25 * sin(pi * k), 0, 0), chest=(-.2 * sin(pi * k), 0, 0))
        head_world(pose, 0, .35 * sin(pi * k) + .3 * k)
        arms(pose, .45 - .7 * k, -.6 * sin(pi * k), -.6 * sin(pi * k), .3 + .3 * k, .5, outL=.6 * k, outR=.6 * k)
        robe(pose, 0, -.4 * k, -.4 * k, -.6 * k, -.6 * k, -.3 * k, flare=.3 * k)
        hat(pose, -.6 * k)
        return pose
    k = smooth((u - .62) / .38); bounce = sin(pi * k) * .035
    lying(pose, lift=bounce)
    return pose
record('knockdown', 30, knock_fn, loop=False)
record('lie', 60, lambda u: (lambda p: (lying(p, breath=sin(2 * pi * u)), p)[-1])(Pose()))

def getup_fn(u):
    pose = Pose()
    if u < .35:      # sit up, knees bend
        k = smooth(u / .35)
        off = Vector((0, 0, .11 - .95 + .1 * k)); Wh = hips_world(pose, off, 0, 0, -1.53 + 1.15 * k)
        for side in 'LR':
            x = (1 if side == 'L' else -1) * .13
            leg_ik(pose, side, hip_joint(Wh, off, side), Vector((x, -.84 + .45 * k, .07)), 0, -.9 + .9 * k, .3 * (1 - k))
        torso(pose, spine=(.25 * k, 0, 0), chest=(.15 * k, 0, 0))
        pose.relative('head', Rx(.28 * (1 - k)))
        arms(pose, -.35 + .5 * k, -.15 + .9 * k, -.15 + .2 * k, .25, .35 + .2 * k, outL=.55 - .3 * k, outR=.55 - .2 * k)
        robe(pose, 0, -.6, -.6, -.7, -.7, -.2, flare=.2)
        hat(pose, -.6 + .6 * k)
        return pose
    if u < .68:      # kneel / crouch, push on the left hand
        k = smooth((u - .35) / .33)
        off = Vector((0, -.12 * k, .11 - .95 + .1 + .33 * k)); Wh = hips_world(pose, off, 0, 0, -.38 + .75 * k)
        legL = Vector((.13, -.39 + .25 * k, .07)); legR = Vector((-.13, -.39 + .32 * k, .07 + .02 * k))
        leg_ik(pose, 'L', hip_joint(Wh, off, 'L'), legL, 0, 0, 0); leg_ik(pose, 'R', hip_joint(Wh, off, 'R'), legR, 0, .3 * k, -.3 * k)
        torso(pose, spine=(.25 + .1 * k, 0, 0), chest=(.15 + .1 * k, 0, 0))
        head_world(pose, 0, -.1 * k)
        arms(pose, .15 + .2 * k, .75 - .3 * k, .05 + .2 * k, .25, .55, outL=.25, outR=.35 - .2 * k)
        robe(pose, 0, -.6 + .2 * k, -.6 + .3 * k, -.7, -.7, -.2 + .2 * k, flare=.2)
        hat(pose, .2 * k)
        return pose
    k = smooth((u - .68) / .32)   # stand up
    off = Vector((0, -.12 * (1 - k), -.015 + (.11 - .95 + .43 + .015) * (1 - k))); Wh = hips_world(pose, off, 0, 0, .37 * (1 - k))
    for side in 'LR':
        x = (1 if side == 'L' else -1) * .105
        leg_ik(pose, side, hip_joint(Wh, off, side), Vector((x, -.14 * (1 - k) + .01 * k, .085)), 0, 0, 0)
    torso(pose, spine=(.35 * (1 - k), 0, 0), chest=(.25 * (1 - k), 0, 0))
    head_world(pose, 0, -.1 * (1 - k))
    arms(pose, .35 + .1 * k, .45 * (1 - k), .25 * (1 - k), .25, .55, outL=.25 * (1 - k), outR=.15 * (1 - k))
    robe(pose, 0, -.4 * (1 - k), -.3 * (1 - k), -.4 * (1 - k), -.4 * (1 - k), 0, flare=.1)
    hat(pose, .2 * (1 - k))
    return pose
record('getup', 42, getup_fn, loop=False)

# ------------------------------------------------------------------ directional dodges (game moves the root)
def dodge_side(u, s):
    """s=+1: dodge to the character's left (+X); -1: right."""
    pose = Pose(); k = sin(pi * u) ** .8; burst = ease([(0, 0), (.25, 1), (.7, .8), (1, 0)], u)
    off = Vector((s * .1 * burst, 0, -.02 - .17 * k))
    Wh = hips_world(pose, off, s * .1 * burst, -s * .22 * k, .1 * k)
    lead, trail = ('L', 'R') if s > 0 else ('R', 'L')
    leg_ik(pose, lead, hip_joint(Wh, off, lead), Vector((s * (.12 + .3 * burst), -.03, .085 + .05 * sin(pi * min(1, u * 2)))), 0, 0, 0)
    leg_ik(pose, trail, hip_joint(Wh, off, trail), Vector((-s * (.12 + .18 * burst), .06, .085 + .1 * burst)), 0, .5 * burst, -.4 * burst)
    torso(pose, spine=(.12 * k, s * .18 * k, 0), chest=(.1 * k, s * .15 * k, 0))
    head_world(pose, -s * .1 * k, -.08 * k, -s * .15 * k)
    arms(pose, .25 + .2 * (1 - k), .2 * k, .2 * k, .5 + .3 * k, .6 + .3 * k, outL=(.5 if s < 0 else .2) * k, outR=(.5 if s > 0 else .2) * k)
    robe(pose, 0, 0, 0, 0, 0, .1 * k, flare=.3 * k, sway=-s * .5 * k)
    hat(pose, .25 * k, side=-s * .6 * k)
    return pose
record('dodge_l', 13, lambda u: dodge_side(u, 1), loop=False)
record('dodge_r', 13, lambda u: dodge_side(u, -1), loop=False)

def dodge_back_fn(u):
    pose = Pose(); k = sin(pi * u) ** .8; hop = sin(pi * min(1, max(0, (u - .15) / .6)))
    off = Vector((0, .06 * k, -.03 - .14 * k + .07 * hop))
    Wh = hips_world(pose, off, 0, 0, .22 * k)
    for side in 'LR':
        x = (1 if side == 'L' else -1) * .12
        A = Vector((x, .05 * k + (.12 if side == 'R' else -.02) * k, .085 + .1 * hop))
        leg_ik(pose, side, hip_joint(Wh, off, side), A, 0, .2 * hop, -.2 * hop)
    torso(pose, spine=(.2 * k, 0, 0), chest=(.18 * k, 0, 0))
    head_world(pose, 0, -.12 * k)
    arms(pose, .3, -.5 * k, -.6 * k, .6 + .3 * k, .7 + .3 * k, outL=.2 * k, outR=.2 * k)
    robe(pose, 0, -.2 * k, -.2 * k, -.4 * k, -.4 * k, -.35 * k, flare=.3 * k)
    hat(pose, -.3 * k)
    return pose
record('dodge_b', 13, dodge_back_fn, loop=False)

# ------------------------------------------------------------------ sitting (bench seat ~0.46 m), reading
SEAT = Vector((0, .1, .47 - .95))
def sitting(pose, breath, lean=.06):
    Wh = hips_world(pose, SEAT, 0, 0, -.12)
    for side in 'LR':
        x = (1 if side == 'L' else -1) * .13
        leg_ik(pose, side, hip_joint(Wh, SEAT, side), Vector((x, -.36, .085)), 0, 0, 0)
    torso(pose, spine=(.12 + lean + .006 * breath, 0, 0), chest=(lean * .5 - .015 * breath, 0, 0))
    head_world(pose, 0, .02 + .02 * breath)
    for name, (s, side, kind) in ROBE_CHAINS.items():
        if kind == 0: W1 = Rx(-1.35) @ Ry(s * .15); r2 = Rx(1.25)
        elif kind == 1: W1 = Rx(-.75) @ Ry(s * .45); r2 = Rx(.7)
        else: W1 = Rx(.55); r2 = Rx(.9)
        pose.world(f'robe_{name}1', W1); pose.relative(f'robe_{name}2', r2)
    hat(pose, .02 * breath)

def sit_fn(u):
    pose = Pose(); b = sin(2 * pi * u)
    sitting(pose, b)
    arms(pose, .35, -.42, -.42, 1.0 + .02 * b, 1.0, handL=-.2, handR=-.1, outL=.0, outR=.0)
    return pose
record('sit', 120, sit_fn)

def sit_read_fn(u):
    pose = Pose(); b = sin(2 * pi * u * 2)
    sitting(pose, b, lean=.12)
    arms(pose, .4, 0, 0, .3, .5)
    turn = sin(pi * smooth((u - .8) / .12)) if u > .8 else 0.
    book_hold(pose, 1., turn)
    return pose
record('sit_read', 180, sit_read_fn)

# ------------------------------------------------------------------ bow (duelling courtesy), full body
def blend_m(a, b, w): return a.to_quaternion().slerp(b.to_quaternion(), max(0., min(1., w))).to_matrix()
def bow_fn(u):
    pose = Pose()
    salute = ease([(0, 0), (.2, 1), (.4, 1), (.55, .3), (.85, .3), (1, 0)], u)
    bend = ease([(0, 0), (.35, 0), (.55, 1), (.75, 1), (.95, 0), (1, 0)], u)
    stand(pose, Vector((0, .03 * bend, -.015 - .02 * bend)), 0, 0, .2 * bend)
    torso(pose, spine=(.3 * bend, 0, 0), chest=(.2 * bend, 0, 0))
    head_world(pose, 0, -.25 * bend)
    arms(pose, .45, .05, -.12, .2, .55, handL=.12, handR=.25)
    hz = hinge('forearm.R')
    pose.relative('upper_arm.R', blend_m(Rx(-.12) @ Ry(-.45), Rz(.645) @ Rx(-1.77), salute))
    pose.relative('forearm.R', blend_m(Rax(hz, .55), Rax(hz, 1.75), salute))
    pose.relative('hand.R', blend_m(Rax(hz, .25), Rax(hz, -.05), salute))
    robe(pose, 0, 0, 0, 0, 0, .1 * bend, flare=.04)
    hat(pose, -.3 * bend)
    return pose
record('bow', 48, bow_fn, loop=False)
