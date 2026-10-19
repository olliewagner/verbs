import { Canvas, TAU, beat, clamp, ease, hex, lerp, noise, particles, shade, smoothstep, threshold, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const STONE = hex('0d090f 181019 261a22 37242a 4c3130 66423a 845a44')
const MOSS = hex('0b1110 132219 1c3324 284530 385c3a')
const WOOD = hex('140b0b 25140f 3a1f16 552d1d 744026 96562f b8743e')
const GLASS = hex('1c1c28 343a4a 5c6a7c 9fb4c0 e6f2f4')
const BLUE = hex('0c2248 17418a 2a6cd0 52a2f2 a6dcff')
const RED = hex('3c0a24 70123a b4234e e8506a ffa0a8')
const PURPLE = hex('24103e 44186e 6e2ca8 a052d8 d6a0f4')
const GREEN = hex('0c2c1c 145a30 22964a 4ad46a a6ff9c e8ffd8')
const FIRE = hex('6a1412 c43c1a f2902c fcd468 fff6d0')
const GAS = hex('16236e 2f5ad0 6aa0ff')
const SMOKE = hex('3a3a4e 7a7890 b4b0c4 ece8f2')
const BONE = hex('3a3028 6a5a48 a8957a d8c8a8')

const CANDLE = { x: 4, y: 13 }
const BEAKER = { x0: 28, x1: 36, top: 12, bottom: 19 }
const MOUTH_X = 32

const POOF = 40
const potionRows = (f: number) => (f < POOF + 4 ? 5 * ease.inOut(beat(f, 15, 29)) : 5 * (1 - ease.inOut(beat(f, POOF + 4, 62))))
function glowOf(f: number): { power: number; green: number } {
  const green = ease.inOut(beat(f, 31, 38)) * (f < 64 ? 1 : 0)
  const flash = f === POOF ? 2.2 : f === POOF + 1 ? 1.3 : f === POOF + 2 ? 0.7 : 0
  const fill = potionRows(f) / 5
  return { power: fill * (0.25 + green * 0.75) + flash + (f >= 36 && f < POOF ? (f - 35) * 0.12 : 0), green: Math.max(green, flash > 0 ? 1 : 0) }
}

function lightAt(f: number, x: number, y: number): { warm: number; glow: number } {
  const flicker = 0.92 + 0.08 * Math.sin((TAU * Math.floor(f / 3) * 7) / 24)
  const dc = Math.hypot(x - CANDLE.x, (y - CANDLE.y) * 1.2)
  const dg = Math.hypot(x - MOUTH_X, (y - 15) * 1.2)
  const g = glowOf(f)

  return { warm: flicker * Math.max(0, 1 - dc / 44) ** 1.4, glow: g.power * Math.max(0, 1 - dg / 26) ** 1.5 }
}

const lit = (f: number, x: number, y: number, base: number, k = 3.4) => {
  const l = lightAt(f, x, y)
  return base + (l.warm + l.glow) * k
}

type FlaskKind = 'round' | 'cone'
type FlaskBeat = { lift: number; tilt: number; pour: number }
type Flask = { kind: FlaskKind; x: number; restY: number; dir: number; ramp: Ramp; start: number }
const FLASKS: Flask[] = [
  { kind: 'round', x: 20, restY: 15, dir: 1, ramp: BLUE, start: 6 },
  { kind: 'cone', x: 44, restY: 15, dir: -1, ramp: RED, start: 12 },
]

const HOP: Record<number, number> = { 0: -1, 1: 1, 2: 3, 20: 3, 21: 1, 22: -1 }

function flaskBeat(fl: Flask, f: number): FlaskBeat {
  const t = f - fl.start
  const lift = HOP[t] ?? (t > 2 && t < 20 ? 4 : 0)
  const lean = t === 0 ? -0.1 : 0
  const tilt = smoothstep(1, 8, t) * (1 - smoothstep(15, 22, t)) + lean
  const pour = t >= 7 && t < 17 ? 1 : 0

  return { lift, tilt: tilt * 1.2 * fl.dir, pour }
}

function inFlask(kind: FlaskKind, u: number, v: number): boolean {
  if (Math.abs(u) <= 1.6 && v >= -8.6 && v <= -7.5) return true
  if (Math.abs(u) <= 1.05 && v >= -8 && v <= -2) return true
  if (kind === 'round') return u * u + v * v <= 3.6 * 3.6
  return v >= -2.2 && v <= 3.5 && Math.abs(u) <= 1.3 + ((v + 2.2) / 5.7) * 3.1
}

function drawFlask(c: Canvas, f: number, fl: Flask): { lip: [number, number] } {
  const b = flaskBeat(fl, f)
  const cy = fl.restY - b.lift
  const cs = Math.cos(b.tilt)
  const sn = Math.sin(b.tilt)
  const local = (x: number, y: number): [number, number] => {
    const dx = x - fl.x
    const dy = y - cy
    return [dx * cs + dy * sn, -dx * sn + dy * cs]
  }
  const inside = (x: number, y: number) => {
    const [u, v] = local(x, y)
    return inFlask(fl.kind, u, v)
  }
  const lipX = fl.x - -8.2 * sn
  const lipY = cy + -8.2 * cs
  const tip = Math.abs(b.tilt) / 1.2
  const surface = lerp(cy - 1, lipY + 0.6, clamp((tip - 0.55) / 0.45))
  for (let y = Math.floor(cy - 10); y <= Math.ceil(cy + 5); y++) {
    for (let x = fl.x - 10; x <= fl.x + 10; x++) {
      if (!inside(x, y)) continue
      const isWall = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      const l = lightAt(f, x, y)
      const facing = x < fl.x ? 1 : 0
      if (isWall) {
        c.set(x, y, shade(GLASS, 1.6 + (l.warm * facing + l.glow * (1 - facing)) * 3.5))
      } else if (y >= surface) {
        const [u] = local(x, y)
        c.set(x, y, shade(fl.ramp, 1.6 + (y <= surface + 0.5 ? 1.2 : 0) + (u < -1 ? 0.6 : 0) + l.glow * 0.8))
      } else {
        c.set(x, y, shade(GLASS, 0.6 + l.warm * 0.8))
      }
    }
  }
  const [gu, gv] = fl.kind === 'round' ? [-2, -1.4] : [-1.6, 0.4]
  c.set(Math.round(fl.x + gu * cs - gv * sn), Math.round(cy + gu * sn + gv * cs), GLASS[4] ?? 0)

  return { lip: [lipX, lipY] }
}

function drawStream(c: Canvas, f: number, fl: Flask, lip: [number, number], into: number): void {
  const t = f - fl.start
  if (t < 7 || t > 17) return
  const head = clamp((t - 6) / 3)
  const tail = clamp((t - 15) / 2.5)
  const [x0, y0] = lip
  const x2 = MOUTH_X - fl.dir * 2
  const y2 = into
  const x1 = x0 + fl.dir * 2.5
  const y1 = y0
  for (let s = tail; s <= head; s += 0.04) {
    const x = (1 - s) ** 2 * x0 + 2 * (1 - s) * s * x1 + s * s * x2
    const y = (1 - s) ** 2 * y0 + 2 * (1 - s) * s * y1 + s * s * y2
    c.set(x, y, shade(fl.ramp, (Math.floor(s * 14) - t) % 3 === 0 ? 4 : 3))
  }
  if (head >= 1 && tail < 1 && t % 2 === 0) {
    c.set(x2 - 1, y2 - 1, shade(fl.ramp, 4))
    c.set(x2 + 1, y2 - 2, shade(fl.ramp, 3))
  }
}

function potion(f: number, x: number, y: number, level: number): number {
  const swirl = noise(x * 0.35 + f * 0.2, y * 0.5, f * 0.12, 3)
  const mixed = beat(f, 20, 29)
  const greenLine = BEAKER.bottom - 1 - ease.inOut(beat(f, 31, 38)) * 7
  let ramp: Ramp = BLUE
  if (f >= 20) ramp = swirl < mixed ? PURPLE : x > MOUTH_X + 1 - (f - 20) ? RED : BLUE
  if (f >= 31 && y >= greenLine) ramp = GREEN
  if (f >= 64) ramp = GREEN

  return shade(ramp, level)
}

const SHELF_Y = 7
const SHELF: { x: number; art: string[] }[] = [
  { x: 1, art: [' n ', ' n ', 'ggg', 'gGg', 'ggg', 'ggg'] },
  { x: 5, art: ['cccc', 'aaaa', 'aAaa', 'aaaa'] },
  { x: 10, art: ['rr', 'rr', 'rr', 'rr', 'rr'] },
  { x: 12, art: ['ee', 'ee', 'ee', 'ee'] },
  { x: 14, art: [' bbb', 'bBbbb', 'b.b.b', 'bbbb ', ' b b '] },
  { x: 20, art: [' n', ' n', 'gg', 'gG', 'gg'] },
  { x: 41, art: [' n ', 'aaa', 'aAa', 'aaa'] },
  { x: 45, art: ['ee', 'ee', 'ee', 'ee', 'ee'] },
  { x: 47, art: ['rr', 'rr', 'rr', 'rr'] },
  { x: 49, art: ['  n  ', ' ggg ', 'ggGgg', 'ggggg'] },
  { x: 55, art: [' cc ', 'pppp', 'pPpp', 'pppp', 'pppp'] },
  { x: 60, art: [' n', ' n', 'aa', 'aA', 'aa', 'aa'] },
]

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const g = glowOf(f)

    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < W; x++) {
        const course = Math.floor(y / 4)
        const bx = (x + (course % 2) * 4) % 8
        const isMortar = y % 4 === 3 || bx === 0
        const l = lightAt(f, x, y)
        const isGreen = g.green > 0.5 && (l.glow - l.warm * 0.9) * 6 > threshold(x, y)
        const level = 1.1 + l.warm * 3.6 + l.glow * 3.2 - (isMortar ? 0.9 : 0) + (bx === 1 && !isMortar && y % 4 === 0 ? 0.5 : 0)
        c.set(x, y, shade(isGreen ? MOSS : STONE, isGreen ? level * 0.62 : level))
      }
    }

    const shelfPaint = (ramp: Ramp, base: number) => (x: number, y: number) => shade(ramp, lit(f, x, y, base, 3))
    const keys: Record<string, (x: number, y: number) => number> = {
      g: shelfPaint(MOSS, 0.6), G: shelfPaint(MOSS, 2), a: shelfPaint(WOOD, 1.6), A: shelfPaint(WOOD, 3.4),
      n: shelfPaint(GLASS, 0.5), c: shelfPaint(WOOD, 2.2), r: shelfPaint(RED, 0), e: shelfPaint(MOSS, 0.3),
      b: shelfPaint(BONE, 0.6), B: shelfPaint(BONE, 1.8), p: shelfPaint(PURPLE, 0.1), P: shelfPaint(PURPLE, 1.2),
    }
    for (const item of SHELF) c.sprite(item.x, SHELF_Y - item.art.length, item.art, keys)
    for (const [x0, x1] of [[0, 24], [40, 63]] as const) {
      for (let x = x0; x <= x1; x++) {
        c.set(x, SHELF_Y, shade(WOOD, lit(f, x, SHELF_Y, 2.2, 3)))
        c.set(x, SHELF_Y + 1, shade(WOOD, lit(f, x, SHELF_Y + 1, 0.6, 1.5)))
      }
    }

    for (let y = 22; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isTop = y <= 24
        const grain = isTop && (x * 3 + y * 7) % 11 === 0 ? -0.6 : 0
        const level = isTop ? lit(f, x, y, 2 + (y - 22) * 0.4, 3.4) + grain : y === 25 ? lit(f, x, y, 3.6, 2) : lit(f, x, y, 0.8, 1.6)
        c.set(x, y, shade(WOOD, level - (y > 25 && (x === 20 || x === 44) ? 0.8 : 0)))
      }
    }

    for (let y = 16; y <= 23; y++) for (let x = 3; x <= 5; x++) c.set(x, y, shade(BONE, (x === 5 ? 1.4 : 2.6) + (y === 16 ? 0.6 : 0)))
    c.set(5, 17, shade(BONE, 2.4))
    const flameTall = Math.floor(f / 3) % 3 === 1 ? 1 : 0
    c.set(4, 15, FIRE[2] ?? 0)
    c.set(4, 14, FIRE[3] ?? 0)
    c.set(4, 13 - flameTall, FIRE[4] ?? 0)
    if (flameTall) c.set(4, 13, FIRE[3] ?? 0)
    c.set(4, 12 - flameTall, FIRE[1] ?? 0)
    for (let y = 19; y <= 23; y++) {
      for (let x = 8; x <= 10; x++) {
        const isWall = x === 8 || x === 10 || y === 23
        c.set(x, y, isWall ? shade(GLASS, lit(f, x, y, 1.2, 2.5)) : shade(GREEN, y >= 21 ? 1 : 0.4))
      }
    }
    c.set(9, 18, shade(WOOD, 3))
    c.set(8, 20, GLASS[3] ?? 0)

    for (let x = 14; x <= 25; x++) {
      c.set(x, 19, shade(RED, x === 14 ? 0.4 : 1.2))
      c.set(x, 20, shade(RED, x === 25 ? 0 : 0.6))
      c.set(x, 21, shade(BONE, x === 14 ? 1 : 2.2))
      for (const y of [22, 23]) c.set(x, y, shade(MOSS, x === 14 ? 1.4 : 3 - (y - 22)))
    }
    for (let y = 19; y <= 23; y++) {
      for (let x = 39; x <= 49; x++) {
        const isSlat = y === 19 || x === 39 || x === 49
        c.set(x, y, shade(WOOD, lit(f, x, y, isSlat ? 3.6 : 2.2, 2) - (y === 21 ? 0.7 : 0)))
      }
    }

    const TUBES: [number, Ramp][] = [[52, RED], [55, GREEN], [58, BLUE], [61, PURPLE]]
    for (const [tx, ramp] of TUBES) {
      for (let y = 13; y <= 22; y++) {
        c.set(tx, y, shade(GLASS, lit(f, tx, y, 1.4, 2)))
        c.set(tx + 1, y, y >= 17 ? shade(ramp, y === 17 ? 2.4 : 1.4) : shade(GLASS, 0.6))
      }
    }
    for (let x = 51; x <= 63; x++) {
      c.set(x, 18, shade(WOOD, lit(f, x, 18, 3.4, 2)))
      c.set(x, 23, shade(WOOD, lit(f, x, 23, 2.6, 2)))
    }
    for (const x of [51, 63]) for (let y = 19; y <= 22; y++) c.set(x, y, shade(WOOD, 2.4))

    const gasUp = Math.floor(f / 2) % 2
    c.set(31, 21, GAS[1] ?? 0)
    c.set(32, 21 - gasUp, GAS[2] ?? 0)
    c.set(32, 21, GAS[2] ?? 0)
    c.set(33, 21, GAS[1] ?? 0)
    for (let x = 30; x <= 34; x++) for (let y = 22; y <= 23; y++) c.set(x, y, shade(GLASS, lit(f, x, y, y === 22 ? 1.6 : 0.8, 2.5)))
    for (let x = 27; x <= 37; x++) c.set(x, 20, shade(GLASS, lit(f, x, 20, 0.8, 2)))
    for (let y = 21; y <= 23; y++) {
      c.set(27, y, shade(GLASS, lit(f, 27, y, 0.6, 2)))
      c.set(37, y, shade(GLASS, lit(f, 37, y, 0.6, 2)))
    }

    const rows = potionRows(f)
    const surface = BEAKER.bottom - rows
    for (let y = BEAKER.top; y <= BEAKER.bottom; y++) {
      for (let x = BEAKER.x0; x <= BEAKER.x1; x++) {
        const isWall = x === BEAKER.x0 || x === BEAKER.x1 || y === BEAKER.bottom
        if (isWall) continue
        if (rows > 0.3 && y >= Math.round(surface)) {
          const level = 1.6 + (y === Math.round(surface) ? 1.2 : 0) + g.power * 0.8 + (x === BEAKER.x0 + 1 ? 0.5 : 0)
          c.set(x, y, potion(f, x, y, level))
        } else {
          c.set(x, y, shade(GLASS, 0.5 + lightAt(f, x, y).glow))
        }
      }
    }

    for (const fl of FLASKS) {
      const { lip } = drawFlask(c, f, fl)
      drawStream(c, f, fl, lip, Math.max(BEAKER.top + 1, Math.round(surface)))
    }

    if (f >= 26 && f < POOF + 6 && rows > 1) {
      for (const p of particles(f, LOOP, 26, 5, 11)) {
        const x = BEAKER.x0 + 1 + Math.floor(p.r[0] * 7)
        const y = Math.round(BEAKER.bottom - 1 - p.t * 1.4)
        if (y > surface && y < BEAKER.bottom) c.set(x, y, shade(f >= 34 ? GREEN : PURPLE, 4))
      }
      const swell = f < POOF ? Math.round(ease.in(beat(f, 30, POOF)) * 3) : Math.max(0, 3 - (f - POOF))
      for (let x = BEAKER.x0 + 1; x < BEAKER.x1; x++) {
        const bump = (x + Math.floor(f / 2)) % 3 === 0 ? 1 : 0
        const top = Math.round(surface) - swell - bump
        for (let y = Math.max(BEAKER.top - 1, top); y < Math.round(surface); y++) c.set(x, y, shade(f >= 34 ? GREEN : PURPLE, y === top ? 4.6 : 3.6))
      }
    }

    for (let y = BEAKER.top; y <= BEAKER.bottom; y++) {
      for (const x of [BEAKER.x0, BEAKER.x1]) {
        const l = lightAt(f, x, y)
        c.set(x, y, shade(GLASS, 1.4 + (x === BEAKER.x0 ? l.warm * 3 : 0) + l.glow * 2.4))
      }
    }
    for (let x = BEAKER.x0; x <= BEAKER.x1; x++) c.set(x, BEAKER.bottom, shade(GLASS, 1.4 + lightAt(f, x, BEAKER.bottom).glow * 2))
    c.set(BEAKER.x0 - 1, BEAKER.top, GLASS[3] ?? 0)
    c.set(BEAKER.x1 + 1, BEAKER.top - 1, GLASS[2] ?? 0)
    for (const y of [14, 15, 16]) c.set(BEAKER.x0 + 1, y, shade(GLASS, 3.2 + g.power))
    for (const y of [14, 16, 18]) c.set(BEAKER.x1 - 1, y, shade(GLASS, 2.2 + g.power * 0.5))

    if (f === POOF || f === POOF + 1) {
      const r = f === POOF ? 2.6 : 3.6
      for (let y = BEAKER.top - 6; y <= BEAKER.top + 2; y++) {
        for (let x = MOUTH_X - 6; x <= MOUTH_X + 6; x++) {
          const d = Math.hypot(x - MOUTH_X, (y - (BEAKER.top - 1)) * 1.3)
          if (f === POOF && d < r) c.set(x, y, shade(GREEN, 5.4 - d * 0.6))
          if (f === POOF + 1 && d > r - 1.2 && d < r && threshold(x, y) < 0.7) c.set(x, y, GREEN[4] ?? 0)
        }
      }
    }
    const age = f - POOF - 1
    if (age >= 0 && age < 26) {
      const p = ease.out(age / 26)
      const ry = 0.9 + p * 1.7
      const rx = 2.2 + p * 6.2
      const cy = BEAKER.top - 2 - p * 10
      const fade = clamp((age - 14) / 12)
      const inside = (x: number, y: number) => ((x - MOUTH_X) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
        for (let x = Math.floor(MOUTH_X - rx - 1); x <= Math.ceil(MOUTH_X + rx + 1); x++) {
          if (!inside(x, y)) continue
          const isEdge = !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))
          const isBelly = !isEdge && ry > 1.8 && y > cy + 0.3 && !inside(x, y + 2)
          if ((!isEdge && !isBelly) || fade > threshold(x, y)) continue
          const isFront = y >= cy
          c.set(x, y, shade(SMOKE, (isBelly ? 1.6 : isFront ? 3 : 1.8) - fade * 1.4 + (isFront ? g.power * 0.4 : 0)))
        }
      }
    }

    if (f >= POOF + 4 && f < 64) {
      for (const p of particles(f, LOOP, 18, 7, 5)) {
        const x = MOUTH_X - 2 + Math.round(p.r[0] * 4 + Math.sin(p.t * 0.7 + p.r[1] * 6))
        const y = BEAKER.top - 1 - p.t * 0.9
        if ((1 - p.age) * 0.9 > threshold(x, Math.round(y))) c.set(x, y, shade(SMOKE, 2.2 - p.age))
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Concocting',
  render,
  hero: 44,
  snaps: [
    {
      frames: POOF,
      box: [26, 4, 41, 23],
      why: 'The potion goes off: a white-green puff bursts from the mouth of the beaker and its flash lights the glass, the tripod and the crate for one frame, after four frames of building glow; the smoke ring rises out of it.',
    },
  ],
}
