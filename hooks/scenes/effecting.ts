import { Canvas, clamp, ease, hash, hex, mod, noise, shade, wave, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 84

const SKY = hex('22388e 2f4aa8 4a5cbc 7068c4 9a74c0 c482b8 e898b0')
const RIDGE = hex('2c1c4c 48245e 6c2c6a 983a72 c24c78 e2647c f4887e fcb08e')
const VALLEY = hex('1e1c4a 262456 302c64 3c3472 4a3c80')
const LIGHTS = hex('f2a860 ffe0a0')
const MOON = hex('eec2b2 fde2d2 fff6ea')
const TABLE = hex('0c1c4a 12296a 1a3c88 2252a0 2a6aa8 2e86aa 32a0a4 4cb8a2 7ccea8 b4e4b8')
const LACQUERS = [
  hex('3a0e2e 861e40 b02c50 d8486a f04848 ff4a30 ff9a70'),
  hex('3e1428 98383a c0563c e8805a fa7a2a ff9420 ffca6a'),
  hex('3a2438 886440 b49450 e8cc76 f6c834 ffde30 fff28a'),
  hex('0e2a3a 1e5e4e 2e8458 7ab070 52b23a 7ad030 c4ee6a'),
  hex('141a52 22389a 3456c0 5a86e6 2e7ae8 3a9cff 98d4ff'),
  hex('22103e 5e2c92 7a40b8 a46ae0 a446dc c464f6 eaacff'),
]
const lacquerAt = (paint: Ramp, level: number) => (level >= 10.6 ? shade(WHITE, 11) : shade(paint, ((level - 1) / 7.5) * 5))
const WHITE = hex('1e1c48 2c2a66 3e3a86 5852a6 7a70c0 a092d2 c8a2cc e8b2b6 f8c698 ffd99e fff0c8 ffffff')
const SKIN = hex('4a1828 7a2a34 aa443e d26448 ee8a58 fbb070 ffd49a')
const NAIL = hex('e8a49a fcd8c8')
const BRASS = hex('3a2414 7a4c22 c08a3a f2c66a fff0b0')
const PENNANT = hex('5a0c20 a01828 e03430 ff6a3c ffa060')
type V3 = readonly [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(...a) || 1))
const CAM: V3 = [0, 0, 2]
const PITCH = 0.18
const FOCAL = 44
const FWD: V3 = [0, Math.cos(PITCH), -Math.sin(PITCH)]
const UP: V3 = [0, Math.sin(PITCH), Math.cos(PITCH)]
const RIGHT: V3 = [1, 0, 0]
const rayAt = (x: number, y: number): V3 => norm(add(FWD, add(mul(RIGHT, (x + 0.5 - W / 2) / FOCAL), mul(UP, (H / 2 - y - 0.5) / FOCAL))))
function toScreen(p: V3): [number, number, number] {
  const d = sub(p, CAM)
  const z = dot(d, FWD)
  return [W / 2 + (FOCAL * dot(d, RIGHT)) / z - 0.5, H / 2 - (FOCAL * dot(d, UP)) / z - 0.5, z]
}
const HORIZON = H / 2 - FOCAL * Math.tan(PITCH) - 0.5

const SUN_ALT = 0.2
const SUN_AZ = 1.45
const SUN: V3 = [-Math.sin(SUN_AZ) * Math.cos(SUN_ALT), -Math.cos(SUN_AZ) * Math.cos(SUN_ALT), Math.sin(SUN_ALT)]
const TABLE_FAR = 13
const PLANK = 1.25

const START = [-1.5, 3.2] as const
const COUNT = 13
const SPACING = 0.72
const TALL = 1
const WIDE = 0.5
const THICK = 0.17
const PIPS: readonly (readonly [number, number])[][] = [
  [], [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [2, 0], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
]
type Domino = { x: number; y: number; tx: number; ty: number; paint: Ramp; halves: readonly [number, number] }
const DOMINOES: Domino[] = (() => {
  const out: Domino[] = []
  let [x, y] = START
  for (let i = 0; i < COUNT; i++) {
    const half = norm(add(SUN, norm(sub(CAM, [x, y, TALL / 2]))))
    const l = Math.hypot(half[0], half[1]) || 1
    const [tx, ty] = [-half[0] / l, -half[1] / l]
    out.push({ x, y, tx, ty, paint: [], halves: [Math.floor(hash(i, 7) * 7), Math.floor(hash(i, 11) * 7)] })
    x += tx * SPACING
    y += ty * SPACING
  }
  const widths = out.map(d => 1 / dot(sub([d.x, d.y, 0], CAM), FWD))
  const total = widths.reduce((a, b) => a + b, 0)
  let run = 0
  return out.map((d, i) => {
    const w = widths[i] ?? 0
    const paint = LACQUERS[Math.min(LACQUERS.length - 1, Math.floor(((run + w / 2) / total) * LACQUERS.length))] ?? []
    run += w
    return { ...d, paint }
  })
})()
const N = DOMINOES.length

const PUSH = 10
const CONTACT = Math.asin((SPACING - THICK) / TALL)
const STEP = 1.25
const FALL = STEP / Math.sqrt(CONTACT / (Math.PI / 2))
const LAST_REST = 1.47
const REWIND = 58
const BACK_STEP = 0.55
const RISE = 4
function firstTilt(f: number): number {
  const lean = 0.3 * ease.inOut(clamp((f - PUSH) / 4))
  return lean + (Math.PI / 2) * clamp((f - PUSH - 4) / FALL) ** 2
}
const FIRST_CONTACT = (() => {
  let f = PUSH
  while (firstTilt(f) < CONTACT) f += 0.01
  return f
})()
const startOf = (i: number) => FIRST_CONTACT + (i - 1) * STEP
function freeTilt(i: number, f: number): number {
  const down = i === 0 ? firstTilt(f) : (Math.PI / 2) * clamp((f - startOf(i)) / FALL) ** 2
  const up = ease.inOut(clamp((f - REWIND - (N - 1 - i) * BACK_STEP) / RISE))
  return Math.min(down, i === N - 1 ? LAST_REST : Math.PI / 2) * (1 - up)
}
function tilts(f: number): number[] {
  const out = new Array<number>(N).fill(0)
  out[N - 1] = freeTilt(N - 1, f)
  for (let i = N - 2; i >= 0; i--) {
    const next = out[i + 1] ?? 0
    out[i] = Math.min(freeTilt(i, f), next + Math.asin(clamp((SPACING * Math.cos(next) - THICK) / TALL, -1, 1)))
  }
  return out
}
const LANDED = startOf(N - 1) + FALL * Math.sqrt(LAST_REST / (Math.PI / 2))

type Box = { c: V3; ax: readonly [V3, V3, V3]; e: readonly [number, number, number] }

function boxOf(d: Domino, angle: number): Box {
  const t: V3 = [d.tx, d.ty, 0]
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const along: V3 = [d.tx * cos, d.ty * cos, -sin]
  const up: V3 = [d.tx * sin, d.ty * sin, cos]
  const pivot: V3 = [d.x + (t[0] * THICK) / 2, d.y + (t[1] * THICK) / 2, 0]
  return { c: add(pivot, add(mul(along, -THICK / 2), mul(up, TALL / 2))), ax: [along, [-d.ty, d.tx, 0], up], e: [THICK / 2, WIDE / 2, TALL / 2] }
}
type Hit = { t: number; axis: number; side: number }
function hitBox(o: V3, d: V3, b: Box): Hit | undefined {
  let near = -Infinity
  let far = Infinity
  let axis = 0
  let side = 0
  const rel = sub(o, b.c)
  for (let k = 0; k < 3; k++) {
    const a = b.ax[k] ?? RIGHT
    const e = b.e[k] ?? 0
    const oo = dot(rel, a)
    const dd = dot(d, a)
    if (Math.abs(dd) < 1e-9) {
      if (Math.abs(oo) > e) return undefined
      continue
    }
    const t0 = (-e - oo) / dd
    const t1 = (e - oo) / dd
    if (Math.min(t0, t1) > near) {
      near = Math.min(t0, t1)
      axis = k
      side = dd > 0 ? -1 : 1
    }
    far = Math.min(far, Math.max(t0, t1))
    if (near > far) return undefined
  }
  return near > 1e-4 ? { t: near, axis, side } : undefined
}

function hitCapsule(o: V3, d: V3, a: V3, b: V3, r: number): number | undefined {
  const ba = sub(b, a)
  const oa = sub(o, a)
  const baba = dot(ba, ba)
  const bard = dot(ba, d)
  const baoa = dot(ba, oa)
  const k2 = baba - bard * bard
  const k1 = baba * dot(d, oa) - baoa * bard
  const k0 = baba * dot(oa, oa) - baoa * baoa - r * r * baba
  const h = k1 * k1 - k2 * k0
  if (h < 0) return undefined
  const t = (-k1 - Math.sqrt(h)) / k2
  const y = baoa + t * bard
  if (y > 0 && y < baba) return t > 0 ? t : undefined
  const oc = y <= 0 ? oa : sub(o, b)
  const c1 = dot(d, oc)
  const c0 = dot(oc, oc) - r * r
  const h2 = c1 * c1 - c0
  if (h2 <= 0) return undefined
  const t2 = -c1 - Math.sqrt(h2)
  return t2 > 0 ? t2 : undefined
}
const FINGER_R = 0.15
const KNUCKLE_R = 0.19
const JOINT = 0.75
const FIRST = DOMINOES[0] ?? { x: 0, y: 0, tx: 0, ty: 1, paint: [], halves: [0, 0] }
const BACK: V3 = norm([-FIRST.tx * 0.6 - 0.6, -FIRST.ty * 0.6, 0.3])
const DORSAL: V3 = norm(sub([0, 0, 1], mul(BACK, BACK[2])))
const TOUCH_AT = 0.78
type Finger = { tip: V3; joint: V3; base: V3 }
function hitFinger(o: V3, d: V3, finger: Finger): number | undefined {
  const a = hitCapsule(o, d, finger.tip, finger.joint, FINGER_R)
  const b = hitCapsule(o, d, finger.joint, finger.base, KNUCKLE_R)
  return a === undefined ? b : b === undefined ? a : Math.min(a, b)
}
function fingerAt(f: number, first: number): Finger {
  const face = boxOf(FIRST, first)
  const press = add(face.c, add(mul(face.ax[0], -THICK / 2 - FINGER_R), mul(face.ax[2], TALL * (TOUCH_AT - 0.5))))
  const u = mod(f - (LOOP - 16), LOOP)
  let away = 0
  if (u < 16) away = 3.2 * (1 - ease.out(u / 16))
  else if (f < PUSH - 4) away = 0
  else if (f < PUSH) away = 0.18 * Math.sin(((f - PUSH + 4) / 4) * Math.PI)
  else if (f >= PUSH + 4) away = 3.2 * ease.inOut(clamp((f - PUSH - 4) / 12))
  const tip = add(press, mul(BACK, away))
  return { tip, joint: add(tip, mul(BACK, JOINT)), base: add(tip, mul(BACK, 6)) }
}
const LAST = DOMINOES[N - 1] ?? FIRST
const HINGE: V3 = [LAST.x + LAST.tx * 1.15, LAST.y + LAST.ty * 1.15, 0.1]
const PLATE: Box = {
  c: [LAST.x + LAST.tx * 0.95, LAST.y + LAST.ty * 0.95, 0.05],
  ax: [[LAST.tx, LAST.ty, 0], [-LAST.ty, LAST.tx, 0], [0, 0, 1]],
  e: [0.38, 0.32, 0.05],
}
const POLE = 2.6
const WIND: V3 = norm([1, 0.25, 0])
const UPRIGHT = (Math.PI / 2) * 0.97
const POP = Math.ceil(LANDED)
const FOLD = REWIND - 9
function raise(f: number): number {
  if (f < POP) return 0
  if (f < FOLD) {
    const t = f - POP
    return UPRIGHT * (ease.outBack(clamp(t / 6)) + Math.sin(t * 1.2) * Math.exp(-t * 0.35) * 0.12)
  }
  return UPRIGHT * (1 - ease.inOut(clamp((f - FOLD) / 10)))
}

const slopeAt = (x: number) => {
  const shape = [4.6, 3.8, 3.0, 2.6, 3.0, 2.4, 2.8, 3.6, 4.4, 5.0, 5.8, 7.4, 8.2, 8.0, 8.4]
  const p = (x / W) * (shape.length - 1)
  const k = Math.floor(p)
  const a = shape[k] ?? 8
  const b = shape[k + 1] ?? a
  return a + (b - a) * (p - k)
}
const ridgeAt = (x: number) => slopeAt(x) + (noise(x * 0.55, 3) - 0.5) * 1.4
const MOON_AT = [54, 4.2] as const
const MOON_R = 2.7
const CITY = Array.from({ length: 9 }, (_, i) => [Math.floor(hash(i, 31) * W), Math.floor(HORIZON + 1 + hash(i, 37) * 3)] as const)
function backdrop(c: Canvas, f: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ridge = ridgeAt(x)
      if (y >= HORIZON) {
        c.set(x, y, shade(VALLEY, 4 - (y - HORIZON) * 0.9))
      } else if (y >= ridge) {
        const slope = slopeAt(x)
        const below = clamp((y - slope) / Math.max(1, HORIZON - slope))
        const gully = noise(x * 0.3 + y * 0.12, y * 0.05, 0, 5) > 0.62 ? 1 : 0
        c.set(x, y, shade(RIDGE, 6.6 - below * 6 - gully + (y - ridge < 1 ? 0.8 : 0)))
      } else {
        const mx = x - MOON_AT[0]
        const my = y - MOON_AT[1]
        const r = Math.hypot(mx, my)
        if (r <= MOON_R) {
          const mare = noise(x * 0.9, y * 0.9, 0, 9) > 0.6
          c.set(x, y, shade(MOON, r > MOON_R - 0.8 ? 1 : mare ? 1 : 2))
        } else {
          c.set(x, y, shade(SKY, (y / Math.max(1, slopeAt(x))) * 6.2))
        }
      }
    }
  }
  for (const [i, [x, y]] of CITY.entries()) {
    if (y >= H || ridgeAt(x) > y) continue
    c.set(x, y, shade(LIGHTS, wave(f, LOOP, 1 + (i % 3), hash(i, 41)) > 0.6 ? 1 : 0))
  }
}
function lacquer(n: V3, p: V3, isLit: boolean): { level: number; glint: number } {
  const sky = 0.5 + 0.5 * n[2]

  const sun = isLit ? clamp((dot(n, SUN) - 0.28) / 0.32) ** 1.2 : 0
  const half = norm(add(SUN, norm(sub(CAM, p))))
  const glint = isLit ? Math.max(0, dot(n, half)) ** 90 : 0
  return { level: 1 + sky * 4 + sun * 5.6 + glint * 3, glint }
}
function render(): Int32Array[] {
  const frames: Int32Array[] = []
  const rays = Array.from({ length: W * H }, (_, k) => rayAt(k % W, Math.floor(k / W)))

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    backdrop(c, f)

    const angles = tilts(f)
    const boxes = DOMINOES.map((d, i) => boxOf(d, angles[i] ?? 0))
    const finger = fingerAt(f, angles[0] ?? 0)
    const phi = raise(f)
    const across: V3 = [LAST.ty, -LAST.tx, 0]
    const poleDir: V3 = add(mul(across, Math.cos(phi)), [0, 0, Math.sin(phi)])
    const poleTip = add(HINGE, mul(poleDir, POLE))
    const isShaded = (p: V3, skip = -1): boolean => {
      for (let i = 0; i < N; i++) if (i !== skip && hitBox(p, SUN, boxes[i] as Box)) return true
      if (hitFinger(p, SUN, finger) !== undefined) return true
      if (hitCapsule(p, SUN, HINGE, poleTip, 0.12)) return true
      return false
    }
    const depth = new Float32Array(W * H).fill(Infinity)
    const owner = new Int16Array(W * H).fill(-1)
    const level = new Float32Array(W * H)
    const face = new Int8Array(W * H)
    const glints = new Float32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = y * W + x
        const d = rays[k] as V3
        let best = Infinity
        let what = -1
        let hit: Hit | undefined
        for (let i = 0; i < N; i++) {
          const h = hitBox(CAM, d, boxes[i] as Box)
          if (h && h.t < best) {
            best = h.t
            what = i
            hit = h
          }
        }
        const plate = hitBox(CAM, d, PLATE)
        if (plate && plate.t < best) {
          best = plate.t
          what = N
          hit = plate
        }
        const fingerT = hitFinger(CAM, d, finger)
        if (fingerT !== undefined && fingerT < best) {
          best = fingerT
          what = N + 1
        }
        const tableT = d[2] < 0 ? -CAM[2] / d[2] : Infinity
        const onTable = tableT < best && CAM[1] + d[1] * tableT < TABLE_FAR
        if (onTable) {
          best = tableT
          what = N + 2
        }
        if (what < 0) continue
        depth[k] = best
        owner[k] = what
        const p = add(CAM, mul(d, best))
        if (what === N + 2) {
          let lit = isShaded(add(p, [0, 0, 1e-3])) ? 2.2 : 6.6
          const scale = FOCAL / dot(sub(p, CAM), FWD)
          const seam = Math.abs(mod(p[0] + 0.3 + PLANK / 2, PLANK) - PLANK / 2)
          if (seam < 0.5 / scale && PLANK * scale > 9) lit -= 1
          for (const d2 of DOMINOES) if (Math.hypot(p[0] - d2.x, p[1] - d2.y) < 0.32) lit -= 0.7
          if (p[1] > TABLE_FAR - 0.5 / scale) lit += 1.2
          c.set(x, y, shade(TABLE, lit, x, y))
        } else if (what === N + 1) {
          const along = Math.max(0, dot(sub(p, finger.tip), BACK))
          const axis = add(finger.tip, mul(BACK, along))
          const n = norm(sub(p, axis))
          const sun = isShaded(add(p, mul(n, 0.02))) ? 0 : Math.max(0, dot(n, SUN))
          const isNail = along > 0.03 && along < 0.27 && dot(n, DORSAL) > 0.5
          const crease = Math.abs(along - JOINT) < 0.05 ? 1 : 0
          c.set(x, y, isNail ? shade(NAIL, sun > 0.3 ? 1 : 0) : shade(SKIN, 2 + (0.5 + 0.5 * n[2]) * 2 + sun * 3 - crease))
        } else {
          const b = what === N ? PLATE : (boxes[what] as Box)
          const h = hit as Hit
          const n = mul(b.ax[h.axis] ?? RIGHT, h.side)
          const isLit = !isShaded(add(p, mul(n, 0.01)), what < N ? what : -1)
          if (what === N) {
            c.set(x, y, shade(BRASS, 1 + (isLit ? 2 : 0) + n[2]))
          } else {
            const { level: l, glint } = lacquer(n, p, isLit)
            glints[k] = glint
            level[k] = l
            face[k] = h.axis === 0 && h.side < 0 ? 1 : 0
            c.set(x, y, lacquerAt(DOMINOES[what]?.paint ?? [], l))
          }
        }
      }
    }
    DOMINOES.forEach((d, i) => {
      const b = boxes[i] as Box
      const front = add(b.c, mul(b.ax[0], -THICK / 2 - 1e-3))
      const [, , z] = toScreen(front)
      const scale = FOCAL / z
      if (WIDE * scale < 4.2) return
      const mark = (u: number, v: number, color: (l: number) => number) => {
        const [sx, sy] = toScreen(add(front, add(mul(b.ax[1], u), mul(b.ax[2], v))))
        const px = Math.round(sx)
        const py = Math.round(sy)
        if (px < 0 || px >= W || py < 0 || py >= H) return
        const k = py * W + px
        if (owner[k] === i && face[k] === 1) c.set(px, py, color(level[k] ?? 0))
      }
      const groove = (l: number) => shade(d.paint, ((l - 1) / 7.5) * 5 - 1.5)
      for (let s = -0.18; s <= 0.18; s += 0.5 / scale) mark(s, 0, groove)
      d.halves.forEach((count, half) => {
        for (const [gx, gy] of PIPS[count] ?? []) {
          mark((gx - 1) * 0.13, (half ? -1 : 1) * (0.25 + (gy - 1) * 0.13), l => shade(WHITE, Math.min(10, l + 0.5)))
        }
      })
    })
    DOMINOES.forEach((_, i) => {
      let at = -1
      for (let k = 0; k < W * H; k++) if (owner[k] === i && face[k] === 1 && (glints[k] ?? 0) > (glints[at] ?? 0.6)) at = k
      if (at < 0) return
      const px = at % W
      const py = Math.floor(at / W)
      const z = depth[at] ?? 0
      const arm = (glints[at] ?? 0) > 0.9 && (FOCAL / z) * WIDE > 3.5 ? 2 : 1
      c.set(px, py, shade(WHITE, 11))
      for (let a = 1; a <= arm; a++) {
        for (const [dx, dy] of [[a, 0], [-a, 0], [0, a], [0, -a]] as const) {
          const k = (py + dy) * W + px + dx
          if (px + dx < 0 || px + dx >= W || py + dy < 0 || py + dy >= H || (depth[k] ?? Infinity) < z - 0.1) continue
          c.set(px + dx, py + dy, shade(WHITE, a === arm ? 10 : 11))
        }
      }
    })
    const [hx, hy, hz] = toScreen(HINGE)
    const [tx, ty] = toScreen(poleTip)
    const behind = (x: number, y: number) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      return ix >= 0 && ix < W && iy >= 0 && iy < H && (depth[iy * W + ix] ?? Infinity) < hz - 0.3
    }
    const pole = new Canvas()
    pole.line(hx, hy, tx, ty, 1)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (pole.get(x, y) && !behind(x, y)) c.set(x, y, shade(BRASS, y === Math.round(ty) ? 4 : 2))
    }
    const ripple = wave(f, 6, 1) * clamp(phi)
    const hoist = add(poleTip, mul(poleDir, -0.65))
    const fly = add(poleTip, add(mul(poleDir, -0.3 + 0.12 * ripple), mul(WIND, 1.2)))
    const [fx, fy] = toScreen(fly)
    const [ax, ay] = toScreen(hoist)
    const cloth = new Canvas()
    cloth.poly([[tx, ty], [fx, fy], [ax, ay]], 1)
    cloth.line(tx, ty, fx, fy, 2)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = cloth.get(x, y)
        if (!k || behind(x, y) || pole.get(x, y)) continue
        c.set(x, y, shade(PENNANT, k === 2 ? 4 : Math.hypot(x - fx, y - fy) < 1.2 && ripple < 0 ? 2 : 3))
      }
    }
    frames.push(c.px)
  }
  return frames
}
const [HINGE_X, HINGE_Y] = toScreen(HINGE)
const LINE_BOX = (() => {
  const points = DOMINOES.flatMap(d => [0, TALL].map(z => toScreen([d.x, d.y, z])))
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  return [Math.max(0, Math.floor(Math.min(...xs)) - 4), Math.max(0, Math.floor(Math.min(...ys)) - 3), W - 1, H - 1] as const
})()
export const scene: Scene = {
  verb: 'Effecting',
  render,
  hero: 17,
  snaps: [
    {
      frames: [Math.ceil(FIRST_CONTACT), Math.ceil(startOf(5) + FALL)],
      why: "the near dominoes go over: each one's long shadow leaves the table in a frame or two",
    },
    {
      frames: [PUSH + 1, POP],
      box: LINE_BOX,
      why: "the fall: as each domino tips, its face mirrors the sun at us for a frame or two, a star that comes and goes, and turns from the sun's colour to the sky's",
    },
    {
      frames: [REWIND + 1, Math.ceil(REWIND + (N - 1) * BACK_STEP + RISE)],
      why: 'the line springs back up: the faces flash and turn from the sky back to the sun, and the near ones throw their long shadows back across the table',
    },
    {
      frames: POP + 1,
      box: [Math.floor(HINGE_X) - 3, 0, W - 1, Math.ceil(HINGE_Y) + 1],
      why: 'the flag springs up off its trigger',
    },
  ],
}