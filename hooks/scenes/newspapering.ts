import { Canvas, TAU, beat, clamp, hash, hex, mix, mod, shade, type Scene, type Snap } from '../engine'

const W = 64
const H = 32
const LOOP = 64
const SHUT = 58

const PRESS = hex('080605 120d0a 1c1510 281e16 36291d 473625 5c472f 76603f')
const PAPER = hex('1a130e 34281d 54432f 776049 9a8065 bca286 d9c4a3 f0e3c6 fbf3e0')
const BLACK = 0x050302

const PW = 34
const PH = 25
const PAGE: number[] = (() => {
  const page = new Array<number>(PW * PH).fill(1)
  const put = (u: number, v: number, value: number) => {
    if (u >= 0 && u < PW && v >= 0 && v < PH) page[v * PW + u] = value
  }
  const box = (u: number, v: number, w: number, h: number, value: number) => {
    for (let j = v; j < v + h; j++) for (let i = u; i < u + w; i++) put(i, j, value)
  }
  let u = 5
  for (const [i, w] of [3, 2, 3, 3, 2, 3, 3].entries()) {
    box(u, i % 3 === 1 ? 2 : 1, w, i % 3 === 1 ? 3 : 4, 0)
    u += w + 1
  }
  box(1, 2, 3, 2, 0.62)
  box(30, 2, 3, 2, 0.62)
  box(1, 6, 32, 1, 0)
  for (let i = 2; i < 32; i++) if (i % 5 !== 0) put(i, 7, 0.62)
  box(1, 8, 32, 1, 0.3)
  for (const [v, words, from] of [[10, [8, 6, 11], 3], [13, [7, 9], 8]] as const) {
    u = from
    for (const w of words) {
      box(u, v, w, 2, 0)
      u += w + 2
    }
  }
  box(2, 16, 13, 8, 0.12)
  box(3, 17, 11, 2, 0.8)
  box(3, 19, 11, 2, 0.68)
  box(3, 21, 11, 2, 0.56)
  for (let i = 5; i <= 11; i++) put(i, 18, i === 5 || i === 11 ? 0.42 : 0.2)
  for (let i = 6; i <= 10; i++) put(i, 17, 0.42)
  for (let i = 6; i <= 10; i++) put(i, 19, 0.2)
  put(8, 20, 0.2)
  const skyline = [1, 2, 2, 1, 3, 1, 2, 2, 1, 4, 2]
  skyline.forEach((h, i) => {
    for (let k = 0; k < h; k++) put(3 + i, 22 - k, 0.24)
  })
  for (const [col, lengths] of [[16, [8, 8, 8, 5]], [25, [5, 8, 8, 8]]] as const) {
    lengths.forEach((len, row) => box(col, 16 + row * 2, len, 1, row === 0 && col === 25 ? 0.18 : 0.46))
  }

  return page
})()

const PX = 31.5
const PY = 15

function paperAt(f: number): { sx: number; sy: number; angle: number; smear: number } | undefined {
  if (f < 2 || f >= SHUT) return undefined
  if (f < 18) {
    const p = beat(f, 2, 18)
    const scale = 0.035 + 0.965 * beat(f, 2, 19) ** 2.4
    const turns = TAU * 2.25
    const spin = (turns * 1.4 * (1 - p) ** 0.4) / 16
    return { sx: scale, sy: scale, angle: turns * (1 - p) ** 1.4, smear: spin / 2 }
  }
  const settle: Record<number, [number, number]> = { 18: [1.09, 0.92], 19: [0.97, 1.04], 20: [1.02, 0.98] }
  const [sx, sy] = settle[f] ?? [1, 1]

  return { sx, sy, angle: 0, smear: 0 }
}

const vignette = (x: number, y: number) => ((x - 31.5) / 34) ** 2 + ((y - 15.5) / 21) ** 2
const lamp = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 26, (y + 8) * 1.1) / 46)

function drawPress(c: Canvas, f: number, glow: number): void {
  const turn = (f * 15 * (TAU / 8)) / LOOP
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = vignette(x, y) * 1.1
      const cy = y < 16 ? 1.5 : 29
      const r = y < 16 ? 6 : 5
      const n = (y - cy) / r
      const onDrum = Math.abs(n) <= 1
      const lit = onDrum ? 0.8 * Math.sqrt(1 - n * n) - 0.5 * n : 0.55
      const isWeb = x >= 12 && x <= 51
      if (!isWeb) {
        if (!onDrum || x < 3 || x > 60) {
          c.set(x, y, shade(PRESS, 0.8 + lamp(x, y) * 1.2 + glow - v))
          continue
        }
        let isGroove = false
        for (let k = 0; k < 8; k++) {
          const a = turn + (k * TAU) / 8
          if (Math.cos(a) > 0.2 && Math.round(cy + r * Math.sin(a)) === y) isGroove = true
        }
        const isCap = x === 3 || x === 60
        const spec = Math.abs(n + 0.35) < 0.2 ? 2.2 : 0
        c.set(x, y, shade(PRESS, 0.6 + lit * 4 + spec - (isGroove ? 1.4 : 0) - (isCap ? 1 : 0) + glow - v * 0.7))
        continue
      }
      const wy = mod(y - f, 16)
      const page = mod(Math.floor((y - f) / 16), LOOP / 16)
      const cx = x - 12
      const col = Math.floor(cx / 8)
      const isGutter = mod(cx, 8) === 0 || cx >= 40
      const isHead = (wy === 1 || wy === 2) && !isGutter
      const isText = wy >= 5 && wy <= 13 && wy % 2 === 1 && !isGutter && mod(cx, 8) < 8 - Math.floor(hash(col, page, wy) * 4)
      const edge = x === 12 ? 0.6 : x === 51 ? -0.8 : 0
      const nip = y === 8 || y === 23 ? -0.7 : 0
      const ink = isHead ? -1.8 : isText ? -1.1 : 0
      c.set(x, y, shade(PRESS, 1.6 + lit * 2.4 + lamp(x, y) * 2.4 + ink + edge + nip + glow - v))
    }
  }
  for (const [gx, dir] of [[6.5, 1], [57.5, -1]] as const) {
    const turn = (dir * f * 5 * (TAU / 10)) / LOOP
    for (let y = 9; y <= 22; y++) {
      for (let x = Math.floor(gx - 6); x <= Math.ceil(gx + 6); x++) {
        const dx = x - gx
        const dy = y - 15.5
        const d = Math.hypot(dx, dy)
        const isTooth = mod(((Math.atan2(dy, dx) - turn) / TAU) * 10, 1) < 0.5
        if (d > 4.4 + (isTooth ? 1.3 : 0) || d < 1) continue
        const facing = -(dx + dy) / Math.max(1, d)
        const isRim = d > 3.6 && facing > 0.3
        const isRing = d > 2.2 && d < 3.2
        c.set(x, y, shade(PRESS, 3.4 + (isRim ? 1.4 : 0) - (isRing ? 1.4 : 0) - (facing < -0.4 ? 0.8 : 0) + glow))
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (const [x, l] of [[0, 0.8], [1, 1.4], [2, 2.4], [61, 1.6], [62, 1.2], [63, 0.8]] as const) {
      const isRivet = (x === 1 || x === 62) && y % 5 === 2
      c.set(x, y, shade(PRESS, l + (isRivet ? 1.5 : 0) + lamp(x, y) + glow - vignette(x, y) * 0.5))
    }
  }
}
function pageLevel(pu: number, pv: number): number {
  const value = PAGE[Math.floor(pv) * PW + Math.floor(pu)] ?? 1
  const edge = pu < 1 ? 0.6 : pv < 1 ? 0.5 : pu >= PW - 1 || pv >= PH - 1 ? -1.1 : 0
  const fall = -(((pu - 6) / PW) ** 2 + ((pv - 4) / PH) ** 2) * 0.9
  return 0.7 + value * 6.4 + (value > 0.9 ? edge + fall : 0)
}

function drawPaper(c: Canvas, sx: number, sy: number, angle: number, smear: number, flash: number): void {
  const reach = (Math.hypot(PW, PH) / 2) * Math.max(sx, sy) + 1
  const subs = angle === 0 ? [0] : [-1 / 3, 0, 1 / 3]
  const turns = (smear === 0 ? [0] : [-0.5, -0.25, 0, 0.25, 0.5]).map(t => {
    const a = angle + smear * t
    return [Math.cos(a), Math.sin(a)] as const
  })
  const samples = subs.length ** 2 * turns.length
  for (let y = Math.floor(PY - reach); y <= Math.ceil(PY + reach); y++) {
    for (let x = Math.floor(PX - reach); x <= Math.ceil(PX + reach); x++) {
      let cover = 0
      let level = 0
      for (const [cos, sin] of turns) {
        for (const oy of subs) {
          for (const ox of subs) {
            const dx = x + ox - PX
            const dy = y + oy - PY
            const pu = (dx * cos + dy * sin) / sx + PW / 2
            const pv = (-dx * sin + dy * cos) / sy + PH / 2
            if (pu < 0 || pv < 0 || pu >= PW || pv >= PH) continue
            cover++
            level += pageLevel(pu, pv)
          }
        }
      }
      if (cover * 2 <= samples) continue
      c.set(x, y, shade(PAPER, level / cover + flash))
    }
  }
}
function drawShadow(c: Canvas, sx: number, sy: number): void {
  if (sx < 0.92) return
  const hw = (PW / 2) * sx
  const hh = (PH / 2) * sy
  for (let y = Math.round(PY - hh) + 2; y <= Math.round(PY + hh) + 2; y++) {
    for (let x = Math.round(PX - hw) + 2; x <= Math.round(PX + hw) + 2; x++) c.tint(x, y, BLACK, 0.55)
  }
}
type Mote = { x: number; y: number; vx: number; vy: number }

function motes(f: number): Mote[] {
  const t = f - 18
  if (t < 0 || t > 7) return []
  return Array.from({ length: 14 }, (_, i) => {
    const r = [hash(i, 1), hash(i, 2), hash(i, 3)] as const
    const side = i % 3
    const x0 = side === 0 ? 15 + r[0] * 34 : side === 1 ? 14.5 : 48.5
    const y0 = side === 0 ? 27.5 : 6 + r[0] * 20
    const vx = side === 0 ? (x0 - PX) * 0.05 : side === 1 ? -0.6 - r[1] * 0.7 : 0.6 + r[1] * 0.7
    const vy = side === 0 ? -0.1 - r[1] * 0.3 : -0.3 - r[2] * 0.4
    return { x: x0 + vx * t * 1.3, y: y0 + vy * t + 0.06 * t * t, vx, vy }
  })
}
const IRIS_FRAMES = 26
const RADII: number[] = (() => {
  const [far, v0, rise, fall, n] = [37.4, 0.55, 10, 6, IRIS_FRAMES]
  const top = (far - (v0 * rise) / 2) / (rise / 2 + (n - rise - fall) + fall / 2)
  const speed = (s: number) =>
    s < rise
      ? v0 + ((top - v0) * (1 - Math.cos((Math.PI * s) / rise))) / 2
      : s < n - fall
        ? top
        : (top * (1 + Math.cos((Math.PI * (s - n + fall)) / fall))) / 2
  const radii = [0]
  let r = 0
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 64; i++) r += speed(k + (i + 0.5) / 64) / 64
    radii.push(r)
  }
  return radii
})()
function lip(color: number): number {
  const dim = mix(color, BLACK, 0.6)
  const channels = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
  const [r, g, b] = channels(dim)
  let best = BLACK
  let bestError = Infinity
  for (const step of [BLACK, ...PAPER.slice(0, 2)]) {
    const [sr, sg, sb] = channels(step)
    const error = (sr - r) ** 2 + (sg - g) ** 2 + (sb - b) ** 2
    if (error < bestError) [best, bestError] = [step, error]
  }
  return best
}
function iris(f: number): number {
  const k = Math.min(mod(f - SHUT, LOOP), mod(SHUT - f, LOOP))
  return RADII[k] ?? 99
}
const SCRATCHES: Record<number, number[]> = { 6: [11], 7: [12], 24: [51], 25: [51], 30: [9], 45: [40] }
const FLECKS: Record<number, [number, number, boolean][]> = {
  4: [[45, 5, false]], 13: [[6, 21, true]], 23: [[40, 9, false]], 29: [[57, 24, true], [22, 2, false]], 34: [[33, 22, false]],
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const flash = f === 18 ? 1 : f === 19 ? 0.4 : 0
    const flicker = hash(f, 99) < 0.18 ? 0.3 : 0
    drawPress(c, f, flash * 0.5 + flicker)
    const paper = paperAt(f)
    if (paper) {
      drawShadow(c, paper.sx, paper.sy)
      drawPaper(c, paper.sx, paper.sy, paper.angle, paper.smear, flash * 0.8)
    }
    for (const m of motes(f)) {
      const age = (f - 18) / 7
      c.set(m.x, m.y, shade(PAPER, 6 - age * 3.5))
      if (age < 0.4) c.set(m.x - Math.sign(m.vx), m.y - Math.sign(m.vy) * 0.6, shade(PAPER, 4.6 - age * 3))
    }
    for (const x of SCRATCHES[f] ?? []) {
      for (let y = 0; y < H; y++) if (hash(x, y, f) > 0.12) c.tint(x, y, PAPER[7] ?? 0, 0.3)
    }
    for (const [x, y, isLight] of FLECKS[f] ?? []) {
      const color = isLight ? (PAPER[6] ?? 0) : BLACK
      c.set(x, y, color)
      c.set(x + 1, y, color)
      c.set(x, y + 1, color)
    }
    const [ox, oy] = f === 18 ? [0, 1] : f === 19 ? [0, -1] : f === 20 ? [1, 0] : [0, 0]
    const px = new Int32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) px[y * W + x] = c.get(clamp(x - ox, 0, W - 1), clamp(y - oy, 0, H - 1))
    }
    const r = iris(f)
    if (r < 60) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - PX, y - PY)
          if (d > r) px[y * W + x] = BLACK
          else if (d > r - 1.2) px[y * W + x] = lip(px[y * W + x] ?? 0)
        }
      }
    }
    out.push(px)
  }
  return out
}
const SNAPS: Snap[] = [
  { frames: [15, 16], box: [20, 3, 43, 27], colors: PAPER, why: 'the paper spins in, smeared, 38 and 34 degrees a frame: its corners sweep further than motion can follow' },
  { frames: [18, 20], why: 'the paper slams home face-on: a white flash, and the camera jolts down, up and aside' },
  ...Object.entries(SCRATCHES).flatMap(([f, xs]) =>
    xs.map((x): Snap => ({ frames: [Number(f), Number(f) + 1], box: [x, 0, x, H - 1], why: 'a scratch on the film, there for a frame or two' })),
  ),
  ...Object.entries(FLECKS).flatMap(([f, flecks]) =>
    flecks.map(([x, y]): Snap => ({ frames: [Number(f), Number(f) + 1], box: [x, y, x + 1, y + 1], why: 'a fleck of dust on the film, there for a frame' })),
  ),
]
export const scene: Scene = { verb: 'Newspapering', render, hero: 26, snaps: SNAPS }