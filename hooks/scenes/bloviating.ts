import { Canvas, TAU, beat, clamp, ease, hash, hex, lerp, mix, mod, shade, wave, type Paint, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const CURTAIN = hex('16060e 260914 3c0d1b 581322 7a1c2b a02a35 c4433f e2684e')
const GOLD = hex('3a2208 6a4410 a07020 cfa040 f0d070 fff0b0')
const FLOOR = hex('1a0e0c 2c1810 44261a 603620 7e4a2a a06438 c88a4e')
const SUIT = hex('0e0b18 181428 241e3c 342c54 483e70')
const SKIN = hex('5c2424 96403a c86c56 e8987a f8c4a0')
const FLUSH = hex('5c1a1e 962c2e c84a44 e8705e f89a80')
const WHITE = hex('9c9aa6 d8d6dc f6f4f0')
const BRASS = hex('3a2408 6e4812 a87a24 d8aa44 f6dc86 fffbe0')
const WOOD = hex('1c0e0a 301a10 4a2a18 683e22 8a542e ad6e3c')
const PAPER = hex('8a7c6c c4b49c ece0c8 fffaee')
const INK = 0x2a1620
const CROWD = hex('07040a 0f0912 18101e 22172a')
const RIM = hex('3e1820 6a2c32 98463c c46a4a e89a68')
const HAT = hex('0c0a10 1a1620 2c2632 443c4a')

function puff(f: number): number {
  const breath = (a: number, b: number, c: number, size: number) =>
    size * (ease.inOut(beat(f, a, b)) - ease.out(beat(f, b, c)))
  return Math.max(0, breath(0, 6, 10, 0.45) + breath(16, 21, 25, 0.6) + breath(31, 40, 56, 1))
}

const MOUTH_STEP = [7, 22, 40]

function pose(f: number) {
  const p = puff(f)
  const lunge = MOUTH_STEP.reduce((s, b) => s + Math.max(0, 1 - Math.abs(f - b - 1) / 3), 0)
  const cx = 9 + lunge * 0.8
  const cy = 14 - p * 0.8
  const hx = cx + 2.4 + lunge * 0.4
  const nod = (f >= 62 && f < 64) || (f >= 66 && f < 68) ? 1 : 0
  const hy = 6.2 - p * 0.9 + nod
  const tilt = -0.2 - p * 0.22 + lunge * 0.1
  return { p, cx, cy, hx, hy, tilt, lunge }
}

function bell(f: number): [number, number] {
  const { hx, hy, tilt } = pose(f)
  return [hx + 3.4 + Math.cos(tilt) * 7, hy + 1.2 + Math.sin(tilt) * 7]
}

type Balloon = { cx: number; cy: number; rx: number; ry: number; scale: number; tail: [number, number] }

const BLURT = [0, 0.22, 0.32, 0.43, 0.55, 0.67, 0.78, 0.87, 0.94, 0.98, 1]

function balloons(f: number): Balloon[] {
  const out: Balloon[] = []
  for (const [born, rx, ry, dx, dy] of [[7, 5, 3.4, 6, 3], [22, 7.5, 4.8, 9, 5]] as const) {
    const t = f - born
    if (t < 0 || t > 34) continue
    const s = BLURT[t] ?? 1
    const m = bell(born)
    const cx = m[0] + dx * s + t * 0.6
    const cy = m[1] + dy * s - Math.max(0, t - 6) ** 1.6 * 0.12
    out.push({ cx, cy, rx: rx * s, ry: ry * s, scale: 1, tail: [m[0] + 1.5, m[1] + 0.5] })
  }
  const t = f - 40
  if (t >= 0 && f < 56) {
    const s = ease.inOut(beat(f, 40, 55))
    const strain = f >= 50 ? Math.sin(f * 2.6) * 0.6 : 0
    const m = bell(f)
    out.push({
      cx: lerp(m[0] + 4, 39, s), cy: lerp(m[1] + 1, 13.5, s),
      rx: 3 + 16 * s + strain, ry: 2 + 8.6 * s - strain * 0.5, scale: 2, tail: [m[0] + 1, m[1] + 0.5],
    })
  }
  return out
}

function drawBalloon(c: Canvas, b: Balloon) {
  const mask = new Set<number>()
  const inside = (x: number, y: number) => {
    const nx = Math.abs(x - b.cx) / Math.max(0.5, b.rx)
    const ny = Math.abs(y - b.cy) / Math.max(0.5, b.ry)
    return nx ** 2.4 + ny ** 2.4 <= 1
  }
  for (let y = Math.floor(b.cy - b.ry - 1); y <= Math.ceil(b.cy + b.ry + 1); y++) {
    for (let x = Math.floor(b.cx - b.rx - 1); x <= Math.ceil(b.cx + b.rx + 1); x++) if (inside(x, y)) mask.add(y * W + x)
  }
  const ang = Math.atan2(b.tail[1] - b.cy, b.tail[0] - b.cx)
  const ex = b.cx + Math.cos(ang) * b.rx * 0.7
  const ey = b.cy + Math.sin(ang) * b.ry * 0.7
  const px = -Math.sin(ang)
  const py = Math.cos(ang)
  const half = Math.min(2.2, b.ry * 0.45)
  const tip: [number, number] = [b.tail[0] + 1.5, b.tail[1]]
  const tri: [number, number][] = [[ex + px * half, ey + py * half], [ex - px * half, ey - py * half], tip]
  const cross = (a: [number, number], o: [number, number], p: [number, number]) => (o[0] - a[0]) * (p[1] - a[1]) - (o[1] - a[1]) * (p[0] - a[0])
  const minX = Math.floor(Math.min(...tri.map(p => p[0])))
  const maxX = Math.ceil(Math.max(...tri.map(p => p[0])))
  const minY = Math.floor(Math.min(...tri.map(p => p[1])))
  const maxY = Math.ceil(Math.max(...tri.map(p => p[1])))
  const [t0, t1, t2] = tri as [[number, number], [number, number], [number, number]]
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p: [number, number] = [x, y]
      const a = cross(t0, t1, p)
      const bb = cross(t1, t2, p)
      const cc = cross(t2, t0, p)
      if ((a >= 0 && bb >= 0 && cc >= 0) || (a <= 0 && bb <= 0 && cc <= 0)) mask.add(y * W + x)
    }
  }
  for (const key of mask) {
    const x = key % W
    const y = Math.floor(key / W)
    const edge = !mask.has(key - 1) || !mask.has(key + 1) || !mask.has(key - W) || !mask.has(key + W)
    if (edge) {
      c.set(x, y, INK)
      continue
    }
    const u = (x - b.cx) / Math.max(1, b.rx) + (y - b.cy) / Math.max(1, b.ry)
    c.set(x, y, shade(PAPER, u > 0.95 ? 1 : u < -0.9 ? 3 : 2, x, y))
  }
  const s = b.scale
  const rows = Math.max(1, Math.floor((b.ry * 1.4) / (3 * s)))
  const wavy = s === 1 ? [0, -1, 0, 0] : [0, 0, -1, -2, -2, -1, 0, 0]
  for (let r = 0; r < rows; r++) {
    const y0 = Math.round(b.cy - ((rows - 1) * 3 * s) / 2 + r * 3 * s)
    const reach = b.rx * Math.sqrt(Math.max(0, 1 - ((y0 - b.cy) / b.ry) ** 2)) * 0.66
    let gap = 0
    for (let x = Math.round(b.cx - reach); x <= Math.round(b.cx + reach); x++) {
      const local = x - Math.round(b.cx - reach)
      if (gap > 0) {
        gap--
        continue
      }
      if (local > 2 && hash(x, r, s) < 0.16 / s) {
        gap = s
        continue
      }
      const dy = wavy[mod(x, wavy.length)] ?? 0
      for (let t = 0; t < s; t++) {
        const key = (y0 + dy + t) * W + x
        if (mask.has(key) && mask.has(key - W) && mask.has(key + W) && mask.has(key + 1) && mask.has(key - 1)) {
          c.set(x, y0 + dy + t, shade(PAPER, 0.2, 0, 0))
        }
      }
    }
  }
}

function stamp(c: Canvas, cx: number, cy: number, art: readonly string[], pal: Readonly<Record<string, Paint>>, angle: number) {
  const h = art.length
  const w = art[0]?.length ?? 0
  const ox = (w - 1) / 2
  const oy = (h - 1) / 2
  const R = Math.ceil(Math.hypot(w, h) / 2) + 1
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const px = Math.round(cx) + x
      const py = Math.round(cy) + y
      const dx = px - cx
      const dy = py - cy
      const ch = art[Math.round(-dx * sin + dy * cos + oy)]?.[Math.round(dx * cos + dy * sin + ox)]
      const paint = ch === undefined ? undefined : pal[ch]
      if (paint !== undefined) c.set(px, py, paint)
    }
  }
}

const HATS: readonly (readonly string[])[] = [
  ['.lkk.', 'lkkkd', 'bbbbb'],
  ['.lkk.', '.lkd.', '.lkd.', '.rrr.', 'bbbbb'],
  ['.lrrr.', 'lbbbbb'],
  ['.lkk.', 'lkkkd', 'bbbbb'],
]

type Person = { x: number; y: number; hat: number; phase: number }
const CROWD_ROW: Person[] = [
  { x: 35, y: 26, hat: 0, phase: 0 },
  { x: 43, y: 25, hat: 1, phase: 1.7 },
  { x: 51, y: 26, hat: 2, phase: 3.1 },
  { x: 59, y: 25.5, hat: 3, phase: 4.4 },
]

const POP = 56

function press(f: number, x: number): number {
  if (f < 40 || f >= POP) return 0
  const big = balloons(f).find(b => b.scale === 2)
  if (!big) return 0
  return clamp(((big.cx + big.rx) - (x - 3)) * 0.45, 0, 3.2)
}

const LAUNCH: (number | undefined)[] = [51, 53, 55, undefined]
const FLIGHT = 15

function lean(f: number, p: Person): number {
  if (f < POP) return press(f, p.x)
  const peak = press(POP - 1, p.x)
  return peak * (1 - ease.outElastic(beat(f, POP, POP + 9)))
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const { p, cx, cy, hx, hy, tilt } = pose(f)
    const flash = f === POP ? 1 : f === POP + 1 ? 0.5 : 0
    const big = balloons(f).find(b => b.scale === 2)
    const glow = big ? clamp((big.rx - 6) / 12) * 0.8 : 0

    const spot = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x - 12) / 15, (y - 11) / 13)) ** 1.2 * 1.6

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < W; x++) {
        const fold = Math.sin(x * 0.95 + Math.sin(y * 0.15) * 0.6)
        const level = 1.6 + fold * 0.9 + spot(x, y) * 3.2 + flash * 1.2 + glow * 0.6 * Math.max(0, 1 - Math.abs(x - 40) / 30)
        c.set(x, y, shade(CURTAIN, level, x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      const scallop = 2 + Math.round(Math.abs(Math.sin((x * Math.PI) / 8)) * 1.6)
      for (let y = 0; y <= scallop; y++) {
        const isFringe = y === scallop
        c.set(x, y, shade(isFringe ? GOLD : CURTAIN, isFringe ? 3 + spot(x, y) * 1.5 : 3.6 + spot(x, y) * 2 - y * 0.6, x, y))
      }
      if (x % 8 === 4) c.set(x, scallop + 1, shade(GOLD, 3.6 + spot(x, 0), x, 0))
    }
    for (let y = 22; y < 26; y++) {
      for (let x = 0; x < W; x++) {
        const seam = mod(x + (y % 2) * 5, 11) === 0
        c.set(x, y, shade(FLOOR, 2 + (y - 22) * 0.5 + spot(x, y + 3) * 3.4 - (seam ? 1 : 0) + flash, x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      c.set(x, 26, shade(GOLD, 2.6 + spot(x, 20) * 2, x, 26))
      for (let y = 27; y < H; y++) c.set(x, y, shade(CURTAIN, 0.6 - (y - 27) * 0.2, x, y))
    }

    const lit = (x: number, y: number) => spot(x, y) * 1.4 + flash
    for (let y = Math.round(cy + 3); y <= 24; y++) {
      for (const lx of [6, 7, 9, 10]) c.set(lx, y, shade(SUIT, (lx === 6 || lx === 9 ? 1.6 : 0.8) + lit(lx, y) * 0.5, lx, y))
    }
    c.set(5, 24, SUIT[0] ?? 0)
    c.set(8, 24, SUIT[0] ?? 0)
    const rx = 5 + p * 1.6
    const ry = 5.6 + p * 0.5
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx
        const ny = (y - cy) / ry
        if (nx * nx + ny * ny > 1) continue
        const shirt = nx > 0.42 && nx < 0.86 && ny > -0.85 && ny < 0.3
        const level = 2 - nx * 0.6 - ny * 0.9 + lit(x, y) - (nx > 0.88 ? 0.6 : 0)
        c.set(x, y, shirt ? shade(WHITE, 1.6 + lit(x, y) * 0.5 - (nx > 0.75 ? 0.8 : 0), x, y) : shade(SUIT, level, x, y))
      }
    }
    const tieX = Math.round(cx + rx * 0.62)
    const tieY = Math.round(cy - ry * 0.78)
    c.set(tieX - 1, tieY, 0xb02a2a)
    c.set(tieX, tieY, 0x7a1820)
    c.set(tieX + 1, tieY, 0xb02a2a)
    for (let x = Math.round(cx - rx * 0.5); x <= Math.round(cx + rx * 0.3); x++) {
      const y = Math.round(cy + 1 + Math.sin(((x - cx + rx * 0.5) / (rx * 0.8)) * Math.PI) * 1.2)
      if ((x & 1) === 0) c.set(x, y, shade(GOLD, 4, x, y))
    }

    const face = (level: number) => mix(shade(SKIN, level, 0, 0), shade(FLUSH, level, 0, 0), Math.round(clamp(p) * 3) / 3)
    for (let y = Math.floor(hy - 3.4); y <= Math.ceil(hy + 3.4); y++) {
      for (let x = Math.floor(hx - 3.2); x <= Math.ceil(hx + 3.2); x++) {
        const nx = (x - hx) / 3
        const ny = (y - hy) / 3.3
        if (nx * nx + ny * ny > 1) continue
        c.set(x, y, face(2.6 - nx * 0.5 - ny * 0.8 + lit(x, y) * 0.6))
      }
    }
    c.set(hx - 1, hy - 2, face(4.6))
    c.set(hx, hy - 3, face(4))
    for (const [dx, dy] of [[-3, 0], [-3, 1], [-2, 1], [-3, 2]] as const) c.set(hx + dx, hy + dy, WHITE[1] ?? 0)
    c.set(hx - 1, hy + 0, face(1.4))
    c.set(hx + 1, hy - 1, 0x1a0e14)
    const brow = Math.round(-p * 1.2)
    for (const dx of [0, 1, 2]) c.set(hx + dx, hy - 2 + brow, WHITE[dx === 2 ? 1 : 0] ?? 0)
    c.set(hx + 3, hy, face(2))
    c.set(hx + 3, hy - 1, face(3))

    const m0: [number, number] = [hx + 3.4, hy + 1.2]
    const ux = Math.cos(tilt)
    const uy = Math.sin(tilt)
    for (let t = 0; t <= 7; t += 0.25) {
      const r = 0.7 + t * 0.36
      for (let k = -r; k <= r; k += 0.35) {
        const x = m0[0] + ux * t - uy * k
        const y = m0[1] + uy * t + ux * k
        const side = k / r
        const level = t > 6.6 ? 4.4 : 3 - side * 1.6 + lit(x, y) * 0.4
        c.set(x, y, shade(BRASS, level, Math.round(x), Math.round(y)))
      }
    }
    for (const [dx, dy, w] of [[1, 1.2, 1], [2, 1.4, 1], [-0.2, 1.6, 0], [0.6, 1.8, 0]] as const) {
      c.set(hx + dx + 0.5, hy + dy + 0.6, WHITE[w + 1] ?? 0)
    }
    const hand: [number, number] = [m0[0] + ux * 2.5 - uy * 1.6, m0[1] + uy * 2.5 + ux * 1.6]
    c.line(cx + rx * 0.4, cy - ry * 0.4, hand[0] - 1, hand[1] + 1, shade(SUIT, 2.6, 0, 0))
    c.set(hand[0], hand[1], face(3))
    c.set(hand[0] - 1, hand[1], face(2))

    for (let y = 15; y <= 25; y++) {
      for (let x = 12; x <= 20; x++) {
        const top = y <= 16
        const inset = x >= 14 && x <= 18 && y >= 18 && y <= 23
        const level = top ? 4.2 : 2.2 + (x === 12 ? 1 : 0) - (x === 20 ? 0.8 : 0) + (inset ? -0.8 : 0) + (inset && y === 18 ? -0.6 : 0)
        c.set(x, y, shade(WOOD, level + lit(x, y) * 0.8, x, y))
      }
    }
    c.set(11, 15, shade(WOOD, 4 + lit(11, 15), 0, 0))
    c.set(21, 15, shade(WOOD, 3, 0, 0))

    for (const b of balloons(f)) drawBalloon(c, b)
    if (f === POP) {
      for (let y = 2; y < 26; y++) {
        for (let x = 18; x < 62; x++) {
          const d = ((x - 39) / 20.5) ** 2 + ((y - 13.5) / 11.4) ** 2
          if (d <= 1) c.set(x, y, d > 0.8 ? PAPER[2] ?? 0 : 0xfffdf6)
        }
      }
    }
    if (f > POP && f < POP + 6) {
      const t = f - POP
      const R = 1 + t * 0.16
      for (let a = 0; a < 80; a++) {
        const th = (a / 80) * TAU
        const seg = Math.floor((th / TAU) * 12)
        if (seg % 2 === 1 || (a % 7) / 7 > 1 - t * 0.15) continue
        const x = 39 + Math.cos(th) * 19 * R
        const y = 13.5 + Math.sin(th) * 10.6 * R
        c.set(x, y, t < 2 ? PAPER[3] ?? 0 : t < 4 ? PAPER[1] ?? 0 : PAPER[0] ?? 0)
      }
      for (let k = 0; k < 9; k++) {
        const th = k * 0.7 + 0.3
        const d = 4 + t * 3.2 + (k % 3)
        const x = 39 + Math.cos(th) * d * 1.6
        const y = 13.5 + Math.sin(th) * d
        c.set(x, y, INK)
        c.set(x + 1, y + (k % 2 ? 1 : -1), INK)
      }
    }

    CROWD_ROW.forEach((person, i) => {
      const l = lean(f, person)
      const bob = Math.round(wave(f, LOOP, 2 + (i % 2), person.phase / TAU) * 0.6)
      const x = person.x + l
      const y = person.y + bob + Math.max(0, l) * 0.25
      const rim = 1.2 + glow * 1.6 + flash * 2
      for (let yy = Math.floor(y + 2); yy < H; yy++) {
        for (let xx = Math.floor(x - 6); xx <= Math.ceil(x + 6); xx++) {
          const nx = (xx - x - l * 0.3) / 5.2
          const ny = (yy - y - 6) / 4.4
          if (nx * nx + ny * ny > 1) continue
          const edge = nx < -0.7 || (ny < -0.75 && nx < 0)
          c.set(xx, yy, edge ? shade(RIM, rim - 0.6, xx, yy) : shade(CROWD, 1.2, xx, yy))
        }
      }
      for (let yy = Math.floor(y - 3); yy <= Math.ceil(y + 3); yy++) {
        for (let xx = Math.floor(x - 3); xx <= Math.ceil(x + 3); xx++) {
          const nx = (xx - x) / 2.7
          const ny = (yy - y) / 3.1
          if (nx * nx + ny * ny > 1) continue
          const edge = nx < -0.6
          c.set(xx, yy, edge ? shade(RIM, rim, xx, yy) : shade(CROWD, 2, xx, yy))
        }
      }
      c.set(x - 1, y, shade(RIM, rim - 0.4, 0, 0))

      const isStraw = person.hat === 2
      const pal: Record<string, number> = {
        k: shade(HAT, 1.6, 0, 0), d: HAT[0] ?? 0, l: shade(RIM, rim + 0.3, 0, 0), b: shade(HAT, 2.4, 0, 0),
        r: 0x8a2030,
      }
      if (isStraw) {
        pal.l = shade(GOLD, 4.4, 0, 0)
        pal.b = shade(GOLD, 2.8 + glow, 0, 0)
        pal.r = 0x7a1a2a
      }
      const art = HATS[person.hat] ?? []
      const launch = LAUNCH[i]
      const onHead: [number, number] = [x + 0.3, y - 3 - (art.length - 1) / 2]
      const t = launch === undefined ? -1 : f - launch
      if (launch !== undefined && t >= 0 && t < FLIGHT) {
        const g = 0.32
        const vy = (g * FLIGHT) / 2
        const from = person.x + 0.3 + press(launch, person.x)
        const to = person.x + 0.3
        const hx2 = lerp(from, to, t / FLIGHT) + 3 * Math.sin((Math.PI * t) / FLIGHT)
        const hy2 = person.y - 3 - (art.length - 1) / 2 - vy * t + (g / 2) * t * t
        stamp(c, hx2, hy2, art, pal, ((t / FLIGHT) * TAU * (i % 2 ? -1 : 1)))
      } else if (launch !== undefined && t >= FLIGHT && t < FLIGHT + 3) {
        stamp(c, onHead[0], onHead[1] + (t === FLIGHT ? 1 : 0), art, pal, 0)
      } else {
        stamp(c, onHead[0], onHead[1], art, pal, l * 0.12)
      }
    })

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Bloviating',
  render,
  hero: 54,
  snaps: [
    { frames: 46, box: [23, 6, 35, 11], colors: [...PAPER, INK], why: 'the last balloon swells fast as he bellows: its paper doubles in a frame' },
    { frames: 54, box: [34, 3, 44, 4], why: 'the balloon quivers with strain before it bursts, its top edge dropping a row for a frame' },
    { frames: [POP, POP + 2], why: 'the balloon bursts: it flashes white, the flash lights the whole stage and decays over two frames as the rags fly' },
  ],
}
