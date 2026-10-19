import { Canvas, TAU, beat, clamp, ease, hex, mix, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const PEG = hex('0b1214 101a1d 152327 1c2e31 243a3b 2f4844 405749 586a52 77805e')
const WOOD = hex('1a0f0e 2a1813 3d2217 552e1c 6e3d22 8a4f2a a86634 c78442')
const BRASS = hex('2a1a0c 46290f 664013 8a5a18 b07c22 d3a136 ecc65a f8e597 fffbe0')
const COPPER = hex('2a0f0c 4a1d14 6f2e1a 96441f bd5e2a db8040 eda766')
const STEEL = hex('15161c 25262e 393a44 545560 767884 a0a2ac d0d2d8')
const RED = hex('3a0c10 6a1418 a02020 d0362a f0603c ff9a6a')
const LAMP = hex('0f1d18 173025 22462f 2f5d39 427547')
const BULB = hex('f6b35a fbd88a fff4cf')
const LIGHTS = [hex('16301c 3a8a3a 9cf06a'), hex('3a2a10 b07a18 ffd050'), hex('3a1014 b0242a ff6a5a')] as const
const DIAL = hex('6b5a48 b8a582 ede0c0')
const SOUND = hex('3b5850 7c9a86 c8dcc0')
const DUST = hex('3d2a20 6b5040 9a8068')
const MOTE = hex('8f8a68 c8bb8c')
const BLUR = mix(RED[2] ?? 0, PEG[5] ?? 0, 0.45)

const swing = (t: number) => (t < 0.75 ? 1.06 * smoothstep(0, 0.75, t) : 1.06 - 0.06 * smoothstep(0.75, 1, t))
const fold = (t: number) => smoothstep(0, 1, t)

const outIn = (f: number, a: number, b: number, c: number, d: number, out = ease.outBack, back = ease.in) =>
  f < c ? out(beat(f, a, b)) : 1 - back(beat(f, c, d))

const antenna = (f: number) => outIn(f, 5, 13, 82, 87)
const propeller = (f: number) => outIn(f, 12, 19, 76, 81, swing)
const horn = (f: number) => outIn(f, 19, 31, 67, 77, swing, fold)
const flag = (f: number) => outIn(f, 27, 34, 65, 70, swing, fold)
const whir = (f: number) => clamp(beat(f, 36, 42) - beat(f, 56, 64))
const SPIN: number[] = (() => {
  const a = [0]
  for (let f = 0; f < LOOP; f++) a.push((a[f] ?? 0) + 1.25 * whir(f + 0.5) + 0.12 * propeller(f) * (f > 20 && f < 76 ? 1 : 0))
  return a
})()

function lift(f: number): number {
  if (f === 4 || f === 5 || f === 34 || f === 35 || f === 58) return 1
  const rattle = (f >> 1) % 2 === 0 ? -1 : 0
  if (f >= 44 && f < 58) {
    const hover = 3 * (ease.out(beat(f, 44, 50)) - ease.in(beat(f, 53, 58)))
    return -Math.round(hover) + (hover > 2 ? rattle : 0)
  }
  if (whir(f) > 0.5) return rattle
  if (f === 87 || f === 88) return -1
  return 0
}

const LAMP_X = 11
const LAMP_Y = 6
const SAG = [0.6, 0.45, 0.8]
const lampPower = (f: number) => SAG[f - 47] ?? SAG[f - 52] ?? 1

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const power = lampPower(f)
    const lit = (x: number, y: number) => power * Math.max(0, 1 - Math.hypot(x - LAMP_X, (y - LAMP_Y) * 1.2) / 46) ** 1.3

    const g = new Canvas()
    g.px.fill(-1)
    drawGadget(g, f, lit)

    const c = new Canvas()
    for (let y = 0; y < 23; y++) {
      for (let x = 0; x < W; x++) {
        const l = lit(x, y)
        const isHole = x % 4 === 2 && y % 4 === 1
        const sx = x - 3
        const sy = y - 2
        const inShadow = sx >= 0 && sy >= 0 && (g.px[sy * W + sx] ?? -1) !== -1
        const level = 0.8 + l * 6.2 - (isHole ? Math.min(1.4, Math.max(0, l - 0.3) * 4) : 0) - (inShadow ? l * 3.2 : 0) - (y === 22 ? 0.8 : 0)
        c.set(x, y, shade(PEG, level, x, y))
      }
    }

    drawTools(c, lit)
    drawLamp(c, f)

    for (let x = 0; x < W; x++) {
      for (let y = 23; y < H; y++) {
        const l = lit(x, y)
        let level: number
        if (y <= 25) {
          const grain = ((x >> 1) * 7 + y * 3) % 11 === 0 ? -0.6 : 0
          const hover = Math.max(0, -lift(f) - 1)
          const shadow = (x >= 39 - hover && x <= 45 - hover && y <= 24 ? (46 - hover - x) / 7 : 0) +
            (x >= 26 + hover && x <= 38 - hover && y === 23 ? 0.6 : 0)
          level = 2.8 + l * 4.4 + grain - shadow * 2 - (y === 23 ? 0.3 : 0)
        } else if (y === 26) {
          level = 3.4 + l * 4
        } else {
          const isDrawer = x >= 22 && x <= 41 && y >= 28 && y <= 30
          const edge = isDrawer && (y === 28 || x === 22 || x === 41) ? -0.8 : 0
          level = 1.2 + l * 2.4 + (isDrawer ? 0.5 : 0) + edge - (x % 21 === 0 ? 0.7 : 0)
        }
        c.set(x, y, shade(WOOD, level, x, y))
      }
    }
    c.set(31, 29, shade(BRASS, 3 + lit(31, 29) * 3))
    c.set(32, 29, shade(BRASS, 2 + lit(32, 29) * 3))
    for (let x = 46; x <= 49; x++) c.set(x, 24, shade(STEEL, 3 + lit(x, 24) * 3 + (x === 46 ? 1 : 0)))
    for (let x = 50; x <= 52; x++) c.set(x, 24, shade(RED, 2.4 + lit(x, 24) * 2.5 + (x === 50 ? 0.8 : 0)))
    for (const [x, y] of [[14, 24], [17, 25], [56, 25]] as const) {
      c.set(x, y, shade(STEEL, 3.2 + lit(x, y) * 3))
      c.set(x + 1, y, shade(STEEL, 2 + lit(x, y) * 2))
    }

    for (let i = 0; i < W * H; i++) {
      const p = g.px[i] ?? -1
      if (p !== -1) c.px[i] = p
    }

    for (const at of [58, 89]) {
      if (f < at || f > at + 3) continue
      const t = (f - at) / 3
      for (const side of [-1, 1]) {
        const x = 32 + side * (7.5 + t * 2.5)
        const y = 22.5 - t
        c.disc(x, y, 0.7 + t * 0.6, shade(DUST, 2 - t * 1.6))
      }
    }

    for (const m of particles(f, LOOP, 5, 60, 5)) {
      const x = 8 + m.r[1] * 26 + Math.sin(m.age * TAU * 0.8 + m.r[2] * 6) * 2
      const y = 9 + m.r[3] * 10 - m.age * 6
      const l = lit(x, y)
      if (l > 0.45 && Math.sin(m.age * Math.PI) > 0.3) c.set(x, y, MOTE[l > 0.75 ? 1 : 0] ?? 0)
    }

    out.push(c.px)
  }

  return out
}

function drawGadget(c: Canvas, f: number, lit: (x: number, y: number) => number): void {
  const dy = lift(f)
  const top = 14 + dy
  const w = whir(f)

  const hp = horn(f)
  if (hp > 0.02) {
    const px = 26
    const py = top + 4
    const angle = -0.03 * Math.PI - hp * 0.87 * Math.PI
    const ux = Math.cos(angle)
    const uy = Math.sin(angle)
    const len = 8
    for (let y = py - 11; y <= py + 11; y++) {
      for (let x = px - 11; x <= px + 11; x++) {
        const rx = x - px
        const ry = y - py
        const u = rx * ux + ry * uy
        const v = -rx * uy + ry * ux
        if (u < 0 || u > len) continue
        const half = 0.55 + (u / len) ** 3 * 2.9
        if (Math.abs(v) > half) continue
        const nx = -uy * Math.sign(v || 1)
        const ny = ux * Math.sign(v || 1)
        const facing = (nx * -0.6 + ny * -0.8) * (Math.abs(v) / Math.max(0.6, half))
        const isMouth = u > len - 0.8
        const level = isMouth ? 1.6 + (Math.abs(v) > half - 0.8 ? 3 : 0) : 3.6 + facing * 2.2 + lit(x, y) * 2.5
        c.set(x, y, shade(BRASS, level, x, y))
      }
    }
    for (const honk of [42, 50]) {
      const t = f - honk
      if (t < 0 || t > 6) continue
      const bx = px + ux * (len + 0.5)
      const by = py + uy * (len + 0.5)
      for (const ring of [0, 1.9]) {
        const r = 1.5 + t * 1.3 - ring
        if (r < 1) continue
        for (let y = Math.floor(by - r - 1); y <= Math.ceil(by + r + 1); y++) {
          for (let x = Math.floor(bx - r - 1); x <= Math.ceil(bx + r + 1); x++) {
            const d = Math.hypot(x - bx, y - by)
            const a = Math.atan2(y - by, x - bx) - angle
            if (Math.abs(d - r) < 0.5 && Math.cos(a) > 0.55 + t * 0.06 && t < 5) c.set(x, y, shade(SOUND, 2.4 - t * 0.5, x, y))
          }
        }
      }
    }
  }

  const ap = antenna(f)
  const ax = 31
  c.set(ax, top - 1, shade(BRASS, 3 + lit(ax, top - 1) * 2))
  c.set(ax + 1, top - 1, shade(BRASS, 2 + lit(ax + 1, top - 1) * 2))
  if (ap > 0.03) {
    const height = Math.round(ap * 9)
    const sway = w > 0.5 ? Math.round(Math.sin(f * 1.3)) : 0
    for (let k = 1; k <= height; k++) {
      const x = ax + (k > height * 0.6 ? sway : 0)
      c.set(x, top - 1 - k, shade(STEEL, (k < height * 0.4 ? 3 : 4.2) + lit(x, top - 1 - k) * 2))
    }
    const tx = ax + sway
    const ty = top - 2 - height
    const isOn = w > 0 ? (f >> 1) % 2 === 0 : (f >> 3) % 2 === 0
    c.set(tx, ty, shade(RED, isOn ? 5 : 2.4))
    c.set(tx + 1, ty, shade(RED, isOn ? 4 : 1.6))
    c.set(tx, ty - 1, shade(RED, isOn ? 5 : 3))
    c.set(tx + 1, ty - 1, shade(RED, isOn ? 4.4 : 2.2))
  } else {
    c.set(ax, top - 2, shade(RED, 2.4))
  }

  const fp = flag(f)
  if (fp > 0.05) {
    const fx = 28
    const height = Math.round(fp * 6)
    for (let k = 1; k <= height; k++) c.set(fx, top - k, shade(STEEL, 3.6 + lit(fx, top - k) * 2))
    const fy = top - height
    const flap = w > 0.3 ? (f % 3) - 1 : Math.round(Math.sin(f * 0.5) * 0.6)
    const cloth = Math.min(4, Math.round(fp * 4))
    for (let row = 0; row < 3; row++) {
      const width = Math.max(0, cloth - row - (row === 0 ? 0 : 0) + (row === 1 && flap > 0 ? 1 : 0))
      for (let i = 1; i <= width; i++) {
        const y = fy + row + (i >= 3 ? (flap < 0 ? 1 : 0) : 0)
        c.set(fx - i, y, shade(RED, 3.6 - row * 0.8 + lit(fx - i, y) * 1.5 - (i === width && flap !== 0 ? 0.8 : 0)))
      }
    }
  }

  const pp = propeller(f)
  if (pp > 0.03) {
    const sx = 37
    const height = Math.round(pp * 5)
    for (let k = 1; k <= height; k++) c.set(sx, top - k, shade(STEEL, 3.4 + lit(sx, top - k) * 2))
    const hy = top - height - 1
    const span = clamp(pp, 0, 1.1) * 3.5
    const angle = SPIN[f] ?? 0
    if (w > 0.55) {
      for (let x = Math.round(sx - span); x <= Math.round(sx + span); x++) c.set(x, hy, BLUR)
    }
    const reach = Math.round(span * Math.abs(Math.cos(angle)))
    for (let x = sx - reach; x <= sx + reach; x++) c.set(x, hy, shade(RED, 3.6 + (x < sx ? 0.6 : -0.4) + lit(x, hy) * 1.5))
    c.set(sx, hy, shade(BRASS, 5.5))
    c.set(sx, hy - 1, shade(BRASS, 4))
  }

  for (let y = top; y <= 22 + dy; y++) {
    for (let x = 26; x <= 38; x++) {
      if (y === top && (x === 26 || x === 38)) continue
      const row = y - top
      const l = lit(x, y)
      let level = 3.2 + l * 2.6
      if (row === 0) level += 1.6
      else if (row === 1) level += 0.4
      if (x === 26) level += 0.6
      if (x === 38) level -= 1
      if (y === 22 + dy) level -= 1.2
      let ramp = BRASS
      if (row === 6) {
        ramp = COPPER
        level = 3.2 + l * 2.4 + (x === 26 ? 0.6 : x === 38 ? -1 : 0)
        if (x === 27 || x === 37) level += 2
      }
      if (row === 7 && x >= 32 && x <= 36) level = 1.1
      if (row === 8 && x >= 32 && x <= 36) level += 0.8
      c.set(x, y, shade(ramp, level, x, y))
    }
  }
  for (const x of [27, 28, 36, 37]) c.set(x, 23 + dy, shade(COPPER, x === 27 || x === 36 ? 2.4 : 1.4))

  const gx = 29.5
  const gy = top + 3
  for (let y = Math.floor(gy - 2); y <= Math.ceil(gy + 2); y++) {
    for (let x = Math.floor(gx - 2); x <= Math.ceil(gx + 2); x++) {
      const d = Math.hypot(x - gx, y - gy)
      if (d < 1.3) c.set(x, y, shade(DIAL, 2 - (x > gx && y > gy ? 1 : 0)))
      else if (d < 2.2) c.set(x, y, shade(BRASS, x < gx && y < gy ? 5.5 : 1.6))
    }
  }
  const needle = -2.4 + (w > 0 ? 2.2 * w + Math.sin(f * 2.1) * 0.3 * w : f >= 3 && f <= 4 ? 0.9 : 0)
  c.set(Math.round(gx + Math.cos(needle) * 1.1), Math.round(gy + Math.sin(needle) * 1.1), STEEL[0] ?? 0)
  c.set(Math.round(gx), Math.round(gy), RED[2] ?? 0)

  for (let k = 0; k < 3; k++) {
    const x = 33 + k * 2
    const y = top + 2
    const ramp = LIGHTS[k] ?? LIGHTS[0]
    const isOn = w > 0.2 ? mod((f >> 1) - k, 3) === 0 : k === 0 && mod(f, 12) < 4
    c.set(x, y, ramp[isOn ? 2 : 0] ?? 0)
  }
}

function drawTools(c: Canvas, lit: (x: number, y: number) => number): void {
  const put = (x: number, y: number, ramp: readonly number[], base: number) => {
    c.set(x + 2, y + 1, shade(PEG, 0.6 + lit(x, y) * 3))
    c.set(x, y, shade(ramp, base + lit(x, y) * 3.2, x, y))
  }
  for (let k = 0; k < 8; k++) put(49 + Math.round(k * 0.4), 4 + k, STEEL, k === 0 ? 3.6 : 2.6)
  for (const [x, y] of [[48, 3], [50, 3], [48, 4], [51, 12], [53, 12], [52, 13]] as const) put(x, y, STEEL, 2.4)
  for (let y = 5; y <= 13; y++) put(58, y, WOOD, 4 - (y === 13 ? 1 : 0))
  for (let x = 55; x <= 60; x++) put(x, 3, STEEL, x === 55 ? 3.8 : 3)
  for (const x of [55, 56, 57, 58]) put(x, 4, STEEL, 2)
  put(61, 4, STEEL, 2.4)
  for (let y = 4; y <= 8; y++) {
    for (let x = 44 - (y - 4) * 2; x <= 44; x++) put(x, y, STEEL, y === 8 ? ((x & 1) === 0 ? 1.6 : 2.4) : 3.2 + (y === 4 ? 0.8 : 0))
  }
  for (const [x, y] of [[45, 3], [46, 3], [45, 4], [47, 4], [45, 5], [47, 5], [45, 6], [46, 6], [47, 6]] as const) put(x, y, WOOD, 4.4)
  for (const [x, y] of [[49, 2], [58, 2], [45, 2]] as const) c.set(x, y, shade(STEEL, 2 + lit(x, y) * 3))
}

function drawLamp(c: Canvas, f: number): void {
  const power = lampPower(f)
  c.line(0, 12, 4, 4, STEEL[2] ?? 0)
  c.line(1, 12, 5, 4, STEEL[1] ?? 0)
  const shadeRows: [number, number, number][] = [[3, 5, 8], [4, 4, 10], [5, 4, 12], [6, 5, 14]]
  for (const [y, x0, x1] of shadeRows) {
    for (let x = x0; x <= x1; x++) {
      const isRim = y === 6
      c.set(x, y, shade(LAMP, isRim ? 4 : 1.4 + (x - x0) * 0.25 + (y === 3 ? 1 : 0), x, y))
    }
  }
  const glow = clamp((power - 0.4) / 0.6)
  for (let x = 7; x <= 12; x++) c.set(x, 7, shade(BULB, (x > 8 && x < 11 ? 2 : 1) * glow))
  for (let x = 6; x <= 14; x++) c.set(x, 6, power > 0.5 && x > 6 && x < 14 ? (BULB[0] ?? 0) : (LAMP[4] ?? 0))
}

export const scene: Scene = {
  verb: 'Whatchamacalliting',
  render,
  hero: 50,
  snaps: [
    { frames: [45, 46], box: [11, 0, 44, 24], why: 'the box lifts off the bench on its propeller, a pixel a frame, and its shadow on the pegboard rises with it: the payoff, the whole gadget moving at once' },
    { frames: [47, 50], box: [0, 0, 53, 31], why: 'the lamp sags as the box draws its hardest: the room dims over two frames and the filament glows back up over two' },
    { frames: [52, 55], box: [0, 0, 53, 31], why: 'the lamp sags a second time, with the second honk, and glows back up' },
    { frames: [57, 58], box: [12, 0, 44, 24], why: 'the box drops back onto the bench, two pixels a frame, and thuds a pixel into it as the dust puffs out' },
  ],
}
