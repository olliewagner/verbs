import { Canvas, clamp, ease, hex, lerp, noise, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const MARBLE = hex('4a5262 677080 8890a0 a8aebb c4c8d1 dadde3 eceef1 f8f8f6')
const EDGE = hex('2a2f3a 3c4352 525a6a 6a7282 8a92a0')
const WALL = hex('2c3240 3a4252 4a5364 5c6578 6e778a')
const CHOC = hex('120705 1e0e09 2c150d 3c1d12 4e2718 643220 7c4029 985238 b86c4c d89470 f4c8a0 fff4e4')
const STEEL = hex('2a2e36 3e434d 575d68 747a86 959ba6 b8bdc6 dde1e6 f6f8fa')
const WOOD = hex('1e0f0a 33190f 4c2615 683620 86492c a4613c')
const BRASS = hex('3a2408 6a4810 a07420 d0a440 f0d070')
const COPPER = hex('2a0f0a 4e1d12 7a301a a8482a d06a3c ec9a62 f8c494')
const FLOOR = hex('0e0a0c 18121a 221a24')

const SLAB_TOP = 5
const SLAB_FRONT = 29
const BAND_TOP = 11
const BAND_BOT = 23

const windowLight = (x: number, y: number) => {
  const u = x + (y - SLAB_TOP) * 0.9
  const isPane = (u > 2 && u < 13) || (u > 15 && u < 25)
  const fall = clamp(1 - (y - SLAB_TOP) / 26)
  return isPane && y > SLAB_TOP + 1 ? 0.9 * fall : 0
}
const ambient = (x: number, y: number) => clamp(1.1 - Math.hypot(x / 70, (y - 4) / 40))

const VEINS: [number, [number, number][]][] = [
  [1.1, [[0, 9], [8, 11], [17, 10], [27, 14], [36, 13], [47, 18], [56, 17], [64, 21]]],
  [0.7, [[22, 5], [26, 9], [24, 15], [30, 21], [29, 26], [34, 30]]],
  [0.7, [[44, 5], [50, 9], [58, 9], [64, 12]]],
  [0.6, [[0, 24], [9, 22], [15, 26], [24, 25]]],
]
const VEIN_MAP: ReadonlyMap<number, number> = (() => {
  const m = new Map<number, number>()
  for (const [depth, pts] of VEINS) {
    const c = new Canvas()
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i] ?? [0, 0]
      const [bx, by] = pts[i + 1] ?? [0, 0]
      c.line(ax, ay, bx, by, 1)
    }
    c.px.forEach((v, i) => {
      if (v === 1) m.set(i, Math.max(m.get(i) ?? 0, depth))
    })
  }
  return m
})()

type State = {
  knife: { x: number; z: number; face: number; coat: number }
  film: [number, number, number?] | null
  mound: { cx: number; rx: number; ry: number; h: number; n: number; cut: number } | null
  bead: { x0: number; x1: number; h: number } | null
  gloss: number
}

const REST = { cx: 16, rx: 8.2, ry: 4.8, h: 2.4, n: 2, cut: -99 }
const DRIP = 48
const DRIP_X = 15
const AWAY = 60
const HOP_Z = 2.8
const OFF = -12
const FILM_GONE = 6

function returning(f: number): State['knife'] {
  const u = (f - 62) / 14
  return { x: lerp(OFF, 7, smoothstep(0, 1, u)), z: lerp(7, 0, ease.inOut(u)), face: 4, coat: 0 }
}

function stateAt(f: number): State {
  if (f < 4) return { knife: returning(f + LOOP), film: null, mound: REST, bead: null, gloss: 1 }
  if (f < 24) {
    const t = smoothstep(0, 1, (f - 4) / 20)
    const k = lerp(7, 50, t)
    const past = REST.cx + REST.rx
    const bh = k < past ? 1.8 : lerp(1.8, 0.9, (k - past) / (50 - past))
    return {
      knife: { x: k, z: 0, face: 4, coat: 1 },
      film: [8, k],
      mound: k < past ? { ...REST, cut: k } : null,
      bead: { x0: k + 1, x1: k + 2.6, h: bh },
      gloss: lerp(0.8, 0.15, clamp((f - 4) / 5)),
    }
  }
  if (f < 28) {
    const t = (f - 24) / 4
    return {
      knife: { x: lerp(50, 54, smoothstep(0, 1, t)), z: Math.sin(t * Math.PI) ** 2 * HOP_Z, face: lerp(4, 1.6, t), coat: 1 },
      film: [8, 50],
      mound: null,
      bead: { x0: 51, x1: 52.6, h: 0.9 },
      gloss: 0.15,
    }
  }
  if (f < 46) {
    const t = smoothstep(0, 1, (f - 28) / 18)
    const k = lerp(54, 18, t)
    const g = (54 - k) / 36
    const w = 1.6 + g * 3
    return {
      knife: { x: k, z: 0, face: 2, coat: 1 },
      film: k - w > 8 ? [8, k - w] : null,
      mound: null,
      bead: { x0: k - w, x1: k - 0.5, h: 1 + g * 2.2 },
      gloss: 0.2,
    }
  }
  const lift = ease.inOut(clamp((f - 46) / 10))
  const away = smoothstep(46, AWAY, f)
  const slump = ease.out(clamp((f - 46) / 10))
  const knife = f < 62 ? { x: lerp(18, OFF, away), z: lerp(0, 7, lift), face: f < 48 ? 2 : 3, coat: 1 } : returning(f)
  return {
    knife,
    film: f < 46 + FILM_GONE ? [8, 13.4, lerp(0, 7, (f - 46) / FILM_GONE)] : null,
    mound: {
      cx: lerp(15.6, REST.cx, slump), rx: lerp(2.3, REST.rx, slump), ry: lerp(6, REST.ry, slump),
      h: lerp(3.2, REST.h, slump), n: lerp(5, REST.n, slump), cut: -99,
    },
    bead: null,
    gloss: clamp((f - 50) / 10),
  }
}

const RAMPS = [MARBLE, EDGE, WALL, CHOC, STEEL, WOOD, BRASS, COPPER, FLOOR]

function dim(color: number): number {
  for (const r of RAMPS) {
    const i = r.indexOf(color)
    const floor = r === COPPER ? 2 : 0
    if (i >= 0) return r[Math.max(Math.min(i, floor), i - 1)] ?? color
  }
  return color
}
function smear(f: number): State['knife'][] {
  const now = stateAt(f).knife
  const step = Math.abs(now.x - stateAt(f - 1).knife.x)
  const reach = Math.round(2 * step - Math.min(3, Math.round(now.face)))
  const out: State['knife'][] = []
  for (let k = reach; k >= 1; k--) {
    const g = stateAt(f - k / Math.max(1, step)).knife
    if (Math.abs(g.z - now.z) < 1) out.push({ ...g, z: now.z, face: now.face })
  }
  return out
}
function heightAt(s: State, x: number, y: number): number {
  let h = 0
  const inBand = y >= BAND_TOP && y <= BAND_BOT
  if (s.film && x >= s.film[0] && x <= s.film[1]) {
    const end = Math.max(0, s.film[0] + 3 - x) * 0.9 + (s.film[2] ?? 0)
    const top = BAND_TOP - 0.5 + noise(x / 5, 0, 0, 5) * 2.6 + end
    const bot = BAND_BOT + 0.5 - noise(x / 5, 3, 0, 6) * 2.6 - end
    if (y >= top && y <= bot) h = 0.45 + (noise(x / 30, y / 1.2, 0, 9) > 0.6 ? 0.25 : 0)
  }
  if (s.mound) {
    const m = s.mound
    const cy = 17
    const d = Math.abs((x - m.cx) / m.rx) ** m.n + Math.abs((y - cy) / m.ry) ** m.n
    if (d < 1 && x >= m.cut) h = Math.max(h, m.h * (1 - d) ** 0.3)
  }
  if (s.bead && inBand) {
    const b = s.bead
    const mid = (b.x0 + b.x1) / 2
    const half = (b.x1 - b.x0) / 2 + 0.5
    const dy = (y - 17) / 6.6
    const d = ((x - mid) / half) ** 2 + dy ** 6
    if (d < 1) h = Math.max(h, b.h * (1 - d) ** 0.5)
  }
  return h
}
function drawKnife(c: Canvas, kn: State['knife'], hAt: (x: number, y: number) => number, ghost?: Set<number>): void {
  const isGhost = ghost !== undefined
  const put = (x: number, y: number, color: number) => {
    if (!ghost) c.set(x, y, color)
    else if (x >= 0 && x < W && y >= 0 && y < H) ghost.add(y * W + x)
  }
  const kx = Math.round(kn.x)
  const kz = Math.round(kn.z)
  const face = Math.round(kn.face)
  const blade = (x: number, y: number) => {
    if (y < BAND_TOP - 1 || y > BAND_BOT + 1) return false
    const w = y === BAND_TOP - 1 ? Math.max(1, face - 2) : face
    return x >= kx - Math.floor(w / 2) && x < kx - Math.floor(w / 2) + w
  }
  const handle: [number, number][] = []
  for (let y = BAND_BOT + 2; y < H + 4; y++) {
    const hx = kx + Math.round((y - BAND_BOT - 1) * 0.55)
    for (let dx = 0; dx < 3; dx++) handle.push([hx + dx, y])
  }
  const sh = 1 + kz * 0.8
  for (let y = BAND_TOP - 1; y <= BAND_BOT + 1 && !isGhost; y++) {
    for (let x = kx - 3; x <= kx + 3; x++) {
      if (!blade(x, y)) continue
      const sx = Math.round(x + sh)
      const sy = Math.round(y + sh * 0.7)
      if (sy < SLAB_FRONT && !blade(sx, sy + kz)) c.set(sx, sy, shade(hAt(sx, sy) > 0 ? CHOC : MARBLE, hAt(sx, sy) > 0 ? 2 : 1.6 + ambient(sx, sy), sx, sy))
    }
  }
  for (let y = BAND_TOP - 1; y <= BAND_BOT + 1; y++) {
    for (let x = kx - 3; x <= kx + 3; x++) {
      if (!blade(x, y)) continue
      const left = x === kx - Math.floor(face / 2)
      const right = !blade(x + 1, y)
      const band = Math.abs(y - (BAND_TOP + 3 + kz)) < 1.5 ? 1.6 : 0
      let level = 3.4 + (left ? 1.2 : 0) - (right ? 1.4 : 0) + band
      if (y === BAND_TOP - 1) level += 1
      const isCoated = kn.coat > 0.5 && ((kn.face >= 4 && right) || (kn.face < 4 && left)) && y > BAND_TOP && y < BAND_BOT
      put(x, y - kz, isCoated ? shade(CHOC, 3 + (y % 6 < 2 ? 1 : 0), x, y) : shade(STEEL, level, x, y))
    }
  }
  for (const [x, y] of [[kx, BAND_BOT + 2], [kx + 1, BAND_BOT + 2], [kx + 1, BAND_BOT + 3]] as const) {
    put(x, y - kz, shade(STEEL, 3, x, y))
  }
  handle.forEach(([x, y], i) => {
    const col = i % 3
    const isFerrule = y <= BAND_BOT + 5
    const ramp = isFerrule ? BRASS : WOOD
    put(x + 1, y - kz, shade(ramp, (isFerrule ? 2.4 : 2.6) + (col === 0 ? 1.4 : col === 2 ? -1.2 : 0) + ambient(x, y) * 0.8, x, y))
  })
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const s = stateAt(f)
    const kn = s.knife
    for (let y = 0; y < SLAB_TOP; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(WALL, 1 + ambient(x, y) * 3 - (y === SLAB_TOP - 1 ? 1.2 : 0), x, y))
    }
    for (let y = SLAB_TOP; y < SLAB_FRONT; y++) {
      for (let x = 0; x < W; x++) {
        const vein = VEIN_MAP.get(y * W + x) ?? 0
        const level = 2.8 + ambient(x, y) * 2.4 + windowLight(x, y) * 1.6 - vein + (y === SLAB_TOP ? 1.4 : 0)
        c.set(x, y, shade(MARBLE, level, x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      c.set(x, SLAB_FRONT, shade(EDGE, 3.6 + ambient(x, SLAB_FRONT) * 0.6, x, SLAB_FRONT))
      c.set(x, SLAB_FRONT + 1, shade(EDGE, 1.6 + ambient(x, SLAB_FRONT) * 0.8, x, SLAB_FRONT))
      c.set(x, SLAB_FRONT + 2, shade(FLOOR, 1 + ambient(x, 31), x, 31))
    }
    for (let y = 0; y <= 6; y++) {
      for (let x = 0; x <= 14; x++) {
        const dx = (x - 6.5) / 7.5
        const dy = (y - 1) / 5.6
        if (dx * dx + dy * dy > 1 || y < 1) continue
        const isRim = y === 1 || (y === 2 && Math.abs(dx) > 0.75)
        const inside = y <= 2 && Math.abs(dx) < 0.8
        if (inside) c.set(x, y, shade(CHOC, y === 1 ? 3 : 4 + (x === 3 ? 4 : 0), x, y))
        else c.set(x, y, shade(COPPER, (isRim ? 5 : 3.2) - dx * 1.6 - (y - 3) * 0.3 + (x === 3 && y === 3 ? 2 : 0), x, y))
      }
    }
    for (let x = 1; x <= 12; x++) c.set(x, 7, shade(MARBLE, 2, x, 7))
    c.line(46, 7, 59, 4, STEEL[5] ?? 0)
    c.line(46, 8, 59, 5, STEEL[2] ?? 0)
    c.line(48, 7, 55, 5, 0x9a3a2a)
    c.set(45, 8, 0xb84a34)
    c.set(45, 7, 0xd8705a)
    c.line(47, 9, 60, 6, MARBLE[2] ?? 0)
    const hAt = (x: number, y: number) => heightAt(s, x, y)
    for (let y = SLAB_TOP + 2; y < SLAB_FRONT; y++) {
      for (let x = 0; x < W; x++) {
        const h = hAt(x, y)
        if (h <= 0) {
          if (hAt(x - 1, y - 1) > 0.6 || hAt(x, y - 1) > 1.2) c.set(x, y, shade(MARBLE, 2 + ambient(x, y) * 1.6, x, y))
          continue
        }
        const gx = hAt(x + 1, y) - hAt(x - 1, y)
        const gy = hAt(x, y + 1) - hAt(x, y - 1)
        const facing = gx + gy * 1.2
        const isThick = h > 0.9
        let level = isThick ? 4 + facing * 1.1 + windowLight(x, y) * 0.6 : 4.2 + windowLight(x, y) * 1.5
        const isRim = isThick && (hAt(x - 1, y) <= 0.3 || hAt(x, y - 1) <= 0.3)
        if (s.gloss > 0.3 && isRim && facing > 0.9) level += 1 + s.gloss * 2.2
        const rt = f - DRIP - 2
        if (rt >= 0 && rt < 8) {
          const d = Math.hypot(x - DRIP_X, (y - 17) * 1.4)
          if (Math.abs(d - (1 + rt * 0.9)) < 0.5 && h > 0.6) level += 2.2 - rt * 0.25
        }
        if (isThick && (hAt(x + 1, y) <= 0 || hAt(x, y + 1) <= 0)) level -= 1.2
        if (s.gloss < 0.5 && h < 0.8 && h > 0.6 && hAt(x, y - 1) < h) level += 1.2
        if (h < 0.8 && (hAt(x, y - 1) <= 0 || hAt(x - 1, y) <= 0)) level += 0.8
        c.set(x, y, shade(CHOC, level, x, y))
      }
    }
    if (s.mound && s.gloss > 0.3) {
      const m = s.mound
      const gx = Math.round(m.cx - m.rx * 0.45)
      const gy = Math.round(17 - m.ry * 0.4)
      const len = s.gloss > 0.8 ? 4 : s.gloss > 0.55 ? 3 : 2
      for (let dx = 0; dx < len; dx++) {
        if (hAt(gx + dx, gy) > 0.8) c.set(gx + dx, gy, CHOC[s.gloss > 0.7 ? 11 : 10] ?? 0)
      }
      if (s.gloss > 0.7 && hAt(gx, gy + 1) > 0.8) c.set(gx, gy + 1, CHOC[10] ?? 0)
      if (f === 59 || f === 60) {
        const tx = gx + 1
        c.set(tx, gy - 1, CHOC[11] ?? 0)
        if (f === 59) {
          c.set(tx, gy - 2, CHOC[9] ?? 0)
          c.set(tx - 1, gy - 1, CHOC[9] ?? 0)
          c.set(tx + 1, gy - 1, CHOC[9] ?? 0)
        }
      }
    }
    const dt = f - DRIP
    if (dt >= 0 && dt < 3) {
      const z = [5, 3, 1][dt] ?? 0
      c.set(DRIP_X, 17 - z, CHOC[3] ?? 0)
      c.set(DRIP_X, 17 - z - 1, CHOC[5] ?? 0)
    }
    const trail = new Set<number>()
    for (const ghost of smear(f)) drawKnife(c, ghost, hAt, trail)
    for (const i of trail) c.px[i] = dim(c.px[i] ?? 0)
    drawKnife(c, kn, hAt)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Tempering', render, hero: 62 }