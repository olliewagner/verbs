import { Canvas, PALETTE, beat, ease, hex, lerp, lightAt, mix, shade, threshold, type Light, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const PANEL = hex('06090d 0b1116 111a1f 172327 1f2e31 283a3b 344846 435850 576a5d 718070')
const AMBER = hex('2a1206 4a2008 7a380c b05a14 dc8424 f6b04a ffd98a fff4d4')
const DEAD = hex('0e0a0a 1a1210 2a1c16 3a281e')
const GREEN = hex('04140c 082414 0c3a1e 125a2a 1c823a 34b050 6cd874 b4f4a8 eeffe4')
const RED = PALETTE.red
const METAL = PALETTE.metal
const FACE = hex('1e1c18 3a362c 5e5846 8c8466 bab092 e0d8bc f6f0de')
const GLOVE = hex('24160e 432a16 6a4422 966232 bc8446 dcaa68 f0cc90')
const SLEEVE = hex('080c18 10162a 1a2440 263656 344a70')
const GREEN_WASH = 0x2e8a4c

const GRAB = 12
const THROW0 = 14
const THROW1 = 18
const CHAIN0 = 19
const SPEED = 2.4
const LETGO = 43
const REACH = 4
const SNAP = 52

const HUB_X = 8
const HUB_Y = 16
const ARM = 10
const LAMP_X = 57.5
const LAMP_Y = 11.5
const MODULES: readonly (readonly [number, number])[] = [[0, 12], [14, 27], [29, 41], [43, 50], [52, 63]]
const TOP = 2
const BOTTOM = 28
const PIPE_Y = 23

const wake = (x: number) => Math.round(CHAIN0 + Math.max(0, x - 13) / SPEED)
const sleep = (x: number) => Math.round(SNAP + 1 + Math.max(0, 62 - x) / 16)
const isOn = (x: number, f: number) => f >= wake(x) && f < sleep(x)

function leverAngle(f: number): number {
  if (f < GRAB) return 0
  if (f < THROW0) return -0.2 * ease.out(beat(f, GRAB, THROW0))
  if (f < THROW1) return lerp(-0.2, Math.PI, beat(f, THROW0, THROW1) ** 2)
  if (f < THROW1 + 3) return Math.PI - 0.32 * Math.sin(beat(f, THROW1, THROW1 + 3) * Math.PI)
  if (f < SNAP) return Math.PI
  if (f < SNAP + 4) return Math.PI * (1 - ease.outBack(beat(f, SNAP, SNAP + 3)))
  return 0
}

function fuseHead(f: number): number {
  if (f < CHAIN0 || f >= SNAP + 1) {
    if (f < SNAP + 1 || f >= SNAP + 5) return -1
    return lerp(62, 10, beat(f, SNAP + 1, SNAP + 4))
  }
  return 13 + (f - CHAIN0) * SPEED
}

const vignette = (x: number, y: number) => (((x - 32) / 36) ** 2 + ((y - 15) / 22) ** 2) * 1.4

type Lamp = { x: number; y: number; w: number; h: number; ramp: Ramp }
const LAMPS: readonly Lamp[] = [
  { x: 2, y: 4, w: 2, h: 2, ramp: AMBER },
  { x: 24, y: 4, w: 2, h: 2, ramp: AMBER },
  { x: 24, y: 7, w: 2, h: 2, ramp: AMBER },
  { x: 24, y: 10, w: 2, h: 2, ramp: RED },
  { x: 44, y: 15, w: 2, h: 2, ramp: RED },
  { x: 48, y: 15, w: 2, h: 2, ramp: AMBER },
  ...[15, 18, 21, 24, 30, 33, 36, 39, 44, 47].map(x => ({ x, y: 26, w: 2, h: 1, ramp: AMBER })),
]

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const head = fuseHead(f)
    const greenOn = isOn(LAMP_X, f)
    const since = f - wake(LAMP_X)
    const ember = greenOn ? 0 : ([0.6, 0.25][f - sleep(LAMP_X)] ?? 0)
    const bloom = greenOn ? (since === 0 ? 2 : since === 1 ? 1.4 : 1 + 0.08 * Math.sin(f * 0.9)) : ember

    const warm: Light[] = []
    for (const l of LAMPS) if (isOn(l.x, f)) warm.push({ x: l.x + l.w / 2, y: l.y + l.h / 2, power: f === wake(l.x) ? 0.7 : 0.35, radius: 7 })
    if (isOn(35, f)) warm.push({ x: 35.5, y: 8, power: 0.45, radius: 12 })
    if (head >= 0) warm.push({ x: head, y: PIPE_Y, power: 0.6, radius: 9 })
    if (f >= THROW1 && f < THROW1 + 3) warm.push({ x: HUB_X, y: 26, power: 1 - (f - THROW1) * 0.3, radius: 14 })
    const green: Light[] = bloom > 0 ? [{ x: LAMP_X, y: LAMP_Y, power: 0.85 * bloom, radius: 56 }] : []
    const lit = (x: number, y: number) => ({ a: lightAt(warm, x, y), g: lightAt(green, x, y) })

    const panel = (x: number, y: number, base: number) => {
      const { a, g } = lit(x, y)
      const col = shade(PANEL, base + a * 2.6 + g * 2.6 - vignette(x, y), x, y)
      const wash = Math.min(0.6, Math.round(g * 4) / 8)
      return wash > 0 ? mix(col, GREEN_WASH, wash) : col
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let base = 0.6
        if (y < TOP) base = y === 1 ? 1.8 : 0.4
        else if (y > BOTTOM) base = y === BOTTOM + 1 ? 0.5 : y === BOTTOM + 2 ? 3.4 : 1.6
        else {
          const m = MODULES.find(([a, b]) => x >= a && x <= b)
          if (m !== undefined) {
            base = 3.4
            if (y === TOP) base += 1.4
            else if (y === BOTTOM) base -= 1
            if (x === m[0]) base += 0.6
            else if (x === m[1]) base -= 0.5
          }
        }
        c.set(x, y, panel(x, y, base))
      }
    }
    for (const [a, b] of MODULES) {
      for (const [sx, sy] of [[a + 1, TOP + 1], [b - 1, TOP + 1]] as const) {
        c.set(sx, sy, panel(sx, sy, 4.4))
        c.set(sx, sy + 1, panel(sx, sy + 1, 1.2))
      }
    }
    for (const vy of [22, 24, 26]) {
      for (let x = 54; x <= 61; x++) {
        c.set(x, vy, panel(x, vy, 0.6))
        c.set(x, vy + 1, panel(x, vy + 1, 3.6))
      }
    }
    for (let x = 15; x <= 21; x++) {
      for (const y of [14, 15]) {
        const { a, g } = lit(x, y)
        c.set(x, y, shade(FACE, 1.4 + (y === 14 ? 0.6 : 0) + a * 2.4 + g * 1.5 - vignette(x, y), x, y))
      }
    }

    for (let y = 6; y <= 28; y++) {
      c.set(HUB_X, y, panel(HUB_X, y, 0.2))
      c.set(HUB_X - 1, y, panel(HUB_X - 1, y, 1.4))
      c.set(HUB_X + 1, y, panel(HUB_X + 1, y, 3.8))
    }

    for (const l of LAMPS) {
      const on = isOn(l.x, f)
      const flash = f === wake(l.x)
      const standby = l.x === 2 && !on && f < THROW1
      for (let j = -1; j <= l.h; j++) {
        for (let i = -1; i <= l.w; i++) {
          const x = l.x + i
          const y = l.y + j
          const isBezel = i < 0 || j < 0 || i >= l.w || j >= l.h
          if (isBezel && l.h === 1) {
            if (j === l.h) c.set(x, y, panel(x, y, 4))
            continue
          }
          if (isBezel) {
            const isCorner = (i < 0 || i >= l.w) && (j < 0 || j >= l.h)
            if (!isCorner) c.set(x, y, panel(x, y, j < 0 ? 4 : j >= l.h ? 0.8 : 2))
            continue
          }
          const spec = i === 0 && j === 0 && l.h > 1 ? 1 : 0
          if (on || standby) c.set(x, y, shade(l.ramp, (flash ? 7 : 5) + spec - (standby ? 3.2 - 2.4 * Math.abs(Math.sin(f * (f >= GRAB ? 0.9 : 0.4))) : 0), x, y))
          else c.set(x, y, shade(DEAD, 1 + spec * 2, x, y))
        }
      }
    }

    for (const [dx, dy, r, target] of [[19, 7.5, 4, 0.72], [46.5, 7.5, 3.5, 0.6]] as const) {
      const w = wake(dx)
      const on = isOn(dx, f)
      const v = on
        ? target * ease.outElastic(beat(f, w, w + 8)) + (f > w + 8 ? Math.sin(f * 1.7 + dx) * 0.025 : 0)
        : f >= sleep(dx) ? target * (1 - ease.in(beat(f, sleep(dx), sleep(dx) + 4))) : 0
      c.disc(dx, dy, r + 0.6, (x, y) => panel(x, y, y < dy ? 4.6 : 1.6))
      c.disc(dx, dy, r - 0.4, (x, y) => {
        const { a, g } = lit(x, y)
        const back = 2.6 * (on ? Math.min(1, (f - w + 1) / 3) : f >= sleep(dx) ? Math.max(0, 1 - (f - sleep(dx) + 1) / 3) : 0)
        return shade(FACE, 1.4 + back + a * 1.4 + g * 1.2 - (y > dy + 1 ? 0.6 : 0) - vignette(x, y) * 0.5, x, y)
      })
      for (const k of [0, 0.5, 1]) {
        const ang = Math.PI * 0.75 + k * Math.PI * 1.5
        const x = dx + Math.cos(ang) * (r - 1)
        const y = dy + Math.sin(ang) * (r - 1)
        if (on) c.set(x, y, k === 1 ? shade(RED, 4, 0, 0) : shade(FACE, 1.5, 0, 0))
      }
      const ang = Math.PI * 0.75 + v * Math.PI * 1.5
      c.line(dx, dy, dx + Math.cos(ang) * (r - 1.2), dy + Math.sin(ang) * (r - 1.2), on ? shade(RED, 3.4, 0, 0) : shade(FACE, 0.4, 0, 0))
      c.set(dx, dy, shade(METAL, on ? 1 : 2, 0, 0))
    }

    const scopeOn = isOn(35, f)
    const scopeAge = f - wake(35)
    const scopeOff = f - sleep(35)
    for (let y = 3; y <= 13; y++) {
      for (let x = 30; x <= 41; x++) {
        const isBezel = x === 30 || x === 41 || y === 3 || y === 13
        if (isBezel) {
          c.set(x, y, panel(x, y, y === 13 || x === 41 ? 4 : 0.8))
          continue
        }
        const glare = (x === 31 && y <= 6) || (y === 4 && x <= 33)
        if (!scopeOn) {
          const { g } = lit(x, y)
          c.set(x, y, shade(DEAD, 0.6 + (glare ? 1.6 : 0) + g * 2, x, y))
          continue
        }
        c.set(x, y, shade(AMBER, (scopeAge === 0 ? 0 : 1) + (y === 8 ? 0.6 : 0) + (glare ? 0.8 : 0), x, y))
      }
    }
    if (scopeOn) {
      for (let x = 31; x <= 40; x++) {
        const amp = scopeAge < 2 ? 0 : Math.min(2.6, (scopeAge - 1) * 0.8)
        const y = Math.round(8 + amp * Math.sin((x - 31) * 0.85 - f * 0.9))
        c.set(x, y, shade(AMBER, scopeAge === 0 ? 7 : 6, 0, 0))
        const ghost = Math.round(8 + amp * Math.sin((x - 31) * 0.85 - (f - 1) * 0.9))
        if (scopeAge > 1 && ghost !== y) c.set(x, ghost, shade(AMBER, 3.4, x, ghost))
      }
    } else if (scopeOff >= 0 && scopeOff < 4) {
      const half = [4, 1, 0, 0][scopeOff] ?? 0
      for (let x = 35 - half; x <= 36 + half; x++) c.set(x, 8, shade(AMBER, scopeOff < 3 ? 7 : 4, 0, 0))
    }

    for (const [k, bx] of [30, 33, 36, 39].entries()) {
      const w = wake(bx)
      const on = isOn(bx, f)
      const target = [0.62, 0.86, 0.5, 0.74][k] ?? 0.6
      const level = on
        ? target * ease.outBack(beat(f, w, w + 5)) + (f > w + 5 ? Math.sin(f * (1.1 + k * 0.4) + k) * 0.12 : 0)
        : 0
      for (let y = 15; y <= 21; y++) {
        const seg = (21 - y + 1) / 7
        const ramp = y <= 16 ? RED : y <= 18 ? AMBER : GREEN
        for (const x of [bx, bx + 1]) {
          if (on && seg <= level) c.set(x, y, shade(ramp, (ramp === GREEN ? 5.6 : 5) + (x === bx ? 0.6 : 0), x, y))
          else c.set(x, y, shade(DEAD, 1 + (x === bx ? 0.6 : 0), x, y))
        }
      }
    }

    for (const tx of [16, 19, 22, 25]) {
      const up = isOn(tx, f)
      c.set(tx, 20, panel(tx, 20, 4.4))
      c.set(tx + 1, 20, panel(tx + 1, 20, 2.6))
      c.set(tx, 21, panel(tx, 21, 2.2))
      c.set(tx + 1, 21, panel(tx + 1, 21, 1))
      for (const s of [1, 2]) {
        const y = up ? 20 - s : 21 + s
        c.set(tx, y, shade(METAL, 5.5 - s * 0.6 + lit(tx, y).a * 2, 0, 0))
      }
      c.set(tx + 1, 17, up ? shade(AMBER, f === wake(tx) ? 7 : 5, 0, 0) : shade(DEAD, 1.5, 0, 0))
    }

    for (let x = 11; x <= 53; x++) {
      c.set(x, PIPE_Y - 1, panel(x, PIPE_Y - 1, 4.6))
      c.set(x, PIPE_Y + 1, panel(x, PIPE_Y + 1, 0.6))
      const burning = f >= SNAP + 1 ? x <= head : x <= head && f >= CHAIN0
      const d = head - x
      if (burning) c.set(x, PIPE_Y, shade(AMBER, d < 1 ? 7 : d < 3 ? 6 : 4.6, x, PIPE_Y))
      else c.set(x, PIPE_Y, shade(DEAD, 2, x, PIPE_Y))
    }
    for (const x of [11, 53]) for (let y = PIPE_Y - 1; y <= PIPE_Y + 1; y++) c.set(x, y, shade(METAL, 3 + lit(x, y).a * 2, 0, 0))

    drawGreenLamp(c, greenOn, since, bloom, ember, lit)
    drawLever(c, f, lit)

    if (f >= THROW1 && f < THROW1 + 6) {
      for (let k = 0; k < 7; k++) {
        const age = f - THROW1
        const vx = Math.cos(k * 2.4 + 0.5) * (1.4 + (k % 3) * 0.5)
        const vy = -1.6 - (k % 2) * 0.8
        const x = HUB_X + 1 + vx * age
        const y = 26 + vy * age + 0.35 * age * age
        if (age < 3 + (k % 3)) c.set(x, y, shade(AMBER, 7 - age, 0, 0))
      }
    }

    drawHand(c, f, lit)
    drawKnob(c, f, lit)

    if (greenOn && since <= 1) {
      const r = since === 0 ? 9 : 13
      for (let y = 0; y < H; y++) {
        for (let x = 36; x < W; x++) {
          const d = Math.hypot(x - LAMP_X, (y - LAMP_Y) * 1.1)
          if (d > r - 1.5 && d < r && threshold(x, y) < (since === 0 ? 0.7 : 0.4)) c.set(x, y, shade(GREEN, since === 0 ? 8 : 7, x, y))
        }
      }
    }

    out.push(c.px)
  }
  return out
}

type Lit = (x: number, y: number) => { a: number; g: number }

function drawGreenLamp(c: Canvas, on: boolean, since: number, bloom: number, ember: number, lit: Lit): void {
  for (let x = 51; x <= 63; x++) {
    for (const y of [17, 18]) {
      const { a, g } = lit(x, y)
      c.set(x, y, shade(METAL, (y === 17 ? 4.6 : 2.4) + (x < 54 ? -0.6 : 0) + a + g * 2.2 - vignette(x, y) * 0.5, x, y))
    }
  }
  c.ellipse(LAMP_X, LAMP_Y + 0.6, 5.4, 5.6, (x, y) => {
    if (y > 16) return undefined
    const d = Math.hypot(x - LAMP_X, (y - LAMP_Y) * 1.05) / 5.4
    if (!on) {
      const { a } = lit(x, y)
      const spec = (x === 55 && y === 8) || (x === 54 && y === 9) ? 2.4 : 0
      return shade(GREEN, 1.4 - d * 0.8 + spec + a * 2 + (x < LAMP_X ? 0.4 : 0) + ember * (6 - d * 2.6), x, y)
    }
    const flash = since === 0 ? 2 : since === 1 ? 1 : 0
    return shade(GREEN, 6.8 + flash - d * 3 + (bloom - 1) * 2, x, y)
  })
  for (const x of [55, 58, 61]) {
    for (let y = 7; y <= 16; y++) {
      if (Math.hypot(x - LAMP_X, (y - LAMP_Y) * 1.05) > 5.6) continue
      c.set(x, y, on || ember > 0 ? shade(GREEN, 2.4 - (on ? 0 : 1), x, y) : shade(METAL, 2.6 + lit(x, y).a, x, y))
    }
  }
  for (let x = 54; x <= 61; x++) c.set(x, 6, on || ember > 0 ? shade(GREEN, 3.4 - (on ? 0 : 1), x, 6) : shade(METAL, 3, x, 6))
  if (on && since > 1) c.set(56, 9, shade(GREEN, 8, 0, 0))
}

const knobAt = (f: number) => {
  const th = leverAngle(f)
  return { th, kx: HUB_X, ky: HUB_Y - ARM * Math.cos(th), scale: 1 + 0.55 * Math.max(0, Math.sin(th)) }
}

function drawLever(c: Canvas, f: number, lit: Lit): void {
  const { kx, ky } = knobAt(f)
  if (f === THROW1 - 1 || f === SNAP + 1) {
    const prev = knobAt(f - 1).ky
    for (let y = Math.min(prev, ky); y <= Math.max(prev, ky); y++) {
      c.set(kx, y, shade(RED, 2.6, 0, 0))
      c.set(kx + 1, y, shade(RED, 1.6, 0, 0))
    }
  }
  for (let i = 0; i <= 12; i++) {
    const y = lerp(HUB_Y, ky, i / 12)
    const { a, g } = lit(kx, y)
    c.set(kx - 1, y, shade(METAL, 4.4 + a * 1.5 + g * 1.5, 0, 0))
    c.set(kx, y, shade(METAL, 6 + a * 1.5 + g, 0, 0))
    c.set(kx + 1, y, shade(METAL, 2.6 + g * 2, 0, 0))
  }
  c.disc(HUB_X + 0.5, HUB_Y + 0.5, 2.2, (x, y) => {
    const { a, g } = lit(x, y)
    return shade(METAL, 2.2 + (y <= HUB_Y ? 1.4 : 0) - (x > HUB_X + 1 ? 0.8 : 0) + a + g * 1.6, x, y)
  })
}

function drawKnob(c: Canvas, f: number, lit: Lit): void {
  const { kx, ky, scale } = knobAt(f)
  const r = 3 * scale
  c.disc(kx + 0.5, ky + 0.5, r, (x, y) => {
    const { a, g } = lit(x, y)
    const nx = (x - kx - 0.5) / r
    const ny = (y - ky - 0.5) / r
    const l = -nx * 0.5 - ny * 0.75
    return shade(RED, 3.4 + Math.round(l * 2) + a * 1.2 + g * 0.8 + (nx > 0.55 ? g * 2.4 : 0), x, y)
  })
  c.set(kx - Math.round(r * 0.45), ky - Math.round(r * 0.45), shade(RED, 6.4, 0, 0))
}

const FIST = ['..gGGg.', '.gGGGGg', 'cgdddgg', 'cgGGGGg', 'cgdddg.', 'ccgGg..']
const OPEN = ['.......', '.gGGGGG', 'cgddddd', 'cgGGGGG', 'cgggg..', 'ccg....']

function drawHand(c: Canvas, f: number, lit: Lit): void {
  if (f < REACH || f >= LETGO + 9) return
  const { kx, ky } = knobAt(f)
  const gy = lerp(HUB_Y, ky, 0.66)
  let ox = 0
  let oy = 0
  if (f < GRAB) {
    const p = ease.out(beat(f, REACH, GRAB))
    ox = lerp(-16, 0, p)
    oy = lerp(12, 0, p)
  } else if (f > LETGO) {
    const p = ease.in(beat(f, LETGO, LETGO + 8))
    ox = lerp(0, -16, p)
    oy = lerp(0, 10, p)
  }
  const hx = Math.round(kx - 4 + ox)
  const hy = Math.round(gy - 3 + oy)
  const isGrip = f >= GRAB && f <= LETGO

  for (let i = 0; i <= 16; i++) {
    const x = lerp(hx - 1, hx - 17, i / 16)
    const y = lerp(hy + 5, hy + 15, i / 16)
    for (let j = -2; j <= 2; j++) {
      const { a, g } = lit(x, y + j)
      c.set(x, y + j, shade(SLEEVE, (j === -2 ? 3.4 : j === 2 ? 0.6 : 2) + a * 2 + g * 2.4, 0, 0))
    }
  }
  const art = isGrip ? FIST : OPEN
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.' || ch === undefined) continue
      const x = hx + i
      const y = hy + j
      const { a, g } = lit(x, y)
      const base = ch === 'G' ? 4.4 : ch === 'g' ? 3 : ch === 'd' ? 1.8 : 5.4
      const ramp = ch === 'c' ? SLEEVE : GLOVE
      const edge = row[i + 1] === '.' || row[i + 1] === undefined ? g * 2 : 0
      c.set(x, y, shade(ramp, (ch === 'c' ? 4 : base) + a * 1.4 + g * 1.4 + edge, x, y))
    }
  })
}

export const scene: Scene = {
  verb: 'Actioning',
  render,
  hero: 50,
  snaps: [
    { frames: [THROW1 - 2, THROW1], box: [HUB_X - 4, 6, HUB_X + 5, 29], why: 'the throw: the lever slams down in two frames, smeared, the knob swinging out toward us past the fist' },
    { frames: wake(LAMP_X), why: 'the green lamp blooms: a white flash floods the whole room green, then settles' },
    { frames: [wake(30), sleep(30)], box: [30, 15, 40, 21], why: 'the meters bounce a segment up and down like VU meters' },
    { frames: SNAP + 1, box: [HUB_X - 4, 4, HUB_X + 5, 29], why: 'the lever springs back up in a frame, smeared' },
    { frames: sleep(35), box: [30, 3, 41, 13], why: 'the scope dies the way a tube does: the picture collapses to a bright line' },
    { frames: sleep(35), box: [11, PIPE_Y, 53, PIPE_Y], why: 'the power drains back down the conduit, a fast sweep to the left' },
    { frames: sleep(LAMP_X) + 2, box: [51, 6, 63, 18], colors: [...METAL], why: 'with its glow gone, the green lamp\'s cage wires show grey over the dead glass, joining the collar' },
  ],
}
