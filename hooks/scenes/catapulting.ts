import { Canvas, beat, clamp, ease, hash, hex, lerp, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const DEG = Math.PI / 180

const SKY = hex('1d1a3f 2b2257 3f2c6c 5a3779 7b4280 9e4f7f c0617a dc7a72 ef9d72 f9c487 fde4ae')
const HAZE = hex('5a3a6e 6a4476 7c4f7d 8f5a82 a46886 bb7a88')
const GRASS = hex('120f20 1a1a2c 222a26 2f3b29 44502c 61672f 8a8238 b8a148')
const STONE = hex('1c1729 2a2236 3b2e45 4f3a52 66495d 815a66 a0716e c48d79 e2b08e')
const WOOD = hex('120a12 1e1018 2e171c 412020 5a2c24 7c3e28 a85a30 d8843e f2b25a')
const ROCK = hex('1a1626 2a2434 3c3444 524858 6c6070 9a8484')
const PUMPKIN = hex('3a1208 6a220a 9e3a0c cf5a12 ef7e1e f9a73e fdd27a')
const STEM = hex('1e2a12 35491a 557026')
const ROPE = hex('3a2420 6a4632 a07a52')
const SUN = 0xfff4d6
const SEED = 0xf6e6b8
const BANNER = hex('3c0e1c 6e1a2c a02a3a d24a4a')

const GROUND = 27
const AXLE = { x: 16, y: 17 }
const LONG = 9.5
const SHORT = 4.5
const SLING = 3.5
const COCKED = 224
const REST = 80
const FIRE = 10
const RELEASE = 16
const IMPACT = 30
const HIT = { x: 46, y: 9 }

function arm(f: number): number {
  if (f < FIRE) return COCKED + ease.inOut(beat(f, 5, FIRE)) * 5
  if (f < 17) return lerp(COCKED + 5, 52, ease.in(beat(f, FIRE, 17)))
  if (f < 34) {
    const t = beat(f, 17, 34)
    return REST + (52 - REST) * Math.cos(t * 3 * Math.PI) * (1 - t) ** 2
  }
  if (f < 58) {
    const u = beat(f, 36, 58) * 6
    const k = Math.min(5, Math.floor(u))
    return lerp(REST, COCKED, (k + (1 - Math.cos(Math.PI * Math.min(1, (u - k) * 1.25))) / 2) / 6)
  }
  return COCKED
}

const tip = (a: number, length = LONG) => ({ x: AXLE.x + Math.cos(a * DEG) * length, y: AXLE.y - Math.sin(a * DEG) * length })

function sling(f: number): number {
  if (f < FIRE) return 0
  if (f < RELEASE + 0.5) return -300 * ease.in(beat(f, FIRE, RELEASE + 0.3))
  if (f < 36) return -300 - 150 * ease.out(beat(f, RELEASE, 23)) + Math.sin((f - 23) * 0.9) * 14 * (1 - beat(f, 23, 36))
  if (f < 52) return -90
  return lerp(-90, 0, ease.inOut(beat(f, 52, 58)))
}

function pumpkin(f: number): { x: number; y: number; spin: number } | undefined {
  if (f >= 56 && f < 66) {
    const roll = ease.out(beat(f, 56, 66))
    return { x: lerp(-5, 12, roll), y: 23, spin: Math.floor(roll * 6) }
  }
  if (f < RELEASE || f >= 66) {
    const p = tip(arm(f))
    const s = sling(f) * DEG
    return { x: p.x + Math.cos(s) * SLING, y: Math.min(23, p.y - Math.sin(s) * SLING), spin: 0 }
  }
  if (f >= IMPACT) return undefined
  const p = tip(arm(RELEASE))
  const s = sling(RELEASE) * DEG
  const rx = p.x + Math.cos(s) * SLING
  const ry = p.y - Math.sin(s) * SLING
  const t = (f - RELEASE) / (IMPACT - RELEASE)
  return { x: lerp(rx, HIT.x, t), y: ry + (HIT.y - 1 - ry) * t - 15 * t * (1 - t), spin: Math.floor((f - RELEASE) / 2) }
}

const PUMPKIN_ART = ['.abba.', 'abbcca', 'abcbca', '.aaaa.']
const SPLAT = ['.d..d..', 'dcbbcd.', '.cbbbcd', '..d.d..']
const DROP = ['..d..', '.dcd.', 'dcbbd', 'dbbbc', '.ddd.']
const PERCHED = ['.b', 'bb']
const WINGS_UP = ['b.b', '.b.']
const WINGS_LEVEL = ['bbb']

type Bird = { x: number; y: number; pose: readonly string[] }
const PERCHES = [[56, 1], [61, 1], [52, 6]] as const

function birds(f: number): Bird[] {
  return PERCHES.map(([px, py], i) => {
    const t = f - IMPACT - 1 - i
    const back = ease.out(beat(f, 50 + i * 4, 64 + i * 2))
    if (t < 0 || back >= 1) return { x: px, y: py, pose: PERCHED }
    const away = ease.in(beat(t, 0, 12))
    const x = back > 0 ? lerp(px - 34, px, back) : lerp(px, px + 18 + i * 4, away)
    const y = back > 0 ? lerp(-4, py, back) : lerp(py, py - 14, away)
    const isGliding = back > 0.6

    return { x, y, pose: isGliding || Math.floor((f + i) / 2) % 2 === 0 ? WINGS_LEVEL : WINGS_UP }
  })
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    const sun = { x: 7, y: 21 }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const glow = clamp(1 - Math.hypot(x - sun.x, (y - sun.y) * 1.6) / 30)
        c.set(x, y, shade(SKY, 0.4 + y * 0.4 + glow * 3.2))
      }
    }
    c.disc(sun.x, sun.y, 3.2, SUN)
    for (const [cx, cy, len] of [[30, 4, 20], [8, 9, 12], [36, 13, 18]] as const) {
      for (let x = cx - len / 2; x < cx + len / 2; x++) {
        const edge = Math.abs(x - cx) / (len / 2)
        c.set(x, cy, shade(SKY, 0.4 + cy * 0.4 + 1.6 + (edge > 0.8 ? -0.8 : 0)))
        if (edge < 0.7) c.set(x, cy + 1, shade(SKY, 0.4 + cy * 0.4 + 3.4))
        if (edge < 0.35) c.set(x + 3, cy - 1, shade(SKY, 0.4 + cy * 0.4 + 0.9))
      }
    }
    for (let x = 0; x < W; x++) {
      const top = Math.round(20.5 + Math.sin(x * 0.13 + 0.6) * 1.4 + Math.sin(x * 0.05 + 2) * 1.2)
      const sunward = clamp(1 - Math.abs(x - sun.x) / 26)
      for (let y = top; y < GROUND; y++) c.set(x, y, shade(HAZE, (y === top ? 4.4 : 2.6) + sunward * 1.6 - x * 0.02))
    }
    const meadow = (x: number) => Math.round(24.5 - smoothstep(30, 50, x) * 1.5)
    for (let x = 0; x < W; x++) {
      const top = meadow(x)
      for (let y = top; y < H; y++) {
        const crest = y === top ? 2.2 : 0
        c.set(x, y, shade(GRASS, 4.8 - (y - top) * 0.55 + crest - x * 0.02))
      }
    }

    const isMerlon = (x: number, left: number) => mod(x - left, 5) < 3
    const stone = (x: number, y: number, face: number) => {
      const course = mod(y, 3) === 2
      const joint = mod(x + Math.floor(y / 3) * 3, 6) === 0 && !course
      return shade(STONE, face - (course ? 0.7 : 0) - (joint ? 0.5 : 0) - (y > 22 ? (y - 22) * 0.15 : 0))
    }
    for (let y = 8; y < GROUND + 1; y++) {
      for (let x = 41; x < 55; x++) {
        if (y < 10 && !isMerlon(x, 41)) continue
        const lit = x === 41 || (y < 10 && mod(x - 41, 5) === 0) ? 6.6 : y === 8 ? 5 : 3.2
        c.set(x, y, stone(x, y, lit))
      }
    }
    for (let y = 3; y < GROUND + 1; y++) {
      for (let x = 55; x < W; x++) {
        if (y < 5 && !isMerlon(x, 55)) continue
        const lit = x === 55 || (y < 5 && mod(x - 55, 5) === 0) ? 6.8 : y === 3 ? 5.2 : x === 56 ? 4.4 : 3.4
        c.set(x, y, stone(x, y, lit))
      }
    }
    for (let y = 10; y < 26; y++) c.set(54, y, stone(54, y, 2.2))
    for (const [sx, sy] of [[59, 9], [59, 17], [48, 14]] as const) {
      for (let k = 0; k < 3; k++) c.set(sx, sy + k, shade(STONE, 0.4))
      c.set(sx - 1, sy + 1, shade(STONE, 2))
    }
    for (let y = 21; y <= GROUND; y++) {
      for (let x = 44; x <= 49; x++) {
        if (y === 21 && (x === 44 || x === 49)) continue
        const isBar = (x - 44) % 2 === 1 || y % 2 === 0
        c.set(x, y, isBar ? shade(STONE, 1.6) : shade(STONE, 0.2))
      }
    }
    for (let y = 0; y < 3; y++) c.set(58, y, shade(WOOD, 3))
    for (let k = 0; k < 5; k++) {
      const ripple = Math.round(Math.sin(f * 0.5 - k * 1.1) * (k / 4))
      for (let j = 0; j < 3 - Math.floor(k / 2); j++) {
        c.set(59 + k, ripple + j, shade(BANNER, 2.6 - j * 0.6 - k * 0.15 + (j === 0 ? 0.6 : 0)))
      }
    }

    if (f > IMPACT && f < 64) {
      const goo = { b: shade(PUMPKIN, 4.6), c: shade(PUMPKIN, 3.4), d: shade(PUMPKIN, 2.2) }
      const isSliding = f >= 44
      if (!isSliding) {
        c.sprite(HIT.x - 3, HIT.y - 1, SPLAT, goo)
        for (const [dx, speed] of [[1, 0.5], [4, 0.8], [5, 0.3]] as const) {
          const len = Math.min(4, Math.round((f - IMPACT) * speed * 0.3))
          for (let k = 0; k < len; k++) c.set(HIT.x - 3 + dx, HIT.y + 2 + k, shade(PUMPKIN, 2.6 - k * 0.3))
        }
        c.set(HIT.x, HIT.y, SEED)
      } else {
        const sy = HIT.y + 1 + Math.round(beat(f, 44, 64) ** 2 * 17)
        for (let y = Math.max(HIT.y + 1, sy - 5); y < sy; y++) c.set(HIT.x, y, shade(STONE, 1.2))
        c.sprite(HIT.x - 2, sy, DROP, goo)
        c.set(HIT.x - 1, sy + 2, SEED)
      }
    }
    if (f === 64 || f === 65) {
      const goo = { b: shade(PUMPKIN, 4.2 - (f - 64)), c: shade(PUMPKIN, 3.2 - (f - 64)), d: shade(PUMPKIN, 2.2 - (f - 64)) }
      c.sprite(HIT.x - 3, GROUND + 1 + (f - 64), f === 64 ? ['.dccd.', 'dbbbbd'] : ['.dccd.'], goo)
    }
    if (f >= 64 && f <= 66) {
      const r = (f - 63) * 1.5
      for (const side of [-1, 1]) c.set(HIT.x + side * r, GROUND - (f === 65 ? 1 : 0), shade(PUMPKIN, 3.6 - (f - 64)))
    }

    const a = arm(f)
    const prev = arm(f - 1)
    const speed = Math.abs(a - prev)
    const hop = f >= 16 && f <= 18 ? 1 : 0
    const wood = new Map<number, number>()
    const put = (x: number, y: number, level: number) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) wood.set(iy * W + ix, level)
    }
    const beam = (x0: number, y0: number, x1: number, y1: number, level: number) => {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))
      for (let k = 0; k <= n; k++) put(lerp(x0, x1, k / n), lerp(y0, y1, k / n) - hop, level)
    }
    beam(5, GROUND - 2, 27, GROUND - 2, 2.6)
    beam(9, GROUND - 2, AXLE.x, AXLE.y, 2.4)
    beam(10, GROUND - 2, AXLE.x + 1, AXLE.y, 1.8)
    beam(23, GROUND - 2, AXLE.x, AXLE.y, 2.4)
    beam(22, GROUND - 2, AXLE.x - 1, AXLE.y, 1.8)
    beam(12, 21, 20, 21, 2)
    const bend = f < 36 ? clamp((a - prev) / 40, -1, 1) * 22 : 0
    const length = LONG * (1 + Math.min(0.18, speed / 400))
    for (let k = -SHORT; k <= length; k += 0.5) {
      const along = k / length
      const ang = (a + (k > 0 ? bend * along * along : 0)) * DEG
      put(AXLE.x + Math.cos(ang) * k, AXLE.y - hop - Math.sin(ang) * k, 3)
      if (k < length * 0.6) put(AXLE.x + Math.cos(ang) * k + Math.sin(ang), AXLE.y - hop - Math.sin(ang) * k + Math.cos(ang), 2)
    }
    for (const [key, l] of wood) {
      const x = key % W
      const y = Math.floor(key / W)
      const left = !wood.has(y * W + x - 1)
      const top = !wood.has((y - 1) * W + x)
      c.set(x, y, shade(WOOD, l + (left ? 3.4 : 0) + (top ? 1.6 : 0)))
    }
    for (const wx of [8, 24]) {
      c.disc(wx, GROUND - 1 - hop, 1.5, shade(WOOD, 1.4))
      c.set(wx - 1, GROUND - 2 - hop, shade(WOOD, 6))
      c.set(wx, GROUND - 1 - hop, shade(WOOD, 4))
    }
    const q = tip(a + 180, SHORT)
    const swing = f >= 17 && f < 36 ? Math.round(Math.sin((f - 17) * 0.8) * 1.4 * (1 - beat(f, 17, 36))) : 0
    const bx = Math.round(q.x) - 2 + swing
    const by = Math.round(q.y) + 1 - hop
    c.set(Math.round(q.x), by, shade(WOOD, 3))
    for (let y = 1; y <= 4; y++) {
      for (let x = 0; x < 5; x++) {
        const lit = (x === 0 ? 2.4 : 0) + (y === 1 ? 1.6 : 0) - (x === 4 ? 0.8 : 0)
        const isStone = y === 1 && (x === 1 || x === 3)
        c.set(bx + x, by + y, isStone ? shade(ROCK, 4.6) : shade(WOOD, 2.2 + lit))
      }
    }
    c.set(AXLE.x, AXLE.y - hop, shade(WOOD, 8))

    if (f >= 14 && f <= 16) {
      const from = arm(f - 0.6)
      for (let s = 0; s <= 1; s += 0.04) {
        const ang = lerp(from, a, s) * DEG
        for (let k = LONG * 0.5; k <= LONG; k += 0.5) {
          const x = Math.round(AXLE.x + Math.cos(ang) * k)
          const y = Math.round(AXLE.y - Math.sin(ang) * k)
          const glow = clamp(1 - Math.hypot(x - sun.x, (y - sun.y) * 1.6) / 30)
          if (!wood.has(y * W + x)) c.set(x, y, shade(SKY, 0.4 + y * 0.4 + glow * 3.2 + 1 + s * 1.2))
        }
      }
    }

    const p = pumpkin(f)
    const t = tip(a + bend * 0.9, length)
    const s = sling(f) * DEG
    const loose = { x: t.x + Math.cos(s) * SLING, y: Math.min(GROUND - 2, t.y - hop - Math.sin(s) * SLING) }
    const end = p && (f < RELEASE || f >= 66) ? p : loose
    c.line(t.x, t.y - hop, end.x, end.y, shade(ROPE, 1.6))
    if (p) {
      if (f >= RELEASE && f < IMPACT) {
        const q0 = pumpkin(f - 1)
        if (q0) c.line(q0.x, q0.y, lerp(q0.x, p.x, 0.6), lerp(q0.y, p.y, 0.6), shade(SKY, 9.4))
      }
      const px = Math.round(p.x - 2.5)
      const py = Math.round(p.y - 2)
      c.sprite(px, py, PUMPKIN_ART, { a: shade(PUMPKIN, 2.2), b: shade(PUMPKIN, 4.4), c: shade(PUMPKIN, 3.4) }, p.spin % 2 === 1)
      c.set(px, py + 1, shade(PUMPKIN, 5.6))
      c.set(px + 1, py, shade(PUMPKIN, 6))
      const stem = [[2, -1], [6, 1], [3, 4], [-1, 2]][mod(p.spin, 4)] ?? [2, -1]
      c.set(px + (stem[0] ?? 0), py + (stem[1] ?? 0), shade(STEM, 2))
    }

    if (f === IMPACT) {
      c.sprite(HIT.x - 3, HIT.y - 2, ['.bbbbb.', 'abbbbba', '.aaaaa.'], { a: shade(PUMPKIN, 2.6), b: shade(PUMPKIN, 5) })
    }
    if (f > IMPACT && f <= IMPACT + 10) {
      const t = f - IMPACT
      for (let i = 0; i < 12; i++) {
        const r1 = hash(i, 1)
        const r2 = hash(i, 2)
        const vx = (r1 - 0.5) * 3.6
        const vy = -1.4 - r2 * 1.8
        const x = HIT.x + vx * t
        const y = HIT.y - 1 + vy * t + 0.32 * t * t
        if (y > GROUND) continue
        const isSeed = i % 3 === 0
        c.set(x, y, isSeed ? SEED : shade(PUMPKIN, 3.6 + r2 * 2))
        if (!isSeed && t < 5) c.set(x - vx * 0.5, y - (vy + 0.44 * t) * 0.5, shade(PUMPKIN, 2.4))
      }
      if (t <= 2) {
        for (const [dx, dy] of [[-5, -1], [5, -1], [-3, -4], [3, -4], [0, -5], [-6, 2], [6, 2]] as const) {
          c.set(HIT.x + dx * (0.6 + t * 0.3), HIT.y + dy * (0.6 + t * 0.3), shade(PUMPKIN, 6))
        }
      }
    }

    for (const b of birds(f)) c.sprite(Math.round(b.x) - 1, Math.round(b.y), b.pose, { b: shade(SKY, 0.2) })

    for (const d of particles(f, LOOP, 6, 10, 5)) {
      const born = f - d.t
      if (born < 15 || born > 19) continue
      const x = AXLE.x + (d.r[1] - 0.5) * 14 + (d.r[1] - 0.5) * d.t * 1.2
      const y = GROUND - 2 - d.t * 0.5
      if (d.age < 0.8) c.set(x, y, shade(HAZE, 5 - d.age * 3))
    }

    for (let x = 0; x < W; x++) {
      c.set(x, H - 1, shade(GRASS, 0.4))
      c.set(x, H - 2, shade(GRASS, 1))
    }
    for (const gx of [3, 11, 19, 30, 37, 52, 60]) {
      const lean = Math.round(Math.sin((f / LOOP) * Math.PI * 4 + gx * 0.7) * 0.7)
      c.set(gx, H - 3, shade(GRASS, 1))
      c.set(gx + lean, H - 4, shade(GRASS, 1.4))
      c.set(gx - 1, H - 3, shade(GRASS, 0.8))
      c.set(gx + 2 + lean, H - 3, shade(GRASS, 1.2))
    }

    const shake = f === IMPACT ? 1 : f === IMPACT + 1 ? -1 : 0
    const px = c.copy()
    if (shake) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = c.get(x, clamp(y - shake, 0, H - 1))
    out.push(px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Catapulting',
  render,
  hero: 22,
  snaps: [
    { frames: [14, RELEASE], box: [1, 2, 16, 24], colors: [...PUMPKIN, ...STEM], why: 'the throw: the sling whips the pumpkin up from the ground and over the arm faster than a frame can follow' },
    { frames: [15, RELEASE], box: [7, 6, 16, 16], colors: [...SKY.slice(8, 10), ...WOOD], why: 'the arm whips over in two frames, its smear fanning across the sky behind it' },
    { frames: RELEASE, box: [1, 2, 25, 27], why: 'the release: as the arm whips over, the whole catapult kicks up a pixel' },
    { frames: 27, box: [33, 3, 42, 6], colors: [...PUMPKIN, ...STEM], why: 'the pumpkin flies at 2.5 px a frame, so here its leading edge and stem step 3 px' },
    { frames: [IMPACT, IMPACT + 2], why: 'the impact shakes the whole picture down a pixel, up a pixel, and back' },
  ],
}
