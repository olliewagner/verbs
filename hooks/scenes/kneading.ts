import { beat, clamp, ease, frames, hex, lerp, noise, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 36

const BOARD = hex('1c130f 2a1d17 3a2a20 4c3829 60482f 765a3a 8e6e48')
const DUST = hex('4e4034 625244 786856 8e806c')
const SLATE = hex('0d1117 141a22 1c2430 263040 324054')
const DOUGH = hex('8a6a4c ae8e6a ccb08a e2cca4 f1e3c3 fcf6e6')
const SKIN = hex('3e1e1c 6e3428 9c5038 c06e4e d98e66 eaae86')
const SLEEVE = hex('18223a 26365c 3c5288 5e7ab0 8ea6d0')
const FLOUR = hex('a89c88 cec4b0 eae2d2 fbf8ee')
const GLAZE = hex('1a2846 2a4070 4468a0 ddd6c6 f3eee2')
const STEEL = hex('353a42 5a606a 8a9098 c0c4c8 eceeec')

const LX = -0.6
const LY = -0.8

function sunlit(x: number, y: number): number {
  const u = x + y * 0.7
  if (u < 4 || u > 44 || y > 24) return 0
  if (Math.abs(u - 24) < 1 || y === 11) return 0

  return 1
}

type Hand = { x: number; y: number; z: number }
type Pose = {
  cx: number
  cy: number
  a: number
  b: number
  theta: number
  lip: number
  seam: number
  seamAngle: number
  hands: readonly [Hand, Hand]
}

const UP = -Math.PI / 2
const REST_L: Hand = { x: 27, y: 19, z: 0 }
const REST_R: Hand = { x: 37, y: 19, z: 0 }

function pose(f: number): Pose {
  if (f < 14) {
    const wind = ease.inOut(beat(f, 3, 6)) * (1 - beat(f, 7, 9))
    const p = smoothstep(7, 11, f)
    const hand = (r: Hand, dx: number): Hand => ({ x: r.x + dx * p, y: r.y + 1.2 * wind - 5 * p, z: wind })
    return {
      cx: 32, cy: 13 - 2.4 * p, a: 6.5 + 2.9 * p, b: 9 - 1.6 * p, theta: UP, lip: -1,
      seam: 1 - p, seamAngle: Math.PI / 2,
      hands: [hand(REST_L, 1), hand(REST_R, -1)],
    }
  }
  if (f < 22) {
    const q = ease.inOut(beat(f, 15, 21))
    const reach = ease.inOut(beat(f, 14, 16))
    const cy = lerp(10.6, 13.2, q)
    const along = lerp(9.4, 6.2, q)
    const lipY = cy - along * (1 - q)
    const z = Math.sin(Math.PI * reach) * 0.9 + (reach >= 1 ? 0.4 * (1 - q) : 0)
    const hand = (x: number): Hand => ({ x, y: lerp(14, lipY + 3, reach), z })
    return {
      cx: 32, cy, a: along, b: lerp(7.4, 8.8, q), theta: UP, lip: q,
      seam: 0, seamAngle: 0,
      hands: [hand(lerp(28, 27.5, q)), hand(lerp(36, 36.5, q))],
    }
  }
  const t = ease.inOut(beat(f, 22, 30))
  const s = ease.inOut(beat(f, 30, 35))
  const turn = UP * t
  const swing = turn * 0.55
  const around = (dx: number, dy: number): Hand => ({
    x: 32 + dx * Math.cos(swing) - dy * Math.sin(swing),
    y: 13.2 + dx * Math.sin(swing) + dy * Math.cos(swing),
    z: 0,
  })
  const settle = (from: Hand, to: Hand): Hand => ({ x: lerp(from.x, to.x, s), y: lerp(from.y, to.y, s), z: Math.sin(Math.PI * s) * 0.8 })
  return {
    cx: 32, cy: lerp(13.2, 13, s), a: lerp(8.8, 6.5, s), b: lerp(6.2, 9, s), theta: turn,
    lip: -1, seam: 1, seamAngle: turn,
    hands: [settle(around(-4.5, 3), REST_L), settle(around(4.5, 3), REST_R)],
  }
}

function board(x: number, y: number): readonly [readonly number[], number] {
  const isBoard = x >= 3 && x <= 60 && y >= 1 && y <= 27 && !((x === 3 || x === 60) && (y === 1 || y === 27))
  const sun = 1 - (x / 64 + y / 32) / 2
  const bd = Math.hypot((x - 61) / 8, (y - 0.5) / 6)
  if (bd <= 1) {
    if (bd > 0.84) return [GLAZE, x < 56 && y > 2 ? 1.4 : 2]
    if (bd > 0.7) return [GLAZE, 3.4 + (x < 57 ? 0.6 : 0)]
    return [FLOUR, 2.6 - (bd > 0.56 ? 1 : 0) + (x < 59 && y < 3 ? 0.6 : 0)]
  }
  if (Math.hypot((x - 62.5) / 8, (y - 2) / 6) <= 1) return isBoard ? [BOARD, 1.2] : [SLATE, 0.3]
  if (x >= 5 && x <= 11 && y >= 19 && y <= 23) {
    if (y === 19) return [BOARD, x === 5 ? 5 : 3.6]
    return [STEEL, y === 20 ? 4 : x === 11 ? 1.4 : 2.4 + (x < 8 ? 0.6 : 0)]
  }
  if ((x === 12 && y >= 20 && y <= 24) || (y === 24 && x >= 6 && x <= 12)) return [BOARD, 1.4]
  if (!isBoard) {
    if (y >= 28 && y <= 29 && x >= 3 && x <= 60) return [BOARD, y === 28 ? 1.6 : 0.8]
    const vein = noise(x * 0.2, y * 0.3, 0, 7) > 0.7 ? 0.7 : 0
    return [SLATE, 1.2 + sun * 1.4 + vein]
  }
  const grain = noise(x * 0.05, y * 0.8, 0, 3) > 0.6 ? -0.8 : 0
  const edge = x === 3 || y === 1 ? 1.2 : x === 60 ? -0.8 : 0
  const ring = Math.hypot((x - 32) / 13.5, (y - 13.5) / 9.6) + (noise(x * 0.14, y * 0.22, 0, 11) - 0.5) * 0.5
  const print = Math.hypot((x - 15) / 2.6, (y - 8) / 2.2) < 1 || ([14, 15, 16, 17].includes(x) && y >= (x === 14 || x === 17 ? 5 : 4) && y <= 5)
  if (ring < 1 || print) return [DUST, (ring < 0.8 ? 2.2 : 1.2) + sun * 0.8 - (print ? 0.6 : 0)]

  return [BOARD, 3.2 + sun * 1.8 + grain + edge]
}

function drawHands(p: Pose): { color: Int32Array; shadow: Uint8Array } {
  const color = new Int32Array(W * H).fill(-1)
  const shadow = new Uint8Array(W * H)
  p.hands.forEach((h, k) => {
    const side = k === 0 ? 1 : -1
    const hx = Math.round(h.x)
    const hy = Math.round(h.y)
    const lift = h.z * 0.6
    const cells = new Map<number, number>()
    const sleeves = new Set<number>()
    const wx = hx
    const wy = hy + 2
    const dx = (k === 0 ? 19 : 45) - wx
    const dy = 37 - wy
    const len = Math.hypot(dx, dy)
    const nx = -dy / len
    const ny = dx / len
    const toLight = Math.sign(nx * LX + ny * LY) || 1
    for (let y = Math.max(0, wy - 1); y < H; y++) {
      for (let x = Math.min(wx, wx + dx) - 6; x <= Math.max(wx, wx + dx) + 6; x++) {
        const t = clamp(((x - wx) * dx + (y - wy) * dy) / (len * len))
        const ex = x - (wx + t * dx)
        const ey = y - (wy + t * dy)
        const half = lerp(1.7, 3.6, t)
        if (Math.hypot(ex, ey) > half) continue
        const lit = ((ex * nx + ey * ny) / half) * toLight
        const key = y * W + x
        if (y >= 28) {
          sleeves.add(key)
          cells.set(key, (y === 28 ? 3.2 : 1.8) + lit * 0.9)
        } else cells.set(key, 2.6 + lit * 1.2 + lift)
      }
    }
    for (let y = hy - 3; y <= hy + 3; y++) {
      for (let x = hx - 3; x <= hx + 3; x++) {
        if (((x - hx) / 2.5) ** 2 + ((y - hy) / 2.1) ** 2 <= 1) cells.set(y * W + x, 3.2 - (x - hx) * 0.15 - (y - hy) * 0.25 + lift)
      }
    }
    ;[-2, -1, 0, 1].forEach((d, i) => {
      const reach = i === 0 ? 2 : 3
      for (let j = 1; j <= reach; j++) cells.set((hy - 2 - j) * W + hx + d * side, 3.5 - (i % 2) * 0.9 + (j === reach ? 0.5 : 0) + lift)
    })
    cells.set((hy - 2) * W + hx + 3 * side, 3.6 + lift)
    cells.set((hy - 1) * W + hx + 3 * side, 2.8 + lift)
    const off = Math.round(1 + h.z * 2)
    for (const [key, level] of cells) {
      const x = key % W
      const y = Math.floor(key / W)
      if (y < 0 || y >= H || x < 0 || x >= W) continue
      const isSleeve = sleeves.has(key)
      const isRim = !cells.has(key + 1) || !cells.has(key + W) || (!cells.has(key - 1) && side < 0)
      color[key] = isSleeve ? shade(SLEEVE, level + sunlit(x, y) * 0.6) : shade(SKIN, level - (isRim ? 1.3 : 0) + sunlit(x, y) * 0.6 - 0.3)
      if (x + off < W && y + off < H) shadow[(y + off) * W + x + off] = 1
    }
  })

  return { color, shadow }
}

type Puff = { at: number; x: number; y: number; vx: number; vy: number; life: number; size: number }

const PUFFS: Puff[] = []
const burst = (at: number, list: readonly (readonly [number, number, number, number])[], life: number, size: number) => {
  for (const [x, y, vx, vy] of list) PUFFS.push({ at, x, y, vx, vy, life, size })
}
burst(8, [[22, 14, -0.5, 0.05], [41, 17, 0.45, 0.2], [25, 5, -0.4, -0.25]], 10, 1.05)
burst(9, [[42, 9, 0.5, -0.1], [23, 19, -0.35, 0.3]], 9, 0.8)
burst(10, [[35, 1.5, 0.15, -0.2]], 7, 0.7)
burst(20, [[22, 13, -0.4, 0], [42, 13, 0.4, 0]], 8, 0.75)
burst(33, [[23, 18, -0.3, 0.15], [41, 18, 0.3, 0.15]], 6, 0.55)

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const p = pose(f)
    const { color: hands, shadow: handShadow } = drawHands(p)
    const ca = Math.cos(p.theta)
    const sa = Math.sin(p.theta)
    const local = (x: number, y: number) => {
      const dx = x - p.cx
      const dy = y - p.cy
      return [(dx * ca + dy * sa) / p.a, (-dx * sa + dy * ca) / p.b] as const
    }
    const inDough = (x: number, y: number) => {
      const [u, v] = local(x, y)
      return u * u + v * v <= 1
    }
    const lipY = p.lip >= 0 ? p.cy - p.a * (1 - p.lip) : -99
    const size = Math.max(p.a, p.b)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const key = y * W + x
        const hand = hands[key] ?? -1
        if (hand >= 0) {
          c.set(x, y, hand)
          continue
        }
        const shaded = handShadow[key] ? 1.3 : 0
        if (inDough(x, y)) {
          const [u, v] = local(x, y)
          const sx = (x - p.cx) / size
          const sy = (y - p.cy) / size
          const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v))
          let level = 1.3 + ((sx * LX + sy * LY) * 1.1 + nz * 0.8) * 2.4 - shaded + sunlit(x, y) * 0.7
          if (!inDough(x + 1, y) || !inDough(x, y + 1)) level -= 1
          if (p.lip >= 0) {
            if (y < lipY - 0.5) level += 0.4
            else if (y < lipY + 0.5) level += 1.2
            else if (y < lipY + 1.5) level -= 1.5
          }
          if (p.seam > 0.3) {
            const along = (x - p.cx) * Math.cos(p.seamAngle) + (y - p.cy) * Math.sin(p.seamAngle)
            const across = -(x - p.cx) * Math.sin(p.seamAngle) + (y - p.cy) * Math.cos(p.seamAngle) - 0.09 * along * along
            if (Math.abs(across) < 0.5 && Math.abs(along) < 4) level += 0.8 * p.seam
            else if (Math.abs(across - 1) < 0.5 && Math.abs(along) < 3) level -= 0.8 * p.seam
          }
          const spot = [[0.5, 0.15], [-0.15, 0.5], [-0.5, -0.15], [0.15, -0.5]].some(([su, sv]) => Math.abs(u - (su ?? 0)) < 0.15 && Math.abs(v - (sv ?? 0)) < 0.12)
          if (spot) level += 0.9
          c.set(x, y, shade(DOUGH, level))
          continue
        }
        const [ramp, level] = board(x, y)
        const doughShadow = inDough(x - 2, y - 2) || inDough(x - 1, y - 2) || inDough(x - 2, y - 1) ? 1.4 : 0
        c.set(x, y, shade(ramp, level - Math.max(doughShadow, shaded) + sunlit(x, y) * (doughShadow || shaded ? 0.6 : 1.9) - 0.9))
      }
    }

    for (const q of PUFFS) {
      const age = (f - q.at + LOOP) % LOOP
      if (age < 0 || age >= q.life) continue
      const t = age / q.life
      const r = Math.max(0.6, (0.6 + 3.5 * ease.out(t)) * q.size)
      const px = q.x + q.vx * age * 1.3
      const py = q.y + q.vy * age * 1.3 - age * 0.1
      const reach = t < 0.6 ? 1 - t * 0.3 : 0.82 * (1 - t) / 0.4
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          const d = Math.hypot(x - px, (y - py) * 1.15) / r
          if (d > reach) continue
          c.set(x, y, shade(FLOUR, 3 - t * 2.2 - (d > reach * 0.6 ? 0.9 : 0) - (x > px && y > py ? 0.5 : 0)))
        }
      }
    }
  })
}

export const scene: Scene = { verb: 'Kneading', render, hero: 9 }
