import { Canvas, hash, hex, lerp, mix, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const NIGHT = hex('03100f 051a1c 08242a 0c3038 123e48 1a4e58')
const GOLD = hex('2e1a06 5a380c 8a5e14 b88a22 dcb03e f0d070 fbeaa8 fffbe6')
const GLASS = hex('1e3c44 3e6a72 74a4a8 b2d8d6 e6faf4')
const BOKEH_WARM = 0xe0a040
const BOKEH_COOL = 0x8ad0d0
const SLEEVE = hex('080c14 101828 1c2a3e 2c4058')
const SKIN = hex('2a1414 4e2a22 7a4434 a0624a')

const CX = 24
const RIM = 2
const BOTTOM = 21
const LEVEL = 7

const halfAt = (t: number) => (t < 0 || t > 1 ? 0 : (4.8 - 0.8 * t) * Math.sqrt(1 - t ** 6))
const half = (y: number) => halfAt((y - RIM) / (BOTTOM - RIM))

const CLINK = 21

const burst = (f: number) => {
  const t = mod(f - CLINK, LOOP)
  return t < 2 ? 0.6 + t * 0.2 : t < 30 ? Math.exp(-(t - 2) / 7) : 0
}

type Pose = { x: number; y: number; angle: number; slosh: number }

const SWING = 2
const IN_EASE = 8
const TOUCH = 0.4
const OUT_ACCEL = 0.36
const OUT_TOP = 2
const IN_FROM = { x: 68.6, y: 6 }
const MEET = { x: 34.6, y: 0.2 }
const OUT_TO = { x: 68.8, y: -4.6 }

function inbound(tau: number): number {
  const eased = TOUCH * Math.min(tau, IN_EASE) + ((SWING - TOUCH) * Math.min(tau, IN_EASE) ** 2) / (2 * IN_EASE)
  return eased + SWING * Math.max(0, tau - IN_EASE)
}

function outbound(tau: number): number {
  const reach = (OUT_TOP - TOUCH) / OUT_ACCEL
  const t = Math.min(tau, reach)
  return TOUCH * t + (OUT_ACCEL * t * t) / 2 + OUT_TOP * Math.max(0, tau - reach)
}

function guestAt(f: number): Pose | undefined {
  if (f <= CLINK) {
    const span = IN_FROM.x - MEET.x
    const d = inbound(CLINK - f)
    if (d > span + 1) return undefined
    const t = d / span
    return { x: Math.round(MEET.x + d), y: Math.round(MEET.y + (IN_FROM.y - MEET.y) * t ** 1.3), angle: -0.28, slosh: 0.3 * Math.min(1, t) }
  }
  const tau = f - CLINK
  const span = OUT_TO.x - MEET.x
  const d = outbound(tau)
  if (d > span + 1) return undefined
  const t = d / span
  const back = Math.exp(-tau / 6)
  return {
    x: Math.round(MEET.x + d),
    y: Math.round(MEET.y + (OUT_TO.y - MEET.y) * t ** 1.5),
    angle: lerp(-0.28, -0.5, Math.min(1, t)),
    slosh: back * Math.sin(tau * 0.75) * 0.35,
  }
}

type Site = { x: number; y: number; rate: number; isBurstOnly: boolean }
const SITES: Site[] = [
  { x: CX, y: 20, rate: 0.45, isBurstOnly: false },
  { x: CX - 3, y: 15, rate: 0.22, isBurstOnly: false },
  { x: CX + 3, y: 12, rate: 0.18, isBurstOnly: false },
  { x: CX - 3, y: 10, rate: 0.14, isBurstOnly: false },
  { x: CX + 2, y: 17, rate: 0.5, isBurstOnly: true },
  { x: CX - 1, y: 14, rate: 0.45, isBurstOnly: true },
  { x: CX + 4, y: 9, rate: 0.35, isBurstOnly: true },
  { x: CX + 1, y: 19, rate: 0.4, isBurstOnly: true },
]

const SPAWNS: number[][] = SITES.map((s, i) => {
  const rate = (f: number) => s.rate * (s.isBurstOnly ? burst(f) * 1.6 : 1 + burst(f) * 1.5)
  let total = 0
  for (let f = 0; f < LOOP; f++) total += rate(f)
  const k = Math.max(1, Math.round(total)) / total
  const phase = hash(i, 5)
  const out: number[] = []
  let sum = 0
  for (let f = 0; f < LOOP; f++) {
    const next = sum + rate(f) * k
    if (Math.floor(next + phase) > Math.floor(sum + phase)) out.push(f)
    sum = next
  }
  return out
})

type Bubble = { x: number; y: number; age: number }

function bubbles(f: number): Bubble[] {
  const out: Bubble[] = []
  SITES.forEach((s, i) => {
    for (const born of SPAWNS[i] ?? []) {
      for (const b of [born, born - LOOP]) {
        if (b > f) continue
        let y = s.y
        let v = 0.19 + 0.14 * hash(i, born, 11)
        for (let k = b; k < f; k++) {
          v += 0.03
          y -= v * (1 + burst(k) * 1.4)
        }
        if (y > LEVEL + 0.5) out.push({ x: s.x, y, age: f - b })
      }
    }
  })
  return out
}

function surfaceAt(x: number, f: number): number {
  const t = mod(f - CLINK, LOOP)
  const amp = t < 14 ? Math.exp(-t / 4.5) * 1.3 : 0
  return LEVEL + Math.round(amp * Math.sin((x - CX) * 1.3 + t * 1.9))
}

function drawBackdrop(c: Canvas): void {
  c.fill((x, y) => {
    if (y >= 27) {
      return shade(NIGHT, y === 27 ? 3 : 1.4 - (y - 28) * 0.3 + (x < 34 ? 0.3 : 0))
    }
    const glow = Math.max(0, 1 - Math.hypot(x - 18, (y - 10) * 1.3) / 40)
    return shade(NIGHT, 1 + glow * 3.2)
  })
  const discs: [number, number, number, number, number][] = [
    [5.5, 6.5, 4.2, BOKEH_WARM, 0.22], [12.5, 19.5, 2.8, BOKEH_WARM, 0.14], [45.5, 5.5, 5.2, BOKEH_WARM, 0.14], [56.5, 15.5, 3.6, BOKEH_COOL, 0.14],
    [38.5, 19.5, 2.4, BOKEH_WARM, 0.14], [60.5, 3.5, 2.6, BOKEH_WARM, 0.22], [50.5, 24.5, 2.2, BOKEH_WARM, 0.14],
  ]
  for (const [bx, by, r, color, a] of discs) {
    c.disc(bx, by, r, (x, y) => (y >= 27 ? undefined : mix(c.get(x, y), color, a)))
  }
  for (let x = CX - 4; x <= CX + 4; x++) {
    for (const y of [30, 31]) c.set(x, y, mix(c.get(x, y), GOLD[4] ?? 0, Math.abs(x - CX) < 2 ? 0.3 : 0.15))
  }
}

function drawFlute(c: Canvas, f: number): void {
  const surge = burst(f)
  for (let y = RIM; y <= BOTTOM; y++) {
    const hw = half(y)
    const xl = Math.round(CX - hw)
    const xr = Math.round(CX + hw)
    for (let x = xl; x <= xr; x++) {
      if (x === xl || x === xr) {
        c.set(x, y, shade(GLASS, x === xl ? 3 - (y > 16 ? 1 : 0) : 2 + (y < 6 ? 1 : 0)))
        continue
      }
      const surface = surfaceAt(x, f)
      if (y < surface - (surge > 0.35 ? 2 : 1)) {
        c.set(x, y, mix(c.get(x, y), GLASS[3] ?? 0, x === xl + 1 ? 0.35 : 0.1))
        continue
      }
      if (y < surface) {
        c.set(x, y, shade(GOLD, (y === surface - 1 ? 6.4 : 7) - ((x + y) % 3 === 0 ? 0.6 : 0)))
        continue
      }
      const across = 1 - Math.abs(x - CX) / Math.max(1, hw)
      const depth = (y - LEVEL) / (BOTTOM - LEVEL)
      const streak = x === xl + 1 && y < 17 ? 1.6 : 0
      c.set(x, y, shade(GOLD, 3.4 + across * 1.6 - depth * 1.4 + streak))
    }
  }
  for (let x = Math.round(CX - half(RIM)); x <= Math.round(CX + half(RIM)); x++) c.set(x, RIM, shade(GLASS, x < CX ? 4 : 3))
  c.set(CX, BOTTOM - 1, GOLD[6] ?? 0)
  for (let y = BOTTOM + 1; y <= 28; y++) c.set(CX, y, shade(GLASS, y < 24 ? 3 : 2))
  c.set(CX, BOTTOM + 1, GOLD[4] ?? 0)
  for (let x = CX - 5; x <= CX + 5; x++) c.set(x, 29, shade(GLASS, Math.abs(x - CX) > 3 ? 1.6 : x < CX ? 3 : 2.4))
  for (let x = CX - 4; x <= CX + 4; x++) c.set(x, 28, Math.abs(x - CX) <= 1 ? (GLASS[3] ?? 0) : c.get(x, 28))

  for (const site of SITES) if (!site.isBurstOnly || surge > 0.15) c.set(site.x, site.y, GOLD[5] ?? 0)
  for (const b of bubbles(f)) {
    const isBig = b.y < 12
    c.set(b.x, b.y, shade(GOLD, isBig ? 7 : 6))
  }
}

function drawGuest(c: Canvas, f: number, p: Pose): void {
  const cos = Math.cos(p.angle)
  const sin = Math.sin(p.angle)
  const toWorld = (u: number, v: number): [number, number] => [p.x + u * cos - v * sin, p.y + u * sin + v * cos]
  const surfaceY = p.y + 5 * cos
  for (let y = 0; y < H; y++) {
    for (let x = Math.floor(p.x - 8); x <= Math.ceil(p.x + 14); x++) {
      const dx = x - p.x
      const dy = y - p.y
      const u = dx * cos + dy * sin
      const v = -dx * sin + dy * cos
      if (v >= -0.5 && v <= 0.5 && Math.abs(u) <= 4.9) {
        c.set(x, y, shade(GLASS, u < 0 ? 4 : 3))
        continue
      }
      if (v > 0.5 && v <= 19) {
        const hw = halfAt(v / 19)
        if (Math.abs(u) > hw + 0.5) continue
        if (Math.abs(u) > hw - 0.5) {
          c.set(x, y, shade(GLASS, u < 0 ? 3 : 2))
          continue
        }
        const level = surfaceY + (x - p.x) * p.slosh * 0.4
        if (y < level - 1) c.set(x, y, mix(c.get(x, y), GLASS[3] ?? 0, 0.1))
        else if (y < level) c.set(x, y, GOLD[6] ?? 0)
        else c.set(x, y, shade(GOLD, 4.2 - (v / 19) * 1.4 + (u < -hw + 1.6 ? 1.4 : 0)))
        continue
      }
      if (v > 19 && v <= 26.5 && Math.abs(u) < 0.6) c.set(x, y, shade(GLASS, 2.6))
      if (v > 26.5 && v <= 27.5 && Math.abs(u) <= 5) c.set(x, y, shade(GLASS, u < 0 ? 3 : 2))
    }
  }
  const [bx, by] = toWorld(0, 18.5)
  for (let k = 0; k < 6; k++) {
    const y = by - mod(f * 1.2 + k * 3, by - surfaceY - 1) - 0.5
    if (y > surfaceY + 0.5) c.set(bx, y, GOLD[6] ?? 0)
  }
  const [hx, hy] = toWorld(0, 22.5)
  c.poly([[hx + 1, hy - 2], [70, hy + 1], [70, hy + 9], [hx + 1, hy + 2.5]], (x, y) => shade(SLEEVE, y < hy - 0.5 + (x - hx) * 0.1 ? 3 : 1.4))
  c.set(hx + 3, hy - 1, SLEEVE[3] ?? 0)
  c.set(hx + 3, hy, SLEEVE[3] ?? 0)
  c.set(hx + 3, hy + 1, SLEEVE[2] ?? 0)
  c.sprite(hx - 1.5, hy - 2, ['.TT..', 'FFFFs', 'ffffs', 'FFFs.'], { T: SKIN[3] ?? 0, F: SKIN[2] ?? 0, f: SKIN[1] ?? 0, s: SKIN[1] ?? 0 })
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    drawBackdrop(c)
    drawFlute(c, f)
    const guest = guestAt(f)
    if (guest) drawGuest(c, f, guest)

    const t = f - CLINK
    if (t === 0) {
      for (const [x, y] of [[29, 2], [30, 2], [29, 1], [30, 3]] as const) c.set(x, y, GOLD[7] ?? 0)
    }
    if (t >= 0 && t < 6) {
      const r = 2.5 + t * 2.2
      for (let a = -Math.PI; a < Math.PI; a += 0.12) {
        const x = Math.round(29.5 + Math.cos(a) * r)
        const y = Math.round(2 + Math.sin(a) * r * 0.9)
        if (Math.abs(x - CX) < 6 && y > 1) continue
        if (t === 0) c.set(x, y, GOLD[7] ?? 0)
        else c.tint(x, y, GOLD[7] ?? 0, 0.7 - t * 0.12)
      }
    }
    const surge = burst(f)
    if (surge > 0.3) {
      for (let k = 0; k < 4; k++) {
        const life = mod(f + k * 2, 5)
        const x = CX - 3 + Math.round(hash(k, Math.floor((f + k * 2) / 5)) * 6)
        const y = LEVEL - 3 - life
        if (life < 3) c.set(x, y, GOLD[6] ?? 0)
      }
    }
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Nucleating',
  render,
  hero: 24,
  snaps: [{ frames: CLINK, box: [27, 0, 32, 4], colors: [GOLD[7] ?? 0], why: 'the rims clink: a flash where they touch' }],
}
