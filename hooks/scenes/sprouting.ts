import { clamp, ease, frames, hex, lerp, loopNoise, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const FACADE = hex('07080f 0b0d19 11142a 181d3a')
const GLOW = hex('1e1220 3a2028 5e3428 8a5030 b47038 d89a48')
const CYAN = hex('0c1624 12283e 1c4458 2c6476 4e98a6 98d8d8 e4fff6')
const PAVE = hex('080a12 0d1019 131722 1a1f2d 232a3a 2e374a 3c475e')
const RAIN = hex('2c3650 485674 7482a6 b0bedc')
const LEAF = hex('0c200e 163a16 22581c 34801f 52a428 80c838 b4e65a e6fca0')
const SOIL = hex('140c0c 26180f 3a2617 54381f 6e4a28')
const PIGEON = hex('15161f 242838 383e54 50576e 6e7590 9298b0 bcc0d2 e4e6ee')
const NECK = hex('123030 1e5048 2e7a5c 3a2a58 5a3c7a')
const IRIS = 0xf08a2a
const CERE = 0xdcdce4

const SX = 31
const SY = 25
const STEM = 11
const LEAF_LEN = 8.5
const LEAF_HALF = 2.3

const SILL = 7
const KERB = 10
const SHOP = [0, 27] as const
const DOOR = [29, 37] as const
const LAUNDRY = [39, 63] as const

const CRACK: readonly (readonly [number, number])[] = [[0, 27], [5, 26], [9, 27], [14, 26], [19, 26], [23, 25], [27, 26], [SX, 26], [35, 25], [39, 25], [43, 24], [48, 25], [53, 24], [58, 24], [63, 23]]
const BRANCH: readonly (readonly [number, number])[] = [[43, 24], [45, 27], [46, 29], [49, 31]]
const JOINT_Y = 16
const jointX = (x0: number, y: number) => 32 + ((x0 - 32) * (y + 12)) / 43

const HEAVE = [8, 18] as const
const ARCH = [18, 30] as const
const STRAIGHT = [30, 38] as const
const SWING = [31, 41] as const
const UNFURL = 41
const OPEN = [0, 0.06, 0.18, 0.36, 0.56, 0.76, 0.92, 1.03, 1.07, 1.03]
const DROP = [46, 53] as const
const PECK = 84

type Head = { x: number; y: number; tilt: number; isGulping: boolean }

const ENTER = 62
const TRACK: readonly (readonly [number, number, number])[] = [
  [-9, -4, 0], [-7, -3, 0], [-4, -2, 0], [0, 0, 0], [3, 1, 0], [5, 2, 0], [5, 2, 0], [5, 2, 0],
  [7, 3, 0], [10, 5, 0], [13, 7, 0], [15, 8, 0], [16, 9, 0], [17, 9, 0], [17, 9, 0], [17, 9, 0],
  [17, 10, 1], [17, 10, 1], [17, 10, 1], [16, 9, 1], [19, 11, 1], [22, 13, 1], [20, 12, 1], [18, 10, 0],
  [17, 9, 0], [17, 10, 0], [17, 10, 0], [16, 9, 0], [15, 7, 0], [14, 5, 0], [13, 3, 0], [12, 1, 0],
  [11, -1, 0], [10, -3, 0], [9, -4, 0], [8, -6, 0],
]
function headAt(f: number): Head | undefined {
  const step = TRACK[f - ENTER] ?? TRACK[f + LOOP - ENTER]
  if (!step) return undefined
  const [x, y, tilt] = step
  return { x, y, tilt, isGulping: f >= 85 && f < 89 }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    for (let y = 0; y < KERB; y++) {
      for (let x = 0; x < W; x++) {
        let color = shade(FACADE, y === SILL ? 3 : y > SILL ? 1.4 : 2)
        if (y < SILL && x >= SHOP[0] && x <= SHOP[1]) {
          const lamp = 2.6 - y * 0.18 + Math.max(0, 1 - Math.abs(x - 10) / 10) * 0.8
          const pot = [[5, 4.5], [13, 3.5], [22, 4]].some(([px, r]) => Math.hypot((x - (px ?? 0)) / (r ?? 1), (y - 4.5) / 4) < 1)
          const potEdge = [[5, 4.5], [13, 3.5], [22, 4]].some(([px, r]) => Math.hypot((x - (px ?? 0)) / ((r ?? 1) + 1.2), (y - 4.5) / 5) < 1)
          color = shade(GLOW, lamp - (pot ? 1.8 : potEdge ? 0.8 : 0))
        }
        if (y < SILL && x >= LAUNDRY[0] && x <= LAUNDRY[1]) {
          const port = [44, 52, 60].map(px => Math.hypot(x - px, (y - 2) * 1.1)).reduce((a, b) => Math.min(a, b), 99)
          color = shade(CYAN, port < 2 ? 1.2 : port < 3.4 ? 3 : 2.2)
        }
        if (x >= DOOR[0] && x <= DOOR[1]) color = shade(FACADE, x === DOOR[0] || x === DOOR[1] ? 0 : y < SILL ? 1 : 0.6)
        if (y === KERB - 1) color = FACADE[0] ?? 0
        c.set(x, y, color)
      }
    }
    for (let y = KERB; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fade = clamp(1 - (y - KERB) / 13) ** 1.2
        const streak = loopNoise(x * 0.42, 0.5, Math.floor(f / 6) / (LOOP / 6), 2, 11)
        const band = streak > 0.55 ? 1 : streak > 0.38 ? 0.6 : 0.25
        const isJoint = y === JOINT_Y || [-30, 8, 56, 94].some(x0 => Math.round(jointX(x0, y)) === x)
        let color = shade(PAVE, 2 + (y - KERB) * 0.09 - (isJoint ? 1.4 : 0))
        const warm = x > SHOP[0] && x < SHOP[1] - 1 ? fade * band : 0
        const cool = x > LAUNDRY[0] + 1 && x < LAUNDRY[1] ? fade * band * 0.9 : 0
        if (warm > 0.2) color = shade(GLOW, 0.6 + warm * 3 - (isJoint ? 1 : 0))
        else if (cool > 0.2) color = shade(CYAN, 0.6 + cool * 2.6 - (isJoint ? 1 : 0))
        c.set(x, y, color)
      }
    }
    for (const path of [CRACK, BRANCH]) {
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, ay] = path[i] ?? [0, 0]
        const [bx, by] = path[i + 1] ?? [0, 0]
        c.line(ax, ay - 1, bx, by - 1, PAVE[4] ?? 0)
      }
    }
    for (const path of [CRACK, BRANCH]) {
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, ay] = path[i] ?? [0, 0]
        const [bx, by] = path[i + 1] ?? [0, 0]
        c.line(ax, ay, bx, by, PAVE[0] ?? 0)
      }
    }
    for (let x = SX - 3; x <= SX + 3; x++) c.set(x, SY + 1, shade(SOIL, Math.abs(x - SX) < 2 ? 2 : 1))
    for (let x = SX - 2; x <= SX + 2; x++) c.set(x, SY + 2, SOIL[0] ?? 0)
    const isEaten = f >= PECK
    const heave = smoothstep(HEAVE[0], HEAVE[1], f)
    const arch = ease.out(smoothstep(ARCH[0], ARCH[1], f))
    const rise = ease.inOut(smoothstep(STRAIGHT[0], STRAIGHT[1], f))
    const open = OPEN[f - UNFURL] ?? (f < UNFURL ? 0 : 1)
    const dropT = f - DROP[1]
    const dip = dropT >= 0 ? Math.exp(-dropT / 5) * Math.cos(dropT * 0.9) : 0
    let bead: [number, number] | undefined
    if (!isEaten) {
      if (heave > 0 && rise === 0) {
        const mound = Math.round(heave * 2)
        for (let k = 0; k < mound; k++) for (let x = SX - 2 + k; x <= SX + 2 - k; x++) c.set(x, SY - k, shade(SOIL, 2.4 + (k === mound - 1 ? 1 : 0) - (x > SX ? 0.6 : 0)))
      }
      if (f >= 13 && f < 26) {
        const k = f - 13
        c.set(SX + 3 + Math.min(4, Math.floor(k / 2)), SY - 1 + Math.min(1, Math.floor(k / 3)), SOIL[4] ?? 0)
        c.set(SX - 3 - Math.min(3, Math.floor(k / 3)), SY - 1 + Math.min(1, Math.floor(k / 4)), SOIL[3] ?? 0)
      }
      if (arch > 0 && rise === 0) {
        const top = SY - Math.round(arch * 6)
        const lift = clamp(f - 27, 0, 3)
        for (let y = top + 1; y <= SY; y++) {
          c.set(SX - 1, y, shade(LEAF, 5))
          c.set(SX, y, shade(LEAF, 4))
          if (y > SY - lift) continue
          const isTip = lift > 0 && y === SY - lift
          c.set(SX + 2, y, shade(LEAF, isTip ? 6.4 : 4.4))
          c.set(SX + 3, y, shade(LEAF, isTip ? 5.6 : 3))
        }
        for (let x = SX; x <= SX + 2; x++) c.set(x, top, shade(LEAF, 6))
        c.set(SX - 1, top + 1, shade(LEAF, 5.6))
        c.set(SX + 3, top + 1, shade(LEAF, 3.6))
        c.set(SX + 1, top + 1, shade(LEAF, 2))
      }
      if (rise > 0) {
        const folded = 1 - clamp((f - SWING[0]) / (SWING[1] - SWING[0]))
        const crown = folded * 1.5
        const height = Math.round(lerp(6, STEM, rise))
        const sway = Math.round(dip * 1.4)
        const topY = SY - height
        for (let y = topY; y <= SY; y++) {
          const up = (SY - y) / height
          const lean = Math.round(up * crown) + (up > 0.6 ? sway : 0)
          c.set(SX - 1 + lean, y, shade(LEAF, 5 + (y < topY + 2 ? 0.6 : 0)))
          c.set(SX + lean, y, shade(LEAF, 3.4))
        }
        const tx = SX - 0.5 + crown + sway
        const swing = 2.77 * folded
        const len = LEAF_LEN - folded * 2.5
        const width = LEAF_HALF - folded * 0.7
        const leaf = (side: number, angle: number, smear?: number) => {
          const dx = Math.cos(angle)
          const dy = Math.sin(angle)
          for (let y = topY - 10; y <= topY + 4; y++) {
            for (let x = Math.floor(tx - 10); x <= tx + 10; x++) {
              const u = (x - tx) * dx + (y - topY) * dy
              const v = -(x - tx) * dy + (y - topY) * dx
              if (u < 0.2 || u > len) continue
              const half = width * Math.sin(Math.PI * (u / len) ** 0.75)
              if (Math.abs(v) > half) continue
              const lit = ((side < 0 ? clamp(open * 2) : 0) - 0.5) * half
              const isUpper = Math.abs(v - lit) <= half / 2
              const isEdge = Math.abs(v) > half - 0.8
              const level = isUpper ? (u > len * 0.55 ? 6.4 : 5.6) : isEdge ? 2.6 : 3.8
              c.set(x, y, shade(LEAF, smear ?? level + (side < 0 ? 0.3 : 0)))
            }
          }
        }
        const spread = open * 1.2
        const rightDip = dip * 0.5
        if (folded > 0 && folded < 1) leaf(1, -Math.PI / 2 + swing + 2.77 / (SWING[1] - SWING[0]), 3)
        leaf(-1, -Math.PI / 2 - spread + swing)
        leaf(1, -Math.PI / 2 + spread + rightDip + swing)
        if (dropT >= 0) {
          const a = -Math.PI / 2 + spread + rightDip
          bead = [Math.round(tx + Math.cos(a) * 5.5 + 0.5), Math.round(topY + Math.sin(a) * 5.5) - 2]
        }
      }
    } else {
      c.set(SX - 1, SY, SOIL[3] ?? 0)
      c.set(SX, SY, SOIL[2] ?? 0)
      c.set(SX + 1, SY, SOIL[3] ?? 0)
    }
    if (f >= DROP[0] && f < DROP[1]) {
      const k = (f - DROP[0] + 1) / (DROP[1] - DROP[0])
      const y = Math.round(lerp(-2, 9, k * k))
      for (const [dx, dy, lv] of [[0, 0, 6], [1, 0, 5], [0, -1, 5], [1, -1, 4], [0, -2, 3]] as const) c.set(37 + dx, y + dy, CYAN[lv] ?? 0)
    }
    if (bead && !isEaten) {
      const [bx, by] = bead
      if (dropT < 2) {
        for (const [ox, oy] of [[-2, 0], [3, 0], [-1, -2], [2, -2], [0, -3], [1, -3]] as const) c.set(bx + ox, by + oy, CYAN[dropT === 0 ? 6 : 5] ?? 0)
      }
      c.sprite(bx - 1, by - 1, ['.L.', 'LHM', '.MD'], { L: CYAN[5] ?? 0, H: CYAN[dropT % 12 < 2 ? 6 : 5] ?? 0, M: CYAN[4] ?? 0, D: CYAN[3] ?? 0 })
      if (dropT % 12 === 0 && dropT > 0) {
        c.set(bx - 1, by - 2, 0xffffff)
        c.set(bx + 1, by - 2, CYAN[5] ?? 0)
      }
    }
    const p = headAt(f)
    if (p) {
      const neck = (x: number, y: number) => {
        const t = clamp(((x - p.x + 1) * -0.6 + (y - p.y - 1) * -0.8) / 18)
        const cx = p.x - 1 - t * 18 * 0.6
        const cy = p.y + 1 - t * 18 * 0.8
        return { d: Math.hypot(x - cx, y - cy), side: (x - cx) * 0.8 - (y - cy) * 0.6, t }
      }
      for (let y = p.y - 16; y <= p.y + 6; y++) {
        for (let x = p.x - 16; x <= p.x + 3; x++) {
          const n = neck(x, y)
          const r = 3.6 + n.t * 1.6 + (p.isGulping && n.t < 0.25 && n.t > 0.05 ? 0.8 : 0)
          if (n.d > r) continue
          const band = n.side < -r * 0.35 ? 1 : n.side > r * 0.45 ? -1 : 0
          const isSheen = n.t < 0.3
          c.set(x, y, isSheen ? shade(NECK, band > 0 ? 2 : band < 0 ? 3 : 1) : shade(PIGEON, 3 + band * 1.2))
        }
      }
      for (let y = p.y - 4; y <= p.y + 4; y++) {
        for (let x = p.x - 4; x <= p.x + 5; x++) {
          const dx = (x - p.x - 0.5) / 4.4
          const dy = (y - p.y) / 3.3
          if (dx * dx + dy * dy > 1) continue
          const lit = -dx * 0.6 - dy * 0.9
          c.set(x, y, shade(PIGEON, 4.4 + (lit > 0.5 ? 1.6 : lit > 0 ? 0.8 : lit > -0.6 ? 0 : -1.2)))
        }
      }
      const bx = p.x + 5
      const by = p.y + p.tilt
      for (let k = 0; k < 4; k++) c.set(bx + k, by + Math.round(k * p.tilt * 0.5), shade(PIGEON, k === 3 ? 2 : 3))
      for (let k = 1; k < 3; k++) c.set(bx + k, by + 1 + Math.round(k * p.tilt * 0.5), PIGEON[1] ?? 0)
      c.set(bx, by - 1, CERE)
      c.set(bx + 1, by - 1 + Math.round(p.tilt * 0.5), CERE)
      const ex = p.x + 2
      const ey = p.y - 1
      c.set(ex, ey, IRIS)
      c.set(ex - 1, ey, IRIS)
      c.set(ex, ey - 1, IRIS)
      c.set(ex - 1, ey - 1, PIGEON[0] ?? 0)
      if (f >= 84 && f < 87) {
        c.set(bx + 3, by + 1, LEAF[6] ?? 0)
        c.set(bx + 4, by + 1, LEAF[5] ?? 0)
        c.set(bx + 3, by + 2, LEAF[4] ?? 0)
        if (f < 86) c.set(bx + 2, by + 2, LEAF[5] ?? 0)
      }
    }
    for (const d of particles(f, LOOP, 150, 4, 3)) {
      const depth = d.r[2]
      const groundY = lerp(KERB + 1, H + 2, depth)
      const y = lerp(-4, groundY, d.age)
      const x = d.r[1] * 74 - 4 - y * 0.3
      const level = 0.4 + depth * 1.6
      for (let k = 0; k < (depth > 0.6 ? 3 : 2); k++) c.set(x + k * 0.3, y - k, shade(RAIN, level - k * 0.7))
    }
    for (const s of particles(f, LOOP, 50, 3, 9)) {
      const x = Math.round(s.r[1] * 64)
      const y = Math.round(lerp(KERB + 2, H - 1, s.r[2]))
      if (Math.abs(x - SX) < 9 && y < SY + 2) continue
      if (s.t === 0) c.set(x, y, RAIN[2] ?? 0)
      else if (s.t === 1) {
        c.set(x - 1, y - 1, RAIN[1] ?? 0)
        c.set(x + 1, y - 1, RAIN[1] ?? 0)
      }
    }
  })
}
export const scene: Scene = {
  verb: 'Sprouting',
  render,
  hero: 60,
  snaps: [
    { frames: 27, box: [15, 2, 19, 13], colors: RAIN.slice(0, 3), why: 'two rain streaks crossing as they fall' },
    { frames: DROP[1], box: [35, 7, 40, 15], colors: [...CYAN.slice(4, 7), LEAF[6] ?? 0, PAVE[2] ?? 0, FACADE[0] ?? 0], why: 'the drop lands and splashes a crown' },
    { frames: PECK, box: [26, 11, 38, 25], colors: LEAF.slice(3, 7), why: 'the peck: the seedling gone in one bite, its leaves in the beak' },
  ],
}