import { Canvas, beat, ease, hash, hex, lerp, mix, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const SKY = hex('86b1cd 9cc0d6 b3cdd9 c9d9d8 dde1d0 ede4c4 f8eac0')
const HEDGE = hex('5d7a62 6e8b6c 82a077 98b383 b0c592')
const VINE = hex('14231c 1d3326 2a4630 3d5e3a')
const TRUMPET = hex('5a1e12 8e3418 c4561e e88432 f8b45a')
const GREEN = hex('0d241d 163a2c 1f5136 2c6a40 3f874a 63a656 9cc86c')
const BELLY = hex('7d8580 a8afa6 cfd3c6 eeeee2')
const GORGET = hex('260812 4c0c1c 7c1226 b01c34 e03a46 ff7a6a ffc0a0')
const RED = hex('3e0b12 6a121c 961c26 c0302c e2523c f4805c')
const PETAL = hex('8a5410 cc9220 f2cc48 fff0a0')
const NECTAR = hex('5a0c26 8a1634 b82644 e04a5a f47c84 fcb4ac')
const GLASS = hex('6f8c96 a9c2c6 dbe8e4 ffffff')
const WING = 0x5d6d6a
const VEIL = hex('4e5c5a 66746f 808e88 9aa8a2 b6c2bc d0dad4 e8eeea f8faf6')
const veil = (under: number, lift: number) => {
  const lum = (((under >> 16) & 255) * 0.3 + ((under >> 8) & 255) * 0.59 + (under & 255) * 0.11) / 255
  return shade(VEIL, lum * 7.4 - 0.6 + lift)
}
const BEAK = 0x231e1c

const SUN = { x: -2, y: -4 }

const skyAt = (x: number, y: number) => {
  const d = Math.hypot(x - SUN.x, (y - SUN.y) * 1.25)
  return shade(SKY, (y / 26) * 2.6 + Math.max(0, 1 - d / 44) ** 1.4 * 3.6, x, y)
}
const CLUMPS: [number, number, number, number][] = (() => {
  const list: [number, number, number, number][] = []
  for (let k = 0; k < 11; k++) list.push([-4 + k * 7 + hash(k, 1) * 3, 21 + hash(k, 2) * 2.5, 4.5 + hash(k, 3) * 2.5, 3.1])
  for (let k = 0; k < 9; k++) list.push([-2 + k * 8.5 + hash(k, 4) * 3, 27.5 + hash(k, 5) * 1.5, 5 + hash(k, 6) * 2.5, 1.8])
  return list
})()
const BOKEH: [number, number, number, number][] = [
  [5.5, 27.5, 2.1, 0xc9d59e], [14.5, 29.5, 1.9, 0xe9b8b2], [31.5, 28.5, 2.6, 0xc9d59e], [24.5, 24.5, 1.9, 0xd8dca6],
  [38.5, 25.5, 1.9, 0xf0c48e], [58.5, 26.5, 2.6, 0xe9b8b2], [62.5, 22.5, 1.9, 0xd8dca6],
  [20.5, 6.5, 2.6, 0xf4ead0], [34.5, 3.5, 1.9, 0xf0e8d2],
]

const BACKDROP: Int32Array = (() => {
  const c = new Canvas()
  c.fill(skyAt)
  for (const [cx, cy, r, base] of CLUMPS) {
    c.disc(cx, cy, r, (x, y) => shade(HEDGE, base - (((x - cx) * 0.6 + (y - cy) * 0.8) / r) * 1.3, x, y))
  }
  for (const [bx, by, r, col] of BOKEH) {
    const under = by < 12 ? (SKY[3] ?? 0) : (HEDGE[2] ?? 0)
    c.disc(bx, by, r, (x, y) => mix(under, col, Math.hypot(x - bx, y - by) / r > 0.72 ? 0.7 : 0.45))
  }

  c.line(49, 0, 49, 2, 0x3a3434)
  c.set(48, 2, 0x5a5250)
  const isBottle = (x: number, y: number) =>
    (y === 3 && x >= 46 && x <= 52) || (y >= 4 && y <= 12 && x >= 45 && x <= 53) ||
    (y === 13 && x >= 46 && x <= 52) || (y === 14 && x >= 47 && x <= 51) || (y >= 15 && y <= 16 && x >= 48 && x <= 50)
  for (let y = 3; y <= 16; y++) {
    for (let x = 44; x <= 54; x++) {
      if (!isBottle(x, y)) continue
      const isEdge = !isBottle(x - 1, y) || !isBottle(x + 1, y) || !isBottle(x, y - 1)
      if (y < 6) {
        c.set(x, y, isEdge ? shade(GLASS, 1 + (x < 49 ? 1 : 0), x, y) : mix(c.get(x, y), 0xffffff, 0.3))
        continue
      }
      const lit = 2.4 + (53 - x) / 4 - (y - 6) * 0.12
      c.set(x, y, shade(NECTAR, isEdge ? lit - 1.6 : lit, x, y))
    }
  }
  for (let y = 4; y <= 11; y++) c.set(46, y, shade(GLASS, y < 6 ? 3 : 2, 46, y))
  c.set(52, 7, GLASS[2] ?? 0)
  c.set(52, 8, GLASS[1] ?? 0)
  for (let x = 40; x <= 58; x++) c.set(x, 17, shade(RED, 4.6 - (x - 40) * 0.09, x, 17))
  for (let y = 18; y <= 20; y++) {
    const x0 = y === 20 ? 41 : 40
    for (let x = x0; x <= 98 - x0; x++) c.set(x, y, shade(RED, 3.2 - (x - 40) * 0.08 - (y - 18) * 0.7 + (x === x0 ? 0.8 : 0), x, y))
  }
  for (let x = 43; x <= 55; x++) c.set(x, 21, RED[0] ?? 0)
  for (const fx of [43, 55]) {
    c.set(fx - 1, 16, PETAL[2] ?? 0)
    c.set(fx + 1, 16, PETAL[1] ?? 0)
    c.set(fx, 15, PETAL[3] ?? 0)
    c.set(fx, 16, PETAL[0] ?? 0)
  }

  c.line(0, 4, 4, 2, VINE[1] ?? 0)
  c.line(5, 2, 13, 1, VINE[1] ?? 0)
  c.line(14, 1, 17, 0, VINE[1] ?? 0)
  const leaf = (lx: number, ly: number, rx: number, ry: number) =>
    c.ellipse(lx, ly, rx, ry, (x, y) => shade(VINE, (y < ly ? 2 : 1) + (x < lx ? 0.6 : 0), x, y))
  leaf(2, 1, 2.5, 1.4)
  leaf(9, 3, 2, 1.2)
  leaf(16, 2, 2.2, 1.2)
  leaf(0, 7, 1.6, 2)
  for (const [tx, ty, len] of [[6, 3, 4], [12, 2, 3]] as const) {
    for (let k = 0; k < len; k++) c.set(tx, ty + k, shade(TRUMPET, 1 + k * 0.6, tx, ty + k))
    c.set(tx - 1, ty + len, TRUMPET[2] ?? 0)
    c.set(tx, ty + len, TRUMPET[4] ?? 0)
    c.set(tx + 1, ty + len, TRUMPET[3] ?? 0)
    c.set(tx - 1, ty + len + 1, TRUMPET[3] ?? 0)
    c.set(tx, ty + len + 1, TRUMPET[1] ?? 0)
    c.set(tx + 1, ty + len + 1, TRUMPET[3] ?? 0)
  }

  return c.copy()
})()

const BODY = [
  '......oooo......',
  '.....oGGGGo.....',
  '....oGGgwego....',
  '....oGggggdkKKKK',
  '...oGggggrRo....',
  '...oGgggrRRw....',
  '..oGgggggwws....',
  '..oggggdwwws....',
  '..odggdwwws.....',
  '...odddwss......',
]
const TAILS: Record<'down' | 'fan' | 'back', string[]> = {
  down: ['..ott.ss.', '.ott.....', 'ott......'],
  fan: ['.ottt.ss.', 'otttt....', 'tt.tt....', 't...t....'],
  back: ['ottt.ss..', 'ttt......', '.........'],
}
const SHOULDER = { x: 6, y: 3 }

type Pose = { x: number; y: number; tail: keyof typeof TAILS; flash: number }

const sine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

function pose(f: number): Pose {
  const home = { x: 18, y: 10 }
  const keys: [number, number, number, (t: number) => number][] = [
    [0, home.x, home.y, ease.inOut],
    [12, home.x, home.y, ease.inOut],
    [16, 16, 9, ease.inOut],
    [17, 16, 9, ease.inOut],
    [18, 19, 10, ease.inOut],
    [19, 22, 11, ease.inOut],
    [20, 25, 12, ease.inOut],
    [21, 27, 12.6, ease.inOut],
    [22, 28, 13, ease.inOut],
    [30, 28, 13, ease.inOut],
    [31, 25, 12, ease.inOut],
    [32, 22, 11, ease.inOut],
    [33, 19, 10, ease.inOut],
    [34, 16, 9, ease.inOut],
    [35, 13, 8.4, ease.inOut],
    [36, 11, 8, ease.inOut],
    [37, 10, 8, ease.inOut],
    [47, home.x, home.y, sine],
    [48, home.x, home.y, ease.inOut],
  ]
  let k = 0
  while (k < keys.length - 2 && f >= (keys[k + 1]?.[0] ?? 0)) k++
  const [f0, x0, y0] = keys[k] ?? [0, 0, 0]
  const [f1, x1, y1, curve] = keys[k + 1] ?? keys[k] ?? [0, 0, 0, ease.inOut]
  const t = curve(beat(f, f0, f1))
  const isHovering = f < 13 || f > 39
  const bob = isHovering ? Math.round(Math.sin(((f % 8) / 8) * Math.PI * 2) * 0.9) : 0
  const pump = f === 24 || f === 25 || f === 28 || f === 29 ? -1 : 0
  const tail = f >= 35 && f <= 38 ? 'fan' : (f >= 18 && f <= 21) || (f >= 31 && f <= 34) ? 'back' : 'down'
  const flash = f >= 20 && f <= 30 ? 0.5 + 0.5 * Math.sin((f - 20) * 0.9) : f === 31 ? 0.3 : 0

  return { x: Math.round(lerp(x0, x1, t)) + pump, y: Math.round(lerp(y0, y1, t)) + bob, tail, flash }
}

function wings(c: Canvas, p: Pose, f: number) {
  const sx = p.x + SHOULDER.x
  const sy = p.y + SHOULDER.y
  const len = 9
  for (let y = sy - len; y <= sy + 2; y++) {
    for (let x = sx - len; x <= sx + 4; x++) {
      const dx = x - sx
      const dy = y - sy
      const r = Math.hypot(dx, dy * 1.15)
      const a = Math.atan2(dy, dx)
      if (r > len || r < 1 || a > -1.0 || a < -2.9) continue
      c.set(x, y, veil(c.get(x, y), r > len - 1.3 ? 1 : -0.4))
    }
  }
  const stroke = (a: number, sink: number, glint: number) => {
    const tipX = sx + Math.cos(a) * (len - 0.5)
    const tipY = sy + (Math.sin(a) * (len - 0.5)) / 1.15
    c.line(sx, sy, tipX, tipY, (x, y) => veil(c.get(x, y), -sink))
    if (glint > 0) c.line(sx, sy - 1, tipX, tipY - 1, (x, y) => veil(c.get(x, y), glint))
  }
  stroke(-1.05, 1, 0)
  stroke(-2.85, 1, 0)
  const angles = [-1.25, -2.1, -2.65, -1.7]
  const a = angles[f % angles.length] ?? 0
  stroke(a, 3, a > -2.4 ? 1.2 : 0)
}

function bird(c: Canvas, p: Pose) {
  const paint: Record<string, number> = {
    o: GREEN[0] ?? 0, d: GREEN[2] ?? 0, g: GREEN[3] ?? 0, G: GREEN[5] ?? 0,
    e: 0x0a0809, k: BEAK, K: BEAK, t: GREEN[1] ?? 0,
    w: BELLY[3] ?? 0, s: BELLY[1] ?? 0,
    r: shade(GORGET, 1 + p.flash * 2.5), R: shade(GORGET, 1.5 + p.flash * 4.5),
  }
  c.sprite(p.x + 1, p.y + 9, TAILS[p.tail], paint)
  c.sprite(p.x, p.y, BODY, paint)
  c.set(p.x + 6, p.y + 1, GREEN[6] ?? 0)
  c.set(p.x + 7, p.y + 1, GREEN[6] ?? 0)
  c.set(p.x + 4, p.y + 4, GREEN[6] ?? 0)
  if (p.flash > 0.6) c.set(p.x + 10, p.y + 5, GORGET[6] ?? 0)
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  let prev = pose(LOOP - 1)
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.px.set(BACKDROP)
    const p = pose(f)

    for (const born of [22, 25, 28]) {
      const t = f - born
      if (t < 0 || t > 7) continue
      const y = 15 - t * 1.4
      if (y < 6) {
        if (y > 4.5) for (let x = 47; x <= 51; x++) c.set(x, 6, NECTAR[5] ?? 0)
        continue
      }
      const x = 49 + (t % 3 === 1 ? 1 : t % 3 === 2 ? -1 : 0)
      c.set(x, y, NECTAR[5] ?? 0)
      if (born === 22 && y < 12) c.set(x + 1, y, NECTAR[4] ?? 0)
    }

    const dx = p.x - prev.x
    if (Math.abs(dx) >= 3) {
      for (const row of [2, 5, 8]) {
        const y = p.y + row
        const from = dx > 0 ? prev.x + 4 : p.x + 12
        const to = dx > 0 ? p.x + 3 : prev.x + 14
        for (let x = Math.min(from, to); x <= Math.max(from, to); x++) {
          const fade = dx > 0 ? (x - from) / Math.max(1, to - from) : (to - x) / Math.max(1, to - from)
          c.set(x, y, veil(c.get(x, y), fade > 0.5 ? 1 : 0.3))
        }
      }
    }

    if (f >= 31 && f <= 37) {
      const t = f - 31
      c.set(42 - t * 0.8, 16 + t * t * 0.45, NECTAR[4] ?? 0)
    }

    for (let k = 0; k < 4; k++) {
      const a = (f / LOOP) * Math.PI * 2 + k * 1.7
      const x = 8 + k * 7 + Math.round(Math.sin(a) * 3)
      const y = 6 + ((k * 5) % 9) + Math.round(Math.cos(a + k) * 2)
      c.set(x, y, 0xf6eed8)
    }

    wings(c, p, f)
    bird(c, p)
    if (f === 23 || f === 24 || f === 27) {
      const gx = p.x + 10
      const gy = p.y + 5
      const arm = f === 24 ? 2 : 1
      c.set(gx, gy, 0xfff0ec)
      for (let k = 1; k <= arm; k++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(gx + dx * k, gy + dy * k, k === arm ? GORGET[6] ?? 0 : 0xfff0ec)
      }
    }
    out.push(c.copy())
    prev = p
  }

  return out
}

export const scene: Scene = { verb: 'Whirring', render, hero: 24 }
