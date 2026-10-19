import { Canvas, PALETTE, TAU, clamp, frames, hash, hex, shade, wave, type Ramp, type Scene } from '../engine'

const W = 64
const LOOP = 96

const SX = 32
const SY = 10
const SR = 3.6

const WALL = hex('06060e 0c0b19 141226 1e1832 2c2038 3e2a3a 573638 74483a')
const BRASS = PALETTE.gold
const WOOD = hex('0c0708 170d0d 241411 351c14 4a2818 63361d')
const SUN = hex('8a2c12 c4521c eb8a2c fac050 fee69a fffbe8')
const MARS = hex('1e0e18 46182a 7a2a2c b04a32 de7a44 f8b070')
const EARTH = hex('0a0e26 132250 1d4078 2a689e 4898bc 88cad4')
const GIANT = hex('1c1218 3a2422 683e2e 966438 c49456 e8c886')
const RING = hex('221e2a 443c4a 6f6474 a89ca6 dcd2c6')
const BOOKS = [hex('0e0a14 1c1220 2e1a26 4a2630'), hex('0a0e14 121c22 1a2c30 26403e'), hex('0e0c10 1e1a1a 322a22 4a3e2c')]

type Moon = { R: number; ry: number; turns: number; phase: number }
type Planet = {
  R: number; ry: number; turns: number; phase: number; r: number
  armY: number; ramp: Ramp; banded: boolean; ring: boolean; moons: Moon[]
}

const PLANETS: Planet[] = [
  { R: 9, ry: 2, turns: 3, phase: 0.35, r: 2, armY: 14, ramp: MARS, banded: false, ring: false, moons: [] },
  { R: 17, ry: 4, turns: 2, phase: 0.35, r: 2.3, armY: 16, ramp: EARTH, banded: false, ring: false,
    moons: [{ R: 4, ry: 1.4, turns: 8, phase: 0.2 }] },
  { R: 26, ry: 6, turns: 1, phase: 0.35, r: 3.2, armY: 18, ramp: GIANT, banded: true, ring: true,
    moons: [{ R: 7, ry: 2, turns: 4, phase: 2.4 }] },
]

const PLINTH_X0 = 19
const PLINTH_X1 = 45
const TABLE_Y = 30

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const t = f / LOOP
    const bodies = PLANETS.map(p => {
      const th = p.phase + TAU * p.turns * t
      return { p, th, x: Math.round(SX + p.R * Math.cos(th)), y: Math.round(SY + p.ry * Math.sin(th)), z: Math.sin(th) }
    })

    let cover = 0
    for (const b of bodies) {
      if (b.z <= 0) continue
      const d = Math.hypot(b.x - SX, b.y - SY)
      cover += clamp((SR + b.p.r - d) / (2 * b.p.r)) * (b.p.r / SR) ** 2
    }
    const fromAlign = Math.min(f, LOOP - f)
    const power = (1 + 0.05 * wave(f, LOOP, 6) + 0.3 * Math.exp(-((fromAlign / 4) ** 2))) * (1 - 0.7 * clamp(cover))
    const glow = (x: number, y: number) => power * Math.max(0, 1 - Math.hypot(x - SX, (y - SY) * 1.25) / 36) ** 1.5
    const brass = (x: number, y: number, extra = 0) => shade(BRASS, 1 + glow(x, y) * 4 + extra)

    c.fill((x, y) => (y < TABLE_Y ? shade(WALL, 0.7 + glow(x, y) * 7.2) : undefined))
    drawShelves(c, glow)
    for (let x = 0; x < W; x++) {
      c.set(x, TABLE_Y, shade(WOOD, 2.2 + glow(x, TABLE_Y) * 4))
      c.set(x, TABLE_Y + 1, shade(WOOD, 0.6 + glow(x, TABLE_Y + 1) * 1.6))
    }
    for (let x = PLINTH_X0 - 1; x <= PLINTH_X1 + 2; x++) c.set(x, TABLE_Y, shade(WOOD, 1 + glow(x, TABLE_Y) * 1.2))

    for (let x = PLINTH_X0; x <= PLINTH_X1; x++) {
      c.set(x, 19, brass(x, 19, 0.4))
      c.set(x, 20, shade(WOOD, 1.2 + glow(x, 20) * 1.6))
      c.set(x, 29, brass(x, 29, -0.8))
    }
    for (let y = 21; y <= 28; y++) {
      for (let x = PLINTH_X0 + 1; x <= PLINTH_X1 - 1; x++) {
        const edge = x === PLINTH_X0 + 1 ? -0.6 : x === PLINTH_X1 - 1 ? -0.3 : 0
        c.set(x, y, shade(WOOD, 1.8 + glow(x, y) * 2.2 + edge))
      }
    }
    for (let y = 21; y <= 27; y++) for (let x = 23; x <= 41; x++) c.set(x, y, shade(WOOD, y === 21 ? 0 : 0.5))
    drawGear(c, 28, 25, 3.1, 10, (TAU / 10) * 10 * t, 1.6, 21, 27)
    drawGear(c, 34, 23, 2.1, 7, -(TAU / 7) * 10 * t + 0.25, 1.5, 21, 27)
    drawGear(c, 38, 26, 1.9, 6, (TAU / 6) * 10 * t + 0.4, 1.2, 21, 27)
    for (let x = 23; x <= 41; x++) c.set(x, 28, shade(WOOD, 2.6 + glow(x, 28) * 2))
    c.set(PLINTH_X1 + 1, 24, brass(PLINTH_X1 + 1, 24, 0.5))
    c.set(PLINTH_X1 + 2, 24, brass(PLINTH_X1 + 2, 24, 0))
    c.set(PLINTH_X1 + 2, 25, brass(PLINTH_X1 + 2, 25, -0.5))

    const drawCalls: { z: number; draw: () => void }[] = []

    drawCalls.push({
      z: 0,
      draw: () => {
        for (let y = 13; y <= 18; y++) {
          c.set(SX - 1, y, brass(SX - 1, y, -0.6))
          c.set(SX, y, brass(SX, y, 1.4))
          c.set(SX + 1, y, brass(SX + 1, y, 0.2))
        }
        for (let x = SX - 2; x <= SX + 2; x++) c.set(x, 14, brass(x, 14, x === SX - 2 ? 0 : 1))
        for (let x = SX - 2; x <= SX + 2; x++) c.set(x, 18, brass(x, 18, 0.2))
        const flick = 0.15 * wave(f, LOOP, 8)
        c.disc(SX, SY, SR, (x, y) => {
          const d = Math.hypot(x - SX, y - SY) / SR
          return shade(SUN, 5.2 - d * d * 3.4 + flick - (x - SX + y - SY) * 0.12)
        })
      },
    })

    for (const b of bodies) {
      const { p } = b
      const ax = SX + p.R * Math.cos(b.th)
      const ay = p.armY + p.ry * Math.sin(b.th)
      drawCalls.push({
        z: b.z,
        draw: () => {
          c.line(SX + Math.sign(ax - SX) * 2, p.armY, ax, ay, (x, y) => brass(x, y, b.z > 0 ? 0 : -0.6))
          c.line(b.x, Math.round(ay), b.x, b.y + Math.ceil(p.r), (x, y) => brass(x, y, 0.3))
          c.set(b.x, Math.round(ay), brass(b.x, ay, 1))

          const moonsBehind = p.moons.map(m => moonAt(m, b, t)).filter(m => m.z < 0)
          const moonsFront = p.moons.map(m => moonAt(m, b, t)).filter(m => m.z >= 0)
          for (const m of moonsBehind) c.set(m.x, m.y, shade(RING, 2 + glow(m.x, m.y) * 2))
          if (p.ring) drawRing(c, b, false, glow)
          drawPlanet(c, b)
          if (p.ring) drawRing(c, b, true, glow)
          for (const m of moonsFront) c.set(m.x, m.y, shade(RING, 2 + glow(m.x, m.y) * 2))
        },
      })
    }
    drawCalls.sort((a, b) => a.z - b.z)
    for (const d of drawCalls) d.draw()
  })
}

type Body = { p: Planet; th: number; x: number; y: number; z: number }

function moonAt(m: Moon, b: Body, t: number) {
  const a = m.phase + TAU * m.turns * t
  return { x: b.x + Math.round(m.R * Math.cos(a)), y: b.y + Math.round(m.ry * Math.sin(a)), z: Math.sin(a) }
}

function drawPlanet(c: Canvas, b: Body): void {
  const { p } = b
  const lx = -Math.cos(b.th)
  const lz = -Math.sin(b.th)
  const top = p.ramp.length - 1
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d2 = (dx * dx + dy * dy) / (p.r * p.r)
      if (d2 > 1) continue
      const nz = Math.sqrt(1 - d2)
      const lam = (dx / p.r) * lx + nz * lz + (-dy / p.r) * 0.15
      const halo = (1 - nz) ** 2 * Math.max(0, -lz) * clamp(1.6 - Math.hypot(b.x - SX, b.y - SY) / 12)
      const band = p.banded && (b.y + dy) % 2 === 0 ? -0.6 : 0
      const level = 0.9 + Math.max(0, lam, halo * 1.4) * (top - 0.7) + band
      c.set(b.x + dx, b.y + dy, shade(p.ramp, level))
    }
  }
}

function drawRing(c: Canvas, b: Body, isFront: boolean, glow: (x: number, y: number) => number): void {
  const lx = -Math.cos(b.th)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const q = (dx / 5.8) ** 2 + (dy / 1.6) ** 2
      if (q > 1 || q < 0.42) continue
      if (dy > 0 !== isFront) continue
      const lit = 1.2 + (dx * lx > 0 ? 1.4 : 0) + glow(b.x + dx, b.y + dy) * 1.2
      c.set(b.x + dx, b.y + dy, shade(RING, lit))
    }
  }
}

function drawGear(c: Canvas, cx: number, cy: number, r: number, teeth: number, angle: number, base: number, y0: number, y1: number): void {
  const reach = Math.ceil(r + 1)
  const holes = [0, Math.PI].map(a => [cx + Math.round(Math.cos(angle + a) * r * 0.55), cy + Math.round(Math.sin(angle + a) * r * 0.55)])
  for (let y = Math.max(y0, cy - reach); y <= Math.min(y1, cy + reach); y++) {
    for (let x = cx - reach; x <= cx + reach; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)
      const isTooth = Math.cos(teeth * (Math.atan2(dy, dx) - angle)) > 0.25
      if (d > r + (isTooth ? 0.9 : 0)) continue
      const isHole = r > 2 && holes.some(([hx, hy]) => hx === x && hy === y)
      const lit = base + (-dy / r) * 0.9 + (-dx / r) * 0.4 + (d < 0.5 ? 1.6 : 0) + (isHole ? -2.4 : 0) + (d > r - 0.5 ? 0.7 : 0)
      c.set(x, y, shade(BRASS, lit))
    }
  }
}

function drawShelves(c: Canvas, glow: (x: number, y: number) => number): void {
  for (const [x0, x1] of [[0, 8], [56, 63]] as const) {
    for (const shelfY of [7, 17, 27]) {
      let x = x0
      let k = shelfY * 7 + x0
      while (x <= x1) {
        const w = 1 + Math.floor(hash(k, 1) * 2)
        const h = 5 + Math.floor(hash(k, 2) * 4)
        const ramp = BOOKS[Math.floor(hash(k, 3) * BOOKS.length)] ?? BOOKS[0] ?? []
        for (let i = 0; i < w && x + i <= x1; i++) {
          for (let y = shelfY - h; y < shelfY; y++) {
            c.set(x + i, y, shade(ramp, 0.6 + glow(x + i, y) * 4 + (i === w - 1 ? -0.5 : 0) + (y === shelfY - h + 1 ? 0.6 : 0)))
          }
        }
        x += w + (hash(k, 4) < 0.2 ? 1 : 0)
        k++
      }
      for (let xx = x0; xx <= x1; xx++) {
        c.set(xx, shelfY, shade(WOOD, 1.4 + glow(xx, shelfY) * 3))
        c.set(xx, shelfY + 1, shade(WOOD, 0.4))
      }
    }
  }
}

export const scene: Scene = { verb: 'Orbiting', render, hero: 72 }
