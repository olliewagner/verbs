import { Canvas, TAU, beat, ease, hash, hex, lerp, mod, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64
const GROUND = 27

const SKY = hex('07061a 0c0a24 130f30 1b143c 251945 321e4c 432454 582c5a 76385e 9a4c66 c06a6a')
const STEEL = hex('0b0818 161028 221a3a 31264e 453866 5f4e84 8270a8')
const CROWD = hex('030209 07051a 0e0a24 18122e 2a1f40')
const TENT_RED = hex('2c0a1a 4e1222 7a1c2c a82c38 d24a48 ee7a60')
const TENT_CREAM = hex('3a2638 6a4a5a 9a7a80 c8aa9e e8d4bc fff2dc')
const GOLD = hex('3a1e08 7a4410 c0761c eeaa30 fbd660 fff4c0 ffffff')
const TEAL = hex('0a2a38 15585e 22918c 4ccab0 9cf0d4 e4fff4 ffffff')
const PINK = hex('3a0c30 6e1650 a8287a d84a9c f27cc0 fcb8e0 ffffff')
const BULB_ON = 0xfff0b4
const BULB_OFF = 0x4a2e3e
const STRING = 0x6a5a80

const CABS = [TENT_RED, TEAL, GOLD, PINK]
const BALLOONS = [
  hex('5a1420 b02a30 ec5448 ffa088'),
  hex('5a3a10 c08a1c f6c840 fff0a0'),
  hex('142a6a 2a5ac0 4c8cf0 a8d0ff'),
  hex('5a1446 b02a7e ee5cb0 ffb0e0'),
  hex('124a2a 21904a 44c870 b0f0b8'),
]
const CONFETTI = [0xf27cc0, 0xfbd660, 0x4ccab0, 0xfff2dc, 0x8cb4ff, 0xee5448]

type Burst = {
  f: number; x: number; y: number; n: number; size: number; life: number
  ramp: readonly number[]; inner?: readonly number[]; launch: number; seed: number
}

const BURSTS: Burst[] = [
  { f: 18, x: 45, y: 9, n: 30, size: 14.5, life: 28, ramp: GOLD, inner: PINK, launch: 6, seed: 1 },
  { f: 29, x: 24, y: 4, n: 18, size: 6.5, life: 18, ramp: TEAL, launch: 22, seed: 2 },
  { f: 34, x: 58, y: 5, n: 18, size: 6.5, life: 18, ramp: PINK, inner: TEAL, launch: 27, seed: 3 },
]

function flashAt(f: number, x: number, y: number): number {
  let sum = 0
  for (const b of BURSTS) {
    const a = f - b.f
    if (a < 0 || a > 16) continue
    const power = (a === 0 ? 2 : a === 1 ? 1.5 : 1.25 * Math.exp(-(a - 1) / 4)) * (b.size / 12)
    sum += power * Math.max(0, 1 - Math.hypot(x - b.x, (y - b.y) * 1.2) / (b.size * 3.6)) ** 1.3
  }

  return sum
}

function drawShell(c: Canvas, b: Burst, a: number, ramp: readonly number[], n: number, size: number, lifeScale: number, seed: number): void {
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * TAU + hash(seed, k) * 0.25
    const speed = size * (0.8 + 0.25 * hash(seed, k, 1))
    const life = b.life * lifeScale * (0.7 + 0.3 * hash(seed, k, 2))
    if (a > life) continue
    const at = (t: number): [number, number] => {
      const r = speed * (1 - Math.exp(-Math.max(0, t) / 3.2))
      return [b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r * 0.85 + 0.018 * t * t]
    }
    const u = a / life
    if (u > 0.55 && hash(seed, k, a) < 0.45) continue
    const level = 6 - u * 5.4
    const [x, y] = at(a)
    if (a < 9) {
      const [tx, ty] = at(Math.max(a * 0.5, a - 3.4))
      const [mx, my] = at(Math.max(a * 0.75, a - 1.5))
      c.line(tx, ty, mx, my, shade(ramp, level - 3.4))
      c.line(mx, my, x, y, shade(ramp, level - 1.6))
    }
    c.set(x, y, shade(ramp, level))
  }
}

function drawBurst(c: Canvas, b: Burst, f: number): void {
  const a = f - b.f
  if (a < 0 || a >= b.life) return
  if (a === 0) {
    c.disc(b.x, b.y, b.size * 0.3, b.ramp[4] ?? 0)
    c.disc(b.x, b.y, b.size * 0.18, b.ramp[6] ?? 0)
    return
  }
  drawShell(c, b, a, b.ramp, b.n, b.size, 1, b.seed)
  if (b.inner) drawShell(c, b, a, b.inner, Math.round(b.n / 2), b.size * 0.42, 0.55, b.seed + 50)
}

function drawRocket(c: Canvas, b: Burst, f: number): void {
  if (f < b.launch || f >= b.f) return
  const t = ease.out(beat(f, b.launch, b.f))
  const y = lerp(GROUND + 2, b.y + 1, t)
  const x = b.x + Math.sin(t * 7) * 0.5
  for (let k = 1; k <= 6; k++) {
    if (k > 2 && hash(f, k, b.seed) < 0.12 * k) continue
    c.set(x + (k > 3 && hash(f, k) < 0.3 ? (hash(f, k, 1) < 0.5 ? -1 : 1) : 0), y + k * (1.4 - t * 0.6), shade(GOLD, 5.5 - k * 0.8))
  }
  c.set(x, y, 0xffffff)
}

const WX = 17
const WY = 13
const R = 11

function drawWheel(c: Canvas, f: number): void {
  const spin = (f / LOOP) * (TAU / 2)
  const steel = (x: number, y: number, base: number) => shade(STEEL, base + flashAt(f, x, y) * 3.4)
  for (const side of [-1, 1]) {
    c.line(WX, WY, WX + side * 7, GROUND, (x, y) => steel(x, y, 2.6))
    c.line(WX + side, WY + 1, WX + side * 8, GROUND, (x, y) => steel(x, y, 1.6))
  }
  c.line(WX - 4, 21, WX + 4, 21, (x, y) => steel(x, y, 2))
  for (let k = 0; k < 8; k++) {
    const a = spin + (k * TAU) / 8
    c.line(WX, WY, WX + Math.cos(a) * R, WY + Math.sin(a) * R, (x, y) => steel(x, y, 2.6))
  }
  for (let y = WY - R - 1; y <= WY + R + 1; y++) {
    for (let x = WX - R - 1; x <= WX + R + 1; x++) {
      const d = Math.hypot(x - WX, y - WY)
      if (Math.abs(d - R) < 0.55) c.set(x, y, steel(x, y, 3.6))
      else if (Math.abs(d - R * 0.5) < 0.5) c.set(x, y, steel(x, y, 2.8))
    }
  }
  for (let k = 0; k < 16; k++) {
    const a = spin + (k * TAU) / 16 + TAU / 32
    const isOn = mod(k - Math.floor(f / 2), 4) !== 0
    c.set(WX + Math.cos(a) * R, WY + Math.sin(a) * R, isOn ? BULB_ON : BULB_OFF)
  }
  c.disc(WX, WY, 1.5, steel(WX, WY, 3.2))
  c.set(WX, WY, BULB_ON)
  for (let k = 0; k < 8; k++) {
    const a = spin + (k * TAU) / 8
    const px = Math.round(WX + Math.cos(a) * R)
    const py = Math.round(WY + Math.sin(a) * R)
    const ramp = CABS[k % CABS.length] ?? GOLD
    const lit = flashAt(f, px, py + 2) * 2
    c.set(px, py + 1, steel(px, py + 1, 2.4))
    for (let i = -1; i <= 1; i++) {
      c.set(px + i, py + 2, shade(ramp, 3 + lit - (i === 1 ? 1 : 0)))
      c.set(px + i, py + 3, i === 0 ? shade(GOLD, 3.6 + lit) : shade(ramp, 1.6 + lit))
      c.set(px + i, py + 4, shade(ramp, 1 + lit * 0.6))
    }
  }
}

const TX = 50
const PEAK = 12
const EAVE = 20
const HALF = 12

function drawTent(c: Canvas, f: number): void {
  for (let y = PEAK; y <= EAVE; y++) {
    const hw = ((y - PEAK) / (EAVE - PEAK)) * HALF + 0.5
    for (let x = Math.round(TX - hw); x <= Math.round(TX + hw); x++) {
      const u = (x - TX) / (y - PEAK + 0.8)
      const isRed = mod(Math.floor(u * 2.4 + 0.5), 2) === 0
      const level = 2.2 + flashAt(f, x, y) * 2.4 + (x < TX ? 0.6 : -0.5) + (Math.abs(x - TX) > hw - 1 ? -0.6 : 0)
      c.set(x, y, shade(isRed ? TENT_RED : TENT_CREAM, level))
    }
  }
  for (let x = TX - HALF; x <= TX + HALF; x++) {
    const isScallop = mod(x - TX, 4) !== 0
    const isRed = mod(Math.floor((x - TX + 2) / 4), 2) === 0
    for (let y = EAVE + 1; y < GROUND; y++) {
      if (y === EAVE + 1) {
        if (isScallop) c.set(x, y, shade(isRed ? TENT_RED : TENT_CREAM, 2.4 + flashAt(f, x, y) * 2))
        else c.set(x, y, shade(TENT_RED, 0.4))
        continue
      }
      const stripe = mod(Math.floor((x - TX + 1) / 3), 2) === 0
      const level = 1.2 + flashAt(f, x, y) * 1.4 + (y === EAVE + 2 ? -0.7 : 0) + (x < TX ? 0.3 : -0.3)
      c.set(x, y, shade(stripe ? TENT_RED : TENT_CREAM, level))
    }
  }
  for (let y = 22; y < GROUND; y++) {
    for (let x = TX - 2; x <= TX + 2; x++) {
      if (y === 22 && Math.abs(x - TX) === 2) continue
      c.set(x, y, shade(GOLD, Math.abs(x - TX) === 2 ? 2.4 : y === 22 ? 3.4 : 4))
    }
  }
  for (let y = PEAK - 5; y < PEAK; y++) c.set(TX, y, shade(STEEL, 3 + flashAt(f, TX, y) * 3))
  const flap = Math.floor(f / 3) % 3
  const pennant = [
    ['ppp', 'pp.'],
    ['pp.', 'ppp'],
    ['ppp', '.pp'],
  ][flap] ?? []
  c.sprite(TX + 1, PEAK - 5, pennant, { p: shade(TEAL, 3 + flashAt(f, TX, PEAK) * 2) })
}

function drawLights(c: Canvas, f: number): void {
  const strings: [number, number, number, number, number][] = [
    [31, 17, TX, PEAK, 4],
    [TX, PEAK, 64, 15, 3],
  ]
  for (let y = 17; y < GROUND; y++) c.set(31, y, shade(STEEL, 1.5 + flashAt(f, 31, y) * 3))
  strings.forEach(([x0, y0, x1, y1, sag], s) => {
    let n = 0
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0)
      const y = lerp(y0, y1, t) + sag * 4 * t * (1 - t)
      c.set(x, y, STRING)
      if (x > x0 && x < x1 && mod(x - x0, 3) === 0) {
        const isOn = mod(n + s + Math.floor(f / 4), 2) === 0
        c.set(x, y + 1, isOn ? CONFETTI[n % 4] ?? BULB_ON : BULB_OFF)
        n++
      }
    }
  })
  c.set(31, 16, BULB_ON)
}

const HEADS = Array.from({ length: 15 }, (_, i) => ({ x: i * 4.4 + hash(i, 4) * 2, y: 26.2 + hash(i, 5) * 1.2, r: 1.2 + hash(i, 6) * 0.4 }))

function drawCrowd(c: Canvas, f: number): void {
  const fill = (x: number, y: number) => {
    const isTop = c.get(x, y - 1) !== CROWD[1] && c.get(x, y - 1) !== CROWD[0]
    return isTop ? shade(CROWD, 1 + flashAt(f, x, y) * 3) : CROWD[1 - (y > 29 ? 1 : 0)] ?? 0
  }
  const people = new Canvas()
  for (const h of HEADS) {
    const bob = Math.round(wave(f, LOOP, 2, h.x * 0.05) * 0.4)
    people.disc(h.x, h.y + bob, h.r, 1)
    people.ellipse(h.x, h.y + 3 + bob, h.r + 1.4, 2, 1)
  }
  const isPointing = f >= 19 && f < 40
  const kid = isPointing
    ? ['....k', '...k.', '.kkk.', '.kk..', 'kkkk.', 'kkkk.']
    : ['.....', '.....', '.kk..', '.kk..', 'kkkk.', 'kkkk.']
  people.sprite(41, 19 + (f === 19 ? -1 : 0), kid, { k: 1 })
  people.rect(0, GROUND + 1, W, H - GROUND - 1, 1)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (people.px[y * W + x] === 1) c.set(x, y, CROWD[1] ?? 0)
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (people.px[y * W + x] === 1) c.set(x, y, fill(x, y))
  }
}

function drawBalloons(c: Canvas, f: number): void {
  const p = f / LOOP
  const kx = 32 + p * 3 + wave(f, LOOP, 2) * 1.2
  const ky = lerp(H + 9, -20, p ** 1.15)
  const bunch: [number, number][] = [[-3, -9], [0, -11], [3, -9], [-1, -7], [2, -6]]
  for (let j = 1; j <= 5; j++) c.set(kx + Math.sin(f * 0.3 - j * 0.6) * j * 0.22, ky + j, STRING)
  bunch.forEach(([dx, dy], i) => {
    const bob = wave(f, LOOP, 4, i * 0.21) * 0.6
    const bx = Math.round(kx + dx)
    const by = Math.round(ky + dy + bob)
    c.line(bx, by + 4, kx, ky, STRING)
  })
  bunch.forEach(([dx, dy], i) => {
    const bob = wave(f, LOOP, 4, i * 0.21) * 0.6
    const bx = Math.round(kx + dx)
    const by = Math.round(ky + dy + bob)
    const ramp = BALLOONS[i] ?? BALLOONS[0] ?? []
    const lit = flashAt(f, bx, by) * 1.5
    c.sprite(bx - 1, by, ['.bb.', 'hbbs', 'bbbs', '.ss.'], {
      b: shade(ramp, 2 + lit), h: shade(ramp, 3), s: shade(ramp, 1 + lit),
    })
    c.set(bx, by + 4, shade(ramp, 1))
  })
}

function drawConfetti(c: Canvas, f: number): void {
  for (let i = 0; i < 22; i++) {
    const born = 19 + (i / 22) * 14 + hash(i, 1) * 2
    const t = mod(f - born, LOOP)
    const y = -1 + t * 0.75 + hash(i, 2) * 6
    if (y >= GROUND + 1 || t > 46) continue
    const x = hash(i, 3) * W + Math.sin(t * 0.32 + i) * 1.6 + t * 0.08
    const color = CONFETTI[i % CONFETTI.length] ?? 0xffffff
    const turn = mod(Math.floor(t / 2) + i, 4)
    if (turn === 0) c.set(x, y, color)
    else if (turn === 1 || turn === 3) {
      c.set(x, y, color)
      c.set(x + 1, y, color)
    } else {
      c.set(x, y, color)
      c.set(x, y + 1, color)
    }
  }
}

const STARS = Array.from({ length: 14 }, (_, i) => ({ x: Math.floor(hash(i, 11) * W), y: Math.floor(hash(i, 12) * 16), phase: hash(i, 13) }))

function render(): Int32Array[] {
  return Array.from({ length: LOOP }, (_, f) => {
    const c = new Canvas()
    c.fill((x, y) => shade(SKY, (y / GROUND) * 6.2 + flashAt(f, x, y) * 2.6))
    for (const s of STARS) {
      if (wave(f, LOOP, 2, s.phase) > -0.6) c.set(s.x, s.y, shade(STEEL, 4 + (s.phase > 0.7 ? 1 : 0)))
    }
    for (const b of BURSTS) {
      drawRocket(c, b, f)
      drawBurst(c, b, f)
    }
    drawWheel(c, f)
    drawLights(c, f)
    drawTent(c, f)
    drawBalloons(c, f)
    drawCrowd(c, f)
    drawConfetti(c, f)
    return c.px
  })
}

export const scene: Scene = {
  verb: 'Hullaballooing',
  render,
  hero: 23,
  snaps: [
    { frames: 18, why: 'the gold burst: its flash lights the whole sky in one frame, then decays' },
    { frames: 20, box: [38, 3, 52, 15], why: 'the gold burst: the pink inner shell opens inside the gold one' },
    { frames: 29, box: [15, 2, 27, 14], why: 'the teal burst opens: a bright core, its flash on the sky and on the wheel hub' },
  ],
}
