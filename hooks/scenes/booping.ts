import { Canvas, PALETTE, beat, clamp, ease, frames, hex, lerp, particles, shade, wave, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const ENTER = [4, 14] as const
const POKE = 17
const WAKE = 18
const LEAVE = [20, 33] as const
const SNEEZE = 34
const SLEEP = 46

const SKY = hex('3a74bc 4f8ccf 6aa6de 8fc2ea bcdcf3')
const HILL = hex('4f7f86 5f9488 76a890 92bc9c')
const LEAF = PALETTE.leaf
const FRAME = hex('5e4e44 8a7664 b8a284 dcc8a6 f4e8cc fffaee')
const WALL = hex('2c1e24 3e2a30 563a3a 704e46 8e6654 ae8264')
const GINGER = hex('3a1408 5c220c 88360f b2521a d6722a ec9640 f6be6a fbe0a6')
const CREAM = hex('6e5040 a8846a d6bc98 f2e2c4 fff7e6')
const PINK = hex('8a3e4e c86878 f0a0aa ffd0d4')
const IRIS = hex('1e2a0c 5c7a1c a6c43a e2f07a')
const SKIN = hex('5e3020 8e4e36 bc7458 dc9878 f2bc9a fadcc4')
const SLEEVE = hex('1c2448 2c3a6e 40548e')
const POT = hex('3e180e 6a2a16 96401e c0602c dc8a4a')
const SUCCULENT = hex('1e3a2e 2e5a40 4a8256 74aa6c a8d08a')
const DUST = 0xfff3cf

const LX = -0.55
const LY = -0.83

type Eyes = 'closed' | 'wide' | 'half' | 'squint' | 'low'
function eyesAt(f: number): Eyes {
  if (f < WAKE || f >= SLEEP) return 'closed'
  if (f < 29) return 'wide'
  if (f < SNEEZE) return 'half'
  if (f < SNEEZE + 2) return 'squint'
  if (f < SNEEZE + 4) return 'closed'
  if (f < 41) return 'half'
  return 'low'
}

function headAt(f: number): { dx: number; dy: number } {
  let dx = 0
  let dy = f > WAKE && f < SLEEP ? 0 : 1
  if (f === WAKE + 2 || f === WAKE + 3) dx = 1
  if (f >= SNEEZE - 3 && f < SNEEZE) dy -= 1
  if (f === SNEEZE || f === SNEEZE + 1) {
    dy += 1
    dx = -1
  }

  return { dx, dy }
}

function fingerAt(f: number): number {
  if (f < ENTER[0] || f > LEAVE[1]) return -30
  if (f < ENTER[1]) return lerp(-6, 15, ease.out(beat(f, ENTER[0], ENTER[1])))
  if (f < POKE - 2) return 15
  if (f < POKE) return [14, 15][f - POKE + 2] ?? 15
  if (f < LEAVE[0]) return 17
  const p = beat(f, LEAVE[0], LEAVE[1])
  const rise = 0.25
  const top = 1 / (1 - rise / 2)
  return lerp(17, -18, p < rise ? (top * p * p) / (2 * rise) : top * (p - rise / 2))
}

const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.hypot((x - cx) / rx, (y - cy) / ry)

function round(r: Ramp, base: number, nx: number, ny: number, isRim: boolean, x: number, y: number): number {
  const lambert = clamp((nx * LX + ny * LY) * 1.2, -0.7, 1)
  return shade(r, base + lambert * 2.2 + (isRim ? 1.3 : 0), x, y)
}

function draw(c: Canvas, f: number): void {
  const eyes = eyesAt(f)
  const head = headAt(f)
  const isAwake = f >= WAKE && f < SLEEP
  const breath = isAwake ? 1 : Math.round(0.5 + 0.5 * wave(f, LOOP, 3, 0.1))

  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < W; x++) {
      const hill = 15 + Math.sin(x * 0.18 + 0.8) * 1.5 + Math.sin(x * 0.07) * 1.2
      c.set(x, y, y >= hill ? shade(HILL, 2.4 - (y - hill) * 0.5 + (y < hill + 1 ? 0.8 : 0), x, y) : shade(SKY, 0.4 + y * 0.27, x, y))
    }
  }
  for (const [cx, cy, rx, ry] of [[47, 10, 5, 2], [51, 9, 3.5, 2.5], [44, 11, 3, 1.4]] as const) {
    for (let y = Math.floor(cy - ry); y <= Math.min(11, Math.ceil(cy + ry)); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (ell(x, y, cx, cy, rx, ry) <= 1) c.set(x, y, y >= 11 ? SKY[4] ?? 0 : 0xf4f9fc)
      }
    }
  }
  const sway = wave(f, LOOP, 1) * 0.8
  c.line(63, 1, 52, 4, LEAF[0] ?? 0)
  c.line(63, 2, 53, 5, LEAF[1] ?? 0)
  for (const [lx, ly, k] of [[54, 5, 0], [57, 4, 1], [60, 3, 2], [55, 2, 3], [59, 6, 4], [51, 4, 5]] as const) {
    const dx = Math.round(sway * (1 + (k % 2)))
    c.sprite(lx + dx - 1, ly - 1, ['.ab', 'abc', 'bc.'], { a: LEAF[2] ?? 0, b: LEAF[3] ?? 0, c: LEAF[4] ?? 0 })
  }

  for (let y = 0; y < 21; y++) {
    for (const [x0, x1] of [[0, 2], [61, 63]] as const) for (let x = x0; x <= x1; x++) c.set(x, y, shade(WALL, 2, x, y))
    for (const [x, l] of [[3, 3.4], [4, 4.2], [5, 2.6], [37, 3.6], [38, 4.4], [39, 2.8], [58, 3.6], [59, 4.2], [60, 2.6]] as const) {
      c.set(x, y, shade(FRAME, l, x, y))
    }
  }

  for (let x = 0; x < W; x++) {
    c.set(x, 21, shade(FRAME, 4.2, x, 21))
    c.set(x, 22, shade(FRAME, 3.6, x, 22))
    c.set(x, 23, shade(FRAME, 5, x, 23))
    c.set(x, 24, shade(FRAME, 1.4, x, 24))
    for (let y = 25; y < H; y++) {
      const u = x - (y - 26) * 1.3
      const isBeam = y > 25 && u > 18 && u < 46
      c.set(x, y, shade(WALL, y === 25 ? 0.6 : isBeam ? 3.6 : 1.8, x, y))
    }
  }

  for (let y = 17; y <= 21; y++) {
    const half = 2.6 - (y - 17) * 0.25
    for (let x = Math.round(52.5 - half); x <= Math.round(52.5 + half); x++) {
      c.set(x, y, shade(POT, (y === 17 ? 3.6 : 2.2) + (x < 52 ? 1 : x > 53 ? -0.8 : 0), x, y))
    }
  }
  for (const [x, y, l] of [[52, 12, 4], [51, 13, 3], [53, 13, 3], [50, 14, 2.5], [52, 14, 3.4], [54, 14, 2], [49, 15, 2.6], [51, 15, 3], [53, 15, 2.6], [55, 15, 1.6], [50, 16, 2], [52, 16, 2.4], [54, 16, 1.2]] as const) {
    c.set(x, y, shade(SUCCULENT, l, x, y))
  }
  for (let x = 51; x <= 57; x++) c.set(x, 22, shade(FRAME, 2.6, x, 22))
  for (let x = 14; x <= 50; x++) c.set(x, 22, shade(FRAME, 2.4, x, 22))

  const body = { cx: 36, cy: 16.4 + (1 - breath) * 0.5, rx: 11.6, ry: 5.2 - (1 - breath) * 0.5 }
  const inBody = (x: number, y: number) => y <= 21 && Math.abs((x - body.cx) / body.rx) ** 2.2 + Math.abs((y - body.cy) / body.ry) ** 2.2 <= 1
  for (let y = 10; y <= 21; y++) {
    for (let x = 23; x <= 49; x++) {
      if (!inBody(x, y)) continue
      const nx = (x - body.cx) / body.rx
      const ny = (y - body.cy) / body.ry
      const isRim = !inBody(x, y - 1) || !inBody(x - 1, y)
      const isBand = y < 17 && [28, 33, 38, 43].includes(x + (y > 13 ? 1 : 0)) && !isRim
      c.set(x, y, round(GINGER, 3.1 - (isBand ? 1 : 0), nx, ny * 1.2, isRim, x, y))
    }
  }

  const tip = isAwake && f < 30 ? Math.round(1 + Math.sin((f - WAKE) * 0.9)) : 0
  for (let x = 29; x <= 46; x++) {
    const isBand = x % 5 === 0
    c.set(x, 20, shade(GINGER, isBand ? 2.6 : 4.4, x, 20))
    c.set(x, 21, shade(GINGER, isBand ? 1.6 : 3, x, 21))
  }
  c.sprite(26, 18 - tip, tip > 0 ? ['ca', 'ab', 'a.', 'b.'] : ['..', 'ca', 'ab', '.b'], { a: GINGER[5] ?? 0, b: GINGER[3] ?? 0, c: CREAM[3] ?? 0 })
  if (tip > 0) c.set(28, 20, GINGER[4] ?? 0)

  const hx = 20.5 + head.dx
  const hy = 14.5 + head.dy
  const inHead = (x: number, y: number) => ell(x, y, hx, hy, 6.8, 5) <= 1 || ell(x, y, hx, hy + 2.2, 7.6, 2.8) <= 1
  const perk = isAwake ? 1 : 0
  const flickR = f >= 23 && f <= 24 ? 1 : 0
  const flickL = f === 26 ? 1 : 0
  const ears = [
    [[hx - 6.6, hy - 1.4], [hx - 5.4 - flickL, hy - 7.2 - perk + flickL], [hx - 1.6, hy - 4.2]] as const,
    [[hx + 1.6, hy - 4.2], [hx + 5.4 + flickR, hy - 7.2 - perk + flickR], [hx + 6.6, hy - 1.4]] as const,
  ]
  ears.forEach((pts, i) => {
    c.poly(pts, (x, y) => shade(GINGER, (i === 0 ? 5 : 3.8) + (y < hy - 5.5 ? 0.6 : 0), x, y))
    const ix = Math.round(i === 0 ? hx - 4.6 : hx + 4.4)
    c.set(ix, Math.round(hy - 4.4 - perk * 0.5), PINK[1] ?? 0)
    c.set(ix, Math.round(hy - 3.4 - perk * 0.5), PINK[0] ?? 0)
  })
  for (let y = Math.floor(hy - 6); y <= Math.ceil(hy + 5); y++) {
    for (let x = Math.floor(hx - 8); x <= Math.ceil(hx + 8); x++) {
      if (!inHead(x, y)) continue
      const nx = (x - hx) / 6.8
      const ny = (y - hy) / 5
      const isRim = !inHead(x, y - 1) || !inHead(x - 1, y)
      const isMark = y >= hy - 4.5 && y <= hy - 3.5 && [hx - 2, hx + 2].some(m => Math.abs(x - m) < 0.6)
      c.set(x, y, round(GINGER, 3.7 - (isMark ? 0.8 : 0), nx * 0.45, ny * 0.6, isRim && !isMark, x, y))
    }
  }
  const nose = { x: Math.round(hx - 0.5), y: Math.round(hy) + 1 }
  for (let y = nose.y; y <= nose.y + 3; y++) {
    for (let x = nose.x - 4; x <= nose.x + 5; x++) {
      if (ell(x, y, hx, nose.y + 1.4, 3.4, 1.9) <= 1 && inHead(x, y)) c.set(x, y, shade(CREAM, x <= hx ? 3.2 : 2.5, x, y))
    }
  }
  for (let x = nose.x - 2; x <= nose.x + 3; x++) c.set(x, 20, shade(CREAM, 3 - (x - nose.x) * 0.3, x, 20))
  for (const px of [15, 23]) {
    for (let x = px; x <= px + 2; x++) c.set(x, 21, shade(CREAM, x === px ? 3.6 : 2.8, x, 21))
    c.set(px + 3, 21, CREAM[1] ?? 0)
  }

  const lid = GINGER[1] ?? 0
  const EYE: Record<Eyes, readonly string[]> = {
    closed: ['...', '.d.', 'd.d'],
    wide: ['gGg', 'gkh', 'gkg', '.g.'],
    half: ['ddd', 'gkg', '...'],
    low: ['...', 'ddd', '.g.'],
    squint: ['d..', '.dd', 'd..'],
  }
  for (const [i, ex] of [nose.x - 4, nose.x + 3].entries()) {
    const art = eyes === 'squint' && i === 1 ? ['..d', 'dd.', '..d'] : EYE[eyes]
    c.sprite(ex, nose.y - 3 - (eyes === 'wide' ? 1 : 0), art, { d: lid, l: GINGER[2] ?? 0, g: IRIS[2] ?? 0, G: IRIS[1] ?? 0, k: 0x0a0806, h: 0xffffff })
  }
  const isBooped = f === POKE || f === POKE + 1
  if (isBooped) {
    c.set(nose.x, nose.y, PINK[3] ?? 0)
    c.set(nose.x + 1, nose.y, PINK[2] ?? 0)
    c.set(nose.x + 2, nose.y, PINK[1] ?? 0)
  } else {
    c.set(nose.x, nose.y, PINK[2] ?? 0)
    c.set(nose.x + 1, nose.y, PINK[1] ?? 0)
    c.set(nose.x, nose.y + 1, PINK[0] ?? 0)
  }
  const mouthOpen = f === SNEEZE || f === SNEEZE + 1
  c.set(nose.x - 1, nose.y + 2, CREAM[0] ?? 0)
  c.set(nose.x + 1, nose.y + 2, CREAM[0] ?? 0)
  if (mouthOpen) c.set(nose.x, nose.y + 2, PINK[0] ?? 0)

  const twitch = (f >= 24 && f <= 25) || (f >= SNEEZE && f <= SNEEZE + 1) ? -1 : 0
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? nose.x - 4 : nose.x + 5
    c.line(x0 + side, nose.y + 1, x0 + side * 4, nose.y + twitch, CREAM[3] ?? 0)
    c.line(x0 + side, nose.y + 2, x0 + side * 3, nose.y + 3 + twitch, CREAM[2] ?? 0)
  }

  const tipX = Math.round(fingerAt(f))
  if (tipX > -26) {
    const fy = nose.y - head.dy
    for (let x = tipX - 11; x <= tipX; x++) {
      const isTip = x === tipX
      c.set(x, fy, shade(SKIN, isTip ? 3.6 : 4.2, x, fy))
      c.set(x, fy + 1, shade(SKIN, isTip ? 2.6 : x === tipX - 5 ? 2 : 3.2, x, fy + 1))
      if (!isTip) c.set(x, fy + 2, shade(SKIN, 1.6, x, fy + 2))
    }
    c.set(tipX - 1, fy, SKIN[5] ?? 0)
    c.set(tipX - 2, fy, SKIN[5] ?? 0)
    for (let y = fy - 1; y <= fy + 7; y++) {
      for (let x = tipX - 20; x <= tipX - 12; x++) {
        const isTop = y === fy - 1
        const isCurl = y > fy + 1 && (y - fy) % 2 === 1 && x >= tipX - 15
        c.set(x, y, shade(SKIN, isTop ? 4.2 : isCurl ? 1.8 : x === tipX - 12 ? 2.4 : 3.2, x, y))
      }
    }
    for (let y = fy - 2; y <= fy + 8; y++) {
      for (let x = tipX - 26; x <= tipX - 21; x++) c.set(x, y, shade(SLEEVE, x === tipX - 21 ? 2 : y === fy - 2 ? 1.6 : 1, x, y))
    }
  }

  if (f >= SNEEZE && f < SNEEZE + 6) {
    const t = f - SNEEZE + 1
    for (let k = 0; k < 6; k++) {
      const a = (k / 5 - 0.5) * 1.2
      const sp = 0.8 + (k % 3) * 0.3
      const x = nose.x - 1 - Math.cos(a) * sp * t * 1.2
      const y = nose.y + 0.5 + Math.sin(a) * sp * t
      if (t < 4 || k % 2 === 0) c.set(x, y, t < 3 ? 0xffffff : 0xd8eef8)
    }
    if (t <= 3) {
      const px = nose.x - 2 - t
      c.sprite(px - 1, nose.y - 1, t === 1 ? ['.a', 'aa'] : ['.a.', 'aaa', '.a.'], { a: 0xeef6fa })
    }
  }

  for (const p of particles(f, LOOP, 6, 40, 3)) {
    const x = 8 + p.r[1] * 40 + Math.sin(p.t * 0.12 + p.r[2] * 6) * 2
    const y = 2 + p.r[3] * 7 + p.t * 0.1
    if (Math.sin(p.age * Math.PI) > 0.3) c.tint(x, y, DUST, 0.5)
  }
}

export const scene: Scene = {
  verb: 'Booping',
  render: () => frames(LOOP, draw),
  hero: 21,
  snaps: [
    { frames: WAKE, box: [16, 13, 18, 16], colors: [...IRIS.slice(1, 3), 0x0a0806, 0x5c220c], why: 'a beat after the boop the eyes snap wide open' },
    { frames: WAKE, box: [23, 13, 25, 16], colors: [0xa6c43a, 0x5c220c, 0xd6722a], why: 'the other eye, snapping open with it' },
    { frames: SNEEZE, box: [15, 12, 18, 16], colors: [0x5c220c, 0xa6c43a, 0x0a0806], why: 'the sneeze squeezes the eyes shut' },
  ],
}
