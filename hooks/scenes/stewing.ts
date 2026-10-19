import { Canvas, TAU, ease, frames, hash, hex, lerp, loopNoise, mod, particles, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const STONE = hex('08060a 120c0f 1c1314 2a1b18 3c261d 52331f 6c4425 8a5729 a86e33')
const IRON = hex('060609 0e0d12 17151b 221e24 31292c 4a3530 6c4632 98603a d08848')
const STEW = hex('1c0b08 2e140e 441e12 5c2a16 763a1c 904c22 aa622c c88040')
const BEEF = hex('260a0c 401210 5e1e16 7c2e1e 9a4428')
const CARROT = hex('6a2408 a0420e d4661a f4963a')
const POTATO = hex('4c3a1e 735c34 9c8248 c0a660')
const FIRE = hex('3a0a10 6a1412 a1221a d23e1c ef6822 f99832 fcc657 fee996 fffbe0')
const LADLE = hex('2a160e 44261a 643a24 885234 ac6e44 cc9058')
const STEAM = hex('2a1e22 443232 664a42 8c6a58 b49076 dcbc9c')

const C = { x: 32, y: 12 }
const RIM_RX = 13
const RIM_RY = 5
const STEW_RY = 4
const BOTTOM = 26
const BELLY = [13, 13.5, 14, 14.3, 14.5, 14.5, 14.4, 14.1, 13.7, 13.1, 12.3, 11.2, 9.8, 8, 5.5]
const halfWidth = (y: number) => BELLY[Math.round(y) - C.y] ?? 0

const FLARE_AT = 45
function firePower(f: number): number {
  const flicker = 0.85 + 0.15 * loopNoise(0, 0, f / LOOP, 8, 2)
  const flare = f >= FLARE_AT ? Math.exp(-(f - FLARE_AT) / 4) * 1.4 : 0
  return flicker + flare
}
const lightAt = (x: number, y: number, p: number) => p * Math.max(0, 1 - Math.hypot(x - 32, (y - 28) * 1.25) / 44) ** 1.4

type Tongue = { x: number; h: number; w: number; lean: number; speed: number; phase: number; side?: number }
const TONGUES: Tongue[] = [
  { x: 19.5, h: 9, w: 1.8, lean: -0.4, speed: 3, phase: 0 },
  { x: 22, h: 10, w: 2.2, lean: -0.8, speed: 2, phase: 0.4 },
  { x: 25, h: 4, w: 2.4, lean: -0.6, speed: 4, phase: 0.7 },
  { x: 29, h: 3, w: 2.4, lean: 0, speed: 5, phase: 0.2 },
  { x: 35, h: 3, w: 2.4, lean: 0, speed: 4, phase: 0.9 },
  { x: 39, h: 4, w: 2.4, lean: 0.6, speed: 3, phase: 0.5 },
  { x: 42, h: 10, w: 2.2, lean: 0.8, speed: 2, phase: 0.1 },
  { x: 44.5, h: 8, w: 1.8, lean: 0.4, speed: 3, phase: 0.6 },
]

const STIR_SPEED = TAU / 34
const SCOOP = 18
const LIFT_END = 26
const TIP = 34
const PLOP = 39
const RETURN = [38, 48] as const
function stirAngle(f: number): number {
  if (f < SCOOP) return f * STIR_SPEED
  if (f < RETURN[1]) return SCOOP * STIR_SPEED
  return (SCOOP + f - RETURN[1]) * STIR_SPEED
}
const surfacePoint = (a: number, r = 0.62) => ({ x: C.x + Math.cos(a) * 11.5 * r, y: C.y + 0.5 + Math.sin(a) * STEW_RY * r })
const HAND = (a: number) => ({ x: 60 + 2 * Math.cos(a), y: -6 + Math.sin(a) })
const RAISED = { x: 36, y: 4 }

type Chunk = { r: number; a: number; kind: 'beef' | 'carrot' | 'potato'; phase: number }
const CHUNKS: Chunk[] = [
  { r: 0.35, a: 0.4, kind: 'beef', phase: 0 },
  { r: 0.75, a: 1.5, kind: 'carrot', phase: 0.3 },
  { r: 0.6, a: 2.7, kind: 'beef', phase: 0.6 },
  { r: 0.78, a: 3.9, kind: 'potato', phase: 0.15 },
  { r: 0.5, a: 5.0, kind: 'carrot', phase: 0.45 },
  { r: 0.7, a: 5.9, kind: 'beef', phase: 0.8 },
]

function drawChunk(c: Canvas, x: number, y: number, kind: Chunk['kind'], lit: number): void {
  if (kind === 'beef') {
    c.set(x, y, shade(BEEF, 2.6 + lit))
    c.set(x + 1, y, shade(BEEF, 2 + lit))
    c.set(x - 1, y, shade(BEEF, 1.4 + lit))
    c.set(x, y - 1, shade(BEEF, 3.4 + lit))
    c.set(x - 1, y - 1, shade(BEEF, 2.6 + lit))
  } else if (kind === 'carrot') {
    c.set(x, y, shade(CARROT, 1.6 + lit))
    c.set(x + 1, y, shade(CARROT, 1 + lit))
    c.set(x, y - 1, shade(CARROT, 2.6 + lit))
  } else {
    c.set(x, y, shade(POTATO, 1.4 + lit))
    c.set(x + 1, y, shade(POTATO, 0.8 + lit))
    c.set(x, y - 1, shade(POTATO, 2.4 + lit))
    c.set(x + 1, y - 1, shade(POTATO, 1.8 + lit))
  }
}

function stoneAt(x: number, y: number): { id: number; isMortar: boolean } {
  const row = Math.floor(y / 5)
  const off = Math.floor(hash(row, 1) * 9)
  const u = x + off
  let start = 0
  let id = 0
  for (let k = 0; k < 20; k++) {
    const w = 6 + Math.floor(hash(k, row, 2) * 5)
    if (u < start + w) {
      id = k
      break
    }
    start += w
  }
  return { id: id * 31 + row, isMortar: y % 5 === 4 || u === start }
}

function handleLine(c: Canvas, x0: number, y0: number, x1: number, y1: number, color: (x: number, y: number) => number): void {
  const [ax, ay, bx, by] = x0 <= x1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0]
  const slope = bx > ax ? (by - ay) / (bx - ax) : 0
  for (let x = Math.round(ax); x <= Math.round(bx); x++) {
    const y = Math.round(ay + (x - ax) * slope)
    c.set(x, y, color(x, y))
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const power = firePower(f)
    const flare = f >= FLARE_AT ? Math.exp(-(f - FLARE_AT) / 4) : 0
    const L = (x: number, y: number) => lightAt(x, y, power)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isJamb = x < 5 || x > 58
        const { id, isMortar } = stoneAt(isJamb ? x * 0.6 : x, isJamb ? y * 0.8 + 2 : y)
        const face = (hash(id, 7) - 0.5) * 0.8
        const soot = isJamb ? 0 : Math.max(0, 9 - y) * 0.16
        const base = isJamb ? 1.6 : 0.5
        const lit = L(x, y) * (isJamb ? 2.4 : 6.4)
        const edge = isJamb && (x === 4 || x === 59) ? 1 + L(x, y) * 3 : 0
        c.set(x, y, shade(STONE, base + lit + face - soot - (isMortar ? 1 : 0) + edge))
      }
    }
    for (let y = 29; y < H; y++) {
      for (let x = 5; x < 59; x++) c.set(x, y, shade(STONE, 1 + L(x, y) * 3.6 + (y === 29 ? 0.6 : 0) - ((x * 5 + y * 3) % 11 === 0 ? 0.8 : 0)))
    }
    for (let y = 0; y <= 2; y++) c.set(C.x, y, shade(IRON, y % 2 ? 4 : 2.6))
    for (let s = 0; s <= 40; s++) {
      const a = (s / 40) * Math.PI
      const x = C.x + Math.cos(a) * 13.6
      const y = C.y - Math.sin(a) * 9.4
      c.set(x, y, shade(IRON, 2.2 + L(x, y) * 2.5 + (a > 2 ? 0.6 : 0)))
    }
    for (let y = C.y; y <= BOTTOM; y++) {
      const hw = halfWidth(y)
      for (let x = Math.ceil(C.x - hw); x <= Math.floor(C.x + hw); x++) {
        if (((x - C.x) / RIM_RX) ** 2 + ((y - C.y) / RIM_RY) ** 2 <= 1) continue
        const nx = (x - C.x) / Math.max(1, hw)
        const under = smoothstep(17, BOTTOM, y)
        const sheen = nx > -0.65 && nx < -0.4 && y < 23 ? 0.9 : 0
        const rim = Math.abs(nx) > 0.86 ? 0.6 + L(x, y) * 2.2 : 0
        const bottom = y === BOTTOM || halfWidth(y + 1) < Math.abs(x - C.x) ? L(x, y) * 1.6 : 0
        c.set(x, y, shade(IRON, 1 + under * L(x, y) * 6 + sheen + rim + bottom))
      }
    }
    for (let y = C.y - RIM_RY - 1; y <= C.y + RIM_RY + 1; y++) {
      for (let x = C.x - RIM_RX - 1; x <= C.x + RIM_RX + 1; x++) {
        const d = ((x - C.x) / RIM_RX) ** 2 + ((y - C.y) / RIM_RY) ** 2
        const ds = ((x - C.x) / 11.6) ** 2 + ((y - C.y - 0.5) / STEW_RY) ** 2
        if (d > 1) continue
        if (d > 0.8) {
          const isFront = y > C.y
          c.set(x, y, shade(IRON, isFront ? 3.6 + L(x, y) * 2 + (y === C.y + RIM_RY ? 0.8 : 0) : 2.6))
        } else if (ds > 1) {
          c.set(x, y, shade(IRON, 1.2))
        }
      }
    }
    const stir = stirAngle(f)
    for (let y = C.y - STEW_RY; y <= C.y + STEW_RY + 1; y++) {
      for (let x = C.x - 12; x <= C.x + 12; x++) {
        const dx = (x - C.x) / 11.6
        const dy = (y - C.y - 0.5) / STEW_RY
        const r = Math.hypot(dx, dy)
        if (r > 1) continue
        const a = Math.atan2(dy, dx)
        const swirl = r > 0.35 && r < 0.75 && Math.abs(Math.sin(a - stir)) < 0.18 && dy > -0.3 ? 0.8 : 0
        const gloss = dy < -0.45 ? 1.2 : dy < -0.1 ? 0.5 : 0
        const shadowEdge = r > 0.85 && dy < 0 ? -0.8 : 0
        c.set(x, y, shade(STEW, 2.8 + gloss + swirl + shadowEdge + flare * 1.4))
      }
    }
    for (const b of particles(f, LOOP, 10, 5, 4)) {
      const a = b.r[1] * TAU
      const p = surfacePoint(a, 0.2 + b.r[2] * 0.7)
      if (b.t < 3) c.set(p.x, p.y, shade(STEW, 4.6 + b.t * 0.6))
      else if (b.t === 3) {
        c.set(p.x - 1, p.y, shade(STEW, 5.4))
        c.set(p.x + 1, p.y, shade(STEW, 5.4))
      }
    }
    const turn = (TAU * f) / LOOP
    const placed = CHUNKS.map(k => {
      const p = surfacePoint(k.a + turn, k.r)
      const bob = wave(f, LOOP, 3, k.phase) > 0.5 ? -1 : 0
      return { k, x: Math.round(p.x), y: Math.round(p.y) + bob }
    }).sort((a, b) => a.y - b.y)
    for (const { k, x, y } of placed) drawChunk(c, x, y, k.kind, flare)
    const lift = ease.outBack(Math.min(1, Math.max(0, (f - SCOOP - 2) / (LIFT_END - SCOOP - 2))))
    const back = ease.inOut(Math.min(1, Math.max(0, (f - RETURN[0]) / (RETURN[1] - RETURN[0]))))
    const dig = f >= SCOOP && f < SCOOP + 2 ? 1 : 0
    const sp = surfacePoint(stirAngle(f))
    const raisedness = f < SCOOP ? 0 : f < RETURN[0] ? lift : 1 - back
    const bowl = { x: lerp(sp.x, RAISED.x, raisedness), y: lerp(sp.y + dig, RAISED.y, raisedness) }
    const hand = HAND(stirAngle(f))
    const isUp = raisedness > 0.25
    if (!isUp) {
      for (const [ox, oy] of [[-2, 0], [2, 0], [-1, 1], [1, 1], [0, 1]] as const) c.set(bowl.x + ox, bowl.y + oy, shade(STEW, 5))
    }
    if (isUp) {
      const tip = f >= TIP && f < RETURN[0] + 2 ? 1 : 0
      const bx = Math.round(bowl.x)
      const by = Math.round(bowl.y)
      const cup = tip ? ['..ww...', '.wwwww.', '..www..'] : ['wwwwwww', '.wwwww.', '..www..']
      c.sprite(bx - 3, by, cup, { w: shade(LADLE, 2.6 + L(bx, by) * 2) })
      c.set(bx - 3, by, shade(LADLE, 4.4))
      if (f < TIP) {
        for (let x = bx - 2; x <= bx + 2; x++) c.set(x, by - 1, shade(STEW, x === bx - 2 ? 5.4 : 4.2))
        for (let x = bx - 1; x <= bx + 1; x++) c.set(x, by - 2, shade(STEW, 3.6))
        drawChunk(c, bx, by - 2, 'beef', 0.8)
        c.set(bx + 2, by - 2, shade(CARROT, 2.6))
      }
      for (const d of particles(f, LOOP, 24, 4, 8)) {
        if (f < SCOOP + 4 || f > TIP + 2) continue
        const dx = Math.round((d.r[1] - 0.5) * 3)
        c.set(bx + dx, by + 3 + d.t * 2, shade(STEW, 4.2))
      }
    }
    handleLine(c, bowl.x + (isUp ? 2 : 0), bowl.y - (isUp ? 1 : 0), hand.x, hand.y, (x, y) => shade(LADLE, 3.4 + L(x, y) * 1.2))
    handleLine(c, bowl.x + (isUp ? 3 : 1), bowl.y - (isUp ? 1 : 0), hand.x + 1, hand.y, (x, y) => shade(LADLE, 1.8 + L(x, y)))
    if (f >= TIP + 2 && f < PLOP) {
      const k = (f - TIP - 2) / (PLOP - TIP - 2)
      drawChunk(c, Math.round(RAISED.x), Math.round(lerp(RAISED.y + 1, C.y, k * k)), 'beef', 0.6)
    }
    const splash = f - PLOP
    if (splash >= 0 && splash < 4) {
      const sx = RAISED.x
      const sy = C.y + 1
      const crown: [number, number][] = splash === 0 ? [[0, -1], [-1, 0], [1, 0]] : splash === 1 ? [[-2, -1], [2, -1], [0, -2]] : splash === 2 ? [[-3, 0], [3, 0], [0, -3]] : [[-4, 1], [4, 1]]
      for (const [ox, oy] of crown) c.set(sx + ox, sy + oy, shade(STEW, 6))
    }
    if (splash >= 0 && f < FLARE_AT) {
      const k = (f - PLOP) / (FLARE_AT - PLOP)
      const x = lerp(RAISED.x + 1, 43, k)
      const y = C.y - 1 - 7 * Math.sin(Math.PI * Math.min(1, k * 1.6)) + (k > 0.62 ? (k - 0.62) * 40 : 0)
      c.set(x, y, STEW[7] ?? 0)
      c.set(x, y - 1, shade(STEW, 5.4))
    }
    for (const [x0, y0, x1, y1] of [[20, 30, 44, 28], [22, 28, 42, 30]] as const) {
      c.line(x0, y0, x1, y1, (x, y) => shade(LADLE, 0.6 + L(x, y) * 1.2))
      c.line(x0, y0 - 1, x1, y1 - 1, (x, y) => shade(LADLE, 1 + L(x, y) * 1.6))
    }
    for (let x = 23; x <= 41; x++) {
      if (hash(Math.floor(x / 3), 3) > 0.4) c.set(x, 29, shade(FIRE, loopNoise(Math.floor(x / 3), 0, f / LOOP, 3, 9) > 0.5 ? 6 : 4.5))
    }
    const lick = 1 + flare * 1.3
    for (const g of TONGUES) {
      const h = g.h * lick * (0.8 + 0.2 * wave(f, LOOP, g.speed, g.phase))
      for (let y = Math.floor(29.5 - h); y <= 29; y++) {
        const v = (29.5 - y) / h
        const sway = Math.sin(TAU * (f / LOOP) * g.speed * 2 + g.phase * 6 + v * 2.5) * 0.7 * v
        const hug = g.side ? C.x + g.side * (Math.max(halfWidth(y), 6) + 0.3) : 0
        const cx = g.side ? hug + sway * 0.6 : g.x + g.lean * v * v * 3 + sway
        const half = g.w * Math.min(1, 0.5 + v * 2.4) * (1 - v) ** 0.8
        for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
          const d = Math.abs(x - cx) / Math.max(0.4, half)
          if (d > 1) continue
          if (y <= BOTTOM && Math.abs(x - C.x) <= halfWidth(y) - (g.side ? 1 : 0)) continue
          const heat = (1 - d * d) * (1 - v ** 1.4)
          if (heat < 0.08) continue
          c.set(x, y, shade(FIRE, (heat < 0.3 ? 3 : heat < 0.55 ? 4.5 : heat < 0.8 ? 6 : 7.4) + Math.round(flare * 1.5)))
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const born = FLARE_AT + Math.floor(hash(i, 1) * 3)
      const t = f - born
      const life = 7 + Math.floor(hash(i, 2) * 6)
      if (t < 0 || t >= life) continue
      const side = i % 2 ? 1 : -1
      const x = 32 + side * (9 + hash(i, 3) * 6) + side * t * (0.3 + hash(i, 4) * 0.5)
      const y = 26 - t * (1.3 + hash(i, 5) * 0.8) + t * t * 0.04
      c.set(x, y, shade(FIRE, 7.5 - (t / life) * 4))
    }
    for (const s of particles(f, LOOP, 14, 30, 6)) {
      const a = Math.PI + s.r[1] * Math.PI
      const p = surfacePoint(a, 0.3 + s.r[2] * 0.6)
      const x = p.x - s.t * 0.3 + Math.sin(s.t * 0.22 + s.r[3] * 6) * 1.4
      const y = p.y - 1 - s.t * 0.6
      const r = 1.5 + s.age * 4.2
      const alpha = Math.sin(Math.PI * Math.min(1, s.age * 1.15)) * (0.7 + s.r[0] * 0.3)
      for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) {
        for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
          const d = Math.hypot(i - x, (j - y) * 1.3) / r
          const density = alpha * (1.15 - d * d)
          if (d > 1 || density < 0.25) continue
          const under = j > y + r * 0.3 ? 0.8 : 0
          c.set(i, j, shade(STEAM, (density > 0.75 ? 3.2 : density > 0.45 ? 2.4 : 1.4) + under + Math.round(flare)))
        }
      }
    }
    if (f >= PLOP && f < PLOP + 16) {
      const k = (f - PLOP) / 16
      const x = RAISED.x - k * 4
      const y = C.y - 2 - k * 12
      const r = 1.5 + k * 4.5
      const alpha = Math.sin(Math.PI * Math.min(1, k * 1.2 + 0.15))
      for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) {
        for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
          const d = Math.hypot(i - x, (j - y) * 1.25) / r
          const density = alpha * (1.15 - d * d)
          if (d > 1 || density < 0.3) continue
          c.set(i, j, shade(STEAM, (density > 0.7 ? 4 : density > 0.5 ? 3.2 : 2.4) + (j > y + r * 0.3 ? 0.8 : 0) + flare * 0.8))
        }
      }
    }
    if (f >= LIFT_END - 2 && f < TIP + 2) {
      for (let k = 0; k < 2; k++) {
        const t = mod(f + k * 4, 8) / 8
        c.set(RAISED.x - 1 + k * 2 + Math.round(Math.sin(t * 5)), RAISED.y - 2 - Math.round(t * 5), shade(STEAM, 4 - t * 2))
      }
    }
  })
}
export const scene: Scene = {
  verb: 'Stewing',
  render,
  hero: 46,
  snaps: [
    { frames: FLARE_AT, why: 'the flung gravy hits the fire: it flares and lights the whole hearth in one frame, then dies down over the next few' },
  ],
}