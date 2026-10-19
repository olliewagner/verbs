import { Canvas, H, W, beat, frames, hash, hex, mix, mod, particles, shade, wave, type Scene } from '../engine'

const LOOP = 72
const PERIOD = 64

const NIGHT = 0x0a0916
const WARM = 0xffe0a0
const WOOD = hex('0c0912 181018 26181a 38231e 4e3220 6a4424 8c5a2c b07636 d49a4c')
const BRASS = hex('2a1d14 5a3f1c 8e6a26 c49a3a ecd27a fff2b8')
const FLOOR = hex('0a0812 140f17 21171a 32221e 472f22 603e26 7e522e')
const SKIN = hex('4a2a2e 8a5444 c4825e eab48a')
const HAIR = hex('120a10 26141a 3e2222 5a3428')
const KNIT = hex('2a1e22 54402e 8a6c46 bc9a62 e2c488')
const TROUSERS = hex('0c0c18 181a2c 262a44 363c5c')
const SCARF = hex('3a0e18 74182a b42c30 e2563c')
const PAGE = hex('3a3048 7c6e74 c4b29c ecdcbc fff8e4')
const FLAME = hex('c0601c f6a640 ffe08a fffbe6')

const BINDINGS = ['8a2024', '1f5a3e', '28407a', 'a87a2a', '5e2c62', '2e5e6a', '6a3a24'].map(h => {
  const base = parseInt(h, 16)
  return [mix(NIGHT, base, 0.16), mix(NIGHT, base, 0.4), mix(NIGHT, base, 0.7), base, mix(base, WARM, 0.25)]
})
const RED = BINDINGS[0] ?? []
const GILT = hex('3a2a18 7a5c22 c09838 f2d878')

const SHELVES: readonly (readonly [number, number])[] = [[0, 6], [8, 14], [16, 22], [24, 27]]
const BOARDS = [7, 15, 23, 28]
const RAIL = 2
const FLOOR_Y = 29

type Book = { x0: number; x1: number; top: number; color: number; band: number }

const PULL: Book = { x0: 30, x1: 31, top: 9, color: 0, band: 10 }

const BOOKS: Book[][] = SHELVES.map(([y0], s) => {
  const books: Book[] = []
  let x = 2
  let n = 0
  while (x < PERIOD) {
    const room = 32 - (x % 32)
    if (room === 32) {
      x += 2
      continue
    }
    if (s === 1 && x === PULL.x0) {
      books.push(PULL)
      x = PULL.x1 + 1
      continue
    }
    const r = hash(n, s, 77)
    const limit = s === 1 && x < PULL.x0 ? PULL.x0 - x : room
    const w = Math.min(limit, r < 0.5 ? 2 : r < 0.88 ? 3 : 4)
    if (hash(n, s, 13) > 0.05) {
      const top = y0 + (s === 0 ? 0 : Math.floor(hash(n, s, 5) * 3))
      const band = hash(n, s, 21) < 0.5 ? top + 1 + Math.floor(hash(n, s, 3) * 2) : -1
      books.push({ x0: x, x1: x + w - 1, top, color: Math.floor(hash(n, s, 9) * BINDINGS.length), band })
    }
    x += w
    n++
  }
  return books
})

const RIDE0 = 6
const RIDE1 = 32
const ride = (t: number) => (1 - Math.cos(Math.PI * t)) / 2
const ladderAt = (f: number) => PERIOD * Math.floor(f / LOOP) + PERIOD * ride(beat(mod(f, LOOP), RIDE0, RIDE1))
const cameraAt = (f: number) => (ladderAt(f - 1) + ladderAt(f - 2)) / 2
const clampSwing = (v: number) => Math.max(-1.6, Math.min(1.6, v))

const SWING: readonly { lantern: number; scarf: number }[] = (() => {
  let a = 0
  let va = 0
  let s = 0
  let vs = 0
  const out: { lantern: number; scarf: number }[] = []
  for (let f = 0; f < LOOP * 3; f++) {
    const v = ladderAt(f) - ladderAt(f - 1)
    const acc = v - (ladderAt(f - 1) - ladderAt(f - 2))
    va += -acc * 0.3 - a * 0.2 - va * 0.14
    a += va
    vs += -(s + v * 0.45) * 0.35 - vs * 0.35
    s += vs
    if (f >= LOOP * 2) out.push({ lantern: a, scarf: s })
  }
  return out
})()

type Pose = 'ready' | 'crouch' | 'ride' | 'reach' | 'lower' | 'hold' | 'read'

function poseAt(f: number): Pose {
  if (f >= 3 && f < 6) return 'crouch'
  if (f >= 6 && f < 33) return 'ride'
  if (f === 37 || f === 62) return 'lower'
  if ((f >= 33 && f < 37) || (f >= 63 && f < 67)) return 'reach'
  if ((f >= 38 && f < 40) || (f >= 60 && f < 62)) return 'hold'
  if (f >= 40 && f < 60) return 'read'
  return 'ready'
}
const isOut = (f: number) => f >= 35 && f < 65

function pageAt(f: number): number | undefined {
  for (const [start, len] of [[42, 3], [45, 3], [48, 3], [53, 6]] as const) {
    if (f >= start && f < start + len) return -1 + (2 * (f - start + 1)) / (len + 1)
  }
  return undefined
}

const READER = [
  '.hhh.',
  'hhhhh',
  'hhsSS',
  'hhsSs',
  '.hss.',
  '.rrr.',
  'jjjJJ',
  'jjjJJ',
  'jjjJ.',
  '.jjj.',
  '.ttt.',
  '.t.t.',
  '.t..t',
  'bb..b',
]

function draw(c: Canvas, f: number): void {
  const cam = Math.round(cameraAt(f))
  const onScreen = ladderAt(f) - cameraAt(f) + 17
  const sx = Math.round(onScreen)
  const swing = SWING[f] ?? { lantern: 0, scarf: 0 }
  const flick = 0.93 + 0.05 * wave(f, LOOP, 6) + 0.03 * wave(f, LOOP, 13, 0.3)
  const glow = onScreen + 7 + clampSwing(swing.lantern) * 1.6
  const lx = Math.round(glow)
  const ly = 9
  const pose = poseAt(f)
  const light = (x: number, y: number) => {
    const d = Math.hypot(x - glow, (y - ly) * 1.15)
    return flick * 1.3 * Math.max(0, 1 - d / 24) ** 1.8
  }

  c.fill((x, y) => shade(WOOD, 0.4 + light(x, y) * 2, x, y))
  for (let x = 0; x < W; x++) {
    for (const y of BOARDS) c.set(x, y, shade(WOOD, 2.2 + light(x, y) * 5.4, x, y))
  }
  for (const [s, books] of BOOKS.entries()) {
    const y1 = SHELVES[s]?.[1] ?? 0
    for (const b of books) {
      if (b === PULL && isOut(f)) continue
      const ramp = BINDINGS[b.color] ?? []
      const w = b.x1 - b.x0
      for (let x = 0; x < W; x++) {
        const k = mod(x + cam - b.x0, PERIOD)
        if (k > w) continue
        for (let y = b.top; y <= y1; y++) {
          const lit = light(x, y)
          const edge = k === 0 && w >= 2 ? 0.6 : k === w ? -0.9 : 0
          if (y === b.band && lit > 0.3) c.set(x, y, shade(GILT, lit * 4 + edge * 0.5, x, y))
          else c.set(x, y, shade(ramp, 0.3 + lit * 3.8 + edge * Math.min(1, 0.4 + lit * 2), x, y))
        }
      }
    }
  }
  if (isOut(f)) {
    for (let x = 0; x < W; x++) {
      const k = mod(x + cam - PULL.x0, PERIOD)
      if (k <= PULL.x1 - PULL.x0) for (let y = PULL.top; y <= 14; y++) c.set(x, y, WOOD[0] ?? 0)
    }
  }
  for (let x = 0; x < W; x++) {
    const k = mod(x + cam, 32)
    if (k > 1) continue
    for (let y = 0; y < FLOOR_Y; y++) c.set(x, y, shade(WOOD, (k === 0 ? 3 : 1.8) + light(x, y) * 4.6, x, y))
  }
  for (let x = 0; x < W; x++) {
    c.set(x, RAIL, shade(BRASS, 0.6 + light(x, RAIL) * 5, x, RAIL))
    for (let y = FLOOR_Y; y < H; y++) {
      const seam = mod(x + cam + (y - FLOOR_Y) * 13, 21) === 0 ? -1 : 0
      c.set(x, y, shade(FLOOR, 1.2 + light(x, y - 10) * 5 + seam - (y - FLOOR_Y) * 0.35, x, y))
    }
  }

  for (let y = RAIL; y <= 30; y++) {
    for (const x of [sx, sx + 5]) c.set(x, y, shade(WOOD, 3.2 + light(x, y) * 5 + (x === sx ? 0.5 : -0.2), x, y))
    if (y % 4 === 1 && y > RAIL + 1 && y < 30) {
      for (let x = sx + 1; x <= sx + 4; x++) c.set(x, y, shade(WOOD, 3.6 + light(x, y) * 4.6, x, y))
    }
  }
  for (const x of [sx, sx + 5]) {
    c.set(x, RAIL - 1, BRASS[3] ?? 0)
    c.set(x, RAIL, BRASS[4] ?? 0)
  }
  const spin = Math.floor(ladderAt(f) / 2) % 2
  for (const x of [sx, sx + 5]) {
    c.set(x, 30, shade(BRASS, 1.8 + light(x, 30) * 2.6, x, 30))
    c.set(x + (spin ? 1 : -1), 30, BRASS[1] ?? 0)
    c.set(x, 31, WOOD[0] ?? 0)
  }

  const crouch = pose === 'crouch' ? 1 : 0
  const speed = Math.abs(ladderAt(f) - ladderAt(f - 1))
  const leanBack = pose === 'ride' && speed > 1.2 ? 1 : 0
  const rx = sx + 1
  const ry = 12 + crouch
  const ink: Record<string, readonly number[]> = { h: HAIR, s: SKIN, S: SKIN, r: SCARF, j: KNIT, J: KNIT, t: TROUSERS, b: HAIR }
  const lift: Record<string, number> = { h: 0.8, s: 1.4, S: 2.4, r: 1.6, j: 1.4, J: 2.4, t: 1, b: 0.4 }
  READER.forEach((row, j) => {
    const shift = j < 6 ? -leanBack : 0
    const y = ry + j - (j >= 10 ? crouch : 0)
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] ?? '.'
      const ramp = ink[ch]
      if (!ramp) continue
      const x = rx + i + shift
      c.set(x, y, shade(ramp, (lift[ch] ?? 1) + light(x, y) * 1.6, x, y))
    }
  })
  const tail = Math.max(-2, Math.min(2, swing.scarf))
  const rise = Math.abs(tail) > 1 ? 1 : 0
  for (const [k, x, y] of [[1, rx - 1, ry + 6], [2, rx - 2, ry + 7]] as const) {
    const tx = Math.round(x + (k === 1 ? 0 : 1) + tail * k * 0.6) - leanBack
    c.set(tx, y - rise * k, shade(SCARF, 2 - k * 0.4 + light(tx, y) * 1.4, tx, y))
  }

  const arm = (x: number, y: number, isHand = false) => c.set(x, y, shade(isHand ? SKIN : KNIT, (isHand ? 2.2 : 1.8) + light(x, y) * 1.6, x, y))
  const book = (x: number, y: number, lvl: number) => c.set(x, y, shade(RED, lvl + light(x, y) * 1.2, x, y))
  if (pose !== 'read' && pose !== 'hold') {
    arm(rx, ry + 7)
    arm(rx - 1, ry + 7, true)
  }
  if (pose === 'ride') {
    arm(rx + 5 - leanBack, ry + 6)
    arm(rx + 6 - leanBack, ry + 5, true)
  } else if (pose === 'ready' || pose === 'crouch') {
    arm(rx + 4, ry + 9, true)
  } else if (pose === 'reach') {
    arm(rx + 5, ry + 6)
    arm(rx + 6, ry + 5)
    arm(rx + 7, ry + 4, true)
    const isHeld = (f >= 35 && f < 37) || (f >= 63 && f < 65)
    if (isHeld) {
      for (let y = ry - 2; y <= ry + 3; y++) {
        book(rx + 7, y, 3.4)
        book(rx + 8, y, 2.4)
      }
      c.set(rx + 7, ry - 1, GILT[3] ?? 0)
      c.set(rx + 8, ry - 1, GILT[2] ?? 0)
    }
  } else if (pose === 'lower') {
    arm(rx + 5, ry + 7)
    arm(rx + 6, ry + 6, true)
    for (let y = ry + 1; y <= ry + 6; y++) {
      book(rx + 7, y, 3.4)
      book(rx + 8, y, 2.4)
    }
    c.set(rx + 7, ry + 2, GILT[3] ?? 0)
    c.set(rx + 8, ry + 2, GILT[2] ?? 0)
  } else if (pose === 'hold') {
    const up = f === 39 || f === 60 ? 1 : 0
    for (let y = ry + 5 - up; y <= ry + 9 - up; y++) {
      book(rx + 6, y, 3.4)
      book(rx + 7, y, 2.4)
    }
    c.set(rx + 6, ry + 6 - up, GILT[3] ?? 0)
    arm(rx + 5, ry + 8 - up, true)
  } else {
    const isHalf = f === 40 || f === 59
    const ox = rx + 8
    const oy = ry + 6
    for (const x of [ox - 1, ox, ox + 1]) book(x, oy, x === ox ? 3.4 : 2.6)
    const pages: readonly (readonly [number, number])[] = [
      [ox - 3, oy - 3], [ox + 3, oy - 3],
      [ox - 3, oy - 2], [ox - 2, oy - 2], [ox - 1, oy - 2], [ox + 1, oy - 2], [ox + 2, oy - 2], [ox + 3, oy - 2],
      [ox - 2, oy - 1], [ox - 1, oy - 1], [ox + 1, oy - 1], [ox + 2, oy - 1],
    ]
    for (const [x, y] of pages) {
      if (isHalf && x > ox) continue
      const isPrint = (x === ox - 2 || x === ox + 2) && y === oy - 2
      c.set(x, y, shade(PAGE, (isPrint ? 2 : 3.2) + light(x, y) * 1.2 - (x < ox ? 0.4 : 0), x, y))
    }
    c.set(ox, oy - 1, PAGE[1] ?? 0)
    c.set(ox - 4, oy - 3, RED[3] ?? 0)
    if (isHalf) {
      c.set(ox, oy - 2, PAGE[4] ?? 0)
      c.set(ox, oy - 3, PAGE[4] ?? 0)
      c.set(ox, oy - 4, RED[2] ?? 0)
    } else c.set(ox + 4, oy - 3, RED[2] ?? 0)
    arm(rx + 5, ry + 7)
    arm(ox - 2, oy, true)
    const p = pageAt(f)
    if (p !== undefined) {
      const ang = p * 1.15
      for (let r = 1; r <= 3; r++) {
        const x = Math.round(ox - Math.sin(ang) * r * 1.05)
        const y = Math.round(oy - 1 - Math.cos(ang) * r * 0.95)
        c.set(x, y, PAGE[4] ?? 0)
      }
    }
  }

  c.set(sx + 6, 5, BRASS[3] ?? 0)
  c.set(Math.round((sx + 6 + lx) / 2), 6, BRASS[2] ?? 0)
  for (const [dx, dy, col] of [
    [-1, 7, BRASS[2]], [0, 7, BRASS[4]], [1, 7, BRASS[2]],
    [-1, 8, BRASS[3]], [1, 8, BRASS[1]], [-1, 9, BRASS[3]], [1, 9, BRASS[1]],
    [-1, 10, BRASS[2]], [0, 10, BRASS[3]], [1, 10, BRASS[1]],
  ] as const) {
    c.set(lx + dx, dy, col ?? 0)
  }
  c.set(lx, 8, shade(FLAME, 2.2 + flick, lx, 8))
  c.set(lx, 9, shade(FLAME, 1.4 + flick, lx, 9))

  for (const p of particles(f, LOOP, 10, 40, 31)) {
    const x = Math.round(lx - 9 + p.r[1] * 18 + Math.sin(p.age * 5 + p.r[2] * 6) * 1.5)
    const y = Math.round(22 - p.age * 16 + p.r[3] * 4)
    if (light(x, y) > 0.6) c.set(x, y, PAGE[2] ?? 0)
  }
}

export const scene: Scene = {
  verb: 'Perusing',
  render: () => frames(LOOP, draw),
  hero: 54,
  snaps: [
    {
      frames: [RIDE0 + 2, RIDE1 + 2],
      colors: [...BINDINGS.flat(), ...GILT, ...WOOD],
      why: 'the camera pans one bookcase-width with the ladder: the wall of spines and the shelves slide past under the lantern',
    },
  ],
}
