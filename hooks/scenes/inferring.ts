import { Canvas, PALETTE, clamp, fract, frames, hex, mix, mod, noise, shade, smoothstep, threshold, wave, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const CORK = hex('180e0a 26160e 382214 4c301a 643f22 7e512c 9a6638')
const FRAME = PALETTE.wood
const PAPER = hex('2e2a26 545048 857e70 b4ab96 dcd2b8 f6efda')
const YELLOW = hex('3a3008 6a5810 a08a1c d0b834 ecd862 faf0a0')
const PINK = hex('3a1a26 683444 9a5866 c88290 e8b0b4 fadcd8')
const MAP = hex('16282a 223e3c 345a50 4e7a66 74a084 a6c8a8')
const PHOTO = hex('0c0c14 1a1a26 2c2c3c 444458 62627a 8a8aa0')
const STRING = hex('1c0408 3a080c 600e12 8c181a b82a24 e04a34 fa8a5a ffd0a0 fff6e6')
const DESK = hex('0c0608 180c0c 261410 381e14 4c2a1a')
const NIGHT = 0x3a5a9a
const GLOW = 0xe0402a

const GLOWN = [1, 2, 3].map((k) => {
  const t = (0.35 * k) / 3
  const by = new Map<number, number>([CORK, PAPER, PHOTO, YELLOW, PINK, MAP, STRING].flatMap((r) => r.map((col) => [col, mix(col, GLOW, t)] as [number, number])))
  return { by, all: [...new Set(by.values())], t }
})
const near = (cols: readonly number[], m: number) => {
  const d = (a: number) => Math.abs(((a >> 16) & 255) - ((m >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((m >> 8) & 255)) + Math.abs((a & 255) - (m & 255))
  return cols.reduce((best, k) => (d(k) < d(best) ? k : best))
}
const rampOf = new Map<number, Ramp>([CORK, PAPER, PHOTO, YELLOW, PINK, MAP, STRING, DESK, FRAME].flatMap((r) => r.map((col) => [col, r] as [number, Ramp])))
const lift = (col: number, light: number, t: number) => {
  const r = rampOf.get(col)
  return r ? near(r, mix(col, light, t)) : mix(col, light, t)
}
function glown(col: number, heat: number, x: number, y: number): number {
  const g = GLOWN[Math.min(3, Math.floor(heat * 3 + 1e-6) + (threshold(x, y) < fract(heat * 3 + 1e-6) ? 1 : 0)) - 1]
  if (!g) return col
  return g.by.get(col) ?? near(g.all, mix(col, GLOW, g.t))
}

type Item = { x: number; y: number; w: number; h: number; kind: 'portrait' | 'note' | 'car' | 'map' | 'paper' | 'suspect' | 'card' | 'house'; pin: [number, number] }

const ITEMS: Item[] = [
  { x: 6, y: 3, w: 9, h: 10, kind: 'portrait', pin: [10, 3] },
  { x: 21, y: 4, w: 7, h: 6, kind: 'note', pin: [24, 5] },
  { x: 35, y: 3, w: 10, h: 8, kind: 'car', pin: [39, 3] },
  { x: 49, y: 2, w: 10, h: 10, kind: 'map', pin: [53, 2] },
  { x: 4, y: 15, w: 10, h: 9, kind: 'paper', pin: [8, 15] },
  { x: 26, y: 13, w: 10, h: 11, kind: 'suspect', pin: [30, 13] },
  { x: 42, y: 15, w: 9, h: 7, kind: 'card', pin: [46, 16] },
  { x: 54, y: 16, w: 7, h: 8, kind: 'house', pin: [57, 16] },
]
const PIN = (i: number): [number, number] => ITEMS[i]?.pin ?? [0, 0]

const LINKS: [number, number][] = [[4, 0], [0, 1], [1, 2], [2, 6], [6, 7], [7, 3], [3, 5]]
const LEAVE = [4, 8, 12, 16, 20, 24, 28]
const LAND = [8, 12, 16, 20, 24, 28, 38]
const DONE = 39
const OFF = 58
const ON = 66

const progress = (k: number, f: number) => smoothstep(LEAVE[k] ?? 0, LAND[k] ?? 0, f)

function path(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = []
  const [dx, dy] = [Math.abs(x1 - x0), -Math.abs(y1 - y0)]
  const [sx, sy] = [x0 < x1 ? 1 : -1, y0 < y1 ? 1 : -1]
  let [x, y, err] = [x0, y0, dx + dy]
  for (;;) {
    out.push([x, y])
    if (x === x1 && y === y1) return out
    const e2 = 2 * err
    if (e2 >= dy) [err, x] = [err + dy, x + sx]
    if (e2 <= dx) [err, y] = [err + dx, y + sy]
  }
}
const PATHS = LINKS.map(([a, b]) => path(...PIN(a), ...PIN(b)))
const TO_SUSPECT = PATHS.map((_, k) => PATHS.slice(k + 1).reduce((n, pts) => n + pts.length - 1, 0))
const PIN_TO_SUSPECT = ITEMS.map((_, i) => {
  const k = LINKS.findIndex(([, b]) => b === i)
  return k >= 0 ? TO_SUSPECT[k] ?? 0 : (TO_SUSPECT[0] ?? 0) + (PATHS[0]?.length ?? 1) - 1
})

const REACHED = ITEMS.map((_, i) => (i === LINKS[0]?.[0] ? LEAVE[0] ?? 0 : LAND[LINKS.findIndex(([, b]) => b === i)] ?? -1))
function flareAt(i: number, f: number): number {
  const d = f - (REACHED[i] ?? -99)
  if (i === 5 && f >= DONE) return [3, 3, 3, 3, 2, 1][f - DONE] ?? 0
  return [1, 2, 3, 2, 1][d + 2] ?? 0
}
const flareHeat = (i: number, f: number) => (f > (REACHED[i] ?? 0) && !(i === 5 && f < DONE + 4) ? 0.6 : 1)

function lamp(f: number): number {
  if (f < OFF) return 1
  if (f < ON) return f === OFF ? 0.35 : 0
  return [0.6, 0, 0.9, 0.2, 1, 1][f - ON] ?? 1
}

const pool = (x: number, y: number) => clamp(1.25 - Math.hypot((x - 30) * 0.7, (y - 9) * 1.1) / 30)
const blinds = (x: number, y: number) => (mod(y * 1.6 - x * 0.55, 7) < 2.4 && x > 20 ? 1 : 0)

function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [d: number, t: number] {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / Math.max(1e-6, dx * dx + dy * dy))
  return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t]
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const on = lamp(f)
    const flash = (toSuspect: number) => (f >= DONE ? 1 - clamp(f - DONE - toSuspect / 32, 0, 5) / 5 : 0)
    const after = f >= DONE ? clamp((f - DONE) / 3) * (f < OFF ? 0.55 + wave(f, LOOP, 3) * 0.15 : Math.max(0, 1 - (f - OFF) / 7)) : 0
    const fadeOf = (k: number) => (f < OFF ? 1 : clamp(1 - (f - OFF) / (1.5 + k * 0.9)))
    const early = (k: number) => clamp(fadeOf(k) * 1.2 - 0.2)
    const hasWeb = f < ON
    const light = (x: number, y: number) => on * (pool(x, y) * 3 + 0.2) + blinds(x, y) * (0.35 + (1 - on) * 0.6)
    const night = (col: number, x: number, y: number) => (on < 0.5 && blinds(x, y) ? mix(col, NIGHT, 0.3) : col)
    const lit = (ramp: Ramp, base: number, x: number, y: number) => night(shade(ramp, base - 1.6 + light(x, y)), x, y)

    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < W; x++) {
        const isFrame = x <= 1 || x >= 62 || y === 0 || y >= 26
        if (isFrame) {
          const edge = y === 0 || x === 1 ? 1 : y === 27 || x === 62 ? -0.8 : 0
          c.set(x, y, lit(FRAME, 2.4 + edge, x, y))
          continue
        }
        const grain = noise(x / 2.5, y / 1.6, 0, 7) > 0.7 ? -0.8 : noise(x / 3, y / 2, 0, 8) > 0.74 ? 0.6 : 0
        c.set(x, y, lit(CORK, 2.5 + grain, x, y))
      }
    }

    for (const it of ITEMS) {
      for (let y = it.y + 1; y <= it.y + it.h; y++) c.set(it.x + it.w, y, lit(CORK, 0.6, it.x + it.w, y))
      for (let x = it.x + 1; x <= it.x + it.w; x++) c.set(x, it.y + it.h, lit(CORK, 0.6, x, it.y + it.h))
      drawItem(c, it, lit, f)
    }

    const toSuspect = (k: number, j: number) => (TO_SUSPECT[k] ?? 0) + (PATHS[k]?.length ?? 1) - 1 - j
    const segs: { ax: number; ay: number; bx: number; by: number; k: number; run: [number, number][] }[] = []
    if (hasWeb) {
      PATHS.forEach((pts, k) => {
        const p = progress(k, f)
        if (p <= 0 || fadeOf(k) <= 0) return
        const run = pts.slice(0, Math.round(p * (pts.length - 1)) + 1)
        const [[ax, ay], [bx, by]] = [run[0] ?? [0, 0], run[run.length - 1] ?? [0, 0]]
        segs.push({ ax, ay, bx, by, k, run })
      })
    }
    if (f >= DONE) {
      for (let y = 1; y < 26; y++) {
        for (let x = 2; x < 62; x++) {
          let g = 0
          for (const s of segs) {
            const [d, t] = toSegment(x, y, s.ax, s.ay, s.bx, s.by)
            if (d >= 2.2) continue
            const at = toSuspect(s.k, t * (s.run.length - 1))
            const heat = f >= OFF ? early(s.k) * 0.35 : Math.round(clamp(after * 0.9 + flash(at)) * 3) / 3
            g = Math.max(g, heat)
          }
          if (g > 0) c.set(x, y, glown(c.get(x, y), g, x, y))
        }
      }
    }
    if (on > 0.5) for (const s of segs) for (const [x, y] of s.run) c.set(x + 1, y + 1, lit(CORK, 0.2, x + 1, y + 1))
    for (const s of segs) {
      const glow = f < OFF ? Math.round(after * 4) / 2 : Math.round((4.4 * fadeOf(s.k) - 2.4) * 2) / 2
      s.run.forEach(([x, y], j) => c.set(x, y, shade(STRING, (on > 0.5 ? 4 : 2.6) + Math.round(light(x, y) * 0.8) / 2 + glow + flash(toSuspect(s.k, j)) * 4)))
    }

    const ring = f >= DONE && hasWeb && early(6) > 0 ? clamp((f - DONE + 1) / 6) : 0
    if (ring > 0) {
      const ink = 0.6 + early(6) * 4
      const [rx, ry, ox, oy] = [7.4, 7, 30.5, 18.2]
      const e = (x: number, y: number) => Math.hypot((x - ox) / rx, (y - oy) / ry)
      for (let y = 10; y < 27; y++) {
        for (let x = 22; x < 40; x++) {
          if (e(x, y) > 1 || (e(x + 1, y) <= 1 && e(x - 1, y) <= 1 && e(x, y + 1) <= 1 && e(x, y - 1) <= 1)) continue
          const sweep = mod(Math.atan2(y - oy, x - ox) + Math.PI / 2 + 0.3, Math.PI * 2) / (Math.PI * 2)
          if (sweep <= ring) c.set(x, y, shade(STRING, ink))
        }
      }
    }

    ITEMS.forEach((it, i) => {
      const [px, py] = it.pin
      const flare = hasWeb ? flareAt(i, f) : 0
      const warm = hasWeb && f >= (REACHED[i] ?? 0) ? (1.4 + after * 2 + flash(PIN_TO_SUSPECT[i] ?? 0) * 2) * fadeOf(Math.max(0, LINKS.findIndex(([, b]) => b === i))) : 0
      if (flare > 0) {
        for (let y = py - flare - 1; y <= py + flare + 1; y++) {
          for (let x = px - flare - 1; x <= px + flare + 1; x++) {
            const d = Math.hypot(x - px - 0.5, y - py - 0.5)
            if (d < flare + 0.6) c.set(x, y, lift(c.get(x, y), 0xffb070, (d < flare - 0.6 ? 0.55 : 0.3) * flareHeat(i, f)))
          }
        }
      }
      c.set(px + 1, py + 2, lit(CORK, 0.4, px + 1, py + 2))
      c.set(px + 2, py + 1, lit(CORK, 0.4, px + 2, py + 1))
      c.set(px, py, shade(STRING, 4.6 + warm + on * 0.6 + flare))
      c.set(px + 1, py, shade(STRING, 3.6 + warm + on * 0.4 + flare))
      c.set(px, py + 1, shade(STRING, 3.2 + warm + on * 0.4 + flare))
      c.set(px + 1, py + 1, shade(STRING, 2.2 + warm + flare))
      if (flare >= 3) c.set(px, py, 0xfff6e6)
    })

    for (let y = 28; y < H; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, night(shade(DESK, (y === 28 ? 3.4 : 1.6 - (y - 29) * 0.4) + on * pool(x, 20) * 1.2), x, y))
    }
    for (let y = 24; y <= 29; y++) {
      for (let x = 10; x <= 14; x++) {
        const isRim = y === 24
        c.set(x, y, shade(PAPER, (isRim ? 2.6 : 1.6) + on * (x === 10 ? 1.4 : x === 14 ? -0.4 : 0.6) - (y === 29 ? 0.6 : 0)))
      }
      if (y >= 25 && y <= 27) c.set(15, y, shade(PAPER, 1 + on * 0.4))
    }
    for (let x = 11; x <= 13; x++) c.set(x, 24, shade(DESK, 1))
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 5; j++) {
        const y = 23 - j - (mod(f * 0.5 + k * 5, 10) | 0) % 2
        const x = 12 + Math.round(Math.sin(j * 0.9 + f * 0.25 + k * 3) * 1.1)
        if ((j + k + Math.floor(f / 3)) % 3 === 0) continue
        c.tint(x, y, 0xe8dcc8, 0.18 + on * 0.12)
      }
    }
    const hat = ['......kkkkkkk......', '.....kkkkkkkkk.....', '.....kbbbbbbbk.....', '.kkkkkkkkkkkkkkkkk.', 'kkkkkkkkkkkkkkkkkkk']
    c.sprite(44, 25, hat, {
      k: (x, y) => night(shade(PHOTO, 1.6 + (y === 25 || y === 28 ? on * 1.4 : 0) + (x < 52 ? on * 0.6 : 0) - (y === 29 ? 0.8 : 0)), x, y),
      b: (x, y) => night(shade(STRING, 2 + on * 0.6), x, y),
    })
  })
}

function drawItem(c: Canvas, it: Item, lit: (r: Ramp, base: number, x: number, y: number) => number, f: number): void {
  const { x: x0, y: y0, w, h } = it
  const at = (fn: (i: number, j: number, x: number, y: number) => number | undefined) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const v = fn(i, j, x0 + i, y0 + j)
        if (v !== undefined) c.set(x0 + i, y0 + j, v)
      }
    }
  }
  const isBorder = (i: number, j: number, bottom = 1) => i === 0 || j === 0 || i === w - 1 || j >= h - bottom
  switch (it.kind) {
    case 'portrait':
    case 'suspect':
    case 'car':
    case 'house': {
      at((i, j, x, y) => (isBorder(i, j, it.kind === 'car' ? 1 : 2) ? lit(PAPER, 4.2, x, y) : lit(PHOTO, 0.6 + (j < h / 2 ? 0.5 : 0), x, y)))
      if (it.kind === 'portrait') {
        const cx = x0 + 4
        c.rect(cx - 1, y0 + 3, 3, 3, (x, y) => lit(PHOTO, 4.6 - (x > cx ? 0.8 : 0), x, y))
        c.rect(cx - 3, y0 + 6, 7, 2, (x, y) => lit(PHOTO, 3.8 - (x > cx ? 0.8 : 0), x, y))
        c.set(cx - 2, y0 + 6, lit(PHOTO, 2.2, cx - 2, y0 + 6))
        c.set(cx + 2, y0 + 6, lit(PHOTO, 2.2, cx + 2, y0 + 6))
      }
      if (it.kind === 'suspect') {
        at((i, j, x, y) => (isBorder(i, j, 2) ? undefined : lit(PHOTO, 4.4 - j * 0.15, x, y)))
        const fig = ['....kk....', '..kkkkkk..', '...kkkk...', '...kkkk...', '..kkkkkk..', '.kkkkkkkk.', '.kkkkkkkk.']
        fig.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === 'k' && i >= 1 && i <= w - 2) c.set(x0 + i, y0 + 2 + j, lit(PHOTO, 0.8 + (i < 4 ? 0.5 : 0), x0 + i, y0 + 2 + j))
        })
      }
      if (it.kind === 'car') {
        c.rect(x0 + 2, y0 + 3, 4, 1, (x, y) => lit(PHOTO, 4.2, x, y))
        c.rect(x0 + 1, y0 + 4, 8, 2, (x, y) => lit(PHOTO, 4.6 - (y === y0 + 5 ? 0.8 : 0), x, y))
        for (const wx of [x0 + 2, x0 + 7]) c.set(wx, y0 + 6, lit(PHOTO, 0.4, wx, y0 + 6))
      }
      if (it.kind === 'house') {
        c.rect(x0 + 2, y0 + 3, 3, 3, (x, y) => lit(PHOTO, 4.4, x, y))
        c.set(x0 + 3, y0 + 2, lit(PHOTO, 4.4, x0 + 3, y0 + 2))
        c.set(x0 + 3, y0 + 5, lit(YELLOW, 4.4, x0 + 3, y0 + 5))
      }
      break
    }
    case 'note':
      at((i, j, x, y) => lit(YELLOW, j === 0 ? 3.4 : 3.8 - (i === w - 1 ? 0.6 : 0), x, y))
      for (const j of [2, 3, 4]) for (let i = 1; i < w - 1; i++) if ((i + j * 2) % 5 !== 0 && !(j === 4 && i > 3)) c.set(x0 + i, y0 + j, lit(YELLOW, 1.4, x0 + i, y0 + j))
      break
    case 'card':
      at((i, j, x, y) => (j === 1 ? lit(STRING, 3, x, y) : lit(PINK, 4.2 - (i === w - 1 ? 0.6 : 0), x, y)))
      for (const j of [3, 5]) for (let i = 1; i < w - 1; i++) if ((i * 3 + j) % 7 !== 0) c.set(x0 + i, y0 + j, lit(PINK, 1.8, x0 + i, y0 + j))
      break
    case 'map':
      at((i, j, x, y) => {
        const isRoad = i === 3 || j === 5
        const isRiver = j === (i < 5 ? 2 : 3)
        return isBorder(i, j, 1) ? lit(PAPER, 3.6, x, y) : isRoad ? lit(PAPER, 4.2, x, y) : isRiver ? lit(MAP, 1.4, x, y) : lit(MAP, 3.4 + (i > 3 && j > 5 ? 0.8 : 0), x, y)
      })
      for (const [i, j] of [[6, 7], [7, 7], [5, 8], [8, 8], [6, 9], [7, 9]] as const) c.set(x0 + i, y0 + j - 1, lit(STRING, 4, x0 + i, y0 + j - 1))
      break
    case 'paper':
      at((i, j, x, y) => lit(PAPER, 3.4 - (i === w - 1 ? 0.5 : 0), x, y))
      c.rect(x0 + 1, y0 + 1, w - 2, 1, (x, y) => lit(PAPER, 0.8, x, y))
      c.rect(x0 + 1, y0 + 3, 4, 3, (x, y) => lit(PHOTO, 2.6, x, y))
      for (let j = 3; j < h - 1; j++) {
        for (let i = 1; i < w - 1; i++) {
          if (i < 6 && j < 6) continue
          if (i === 5 || (i + j * 3) % 6 === 0) continue
          if (j % 2 === 1) c.set(x0 + i, y0 + j, lit(PAPER, 1.8, x0 + i, y0 + j))
        }
      }
      break
  }
  void f
}

export const scene: Scene = {
  verb: 'Inferring',
  render,
  hero: 41,
  snaps: [
    {
      frames: DONE,
      box: [6, 2, 59, 18],
      colors: [...STRING.slice(6), ...[CORK, PAPER, PHOTO, YELLOW, PINK, MAP, STRING].flatMap((r) => r.map((col) => mix(col, GLOW, 0.35)))],
      why: 'The answer lands: on the frame the last link reaches the suspect the whole web of string flashes white-hot, the cork along it glows red and every pin brightens at once, then it cools over five frames from the suspect outward.',
    },
    { frames: [OFF, OFF + 1], box: [0, 0, W - 1, H - 1], why: 'The lamp clicks off: its warm light leaves the whole room in two frames, the bulb dying, and the board drops to moonlight through the blinds.' },
    { frames: [ON, ON + 4], box: [0, 0, W - 1, H - 1], why: 'The lamp flickers back on over the clean board, half, off, nearly, dim, full: a bulb catching, so the whole room jumps in brightness from frame to frame.' },
  ],
}
