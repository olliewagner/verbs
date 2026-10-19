import { Canvas, TAU, beat, clamp, ease, frames, hex, lerp, mix, mod, type Scene, shade } from '../engine'

const W = 64
const LOOP = 72
const TOP = 24
const SPK = 11

const WALL = hex('0e0c1a 161328 211a36 2e2242 3f2c4a 56384e 734852 92604f')
const WOOD = hex('1a0e0e 2b1814 432519 5e3420 7c4628 9c5c32 bc7840')
const TEAK = hex('1e1210 34201a 4e2f20 6b4128 8a5632 a86e3e c48a52')
const CAB = hex('0d0a0e 17121a 221a24 30252e 43343a')
const CONE = hex('08080c 141418 22222a 34343e 4c4c58 6c6c7a 9a9aa8')
const VINYL = hex('07070c 101018 1a1a26 282838 3e3e56 66668a a4a4c8')
const LABEL = hex('4a1010 8a2016 c8401e ee7434 f8c890')
const METAL = hex('16151c 2a2832 44404c 66606c 908894 c4bcc0 f0eae4')
const LAMP = hex('6a3418 a8582a d88a3c f4bc62 fde4a0 fff8e2')
const BRASS = hex('3a2610 6a4818 a07428 d0a640 f0d878')
const CAT = hex('2a120c 5a2812 94461a c86c26 e89a44 f8c87a')
const SOUND = hex('3a2a4c 5e4268 8e6688 c496aa ecccd0')

const BEATS = [21, 27, 33, 39, 45, 51, 57]
const DROP = 21
const RING_DROP = [1, 2, 3, 4, 4, 3, 3, 2, 2, 1, 1, 0]
const RING = [1, 2, 3, 3, 2, 2, 1, 1, 0]

function pump(f: number): number {
  let p = 0
  for (const b of BEATS) {
    const age = f - b
    const strength = b === DROP ? 1.5 : 1
    if (age === 0) p = Math.max(p, strength)
    else if (age === 1) p = Math.max(p, 0.55 * strength)
    else if (age === 2) p = Math.max(p, 0.2 * strength)
  }
  return p
}

const SPIN: number[] = (() => {
  const speed = (f: number) => ease.inOut(beat(f, 0, 10)) * (1 - ease.inOut(beat(f, 60, 72)))
  const turns: number[] = [0]
  for (let f = 1; f <= LOOP; f++) turns.push((turns[f - 1] ?? 0) + speed(f - 0.5))
  const total = turns[LOOP] ?? 1
  const k = (TAU * Math.round((total * 0.29) / TAU)) / total
  return turns.map(t => t * k)
})()

function arm(f: number): { angle: number; lift: number } {
  const rest = 1.66
  const play = 2.37 + 0.06 * beat(f, DROP, 60)
  const lift = 2 * (ease.out(beat(f, 4, 7)) - ease.in(beat(f, 17, DROP)) + ease.out(beat(f, 60, 62)) - ease.in(beat(f, 69, 72)))
  const swing = ease.inOut(beat(f, 7, 15)) - ease.inOut(beat(f, 62, 69))
  return { angle: lerp(rest, play, swing), lift: Math.round(lift) }
}

const REC = { x: 28, y: 15.5, rx: 9.5, ry: 4.3 }
const PIVOT = { x: 43, y: 11 }
const ARM_LEN = 10.5
const LAMP_AT = { x: 8, y: 5 }

const lampLight = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - LAMP_AT.x, (y - LAMP_AT.y) * 1.3) / 52) ** 1.4

function ring(sx: number, r: number): [number, number][] {
  const on = new Set<number>()
  for (let y = 0; y < TOP; y++) {
    for (let x = 0; x < W; x++) if (Math.abs(Math.hypot(x - sx, (y - 18.5) * 1.1) - r) <= 0.6) on.add(y * W + x)
  }
  for (const i of [...on]) {
    const x = i % W
    const isAcross = (x > 0 && on.has(i - 1)) || (x < W - 1 && on.has(i + 1))
    const isAlong = on.has(i - W) || on.has(i + W)
    if (isAcross && isAlong) on.delete(i)
  }
  return [...on].map(i => [i % W, Math.floor(i / W)])
}

function speaker(c: Canvas, x0: number, f: number): void {
  const x1 = x0 + 10
  for (let y = SPK; y < TOP; y++) {
    for (let x = x0; x <= x1; x++) {
      const lit = lampLight(x, y)
      const isEdge = x === x0 || x === x1 || y === SPK
      const level = isEdge ? 2.6 + lit * 3 + (x === x0 ? 0.6 : 0) : 1.4 + lit * 1.4
      c.set(x, y, shade(CAB, level))
    }
  }
  const p = pump(f)
  const cx = x0 + 5
  c.disc(cx, 13.5, 1.4, shade(CONE, 1))
  c.set(cx, 13, shade(CONE, 4 + p))
  c.set(cx - 1, 13, shade(CONE, 3))
  const r = 4.1
  for (let y = 14; y <= 23; y++) {
    for (let x = cx - 5; x <= cx + 5; x++) {
      const d = Math.hypot(x - cx, y - 18.5)
      if (d > r) continue
      const isRim = d > r - 0.8
      const isSurround = !isRim && d > r - 1.7 + Math.min(1, p) * 0.6
      const toLight = -(x - cx) - (y - 18.5)
      const isCap = d < 1.2 + Math.min(1, p) * 0.6
      const level = isRim ? 3.4 + (toLight > 0 ? 1 : -1)
        : isSurround ? 0.6 + (toLight < 0 ? 0.8 : 0)
        : isCap ? 5 + p + (toLight > 0 ? 0.8 : 0)
        : 2.8 + (toLight > 0 ? 0.8 : -0.4) + p * 1.2
      c.set(x, y, shade(CONE, level))
    }
  }
  c.set(x0 + 1, TOP, shade(CAB, 0))
  c.set(x1 - 1, TOP, shade(CAB, 0))
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const p = pump(f)
    const flash = f >= DROP ? Math.max(0, 1 - (f - DROP) / 7) : 0
    const playing = f >= DROP && f < 60

    for (let y = 0; y < TOP; y++) {
      for (let x = 0; x < W; x++) {
        const lit = lampLight(x, y)
        const stripe = mod(x, 6) === 0 ? -0.5 : 0
        const near = Math.min(Math.hypot(x - 8, y - 18), Math.hypot(x - 55, y - 18))
        const thump = (flash * 1.6 + p * 0.4) * clamp(1.4 - near / 30)
        c.set(x, y, shade(WALL, 1.2 + lit * 5 + stripe + thump))
      }
    }

    for (const b of BEATS) {
      const age = f - b
      const steps = b === DROP ? RING_DROP : RING
      const level = steps[age]
      if (level === undefined) continue
      for (const sx of [8, 55]) for (const [x, y] of ring(sx, 5 + age * 2)) c.set(x, y, SOUND[level] ?? 0)
    }

    for (let y = 3; y <= 7; y++) {
      const half = 2.5 + (y - 3) * 0.5
      for (let x = Math.round(8 - half); x <= Math.round(8 + half) - 1; x++) {
        const edge = x === Math.round(8 - half) || x === Math.round(8 + half) - 1
        c.set(x, y, shade(LAMP, 3.6 + (y - 3) * 0.35 - (edge ? 1 : 0)))
      }
    }
    c.rect(6, 8, 4, 1, shade(LAMP, 2))
    c.set(7, 9, shade(BRASS, 3))
    c.rect(5, 10, 5, 1, shade(BRASS, 2))
    c.set(5, 10, shade(BRASS, 3.4))

    speaker(c, 3, f)
    speaker(c, 50, f)

    for (let x = 0; x < W; x++) {
      const lit = lampLight(x, TOP)
      c.set(x, TOP, shade(WOOD, 4 + lit * 2.4))
      for (let y = TOP + 1; y < 32; y++) {
        const isSeam = x === 21 || x === 42 || y === TOP + 1
        c.set(x, y, shade(WOOD, 2.2 + lampLight(x, y) * 1.6 - (isSeam ? 1 : 0) - (y > 29 ? 0.6 : 0)))
      }
    }
    for (const kx of [19, 23, 40, 44]) c.set(kx, 28, shade(BRASS, 3 + lampLight(kx, 28) * 2))
    for (const [a, b] of [[3, 13], [50, 60], [16, 45]] as const) for (let x = a; x <= b; x++) c.set(x, TOP, shade(WOOD, 2.6))

    for (let y = 10; y <= 22; y++) {
      for (let x = 15; x <= 46; x++) {
        const isFront = y >= 21
        const corner = (x === 15 || x === 46) && (y === 10 || y === 22)
        if (corner) continue
        const lit = lampLight(x, y)
        const level = isFront ? 2.6 + lit * 2 - (y === 22 ? 0.8 : 0) + (y === 21 ? 0.8 : 0)
          : 3 + lit * 2.2 + (y === 10 ? 1 : 0) + (x === 15 ? 0.7 : 0)
        c.set(x, y, shade(TEAK, level))
      }
    }
    c.set(43, 21, shade(METAL, 4 + (playing ? 1.5 : 0)))
    c.set(18, 21, shade(METAL, 3))

    const spin = SPIN[f] ?? 0
    for (let x = Math.floor(REC.x - REC.rx - 1); x <= REC.x + REC.rx + 1; x++) {
      const u = (x - REC.x) / (REC.rx + 0.6)
      if (Math.abs(u) > 1) continue
      const y = Math.round(REC.y + Math.sqrt(1 - u * u) * (REC.ry + 0.5))
      const a = Math.acos(clamp(u, -1, 1))
      const dot = Math.sin(a * 12 - spin * 6) > 0
      c.set(x, y + 1, shade(METAL, dot ? 4.6 - Math.abs(u) * 1.5 : 2.4))
      c.set(x, y, shade(METAL, 3))
    }

    for (let y = Math.floor(REC.y - REC.ry); y <= REC.y + REC.ry; y++) {
      for (let x = Math.floor(REC.x - REC.rx); x <= REC.x + REC.rx; x++) {
        const u = (x - REC.x) / REC.rx
        const v = (y - REC.y) / REC.ry
        const r = Math.hypot(u, v)
        if (r > 1) continue
        const a = Math.atan2(v, u)
        if (r < 0.33) {
          const sector = mod(a + spin, TAU) < 1.6
          c.set(x, y, r < 0.1 ? METAL[5] ?? 0 : sector ? LABEL[4] ?? 0 : shade(LABEL, 2.4 - v * 0.8))
          continue
        }
        const ring = Math.floor(r * 10)
        let level = r > 0.93 ? 2.6 : ring === 5 || ring === 8 ? 0.6 : 1.6
        for (const [a0, power] of [[-2.5, 1], [0.64, 0.7]] as const) {
          const off = Math.abs(mod(a - a0 + Math.PI, TAU) - Math.PI)
          if (off < 0.45) {
            const isFlare = off < 0.22 && ring === 4 + mod(Math.floor(spin * 1.3), 6)
            level += power * (off < 0.22 ? 2.6 + (isFlare ? 2 : 0) : 1.3)
          }
        }
        c.set(x, y, shade(VINYL, level))
      }
    }

    const { angle, lift } = arm(f)
    const tip = { x: PIVOT.x + Math.cos(angle) * ARM_LEN, y: PIVOT.y + Math.sin(angle) * ARM_LEN * 0.5 }
    const back = { x: PIVOT.x - Math.cos(angle) * 3, y: PIVOT.y - Math.sin(angle) * 1.5 }
    c.line(PIVOT.x + 1, PIVOT.y + 2, tip.x + 1, tip.y + 1, (x, y) => mix(c.get(x, y), 0x08060e, 0.55))
    c.disc(PIVOT.x, PIVOT.y + 0.5, 1.6, shade(METAL, 2.6))
    c.set(PIVOT.x - 1, PIVOT.y, shade(METAL, 4.4))
    c.rect(back.x - 1, back.y - 1 - lift * 0.5, 2, 2, shade(METAL, 2))
    c.set(back.x - 1, back.y - 1 - lift * 0.5, shade(METAL, 3.6))
    c.line(PIVOT.x, PIVOT.y - 1, tip.x, tip.y - 1 - lift, shade(METAL, 5))
    c.rect(tip.x - 1, tip.y - 1 - lift, 2, 2, shade(METAL, 1.6))
    c.set(tip.x - 1, tip.y - 1 - lift, shade(METAL, 3.6))
    c.rect(44, 18, 2, 1, shade(METAL, lift > 0 ? 5 : 3))

    const jump = f >= DROP && f < DROP + 8 ? Math.round(3 * Math.sin((Math.PI * (f - DROP)) / 8)) : 0
    const isBob = f > DROP + 7 && f < 60 && pump(f) > 0.5
    const isAwake = f >= DROP && f < 64
    const tail = Math.round(Math.sin((TAU * f) / 24))
    const cx = 52
    const cy = 3 - jump
    const body: Record<string, number> = {
      d: CAT[1] ?? 0, m: CAT[2] ?? 0, o: CAT[3] ?? 0, l: CAT[4] ?? 0, h: CAT[5] ?? 0,
      e: isAwake ? 0xd8f070 : CAT[1] ?? 0, n: 0xe8a0a0, k: CAT[0] ?? 0,
    }
    const head = isBob ? 1 : 0
    c.sprite(cx, cy + 3, [
      '.ooooo.',
      'looooom',
      'loooomm',
      'loommmd',
      '.mmmmd.',
    ], body)
    c.sprite(cx, cy + head, [
      'l.....m',
      'lo...om',
      'looooom',
      isAwake ? 'oekoekm' : 'odoodom',
      '.oonom.',
    ], body)
    const flick = playing ? tail : 0
    c.set(cx + 7, cy + 7, CAT[2] ?? 0)
    c.set(cx + 8, cy + 6, CAT[3] ?? 0)
    c.set(cx + 8 + (flick > 0 ? 1 : 0), cy + 5 - (flick < 0 ? 1 : 0), CAT[4] ?? 0)
  })
}

export const scene: Scene = {
  verb: 'Grooving',
  render,
  hero: 22,
  snaps: [
    { frames: 21, box: [12, 2, 21, 9], colors: WALL.slice(6), why: 'the drop flashes the room' },
    { frames: 21, box: [2, 6, 4, 15], colors: WALL.slice(6), why: 'the drop flashes the room' },
  ],
}
