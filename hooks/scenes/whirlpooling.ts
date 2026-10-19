import { Canvas, TAU, beat, clamp, ease, hash, hex, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const CX = 31.5
const CY = 15.5
const FLAT = 0.7

const SEA = hex('040a1c 081733 0b2650 0d3a6c 0f5384 136c98 1a87a8 2ba1b4 4cb8bb 7fcfc4 b4e6d6')
const FOAM = hex('7fcfc4 c2ecdf eefbf4')
const HULL = hex('3a0c10 6e1a18 a82c20 d84a2c f0764a')
const PLANK = hex('5a3a24 8a6038 b88a52 dcb478')
const COAT = hex('8a6a10 e0b020 ffe070')
const ROCK = hex('121820 1f2a30 33403f 4d5a50 6f7a62 98a07a')
const MOSS = hex('2e4a2c 486a3a 6e8c4c')
const OAR = hex('4a2e1c 8a6038 c8a064')

function polar(x: number, y: number): [number, number] {
  const dx = x - CX
  const dy = (y - CY) / FLAT
  return [Math.hypot(dx, dy), Math.atan2(dy, dx)]
}

const SPIN = (f: number) => (TAU * f) / LOOP
const WIND = 2.1

function radius(f: number): number {
  if (f < 38) return 13.5 - 10.5 * ease.in(beat(f, 0, 38)) ** 0.8
  if (f < 46) return 3 - 0.6 * Math.sin(Math.PI * beat(f, 38, 46))
  if (f < 56) return 3 + 12.5 * ease.out(beat(f, 46, 56))
  return 15.5 - 2 * ease.inOut(beat(f, 56, LOOP))
}

const ANGLE: number[] = (() => {
  const steps = 8
  const raw = [0]
  for (let f = 0; f < LOOP; f++) {
    let a = 0
    for (let k = 0; k < steps; k++) a += 0.11 * (13.5 / radius(f + (k + 0.5) / steps)) ** 1.15 / steps
    raw.push((raw[f] ?? 0) + a)
  }
  const total = raw[LOOP] ?? 1
  const k = (TAU * Math.max(1, Math.round(total / TAU))) / total
  return raw.map(v => v * k + 2.2)
})()

function boatAt(f: number): [number, number] {
  const i = mod(f, LOOP)
  const a = (ANGLE[Math.floor(i)] ?? 0) + ((ANGLE[Math.floor(i) + 1] ?? 0) - (ANGLE[Math.floor(i)] ?? 0)) * (i - Math.floor(i))
  const r = radius(i)
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * FLAT]
}

function water(x: number, y: number, f: number): number {
  const [r, a] = polar(x, y)
  const dx = x - CX
  const dy = (y - CY) / FLAT
  const depth = 1 - smoothstep(1.5, 17, r)
  const slope = r > 1.5 ? Math.exp(-(r - 1.5) / 5) : 0
  const sun = r > 0.5 ? ((dx + dy) / (r * Math.SQRT2)) * slope * 2 : 0
  const phase = 3 * (a + WIND * Math.log(r + 0.8)) - 3 * SPIN(f)
  const s = Math.sin(phase)
  const arms = (1 - smoothstep(17, 31, r)) * smoothstep(2.2, 4, r)
  const streak = s > 0.8 ? 1.5 : s > 0.45 ? 0.6 : s < -0.55 ? -0.8 : 0
  const dash = Math.sin(TAU * (y / 5 + x / 26 - (3 * f) / LOOP)) > 0.9
  const gate = Math.sin(TAU * (x / 9 - y / 15 + (2 * f) / LOOP)) > 0.35
  const glint = r > 15 && dash && gate ? 1.1 * smoothstep(15, 22, r) : 0

  return 7.2 - depth * 6.4 + sun + streak * arms + glint - (r < 1.6 ? 1 : 0)
}

function boatPart(x: number, y: number, bx: number, by: number, heading: number): 'hull' | 'plank' | 'coat' | 'seat' | undefined {
  const dx = x - bx
  const dy = y - by
  const u = dx * Math.cos(heading) + dy * Math.sin(heading)
  const v = -dx * Math.sin(heading) + dy * Math.cos(heading)
  if (u < -3.9 || u > 4.5) return undefined
  const half = u < 1 ? 2 : 2 * (1 - (u - 1) / 3.5) ** 0.75
  if (Math.abs(v) > half) return undefined
  if (Math.abs(u) < 0.9 && Math.abs(v) < 0.9) return 'coat'
  if (Math.abs(v) > half - 0.85 || u < -3.1 || u > 3.5) return 'hull'
  return Math.abs(u + 2.2) < 0.5 ? 'seat' : 'plank'
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.fill((x, y) => shade(SEA, water(x, y, f), x, y))

    for (const p of particles(f, LOOP, 26, 30, 3)) {
      const r0 = 9 + p.r[1] * 16
      const r = r0 * (1 - p.age * 0.82)
      const a = p.r[2] * TAU + SPIN(f) - WIND * Math.log((r + 0.8) / (r0 + 0.8)) + p.age * 1.2
      const x = CX + Math.cos(a) * r
      const y = CY + Math.sin(a) * r * FLAT
      if (r < 2.4) continue
      const level = r < 5 ? 0 : p.age < 0.15 ? 0 : 1
      c.set(x, y, FOAM[level] ?? 0)
    }

    for (let y = 0; y < 8; y++) {
      for (let x = 52; x < W; x++) {
        const d = Math.hypot((x - 60.5) / 1.3, y + 0.5)
        const edge = 5.2 + Math.sin(x * 1.7) * 0.4 + Math.cos(y * 2.3) * 0.3
        if (d < edge) {
          const top = d < edge - 1.2 ? 1 : 0
          const lit = (61 - x + (2 - y)) * 0.25
          const isMoss = d < edge - 2 && y < 3
          c.set(x, y, isMoss ? shade(MOSS, 1 + lit, x, y) : shade(ROCK, 1.6 + top * 1.4 + lit, x, y))
        } else if (d < edge + 1.4) {
          const surf = Math.sin(TAU * ((2 * f) / LOOP) - d * 1.4 + x * 0.3)
          if (surf > -0.2) c.set(x, y, FOAM[surf > 0.6 ? 2 : 1] ?? 0)
        }
      }
    }

    const [bx, by] = boatAt(f)
    const [px, py] = boatAt(f - 1)
    const speed = Math.hypot(bx - px, by - py)
    const inThroat = smoothstep(35, 39, f) * (1 - smoothstep(45, 49, f))
    for (let k = 1; k <= Math.round(9 * (1 - inThroat)); k++) {
      const [wx, wy] = boatAt(f - k * 0.8)
      const [qx, qy] = boatAt(f - k * 0.8 - 0.5)
      const tx = wx - qx
      const ty = wy - qy
      const tl = Math.hypot(tx, ty) || 1
      const spread = 0.6 + k * 0.28
      const fade = k / (3 + speed * 6)
      if (fade > 1) break
      for (const side of [-1, 1]) {
        const x = wx - (ty / tl) * spread * side
        const y = wy + (tx / tl) * spread * side
        c.set(x, y, FOAM[fade < 0.4 ? 2 : fade < 0.75 ? 1 : 0] ?? 0)
      }
    }

    const [nx, ny] = boatAt(f + 0.5)
    const [ox, oy] = boatAt(f - 0.5)
    const spin = TAU * ease.inOut(beat(f, 37, 47))
    const heading = Math.round(((Math.atan2(ny - oy, nx - ox) + spin) / TAU) * 16) * (TAU / 16)
    const rbx = Math.round(bx * 2) / 2
    const rby = Math.round(by * 2) / 2
    for (let y = Math.floor(rby - 5); y <= Math.ceil(rby + 5); y++) {
      for (let x = Math.floor(rbx - 5); x <= Math.ceil(rbx + 5); x++) {
        if (boatPart(x - 1, y - 1, rbx, rby, heading) && !boatPart(x, y, rbx, rby, heading)) {
          c.set(x, y, shade(SEA, water(x, y, f) - 1.6, x, y))
        }
      }
    }
    for (let y = Math.floor(rby - 5); y <= Math.ceil(rby + 5); y++) {
      for (let x = Math.floor(rbx - 5); x <= Math.ceil(rbx + 5); x++) {
        const part = boatPart(x, y, rbx, rby, heading)
        if (!part) continue
        const lit = (rbx - x + (rby - y)) * 0.35 - (1 - smoothstep(3.2, 5.5, radius(f))) * 0.9
        const color =
          part === 'hull' ? shade(HULL, 2.6 + lit, x, y)
            : part === 'coat' ? shade(COAT, 1.4 + lit, x, y)
              : part === 'seat' ? shade(PLANK, 0.8 + lit, x, y)
                : shade(PLANK, 2 + lit, x, y)
        c.set(x, y, color)
      }
    }

    const isSpinning = f >= 37 && f < 49
    const stroke = isSpinning ? 0.9 * Math.sin(f * 1.9) : 0.55 * Math.sin((TAU * 6 * f) / LOOP)
    for (const side of [-1, 1]) {
      const a = heading + side * (Math.PI / 2 + stroke)
      for (let k = 1.6; k <= 4.6; k += 0.5) {
        const x = Math.round(rbx + Math.cos(a) * k)
        const y = Math.round(rby + Math.sin(a) * k)
        if (k < 2.4 && boatPart(x, y, rbx, rby, heading)) continue
        c.set(x, y, OAR[k > 3.8 ? 2 : 1] ?? 0)
      }
    }

    if (f >= 45 && f <= 52) {
      const t = (f - 45) / 7
      for (let i = 0; i < 9; i++) {
        const a = hash(i, 9) * TAU
        const d = 2.5 + t * (4 + hash(i, 10) * 4)
        const x = bx + Math.cos(a) * d
        const y = by + Math.sin(a) * d * FLAT
        if (t < 0.9 - hash(i, 11) * 0.3) c.set(x, y, FOAM[t < 0.4 ? 2 : 1] ?? 0)
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Whirlpooling', render, hero: 42 }
