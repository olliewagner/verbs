import { PALETTE, beat, clamp, ease, frames, fract, hash, hex, lerp, mod, noise, particles, shade, smoothstep, threshold, type Scene } from '../engine'

const LOOP = 72

const PLASTER = hex('5e4a3c 7c6450 9a7f64 b49a7a cbb291 dec8a6 eddcbc f8eed6')
const MARBLE = hex('8a8580 aaa49e c6c0b8 dbd6ce ebe7df f7f4ee')
const COPPER = PALETTE.copper
const CARAMEL = hex('2a0c05 4a1806 70290a 963d0e b8561a d47826 e59c3a f0c060 f7dc94 fff3cf')
const SUGAR = hex('7d7f96 a4a5b8 cacbd6 e8e8ee ffffff')
const STEEL = PALETTE.metal
const STOVE = hex('0c0a0c 151215 1f1a1d 2a2428 3a3236 504548 6c5f60')
const FLAME = hex('16236e 2747c7 4f86ff a9d0ff')
const ENAMEL = hex('5c6478 8a92a6 b9c0cc e2e6ea fbfcfc')
const NAVY = hex('101a3a 1d2d5e 2e4486 4560a8')
const STEAM = hex('b8a68c d4c6ac e8dcc6 f6efe0 fffaf0')

const CX = 33
const RIM_Y = 19
const RX = 19
const RY = 5.5
const POOL_Y = 20.3
const POOL_RX = RX - 1.4
const POOL_RY = RY - 1.2
const BASE_Y = 24
const STOVE_Y = 23

const e2 = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
const inRim = (x: number, y: number) => e2(x, y, CX, RIM_Y, RX, RY) <= 1
const inMouth = (x: number, y: number) => e2(x, y, CX, RIM_Y, RX - 1, RY - 0.8) <= 1
const inPool = (x: number, y: number) => inMouth(x, y) && e2(x, y, CX, POOL_Y, POOL_RX, POOL_RY) <= 1
const inBody = (x: number, y: number) =>
  !inRim(x, y) && y >= RIM_Y && Math.abs(x - CX) <= RX && (y <= BASE_Y || e2(x, y, CX, BASE_Y, RX, 4) <= 1)
const POOL_TOP = POOL_Y - POOL_RY

const SPLASH_Y = 12

const inBeam = (x: number, y: number) => {
  const u = x - y * 0.55
  return u >= 22 && u < 31
}

const cook = (f: number) => 2.5 + 3.6 * ease.inOut(beat(f, 5, 26)) - 3.6 * ease.inOut(beat(f, 26, 50))

const heap = (f: number) => ease.out(beat(f, 1, 11)) * (1 - ease.inOut(beat(f, 12, 32)))
const HEAP_X = 24
const HEAP_Y = 20

function bowl(f: number) {
  const t = mod(f - 60, LOOP)
  const enter = ease.out(beat(t, 0, 9))
  const exit = ease.in(beat(t, 26, 34))
  const tilt = ease.inOut(beat(t, 8, 13)) - ease.inOut(beat(t, 22, 27))

  return { x: lerp(-12, 8, enter) - 22 * exit, y: lerp(-9, 3, enter) - 12 * exit, a: tilt * 1.05 }
}
const LIP_X = 8 + 6.5 * Math.cos(1.05)
const LIP_Y = 3 + 6.5 * Math.sin(1.05)

const DIP_X = 37
const LIFT = 47
const BREAK = 57

function spoon(f: number): { x: number; y: number } | undefined {
  if (f < 20 || f > 70) return undefined
  if (f < LIFT) return onHandle(APPROACH[f - 20] ?? 0)
  if (f < 63) {
    const t = smoothstep(0, 1, beat(f, LIFT, 59))
    return { x: lerp(DIP_X, 46, t), y: lerp(21, 3, t) }
  }
  return { x: 46 + f - 62, y: 3 - (f - 62) }
}

const APPROACH = [
  30, 28, 26, 24, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 10, 9, 9, 9,
  8, 7, 6, 5, 3, 1, 0,
]
const onHandle = (d: number) => ({ x: DIP_X + d, y: 21 - d })

type Px = [number, number, number]

function spoonPixels(f: number): Px[] {
  const s = spoon(f)
  if (!s) return []
  const out: Px[] = []
  const x = Math.round(s.x)
  const y = Math.round(s.y)
  for (let k = 2; k < 24; k++) {
    out.push([x + k, y - k + 1, 6.6])
    out.push([x + k + 1, y - k + 1, 2.8])
  }
  const isCoated = f >= LIFT
  for (const [dx, dy, l] of [
    [-1, -1, 7], [0, -1, 6.2], [1, -1, 5.4], [2, -1, 4.6],
    [-2, 0, 5.4], [-1, 0, 4.8], [0, 0, 4.2], [1, 0, 3.6], [2, 0, 3],
    [-1, 1, 2.6], [0, 1, 2.2], [1, 1, 1.8],
  ] as const) {
    const coat = isCoated && (dy === 1 || (dy === 0 && dx >= 0))
    out.push([x + dx, y + dy, coat ? 100 + (dy === 1 ? 0.6 : 1.6) : l])
  }

  return out
}

function ribbon(f: number): Px[] {
  const s = spoon(f)
  if (!s || f < LIFT + 1 || f > 66) return []
  const top = Math.round(s.y) + 2
  const foot = Math.round(POOL_TOP) + 1
  const footX = lerp(DIP_X, s.x, 0.6)
  const length = foot - top
  const out: Px[] = []
  if (length < 1) return out
  const sway = Math.sin(beat(f, LIFT, 60) * Math.PI) * 0.9
  const since = f - BREAK
  const breakAt = 0.5
  for (let y = top; y <= foot; y++) {
    const p = (y - top) / length
    if (since >= 0) {
      const drip = 2 + (breakAt * length - 2) * (1 - ease.outElastic(beat(since, 0, 7)))
      const fallen = breakAt + 0.12 * since * since
      const isUpper = y - top <= drip
      const isLower = p >= fallen && since < 4
      if (!isUpper && !isLower) continue
    }
    const x = Math.round(lerp(s.x, footX, p) - Math.sin(p * Math.PI) * sway)
    const isThin = since < 0 && length > 10 && Math.abs(p - breakAt) < (f >= BREAK - 3 ? 0.22 : 0.08)
    const g = Math.abs(p - fract((f - LIFT) / 7)) * length
    const bead = g < 0.6 ? 4.6 : g < 1.6 ? 2 : 0
    if (isThin) {
      out.push([x, y, 1.8 + bead])
    } else {
      out.push([x, y, 2.4 + bead])
      out.push([x + 1, y, 0.6 + bead * 0.4])
    }
  }

  return out
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const L = cook(f)
    const amber = clamp((6.1 - L) / 3.6)
    const sp = spoonPixels(f)
    const rb = ribbon(f)

    for (let y = 0; y < STOVE_Y; y++) {
      for (let x = 0; x < 64; x++) {
        const window = clamp(1 - Math.hypot(x + 8, y + 6) / 78)
        const sun = inBeam(x, y) ? 1 : 0
        if (y < SPLASH_Y - 1) {
          const n = noise(x * 0.16, y * 0.3, 0, 5)
          const patch = n > 0.7 ? 0.4 : n < 0.26 ? -0.35 : 0
          c.set(x, y, shade(PLASTER, 1.8 + window * 2.2 + sun * 2.6 + patch))
        } else if (y === SPLASH_Y - 1) {
          c.set(x, y, shade(COPPER, 4.4 + window * 1.6 + sun * 1.4 + (x % 21 === 9 ? 1.2 : 0)))
        } else if (y === SPLASH_Y) {
          c.set(x, y, shade(MARBLE, 1 + window + sun))
        } else {
          const vein = Math.abs(noise(x * 0.07 + y * 0.09, y * 0.16, 0, 9) - 0.5) < 0.022 ? -1.3 : 0
          const seam = x % 21 === 20 ? -1 : 0
          c.set(x, y, shade(MARBLE, 2.4 + window * 1.6 + sun * 1.2 + vein + seam - (y - SPLASH_Y) * 0.06))
        }
      }
    }
    for (let y = STOVE_Y; y < 29; y++) {
      for (let x = 0; x < 64; x++) {
        const back = y === STOVE_Y ? -0.8 : 0
        const sheen = y === STOVE_Y + 1 && x < 13 ? 1.4 : 0
        c.set(x, y, shade(STOVE, 1.6 + (y - STOVE_Y) * 0.14 + back + sheen))
      }
    }
    for (let x = 0; x < 64; x++) {
      c.set(x, 29, shade(STEEL, 5.2 - Math.abs(x - 16) * 0.04))
      c.set(x, 30, shade(STOVE, 2.2))
      c.set(x, 31, shade(STOVE, 1.3))
    }
    for (const kx of [5, 19, 47, 58]) {
      c.set(kx, 30, shade(STEEL, 5.4))
      c.set(kx + 1, 30, shade(STEEL, 3.6))
      c.set(kx, 31, shade(STEEL, 2.6))
      c.set(kx + 1, 31, shade(STEEL, 1.6))
    }

    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const x = CX + side * (14 + k)
        const n = Math.sin(f * 1.9 + k * 2.1 + side) + Math.sin(f * 0.7 - k)
        c.set(x, 27, shade(FLAME, 1.6 + n * 0.5))
        if (n > 0.4 && k < 2) c.set(x, 26, shade(FLAME, 2.2 + n * 0.4))
      }
    }

    for (let x = 0; x <= CX - RX; x++) {
      const y = Math.round(20 - (CX - RX - x) * 0.3)
      c.set(x, y - 1, shade(STEEL, 4.6 + (x < 5 ? 0.6 : 0)))
      c.set(x, y, shade(STEEL, 2.4))
      c.set(x, y + 1, shade(STEEL, 1.2))
    }

    for (let y = RIM_Y; y < 30; y++) {
      for (let x = CX - RX; x <= CX + RX; x++) {
        if (!inBody(x, y)) continue
        const nx = (x - CX) / RX
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx))
        const diffuse = Math.max(0, -0.55 * nx + 0.8 * nz)
        const d = Math.abs(nx + 0.45)
        const spec = d < 0.05 ? 2.2 : d < 0.12 ? 1 : 0
        const under = y > BASE_Y ? (y - BASE_Y) * 0.45 : 0
        const lip = inRim(x, y - 1) ? -0.8 : 0
        const bounce = nx > 0.86 ? 0.8 : 0
        c.set(x, y, shade(COPPER, 0.6 + diffuse * 4.4 + spec - under + lip + bounce))
      }
    }
    for (let x = CX - 13; x <= CX + 13; x++) if (!inBody(x, 28)) c.set(x, 28, shade(STOVE, 0.3))

    for (let y = Math.floor(RIM_Y - RY); y <= RIM_Y + RY; y++) {
      for (let x = CX - RX; x <= CX + RX; x++) {
        if (!inRim(x, y)) continue
        const nx = (x - CX) / RX
        if (!inMouth(x, y)) {
          const isFront = y >= RIM_Y
          const hot = isFront && nx > -0.62 && nx < -0.3 ? 1.6 : 0
          c.set(x, y, shade(COPPER, (isFront ? 5.4 : 4.4) - nx * 1.3 + hot))
        } else if (!inPool(x, y)) {
          c.set(x, y, shade(COPPER, 2.2 + nx * 1.8))
        }
      }
    }

    const h = heap(f)
    for (let y = Math.floor(RIM_Y - RY); y <= RIM_Y + RY; y++) {
      for (let x = CX - RX; x <= CX + RX; x++) {
        if (!inPool(x, y)) continue
        const depth = (y - POOL_TOP) / (POOL_RY * 2)
        const isEdge = !inPool(x - 1, y) || !inPool(x + 1, y) || !inPool(x, y + 1) || !inPool(x, y - 1)
        const d = Math.sqrt(e2(x, y, CX, POOL_Y, POOL_RX, POOL_RY))
        let level = L + 1.9 - d * 1.4 - depth * 1.1 - (isEdge ? 1 : 0)
        const gx = x - 18 + (y === Math.round(POOL_TOP) + 1 ? 1 : 0)
        if (!isEdge && y <= POOL_TOP + 2 && gx >= 0 && gx <= 6 && gx !== 3) level = 8.4 + (y <= POOL_TOP + 1 ? 0.6 : -0.6)
        if (h > 0.02 && e2(x, y, HEAP_X, HEAP_Y, 2.5 + 5 * h, 1 + 1.6 * h) <= 1) level = Math.max(level, L + 2)
        c.set(x, y, shade(CARAMEL, level))
      }
    }

    for (const b of particles(f, LOOP, 20, 10, 7)) {
      if (b.r[3] > 0.4 + amber * 0.6) continue
      const a = b.r[1] * Math.PI * 2
      const rr = 0.25 + Math.sqrt(b.r[2]) * 0.6
      const bx = Math.round(CX + Math.cos(a) * POOL_RX * rr)
      const by = Math.round(POOL_Y + 0.4 + Math.sin(a) * POOL_RY * rr)
      if (!inPool(bx - 1, by) || !inPool(bx + 2, by) || !inPool(bx, by - 1)) continue
      if (h > 0.05 && Math.abs(bx - HEAP_X) < 8) continue
      if (f >= 41 && f <= 60 && Math.abs(bx - DIP_X) < 5) continue
      const level = (d: number) => shade(CARAMEL, L + d - (by - POOL_TOP) * 0.25)
      if (b.age > 0.8) {
        c.set(bx, by, level(-0.6))
        c.set(bx + 1, by, level(0.6))
      } else if (b.age < 0.3 || b.r[0] < 0.35) {
        c.set(bx, by, level(2.6))
        c.set(bx + 1, by, level(1))
      } else {
        c.set(bx, by - 1, level(3.6))
        c.set(bx + 1, by - 1, level(2.4))
        c.set(bx - 1, by, level(1.2))
        c.set(bx, by, level(1.8))
        c.set(bx + 1, by, level(1.2))
        c.set(bx + 2, by, level(-0.6))
      }
    }

    if (h > 0.04) {
      const melt = beat(f, 12, 32)
      const rx = 0.8 + 4.2 * h
      const ry = 0.6 + 2.6 * h
      for (let y = Math.floor(HEAP_Y - ry); y <= HEAP_Y; y++) {
        for (let x = Math.floor(HEAP_X - rx); x <= Math.ceil(HEAP_X + rx); x++) {
          const e = e2(x, y, HEAP_X, HEAP_Y + 0.4, rx, ry)
          if (e > 1) continue
          const lit = -((x - HEAP_X) / rx) * 0.9 - ((y - HEAP_Y) / ry) * 0.7
          if (e > 1 - melt * 0.85 || y >= Math.round(HEAP_Y)) {
            c.set(x, y, shade(CARAMEL, 7.4 + lit * 0.9))
          } else {
            const sparkle = hash(x, y, Math.floor(f / 3)) > 0.9 ? 1.5 : 0
            c.set(x, y, shade(SUGAR, 2.2 + lit * 1.4 + sparkle))
          }
        }
      }
    }

    for (const p of particles(f, LOOP, 10, 18, 3)) {
      const x = Math.round(17 + p.r[1] * 30 + Math.sin(p.age * 5 + p.r[2] * 6) * 1.2)
      const y = Math.round(POOL_TOP - 1 - p.age * 13)
      const alpha = Math.sin(p.age * Math.PI) * (0.35 + amber * 0.45)
      if (y < 0 || (x >= 39 && x <= 52 && f >= 30 && f <= 70)) continue
      for (const dy of [0, 1]) {
        if (alpha * (dy ? 0.7 : 1) <= threshold(x, y + dy)) continue
        const lit = inBeam(x, y + dy) ? 2.6 : 0
        c.set(x, y + dy, shade(STEAM, 0.4 + alpha * 1.6 + lit * 0.6 - dy * 0.4))
      }
    }

    const s = spoon(f)
    const isDipped = s !== undefined && s.y > POOL_TOP + 1
    const surface = Math.round(POOL_TOP) + 1
    for (const [x, y, l] of sp) {
      if (isDipped && y >= surface && inPool(x, y)) continue
      c.set(x, y, l >= 100 ? shade(CARAMEL, L + (l - 100)) : shade(STEEL, l))
    }
    if (isDipped && s) {
      const ex = Math.round(s.x) + Math.round(s.y) - surface + 1
      c.set(ex - 1, surface, shade(CARAMEL, L + 3))
      c.set(ex + 2, surface, shade(CARAMEL, L + 2.2))
      c.set(ex - 2, surface + 1, shade(CARAMEL, L + 1.8))
      c.set(ex + 3, surface + 1, shade(CARAMEL, L + 1.4))
    }

    for (const [x, y, l] of rb) c.set(x, y, shade(CARAMEL, L + l + (inBeam(x, y) ? 1.4 : 0)))
    if (f > LIFT && f < BREAK + 4 && s) {
      const fx = Math.round(lerp(DIP_X, s.x, 0.6))
      const fy = surface + 1
      const r = 2.5 + ((f - LIFT) % 4) * 1.2
      for (let x = Math.floor(fx - r - 1); x <= Math.ceil(fx + r + 1); x++) {
        for (const y of [fy - 1, fy, fy + 1]) {
          const e = Math.sqrt(e2(x, y, fx + 0.5, fy, r, r * 0.34))
          if (Math.abs(e - 1) < 0.18 && inPool(x, y)) c.set(x, y, shade(CARAMEL, L + 1.6))
        }
      }
      c.set(fx - 1, fy, shade(CARAMEL, L + 1.8))
      c.set(fx, fy, shade(CARAMEL, L + 3))
      c.set(fx + 1, fy, shade(CARAMEL, L + 2.2))
      c.set(fx + 2, fy, shade(CARAMEL, L + 0.4))
    }

    const b = bowl(f)
    if (b.x > -11) {
      const cos = Math.cos(b.a)
      const sin = Math.sin(b.a)
      for (let y = Math.floor(b.y - 9); y <= b.y + 9; y++) {
        for (let x = Math.floor(b.x - 9); x <= b.x + 9; x++) {
          const dx = x - b.x
          const dy = y - b.y
          const lx = cos * dx + sin * dy
          const ly = -sin * dx + cos * dy
          if (ly < -0.6 || ly > 5.2) continue
          const half = 6.5 * Math.sqrt(Math.max(0, 1 - (Math.max(0, ly) / 5.4) ** 2))
          if (Math.abs(lx) > half) continue
          if (ly < 0.6) {
            c.set(x, y, shade(NAVY, 1.6 - lx * 0.12))
            continue
          }
          const nx = (lx / 6.5) * cos - (ly / 5.4) * sin
          const ny = (lx / 6.5) * sin + (ly / 5.4) * cos
          const lit = -0.7 * nx - 0.7 * ny
          c.set(x, y, Math.abs(lx) > half - 1 && ny > 0.2 ? shade(ENAMEL, 0.6 + lit) : shade(ENAMEL, 2.4 + lit * 2))
        }
      }
      if (b.a > 0.6) {
        c.set(LIP_X - 1, LIP_Y - 1, shade(SUGAR, 4))
        c.set(LIP_X, LIP_Y - 1, shade(SUGAR, 3))
        c.set(LIP_X - 2, LIP_Y - 2, shade(SUGAR, 3))
      }
    }

    const head = ease.in(beat(f, 0, 2.5))
    const tail = ease.in(beat(f, 10, 12.5))
    if (head > tail) {
      const endY = HEAP_Y - (0.6 + 2.6 * h)
      for (let k = 0; k <= 40; k++) {
        const t = k / 40
        if (t < tail || t > head) continue
        const x = lerp(LIP_X + 0.5, HEAP_X, t)
        const y = LIP_Y + (endY - LIP_Y) * t * t
        const twinkle = mod(Math.round(y) - f * 2, 3) === 0 ? 1 : 0
        c.set(x, y, shade(SUGAR, 2.6 + twinkle * 1.4 - t * 0.4))
      }
      for (const g of particles(f, 12, 6, 3, 11)) {
        if (f > 11) continue
        const t = 0.25 + g.r[1] * 0.7
        if (t > head) continue
        const x = lerp(LIP_X + 0.5, HEAP_X, t) + (g.r[2] < 0.5 ? -1 : 1) * (1 + g.age * 1.5)
        const y = LIP_Y + (endY - LIP_Y) * t * t + g.age * 2
        c.set(x, y, shade(SUGAR, 3.5))
      }
    }
  })
}

export const scene: Scene = { verb: 'Caramelizing', render, hero: 54 }
