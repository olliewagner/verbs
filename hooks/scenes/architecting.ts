import { Canvas, beat, ease, hash, hex, lerp, mix, mod, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('050e24 08142f 0b1a3c 0f2149 132957 18326a 1f3d7c 29498c')
const GRID_SKY = SKY.map(c => mix(c, 0x7aa0e0, 0.1))
const CITY = hex('040916 07102a 0b1736 101f44 162a56 1e3666')
const MOON = hex('6a7ea8 a6b8d4 dce6f0 f6f8f4')
const CRANE = hex('1e1608 3a2a0c 624814 8c6a1c b48c26 dab034 f2d266')
const STEEL = hex('1e0a08 3c140c 64200f a03a1c c8562a e87a40 f6a868')
const FACADE = hex('050a16 0a1224 0f1a32 162442 1f3054 2c3e68 3e5280')
const WARM = hex('3a2410 7a4a18 c88a30 f0c060 fde8a0 fff8dc')
const COOL = hex('2a3a5a 5a7aa8 a8c8ec e4f0ff')
const WELD = hex('2a4a8a 6a9ae0 c4dcff ffffff')
const RED_LIGHT = 0xff4a3a

const FH = 4
const X0 = 16
const X1 = 32
const COLS = [16, 24, 32]
const TOP_DONE = 23
const SKEL_BEAM = 19
const STUB_TOP = 16
const LAND = 15

const MAST = 41
const JIB_Y = 1
const PICK_X = 7
const SET_X = 24
const BOTTOM = 33

const HOIST1 = 15
const TRAVEL0 = 17
const TRAVEL1 = 29
const LOWER0 = 33
const LANDED = 39
const UNHOOK = 45
const CLAD0 = 46
const BACK0 = 47
const BACK1 = 57
const RISE_AT = [58, 61, 63, 66]

const rise = (f: number) => RISE_AT.filter(at => f >= at).length

function glide(t: number, n: number, a: number, b: number): number {
  if (t <= 0) return 0
  if (t >= n) return 1
  const v = 1 / (n - (a + b) / 2)
  if (t < a) return (v * t * t) / (2 * a)
  if (t > n - b) return 1 - (v * (n - t) ** 2) / (2 * b)
  return v * (t - a / 2)
}
function trolleyAt(f: number): number {
  if (f < BACK0) return lerp(PICK_X, SET_X, glide(f - TRAVEL0, TRAVEL1 - TRAVEL0, 3, 3))
  return lerp(SET_X, PICK_X, glide(f - BACK0, BACK1 - BACK0, 1, 1))
}
const trolleyX = (f: number) => Math.round(trolleyAt(f))
function loadY(f: number): number | undefined {
  if (f >= LANDED) return undefined
  if (f < LOWER0) return Math.round(lerp(BOTTOM + 6, LAND - 3, glide(f, HOIST1, 0, 3)))
  return Math.round(lerp(LAND - 3, LAND, ease.inOut(beat(f, LOWER0, LANDED - 1))))
}
function hookY(f: number): number {
  const load = loadY(f)
  if (load !== undefined) return load - 6
  if (f < UNHOOK) return LAND - 6
  if (f < BACK1) return Math.round(lerp(LAND - 6, 6, ease.out(beat(f, UNHOOK, UNHOOK + 4))))
  return Math.round(lerp(6, BOTTOM, glide(f - BACK1, LOOP - BACK1, 3, 0)))
}
const HOOK_X: readonly number[] = (() => {
  const w = (2 * Math.PI) / 8
  const n = 50
  const dt = 1 / n
  let r = 0
  let v = 0
  const xs: number[] = []
  for (let f = 0; f < LANDED; f++) {
    xs.push(Math.round(trolleyAt(f) + r))
    for (let k = 0; k < n; k++) {
      const t = f + k * dt
      const pull = (trolleyAt(t + dt) - 2 * trolleyAt(t) + trolleyAt(t - dt)) / (dt * dt)
      v += (-w * w * r - w * v - pull) * dt
      r += v * dt
    }
  }
  return xs
})()
const sway = (f: number) => (HOOK_X[f] ?? trolleyX(f)) - trolleyX(f)
type Block = { x0: number; x1: number; top: number; isNear: boolean }
const BLOCKS: readonly Block[] = (() => {
  const blocks: Block[] = []
  for (const isNear of [false, true]) {
    let x = isNear ? -2 : -1
    let k = 0
    while (x < W) {
      const w = 3 + Math.floor(hash(k, isNear ? 7 : 3) * 5)
      const top = isNear ? 23 + Math.floor(hash(k, 11) * 5) : 18 + Math.floor(hash(k, 13) * 6)
      blocks.push({ x0: x, x1: x + w - 1, top, isNear })
      x += w + (isNear ? 1 : 0)
      k++
    }
  }
  blocks.push({ x0: 50, x1: 54, top: 12, isNear: false }, { x0: 1, x1: 4, top: 16, isNear: false })
  return blocks
})()
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const s = rise(f)
    const tx = trolleyX(f)
    const load = loadY(f)
    const isSet = f >= LANDED
    const welding = f >= LANDED && f < LANDED + 8
    const flash = welding ? (f - LANDED) % 3 === 0 ? 1 : 0.4 : 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const glow = Math.max(0, (y - 10) / 22)
        const halo = Math.max(0, 1 - Math.hypot(x - 9, y - 10) / 9)
        const isGrid = x % 8 === 4 || y % 8 === 4
        c.set(x, y, shade(isGrid ? GRID_SKY : SKY, 1.2 + glow * 4 + halo * 2.2, x, y))
      }
    }
    for (let k = 0; k < 11; k++) {
      const x = Math.floor(hash(k, 1) * W)
      const y = Math.floor(hash(k, 2) * 14)
      if (Math.hypot(x - 9, y - 10) < 6) continue
      c.set(x, y, (f + k * 7) % 31 < 2 ? SKY[5] ?? 0 : COOL[1] ?? 0)
    }
    const planeX = Math.round(70 - f * (78 / LOOP))
    c.set(planeX, 6, SKY[6] ?? 0)
    c.set(planeX + 1, 6, SKY[5] ?? 0)
    if (f % 6 < 2) c.set(planeX, 7, RED_LIGHT)
    else if (f % 6 === 3) c.set(planeX + 1, 5, COOL[3] ?? 0)
    c.disc(9, 10, 3.2, (x, y) => shade(MOON, 2.6 - Math.max(0, (x - 9) + (y - 10)) * 0.45, x, y))
    c.set(8, 10, MOON[1] ?? 0)
    c.set(10, 11, MOON[1] ?? 0)
    for (const b of BLOCKS) {
      for (let y = b.top; y < H; y++) {
        for (let x = Math.max(0, b.x0); x <= Math.min(W - 1, b.x1); x++) {
          const isEdge = x === b.x0
          const level = b.isNear ? 1 + (isEdge ? 0.8 : 0) : 2.6 + (isEdge ? 0.6 : 0) - (y - b.top) * 0.04
          c.set(x, y, shade(CITY, level, x, y))
          const isWindow = (x - b.x0) % 2 === 1 && (y - b.top) % 2 === 1 && x < b.x1 && y > b.top
          if (isWindow && b.isNear && hash(x, y, 5) < 0.24) c.set(x, y, shade(WARM, 2 + hash(x, y, 9) * 1.5, x, y))
        }
      }
    }
    if (f % 24 < 12) {
      c.set(52, 11, RED_LIGHT)
      c.set(2, 15, 0xb83228)
    }
    drawTower(c, f, s, isSet, flash)
    drawCrane(c, f, s, tx)
    const hy = hookY(f)
    const swing = sway(f)
    for (let y = JIB_Y + 4; y < hy; y++) c.set(tx + Math.round((swing * (y - JIB_Y - 4)) / Math.max(1, hy - JIB_Y)), y, shade(CRANE, 1.4, 0, 0))
    const hx = tx + swing
    c.rect(hx - 1, hy, 3, 2, (x, y) => shade(CRANE, x === hx - 1 ? 4.6 : y === hy ? 3.6 : 2.4, x, y))
    c.set(hx, hy + 2, shade(CRANE, 1.6, 0, 0))
    if (load !== undefined) {
      const lx = hx
      for (const dir of [-1, 1]) c.line(hx, hy + 2, lx + dir * 8, load - 3, shade(CRANE, 1.2, 0, 0))
      drawFrame(c, lx, load, 0)
    } else if (f < UNHOOK) {
      for (const dir of [-1, 1]) c.line(hx, hy + 2, SET_X + dir * 8, LAND - 3 + s, shade(CRANE, 1.2, 0, 0))
    }
    if (flash === 1) {
      for (let y = LAND + s - 7; y <= LAND + s + 7; y++) {
        for (let x = SET_X - 14; x <= SET_X + 14; x++) {
          const d = Math.min(...COLS.map(jx => Math.hypot(x - jx, y - LAND - s)))
          if (d < 6) c.tint(x, y, WELD[1] ?? 0, d < 3 ? 0.3 : 0.15)
        }
      }
    }
    if (welding) {
      for (const [k, jx] of COLS.entries()) {
        if ((f - LANDED + k) % 3 === 0) c.set(jx, LAND + s, shade(WELD, 3, 0, 0))
        else c.set(jx, LAND + s, shade(WELD, 2, 0, 0))
      }
    }
    for (const p of particles(f, LOOP, 18, 7, 31)) {
      const born = f - p.t
      if (born < LANDED || born >= LANDED + 7) continue
      const jx = COLS[p.i % 3] ?? SET_X
      const x = jx + (p.r[1] - 0.5) * 2.4 * p.t
      const y = LAND + s - 0.6 * p.t + 0.22 * p.t * p.t
      c.set(x, y, p.age < 0.4 ? WARM[5] ?? 0 : shade(WARM, 4 - p.age * 3, 0, 0))
    }
    out.push(c.px)
  }
  return out
}
function drawFrame(c: Canvas, cx: number, beamY: number, glow: number): void {
  for (let x = cx - 8; x <= cx + 8; x++) c.set(x, beamY, shade(STEEL, 3.6 + (x < cx - 6 ? 0.8 : 0) + glow, x, beamY))
  for (const dx of [-8, 0, 8]) {
    for (let y = beamY - 3; y < beamY; y++) c.set(cx + dx, y, shade(STEEL, 3 + (y === beamY - 3 ? 0.8 : 0) + glow, cx + dx, y))
  }
}
function drawTower(c: Canvas, f: number, s: number, isSet: boolean, flash: number): void {
  for (let y = 0; y < H; y++) {
    const by = y - s
    const isClad = by >= TOP_DONE || (by >= SKEL_BEAM && f >= CLAD0)
    if (isClad) {
      const r = mod(by - TOP_DONE, FH)
      const isNew = by < TOP_DONE
      for (let x = X1 + 1; x <= X1 + 3; x++) {
        const isSideGlass = r !== 0 && r !== 3 && x === X1 + 2 && (!isNew || litAt(f, 5))
        c.set(x, y, isSideGlass ? shade(WARM, 1.6, x, y) : shade(FACADE, r === 0 ? 2.6 : 1, x, y))
      }
      for (let x = X0 - 1; x <= X1 + 1; x++) {
        if (r === 0) {
          c.set(x, y, shade(FACADE, x === X0 - 1 ? 6 : 4.4 - (x - X0) * 0.04, x, y))
          continue
        }
        if (x < X0 || x > X1) continue
        if (x === X0 || x === X1) {
          c.set(x, y, shade(FACADE, x === X0 ? 4 : 2.2, x, y))
          continue
        }
        const w = Math.floor((x - X0 - 1) / 3)
        const isGlass = (x - X0 - 1) % 3 !== 2 && r !== 3
        if (!isGlass) {
          c.set(x, y, shade(FACADE, r === 3 ? 1.4 : 2, x, y))
          continue
        }
        const on = !isNew || litAt(f, w)
        if (!on) {
          c.set(x, y, shade(FACADE, 2.6 + (r === 1 ? 0.6 : 0), x, y))
          continue
        }
        const isCool = w === 2
        const level = (r === 1 ? 3.2 : 2.6) + ((x - X0 - 1) % 3 === 0 ? 0.4 : 0)
        c.set(x, y, isCool ? shade(COOL, level - 0.6, x, y) : shade(WARM, level, x, y))
      }
      continue
    }
    const isBeam = by === SKEL_BEAM || (isSet && by === LAND)
    const isColumn = (by > SKEL_BEAM && by < TOP_DONE) || (by >= STUB_TOP && by < SKEL_BEAM) || (isSet && by >= LAND - 3 && by < LAND)
    for (let x = X0; x <= X1; x++) {
      const lit = flash > 0 && by >= LAND - 4 && by <= SKEL_BEAM ? flash * 1.6 : 0
      if (isBeam) c.set(x, y, shade(STEEL, 3.6 + (x === X0 ? 1 : 0) + lit, x, y))
      else if (isColumn && COLS.includes(x)) c.set(x, y, shade(STEEL, (x === X0 ? 4 : 3.2) + lit, x, y))
    }
  }
}
function litAt(f: number, w: number): boolean {
  const t = f - (CLAD0 + 2 + w * 2)
  return t >= 0 && t !== 1
}

function drawCrane(c: Canvas, f: number, s: number, tx: number): void {
  for (let y = JIB_Y + 5; y < H; y++) {
    const r = mod(y - s, FH)
    c.set(MAST - 1, y, shade(CRANE, 3.6, 0, 0))
    c.set(MAST + 1, y, shade(CRANE, 2, 0, 0))
    if (r === 0) c.set(MAST, y, shade(CRANE, 3, 0, 0))
    else if (r === 2) c.set(MAST, y, shade(CRANE, 2.4, 0, 0))
  }
  for (let x = 2; x <= 61; x++) {
    c.set(x, JIB_Y, shade(CRANE, 4.4 - (x > MAST ? 0.6 : 0), 0, 0))
    c.set(x, JIB_Y + 2, shade(CRANE, 2.8, 0, 0))
    if (mod(x, 4) === 0 || mod(x, 4) === 2) c.set(x, JIB_Y + 1, shade(CRANE, mod(x, 4) === 0 ? 3 : 2, 0, 0))
  }
  c.rect(54, JIB_Y + 3, 7, 3, (x, y) => shade(COOL, 0.8 + (y === JIB_Y + 3 ? 1 : 0) - (x > 58 ? 0.6 : 0), x, y))
  c.rect(MAST - 2, JIB_Y + 3, 5, 2, (x, y) => shade(CRANE, x === MAST - 2 ? 4.6 : 3, x, y))
  c.rect(MAST - 5, JIB_Y + 3, 3, 4, (x, y) => shade(CRANE, x === MAST - 5 ? 4.2 : 3.2, x, y))
  c.set(MAST - 4, JIB_Y + 4, shade(WARM, 3.6, 0, 0))
  c.set(MAST - 4, JIB_Y + 5, shade(WARM, 2.6, 0, 0))
  c.rect(tx - 1, JIB_Y + 3, 3, 1, (x, y) => shade(CRANE, x === tx - 1 ? 5 : 3.6, x, y))
  if (f % 24 < 3) c.set(2, JIB_Y - 1, RED_LIGHT)
  if ((f + 12) % 24 < 3) c.set(61, JIB_Y - 1, RED_LIGHT)
}
const WELD_GLOW = [[14, 13, 18, 19], [22, 13, 26, 17], [30, 13, 34, 17]] as const
const GLOWN = [0x28406d, 0x2a4576, 0xc28470, ...STEEL.slice(4, 6)]
export const scene: Scene = {
  verb: 'Architecting',
  render,
  hero: 45,
  snaps: [0, 3, 6].flatMap(k =>
    WELD_GLOW.map(box => ({ frames: [LANDED + k, LANDED + k + 1] as const, box, colors: GLOWN, why: 'a weld arc flashes for a frame and lights the steel round its joint' })),
  ),
}