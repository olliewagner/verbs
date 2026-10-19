import { Canvas, beat, clamp, ease, frames, hash, hex, mix, noise, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const HORIZON = 12
const SHORE = 19

const SKY = hex('3a6cc0 4a82d0 5c99dc 76b0e6 96c7ee bcdff5')
const CLOUD = hex('9ab8dc c2d8ee e2eef8 fbfdff')
const SEA = hex('0c3868 12548c 1a70a6 2690bc 40aec8 6ecad0 a8e6dc')
const FOAM = 0xf4fbf2
const SAND = hex('6e4c36 96704c b8925e d6b27a ebcf98 f8e7bc')
const BARK = hex('2a1a14 46291c 683f26 8a5a32 aa7a46 c49a62')
const FROND = hex('0e2a26 15432e 205f36 33803c 58a242 8cc456')
const ROPE = hex('5a4230 8e7050 c4a676')
const STRIPES = [hex('6a1626 a42a30 da4a3a f07a5a'), hex('80580e c8961c f0c83a f8e27a'), hex('104a52 1e7a76 3caa92 74d0a8')]
const SKIN = hex('4a2418 6c3a24 8e5432 ae7044 c88e5c e0ac7a')
const HAIR = hex('1e120e 3a2418')
const INSIDE = hex('3a1a2a 5a2a34 7a3a3a')
const SHIRT = hex('7a86a6 b8c2d8 eef2f8 ffffff')
const SHORTS = hex('6a1e3a a03a5a d0607a ec8a96')
const HAT = hex('5c3e1a 8c6428 b88c3c dcb45a f4d888')
const BAND = hex('3a1650 6a2a8a')
const COCO = hex('3a2016 5c3620 82522e a8743e c89a5a')
const FLESH = hex('cfc6ac f8f2e0')
const PINK = hex('a83a68 f0709c ffd2e2')
const GULL = hex('3c4250 aab4c4 f4f6fa')

const gust = (f: number) => smoothstep(26, 36, f) * (1 - smoothstep(44, 58, f))

const swing = (f: number) => wave(f, LOOP, 1)

const X0 = 14
const X1 = 50
const END_Y = 13.5

function lipY(f: number, x: number): number {
  const u = clamp((x - X0) / (X1 - X0))
  const k = -0.6 * swing(f)
  const warped = u - k * u * (1 - u)
  const depth = 3.4 - 0.3 * swing(f) ** 2
  return END_Y + depth * Math.sin(Math.PI * warped)
}

const thickness = (x: number) => 1 + 2.6 * Math.sin(Math.PI * clamp((x - X0) / (X1 - X0))) ** 0.6

const PERSON = [
  '..............................',
  'ff......................ee....',
  'ff............wwww.....e.hh...',
  '.kk........wwwwwwwww...ssnsh..',
  '.kkkkkkbbbwwwwwwwwwwwsssssssh.',
  '..kkkkkbbbbwwwwwwwwwwwssssssh.',
]
const PERSON_X = 17
const PERSON_PAINT: Record<string, [readonly number[], number]> = {
  h: [HAIR, 0.6], e: [SKIN, 3], s: [SKIN, 2.6], n: [SKIN, 3.4], w: [SHIRT, 1.5], b: [SHORTS, 1.4], k: [SKIN, 2.3], f: [SKIN, 3],
}
const HEAD_X = PERSON_X + 26
const SHOULDER = PERSON_X + 20
const DRINK_X = 46

const HAT_ART = [
  '...cccc...',
  '..ccccco..',
  '..bbbbbb..',
  'rrrrrrrrrr',
]

const TRUNKS = [
  { base: 10, lean: -4.5, bow: 1.2 },
  { base: 54, lean: 4.5, bow: -1.2 },
]
const CROWN_Y = 4
const trunkX = (t: { base: number; lean: number; bow: number }, s: number) => t.base + t.bow * Math.sin(Math.PI * s) + t.lean * s * s

const FRONDS: [number, number, number, number][] = [
  [-3.4, 9, 0.6, 2.8], [-2.0, 7, 0.3, 2.4], [-2.7, 11, 0.55, 3.2], [-1.15, 8, 0.45, 2.6], [0.2, 10, 0.55, 3], [-0.45, 13, 0.5, 3.4], [2.75, 10, 0.5, 3],
]

function frond(c: Canvas, cx: number, cy: number, angle: number, len: number, droop: number, leaf: number, sway: number, isBack: boolean) {
  const steps = Math.ceil(len * 2.5)
  const dim = isBack ? 1 : 0
  for (let i = steps; i >= 0; i--) {
    const s = i / steps
    const a = angle + sway * s
    const rx = cx + Math.cos(a) * len * s
    const ry = cy + Math.sin(a) * len * s + droop * len * s * s
    let tx = Math.cos(a)
    let ty = Math.sin(a) + 2 * droop * s
    const tl = Math.hypot(tx, ty)
    tx /= tl
    ty /= tl
    if (s > 0.08) {
      const l = leaf * Math.sin(Math.PI * Math.min(1, s * 1.1)) ** 0.6 * (i % 3 === 0 ? 1 : 0.8)
      const lx = tx * 0.55
      const ll = Math.hypot(lx, 1)
      for (let d = 0.5; d <= l; d += 0.5) {
        c.set(rx + (lx / ll) * d, ry + d / ll, FROND[d < l * 0.55 ? 3 - dim : 2 - dim] ?? 0)
      }
    }
    c.set(rx, ry, FROND[s < 0.7 ? 5 - dim : 4 - dim] ?? 0)
  }
}

type HatPose = { dx: number; dy: number; tilt: number; flick: number }

function hatPose(f: number): HatPose {
  if (f < 30) return { dx: 0, dy: 0, tilt: 0, flick: 0 }
  if (f < 38) return { dx: 0, dy: 0, tilt: 0, flick: f === 31 || f === 34 || f === 36 || f === 37 ? 1 : 0 }
  if (f < 47) {
    const t = smoothstep(38, 45, f)
    return { dx: -Math.round(t * 3), dy: -Math.round(t * 7), tilt: 0.3 * Math.sin((f - 38) * 0.9), flick: 0 }
  }
  if (f < 56) {
    const dy = [-7, -6.5, -5.5, -4, -2, 0, -1, -1, 0][f - 47] ?? 0
    return { dx: -Math.round((-dy / 7) * 3), dy: Math.round(dy), tilt: 0.15 * (-dy / 7), flick: 0 }
  }

  return { dx: 0, dy: 0, tilt: 0, flick: 0 }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const sw = swing(f)
    const wind = gust(f)

    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, 0.3 + (y / (HORIZON - 1)) * 4.9))
    }
    const puffs: [number, number, number, number][] = [
      [19, 9, 6, 2.6], [25, 8, 4.5, 3.4], [30, 9.5, 4, 2], [40, 9.5, 4, 1.8], [44, 8.4, 3.5, 2.6], [48, 10, 4, 1.6],
    ]
    for (let y = 4; y < HORIZON; y++) {
      for (let x = 10; x < 58; x++) {
        let top = 99
        for (const [px, py, rx, ry] of puffs) {
          const d = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2
          if (d <= 1) top = Math.min(top, y - (py - ry * Math.sqrt(Math.max(0, 1 - ((x - px) / rx) ** 2))))
        }
        if (top === 99) continue
        c.set(x, y, shade(CLOUD, 3 - top * 0.55 + (x > 26 ? 0.3 : 0) - (y >= HORIZON - 2 ? 0.8 : 0)))
      }
    }

    const gx = Math.round(70 - (f / LOOP) * 80)
    const gy = 2 + Math.round(wave(f, LOOP, 2) * 0.6)
    const flap = Math.floor(f / 3) % 4
    const wings = flap === 0 ? ['l...l', '.lbl.'] : flap === 2 ? ['.....', '.lbl.', 'l...l'] : ['.....', 'llbll']
    c.sprite(gx, gy, wings, { l: GULL[1] ?? 0, b: GULL[2] ?? 0 })

    for (let y = HORIZON; y < SHORE + 4; y++) {
      const d = (y - HORIZON) / (SHORE - HORIZON)
      for (let x = 0; x < W; x++) c.set(x, y, shade(SEA, 0.6 + d * 3.6))
    }
    c.rect(0, HORIZON, W, 1, SEA[0] ?? 0)
    for (let k = 0; k < 3; k++) {
      const p = (k / 3 + f / LOOP) % 1
      const y = Math.round(HORIZON + 1 + p ** 1.4 * (SHORE - HORIZON - 1.5))
      for (let x = 0; x < W; x++) {
        if (noise(x * 0.09 + k * 9.3, k * 3.1) < 0.6 - p * 0.35 + smoothstep(0.8, 1, p) * 0.8) continue
        c.set(x, y, shade(SEA, 1.6 + p * 4.4))
        if (p > 0.4) c.set(x, y + 1, shade(SEA, 0.8 + p * 2.6))
      }
    }
    for (let i = 0; i < 5; i++) {
      const life = Math.floor((f + i * 12) / 6)
      const gxs = Math.floor(hash(i, life) * 58) + 3
      const gys = HORIZON + 1 + Math.floor(hash(i, life, 7) * 4)
      if ((f + i * 12) % 6 < 3) c.set(gxs, gys, 0xeafcff)
    }

    const wash = (f % 24) / 24
    const strength = [1, 0.7, 0.85][Math.floor(f / 24)] ?? 1
    const reach = (wash < 0.3 ? ease.out(wash / 0.3) : 1 - smoothstep(0.3, 1, wash)) * strength
    for (let y = SHORE; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wob = Math.sin(x * 0.21 + 1.3) * 0.7 + Math.sin(x * 0.47) * 0.4
        const front = SHORE + 0.3 + reach * 3.2 + wob * (0.4 + reach * 0.6)
        const wetLine = SHORE + 0.6 + 3.2 + wob
        if (y < front - 0.8) c.set(x, y, shade(SEA, 5.2 + (y - SHORE) * 0.3))
        else if (y < front + 0.2) c.set(x, y, FOAM)
        else if (y < wetLine) c.set(x, y, shade(SAND, 2.8 + (y - SHORE) * 0.2))
        else c.set(x, y, shade(SAND, 4.1 - (y > 28 ? 0.4 : 0)))
      }
    }
    for (const [x, y] of [[3, 30], [6, 28], [8, 30], [11, 27], [58, 29], [61, 31]] as const) {
      c.set(x, y, SAND[3] ?? 0)
      c.set(x + 1, y, SAND[3] ?? 0)
    }

    const shadowX = 28 + sw * 1.6
    for (let y = 25; y < 31; y++) {
      for (let x = 10; x < 48; x++) {
        const d = ((x - shadowX) / 13) ** 2 + ((y - 27.6) / 1.6) ** 2
        if (d < 1) c.set(x, y, mix(c.get(x, y), 0x6a5a72, 0.4))
      }
    }

    for (const t of TRUNKS) {
      for (let y = H - 1; y >= CROWN_Y + 1; y--) {
        const s = (H - 1 - y) / (H - 1 - CROWN_Y)
        const cx = trunkX(t, s)
        const half = 1.7 - 0.6 * s
        const ring = (y + (t.base > 32 ? 1 : 0)) % 3 === 0
        const x0 = Math.round(cx - half)
        const x1 = Math.round(cx + half)
        for (let x = x0; x <= x1; x++) {
          const level = x === x1 ? 4 : x === x0 ? 1 : 2.6
          c.set(x, y, ring ? (x === x1 ? BARK[3] : BARK[1]) ?? 0 : shade(BARK, level))
        }
      }
    }
    const tieY = 12
    const anchors = TRUNKS.map(t => trunkX(t, (H - 1 - tieY) / (H - 1 - CROWN_Y)))
    for (const [i, ax] of anchors.entries()) {
      const ex = i === 0 ? X0 : X1
      const ey = lipY(f, ex)
      c.line(ax, tieY, ex, ey, ROPE[2] ?? 0)
      c.line(ax, tieY + 1, ex, ey + 1, ROPE[1] ?? 0)
      c.set(ax, tieY, ROPE[2] ?? 0)
      c.set(ax + (i === 0 ? -1 : 1), tieY, ROPE[1] ?? 0)
    }

    for (let x = X0 + 1; x < X1; x++) {
      const u = (x - X0) / (X1 - X0)
      const front = Math.round(lipY(f, x))
      const back = Math.round(lipY(f, x) - 2.6 * Math.sin(Math.PI * u) ** 0.8)
      for (let y = back + 1; y < front; y++) c.set(x, y, shade(INSIDE, 1 + (y - back) * 0.4))
      c.set(x, back, shade(STRIPES[0] ?? [], 1.2))
    }

    const bodyShift = Math.round(sw * 1.2)
    const cols = PERSON[0]?.length ?? 0
    for (let i = 0; i < cols; i++) {
      const x = PERSON_X + i + bodyShift
      const base = Math.round(lipY(f, x))
      let isTop = true
      for (let r = 0; r < PERSON.length; r++) {
        const ch = PERSON[r]?.[i] ?? '.'
        const paint = PERSON_PAINT[ch]
        if (!paint) continue
        const [rampOf, level] = paint
        const toes = ch === 'f' && r === 0 && f >= 56 && f <= 63 && (f & 2) === 0 ? 1 : 0
        c.set(x, base - PERSON.length + r - toes, shade(rampOf, level + (isTop ? 1 : 0)))
        isTop = false
      }
    }
    const headX = HEAD_X + bodyShift
    const headY = Math.round(lipY(f, headX)) - 2
    const isPeek = f >= 42 && f <= 47
    c.set(headX, headY, isPeek ? 0xffffff : SKIN[0] ?? 0)
    if (isPeek) c.set(headX + 1, headY, HAIR[0] ?? 0)

    for (let x = X0; x <= X1; x++) {
      const top = Math.round(lipY(f, x))
      const th = Math.round(thickness(x))
      for (let j = 0; j < th; j++) {
        const stripe = STRIPES[Math.min(2, Math.floor((j / th) * 3))] ?? []
        const lip = j === 0 ? 1 : 0
        const under = j === th - 1 && th > 2 ? -0.7 : 0
        const lit = (x - X0) / (X1 - X0) > 0.55 ? 0.4 : 0
        c.set(x, top + j, shade(stripe, 1.2 + lip + under + lit))
      }
    }

    const shoulder = SHOULDER + bodyShift
    const hand = Math.round(shoulder + 1 + wave(f, LOOP, 1, -0.1) * 2.4)
    const sy = Math.round(lipY(f, shoulder)) - 1
    c.line(shoulder, sy, hand, 23, SKIN[2] ?? 0)
    c.line(shoulder + 1, sy, hand + 1, 22, SKIN[3] ?? 0)
    c.set(hand, 24, SKIN[3] ?? 0)
    c.set(hand + 1, 24, SKIN[4] ?? 0)
    c.set(hand + 1, 25, SKIN[2] ?? 0)

    c.line(DRINK_X - 5, 30, DRINK_X + 1, 30, mix(SAND[4] ?? 0, 0x5a4a5a, 0.4))
    c.line(DRINK_X - 4, 31, DRINK_X + 2, 31, mix(SAND[3] ?? 0, 0x5a4a5a, 0.3))
    for (let y = 25; y <= 30; y++) {
      for (let x = DRINK_X - 3; x <= DRINK_X + 3; x++) {
        const d = ((x - DRINK_X) / 3.3) ** 2 + ((y - 27.8) / 2.9) ** 2
        if (d > 1) continue
        if (y === 25) c.set(x, y, shade(FLESH, x > DRINK_X ? 1 : 0))
        else c.set(x, y, shade(COCO, x >= DRINK_X + 2 ? 4 : x >= DRINK_X ? 3 : x >= DRINK_X - 2 ? 2 : 1))
      }
    }
    c.set(DRINK_X + 1, 26, COCO[4] ?? 0)
    c.line(DRINK_X + 1, 24, DRINK_X + 2, 21, PINK[1] ?? 0)
    c.set(DRINK_X + 3, 20, PINK[1] ?? 0)
    c.line(DRINK_X - 1, 24, DRINK_X - 2, 21, FLESH[0] ?? 0)
    c.sprite(DRINK_X - 4, 19, ['.ppp.', 'ppppp'], { p: (x: number) => shade(PINK, x > DRINK_X - 3 ? 1.4 : 0.4) })

    const hat = hatPose(f)
    const hx = headX - 4 + hat.dx
    const hy = headY - 3 + hat.dy
    for (let r = 0; r < HAT_ART.length; r++) {
      const row = HAT_ART[r] ?? ''
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        if (ch === '.') continue
        const tiltY = Math.round(hat.tilt * (i - 4.5))
        const flick = ch === 'r' && (i === 0 || i === 9) ? hat.flick : 0
        const paint =
          ch === 'b' ? shade(BAND, i > 5 ? 1 : 0)
          : ch === 'r' ? shade(HAT, 2.6 + (i > 4 ? 0.7 : 0))
          : ch === 'o' ? shade(HAT, 4)
          : shade(HAT, 2.2 + (r === 0 ? 1 : 0) + (i > 5 ? 0.7 : 0))
        c.set(hx + i, hy + r + tiltY - flick, paint)
      }
    }

    for (const [ti, t] of TRUNKS.entries()) {
      const cx = trunkX(t, 1)
      const flip = ti === 0 ? 1 : -1
      for (const [fi, [a, len, droop, leaf]] of FRONDS.entries()) {
        const angle = flip > 0 ? a : Math.PI - a
        const calm = wave(f, LOOP, 2, fi * 0.17 + ti * 0.4) * 0.05
        const toss = -wind * (0.16 + 0.1 * Math.sin(f * 1.1 + fi * 1.7))
        frond(c, cx, CROWN_Y, angle, len, droop, leaf, (calm + toss) * flip, fi < 2)
      }
      for (const [dx, dy] of [[-1, 1], [1, 1], [0, 2]] as const) {
        c.set(cx + dx * flip, CROWN_Y + dy, shade(COCO, dx === 1 ? 3 : 1.6))
      }
    }
  })
}

export const scene: Scene = { verb: 'Lollygagging', render, hero: 44 }
