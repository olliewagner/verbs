import { Canvas, TAU, beat, clamp, hex, lerp, mix, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const DROP = hex('060818 0b1130 121b4c 1a2a68 263d86 3a58a6 5e7ec4 98b4e0 dce8fa')
const VELVET = hex('14040e 2c0816 4c0c1e 721424 9c1e2a c4342e e45a3c f69a64')
const GOLD = hex('241206 482a0c 74460f a86c16 d49a28 f0c64e fde68a fffbe0')
const FLOOR = hex('08060a 140c10 221418 342019 4c2e1e 6c4426 94622e')
const SATIN = hex('050409 0e0c16 1a1726 2a2840 46446a 7c7aa4 c0c0e0')
const BAND = hex('2a0610 581020 8a1a2a c03038 e85a4a')
const BULB_OFF = 0x5a3a1c

const HX = 32
const REST_Y = 20
const FLOOR_Y = 25
const TRAP_Y = 26

const BULBS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let y = 29; y >= 5; y -= 3) out.push([2, y])
  for (let i = 0; i <= 20; i++) out.push([Math.round(2 + (i * 59) / 20), 2])
  for (let y = 5; y <= 29; y += 3) out.push([61, y])
  return out
})()

function bulb(i: number, f: number): number {
  if (f >= 24 && f < 27) return 1.3
  if (f >= 27 && f < 35) return (i + Math.floor((f - 27) / 2)) % 2 === 0 ? 1 : 0.15
  return (i - Math.floor((f < 24 ? f : f + 1) / 2)) % 3 === 0 ? 1 : 0.15
}
function hat(f: number): { y: number; spin: number; caneX: number; caneY: number; caneA: number; isUp: boolean } {

  const rise = (from: number, to: number) => smoothstep(from, to, f) * 1.07 - 0.07 * smoothstep(to, to + 3, f)
  const down = smoothstep(35, 47, f)
  const lift = rise(10, 23) * (1 - down)
  const bob = f >= 25 && f < 35 ? Math.round(wave(f - 25, 10, 1) * 0.6) : 0
  const y = lerp(36, REST_Y, lift) + bob
  const spinUp = (1 - (1 - beat(f, 11, 24)) ** 2) * TAU * 2
  const spinDown = beat(f, 35, 45) ** 2 * TAU * 2
  const caneLift = rise(12, 25) * (1 - smoothstep(34, 45, f))
  const caneTwirl = (1 - smoothstep(13, 27, f)) * TAU + beat(f, 34, 45) ** 2 * TAU
  return {
    y,
    spin: spinUp + spinDown,
    caneX: HX + 8,
    caneY: lerp(38, REST_Y - 3, caneLift) + bob,
    caneA: -0.32 + caneTwirl,
    isUp: f >= 10 && f < 46,
  }
}
function spots(f: number): { x: number; y: number; rx: number; ry: number }[] {
  const focus = smoothstep(11, 22, f) * (1 - smoothstep(36, 48, f))
  const a = { x: 32 + wave(f, LOOP, 1, 0.1) * 17, y: 15 + wave(f, LOOP, 2, 0.3) * 4 }
  const b = { x: 32 - wave(f, LOOP, 1, 0.35) * 17, y: 15 + wave(f, LOOP, 2, 0.8) * 4 }
  const target = { x: HX, y: REST_Y - 4 }
  return [a, b].map((s, i) => ({
    x: lerp(s.x, target.x + (i ? 3 : -1) + wave(f, LOOP, 4, i * 0.4) * 1.2, focus),
    y: lerp(s.y, target.y + wave(f, LOOP, 6, i * 0.3) * 0.8, focus),
    rx: lerp(7.5, 10, focus),
    ry: lerp(7, 9, focus),
  }))
}
const curtainL = (y: number) => 5 + 9 - 5 * Math.sin(clamp((y - 5) / 15) * Math.PI * 0.5) + Math.max(0, y - 20) * 0.35
const curtainR = (y: number) => 63 - curtainL(y)
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const h = hat(f)
    const sp = spots(f)
    const blaze = f >= 24 && f < 27 ? [1.4, 0.9, 0.5][f - 24] ?? 0 : 0
    const trapOpen = smoothstep(10, 14, f) * (1 - smoothstep(43, 47, f))
    const trapGlow = trapOpen * (f < 24 ? 1 : f < 36 ? 0.55 : 1)
    const hatMask = new Set<number>()
    const markHat = (x: number, y: number) => hatMask.add(Math.round(y) * W + Math.round(x))
    for (let y = Math.round(h.y - 9); y <= Math.round(h.y + 1); y++) {
      for (let x = HX - 6; x <= HX + 6; x++) {
        if (y >= h.y - 1 ? Math.abs(x - HX) <= 6 : Math.abs(x - HX) <= 4) markHat(x, y)
      }
    }
    const spotLight = (x: number, y: number) => {
      let l = 0
      for (const [i, s] of sp.entries()) {
        const d = Math.hypot((x - s.x) / s.rx, (y - s.y) / s.ry)
        const isShadowed = hatMask.has(Math.round(y + 2) * W + Math.round(x + (i ? 3 : -3))) && h.isUp
        if (d < 1 && !isShadowed) l += d < 0.65 ? 3.2 : 2
      }
      return l
    }
    const beam = (x: number, y: number) => {
      let l = 0
      for (const [i, s] of sp.entries()) {
        const sx = i ? 58 : 6
        const sy = 46
        const ax = s.x - sx
        const ay = s.y - sy
        const bx = x - sx
        const by = y - sy
        const along = (ax * bx + ay * by) / Math.hypot(ax, ay)
        const across = Math.abs(ax * by - ay * bx) / Math.hypot(ax, ay)
        const reach = along / Math.hypot(ax, ay)
        if (reach > 0.15 && reach < 1 && across < s.rx * 0.7 * reach) l += 1.2
      }
      return Math.min(1.6, l)
    }
    const trapLight = (x: number, y: number) => trapGlow * Math.max(0, 1 - Math.hypot((x - HX) / 9, (y - TRAP_Y) / 14)) * 3
    for (let y = 5; y < FLOOR_Y; y++) {
      for (let x = 4; x < 60; x++) {
        const horizon = smoothstep(12, FLOOR_Y, y) * 1.4
        const isStar = (x * 7 + y * 13) % 41 === 0 && y < 15
        c.set(x, y, shade(DROP, 1.4 + horizon + spotLight(x, y) + beam(x, y) + trapLight(x, y) + blaze + (isStar ? 2 : 0), x, y))
      }
    }
    for (let y = FLOOR_Y; y < H; y++) {
      for (let x = 4; x < 60; x++) {
        const depth = (y - FLOOR_Y) / 6
        const isSeam = y === 27 || y === 30
        const mirror = spotLight(x, FLOOR_Y - 1 - (y - FLOOR_Y) * 2) * 0.45
        const level = 2.2 + depth * 0.8 + mirror + beam(x, y) + trapLight(x, y) * 0.6 + blaze * 0.6 - (isSeam ? 0.9 : 0)
        c.set(x, y, shade(FLOOR, level, x, y))
      }
    }
    for (let x = 4; x < 60; x++) c.set(x, 31, shade(GOLD, 2 + spotLight(x, 18) * 0.5 + blaze, x, 31))
    if (trapOpen > 0) {
      const rx = 6.5 * trapOpen
      for (let y = TRAP_Y - 1; y <= TRAP_Y + 1; y++) {
        for (let x = HX - 7; x <= HX + 7; x++) {
          const d = Math.hypot((x - HX + 0.5) / Math.max(0.5, rx), (y - TRAP_Y) / 1.3)
          if (d < 1) c.set(x, y, shade(GOLD, 3 + trapGlow * 4 - d * 2 + (y > TRAP_Y ? -1.5 : 0), x, y))
        }
      }
    }
    const isVisible = (x: number, y: number) =>
      y < FLOOR_Y || (y <= TRAP_Y && trapOpen > 0.3 && Math.abs(x - HX + 0.5) < 6.5 * trapOpen)
    if (h.isUp) {
      const by = Math.round(h.y)
      const front = Math.cos(h.spin)
      const bowX = Math.round(HX + Math.sin(h.spin) * 3.4)
      const lift = blaze * 0.8
      for (let y = by - 10; y <= by - 1; y++) {
        for (let x = HX - 4; x <= HX + 4; x++) {
          if (!isVisible(x, y)) continue
          const dx = x - HX
          const light = Math.min(1, spotLight(x, y) / 3.2) + trapLight(x, y) * 0.3 + lift
          const surface = dx === -2 ? 1.6 * light + 0.8 : dx === 3 ? 1.1 * light + 0.3 : Math.abs(dx) === 4 ? -0.4 : dx === -3 ? 0.5 * light : 0.2 * light
          if (y === by - 10) {
            if (Math.abs(dx) <= 3) c.set(x, y, shade(SATIN, 2.4 + light * 0.8, 0, 0))
            continue
          }
          if (y === by - 3 || y === by - 2) {
            const isBow = front > 0.2 && Math.abs(x - bowX) <= 1 && !(y === by - 2 && x === bowX)
            c.set(x, y, isBow ? shade(GOLD, x === bowX ? 6 : 4.4, 0, 0) : shade(BAND, 1.5 + surface * 0.7, 0, 0))
            continue
          }
          c.set(x, y, shade(SATIN, 1 + surface, 0, 0))
        }
      }
      for (let x = HX - 6; x <= HX + 6; x++) {
        const dx = Math.abs(x - HX)
        if (isVisible(x, by)) c.set(x, by, shade(SATIN, dx === 6 ? 1.6 : 2.2 + trapLight(x, by) * 0.3 + lift + (x < HX ? 0.4 : 0), 0, 0))
        if (dx <= 5 && isVisible(x, by + 1)) c.set(x, by + 1, shade(SATIN, 0.4 + trapLight(x, by + 1) * 0.6, 0, 0))
      }
      for (const x of [HX - 6, HX + 6]) if (isVisible(x, by - 1)) c.set(x, by - 1, shade(SATIN, 2.4 + lift, 0, 0))
    }
    const spinning = (f >= 14 && f < 24) || (f >= 36 && f < 43)
    if (h.isUp && spinning) {
      const by = Math.round(h.y)
      const k = f % 2
      for (const side of [-1, 1]) {
        const x0 = HX + side * 6
        const ys = side === (k ? 1 : -1) ? [by - 8, by - 7, by - 6] : [by - 5, by - 4, by - 3]
        ys.forEach((y, j) => {
          const x = x0 + side * (j === 1 ? 1 : 0)
          if (isVisible(x, y)) c.set(x, y, shade(DROP, 7 - (j === 1 ? 0 : 1), 0, 0))
        })
      }
    }
    if (h.isUp) {
      const turn = h.caneA - hat(f - 1).caneA
      if (Math.abs(turn) > 0.3) {
        for (let k = 0; k <= 12; k++) {
          const a = h.caneA - (turn * k) / 12
          const x = Math.round(h.caneX + 7 * Math.sin(a))
          const y = Math.round(h.caneY - 7 * Math.cos(a))
          if (isVisible(x, y)) c.set(x, y, shade(GOLD, 2.6 - k * 0.1, 0, 0))
        }
      }
      const ca = Math.cos(h.caneA)
      const sa = Math.sin(h.caneA)
      const pt = (u: number, v: number): [number, number] => [h.caneX + u * ca - v * sa, h.caneY + u * sa + v * ca]
      const pts: [number, number, string][] = []
      for (let v = 8; v >= -6; v -= 0.5) pts.push([...pt(0, v), v > 6.5 ? 'tip' : 'shaft'])
      for (let a = 0; a <= Math.PI * 1.2; a += 0.15) pts.push([...pt(2 - 2 * Math.cos(a), -6 - 2 * Math.sin(a)), 'crook'])
      for (const [x, y, part] of pts) {
        if (!isVisible(Math.round(x), Math.round(y))) continue
        const lit = (spotLight(x, y) > 0 ? 1 : 0) + trapLight(x, y) * 0.4 + blaze
        c.set(x, y, part === 'shaft' ? shade(SATIN, 0.8 + lit * 1.6, 0, 0) : shade(GOLD, 4 + lit, 0, 0))
      }
    }
    for (let y = 5; y < H; y++) {
      for (let x = 4; x < 60; x++) {
        const isLeft = x <= curtainL(y)
        const isRight = x >= curtainR(y)
        if (!isLeft && !isRight) continue
        const fold = Math.cos((isLeft ? x : 63 - x) * 1.15 + (y > 19 ? (y - 19) * 0.25 : 0))
        const toEdge = isLeft ? curtainL(y) - x : x - curtainR(y)
        const spill = spotLight(x, y) * 0.5 + beam(x, y) * 0.9 + blaze * 0.8
        c.set(x, y, shade(VELVET, 2.6 + fold * 1.2 + spill - (toEdge < 1 ? 0.8 : 0) - (y > 26 ? 0.6 : 0), x, y))
      }
    }
    for (const [x0, x1] of [[4, 9], [54, 59]] as const) {
      for (let x = x0; x <= x1; x++) c.set(x, 20, shade(GOLD, 4 + blaze, 0, 0))
      c.set(x0 === 4 ? x1 : x0, 21, shade(GOLD, 3, 0, 0))
    }
    for (let x = 4; x < 60; x++) {
      const scallop = 6 + Math.round(Math.abs(Math.sin(((x - 4) / 56) * Math.PI * 5)) * 2)
      for (let y = 5; y <= scallop; y++) {
        c.set(x, y, shade(VELVET, 3 + (y === 5 ? 1.2 : 0) - (y === scallop ? 0.8 : 0) + blaze * 0.6, x, y))
      }
      c.set(x, scallop + 1, shade(GOLD, 3.6 + blaze, 0, 0))
    }
    const glow = new Float32Array(W * H)
    const lit = BULBS.map((_, i) => bulb(i, f))
    BULBS.forEach(([bx, by], i) => {
      for (let y = by - 1; y <= by + 1; y++) {
        for (let x = bx - 1; x <= bx + 1; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          glow[y * W + x] = Math.max(glow[y * W + x] ?? 0, (lit[i] ?? 0) > 0.5 ? 1 : 0)
        }
      }
    })
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isFrame = y < 5 || x < 4 || x >= 60
        if (!isFrame) continue
        const g = glow[y * W + x] ?? 0
        const isTrim = y === 4 || x === 3 || x === 60 || y === 0
        const base = isTrim ? 2.4 : 0.9
        c.set(x, y, shade(GOLD, g > 0 ? 3.6 + blaze : base + blaze * 0.6, x, y))
      }
    }
    BULBS.forEach(([bx, by], i) => {
      const l = lit[i] ?? 0
      c.set(bx, by, l > 0.5 ? mix(GOLD[6] ?? 0, 0xffffff, l - 0.7) : BULB_OFF)
    })
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Razzle-dazzling',
  render,
  hero: 25,
  snaps: [
    { frames: 24, why: 'the hat lands its pose: every bulb blazes and the whole stage flashes' },
    { frames: [15, 19], box: [HX - 7, FLOOR_Y - 1, HX + 6, TRAP_Y + 1], why: 'the stage floor hides the hat until it clears the trap: its band and brim come through the slot whole' },
    { frames: [38, 45], box: [HX - 7, FLOOR_Y - 1, HX + 6, TRAP_Y + 1], why: 'the hat sinks behind the stage floor through the trap, and the trap shuts' },
    { frames: [17, 24], box: [HX + 7, 8, HX + 17, FLOOR_Y], colors: [...SATIN, ...GOLD], why: 'the cane twirls up beside the hat, too fast to follow, its crook trailing a gold swoosh' },
    { frames: [38, 45], box: [HX + 7, 8, HX + 17, FLOOR_Y], colors: [...SATIN, ...GOLD], why: 'the cane twirls away down behind the floor, its crook trailing a gold swoosh' },
  ],
}