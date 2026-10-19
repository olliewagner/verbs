import { Canvas, beat, clamp, ease, hash, hex, lerp, noise, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const CYCLE = 36
const SPACING = 16

const WALL = hex('24161a 381e20 50282a 683630 82463a a05c46 bc7a58')
const FLOOR = hex('1a1820 26242c 34323c 46424c 5c5660 76707a')
const SUN = hex('b08a62 d0a874 ecc88a fbe4b0')
const MINT = hex('0c2026 143434 1e4c48 2c6a5c 40897a 62aa94 92ccae c4e8cc')
const STEEL = hex('121218 1e1e26 2e2e38 44444e 62606a 8a8690 b8b2b8 e6e0e0')
const RUBBER = hex('0a0a0e 141418 1e1e24 2a2a32')
const CLAY = hex('22140e 3a2418 563620 74502e 926a3e ae8650')
const PAPER = hex('6a5444 9a8066 c8ae8a e6d4b0 f8eed6')
const RIBBON = hex('4a0a14 7e1422 b42430 e04a48')
const HAZARD = hex('16120e f0b830')
const STEAM = hex('8a8a98 b4b4c4 dcdce8 f8f8fc')

const BELT_Y = 22
const MACHINE_L = 22
const MACHINE_R = 42

function belt(f: number): number {
  const cycle = Math.floor(f / CYCLE)
  return (cycle + smoothstep(0, 11, f % CYCLE)) * SPACING
}

function stroke(c: number, at: number): number {
  if (c < at) return 0
  if (c < at + 1) return 1
  return 1 - beat(c, at + 1, at + 5)
}
const pistonA = (c: number) => stroke(c, 15)
const pistonB = (c: number) => stroke(c, 19)
const jolt = (c: number) => (c === 15 || c === 19 || c === 16 || c === 20 ? 1 : 0)

function lumpInside(kind: number, dx: number, dy: number): boolean {
  const rx = kind === 0 ? 4.6 : 3.8
  const ry = kind === 0 ? 3 : 3.6
  const wob = (noise(dx * 0.6 + kind * 7, dy * 0.6, 0, 3) - 0.5) * 0.9
  return (dx / rx) ** 2 + (dy / ry) ** 2 < 1 + wob
}

function drawLump(c: Canvas, x: number, kind: number, squash: number): void {
  const cy = BELT_Y - (kind === 0 ? 3 : 3.6) + squash * 0.5
  for (let dy = -5; dy <= 4; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const sy = dy / (1 - squash * 0.12)
      if (!lumpInside(kind, dx, sy)) continue
      const y = Math.round(cy + dy)
      if (y >= BELT_Y) continue
      const lit = -(dx * 0.18 + sy * 0.3) + (lumpInside(kind, dx - 1, sy - 1) ? 0 : 1.2)
      const pit = noise(dx * 1.3 + kind * 11, sy * 1.3, 0, 9) > 0.72 ? -1.3 : 0
      c.set(Math.round(x + dx), y, shade(CLAY, 2.8 + lit + pit))
    }
  }
}

function drawBox(c: Canvas, x: number): void {
  const x0 = Math.round(x) - 4
  const top = BELT_Y - 7
  for (let y = top; y < BELT_Y; y++) {
    for (let dx = 0; dx <= 8; dx++) {
      const isTop = y === top
      if (isTop && (dx === 0 || dx === 8)) continue
      const isSide = dx === 8
      const isRibbon = dx === 3 || dx === 4
      if (isRibbon) c.set(x0 + dx, y, RIBBON[isTop ? 3 : dx === 3 ? 2 : 1] ?? 0)
      else c.set(x0 + dx, y, PAPER[isTop ? 4 : isSide ? 1 : dx === 0 ? 3 : y === BELT_Y - 1 ? 2 : 3] ?? 0)
    }
  }
  for (const [dx, dy, k] of [[1, -2, 2], [2, -2, 3], [2, -1, 2], [5, -2, 3], [6, -2, 2], [5, -1, 2], [3, -1, 3], [4, -1, 2]] as const) {
    c.set(x0 + dx, top + dy, RIBBON[k] ?? 0)
  }
}

function beamAt(x: number, y: number): number {
  const u = x - y * 0.75
  return (u > 2 && u < 11 ? 1 : 0) + (u > 46 && u < 54 ? 1 : 0)
}

function drawRoom(c: Canvas, f: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const beam = beamAt(x, y)
      if (y < 26) {
        const panel = x % 16 === 0 ? -0.8 : 0
        c.set(x, y, shade(WALL, 2.6 - y * 0.02 + panel + beam * 1.4))
      } else {
        const seam = y === 26 ? -1 : 0
        c.set(x, y, shade(FLOOR, 2.4 + beam * 1.8 + seam + (y - 26) * 0.2))
      }
    }
  }
  for (const wx of [3, 49]) {
    c.rect(wx, 1, 13, 7, WALL[0] ?? 0)
    for (let y = 2; y <= 6; y++) {
      for (let x = wx + 1; x <= wx + 11; x++) {
        const isBar = (x - wx) % 4 === 0 || y === 4
        c.set(x, y, isBar ? (WALL[1] ?? 0) : (SUN[y < 4 ? 3 : 2] ?? 0))
      }
    }
    c.rect(wx, 8, 13, 1, WALL[4] ?? 0)
  }
  for (let x = 0; x < MACHINE_L; x++) {
    c.set(x, 11, shade(STEEL, 4 + beamAt(x, 11)))
    c.set(x, 12, shade(STEEL, 2.6 + beamAt(x, 12)))
    c.set(x, 13, STEEL[1] ?? 0)
    if (x % 9 === 4) {
      c.set(x, 10, STEEL[3] ?? 0)
      c.set(x, 14, STEEL[1] ?? 0)
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.round(lerp(0, W, hash(i, 1)) + wave(f, LOOP, 1, hash(i, 2)) * 2)
    const y = Math.round(lerp(2, 26, hash(i, 3)) + wave(f, LOOP, 2, hash(i, 4)) * 1.5)
    if (beamAt(x, y) > 0 && (x < MACHINE_L - 1 || x > MACHINE_R + 1)) c.set(x, y, SUN[3] ?? 0)
  }
}

function drawConveyor(c: Canvas, f: number): void {
  const run = belt(f)
  for (let x = 0; x < W; x++) {
    const tread = Math.round(x - run) % 4 === 0
    c.set(x, BELT_Y, RUBBER[tread ? 1 : 3] ?? 0)
    c.set(x, BELT_Y + 1, RUBBER[1] ?? 0)
    c.set(x, BELT_Y + 2, shade(STEEL, 4 + beamAt(x, BELT_Y + 2) * 0.8))
    c.set(x, BELT_Y + 3, shade(STEEL, 2.4))
    c.set(x, BELT_Y + 4, STEEL[1] ?? 0)
  }
  const spin = Math.floor(run / 2) % 4
  for (let rx = 4; rx < W; rx += 8) {
    c.set(rx, BELT_Y + 3, STEEL[0] ?? 0)
    const [sx, sy] = ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)[spin] ?? [1, 0]
    c.set(rx + sx, BELT_Y + 3 + sy, STEEL[6] ?? 0)
  }
  for (const lx of [8, 56]) {
    for (let y = BELT_Y + 5; y <= 29; y++) {
      c.set(lx, y, STEEL[3] ?? 0)
      c.set(lx + 1, y, STEEL[1] ?? 0)
    }
  }
  for (let x = 0; x < W; x++) {
    c.set(x, 28, shade(FLOOR, 1 + beamAt(x, 28) * 1.4))
  }
}

const GLOW = hex('2a0e08 5a1e0a 9a3e12 d0701e f0a040')

function drawMachine(c: Canvas, f: number): void {
  const k = f % CYCLE
  const j = jolt(k)
  const top = 7 + j
  for (let y = top; y <= BELT_Y + 2; y++) {
    for (let x = MACHINE_L; x <= MACHINE_R; x++) {
      if (y === top && (x === MACHINE_L || x === MACHINE_R)) continue
      const edgeL = x === MACHINE_L ? 1.4 : 0
      const edgeT = y === top ? 1.6 : 0
      const edgeR = x === MACHINE_R ? -1.4 : 0
      const plinth = y >= BELT_Y ? -2 : 0
      const seam = y === top + 2 ? -1.1 : 0
      c.set(x, y, shade(MINT, 3.6 + edgeL + edgeT + edgeR + plinth + seam - (y - top) * 0.04))
    }
  }
  for (const [x, y] of [[MACHINE_L + 1, top + 1], [MACHINE_R - 1, top + 1], [MACHINE_L + 1, BELT_Y - 1], [MACHINE_R - 1, BELT_Y - 1]] as const) {
    c.set(x, y, MINT[6] ?? 0)
  }

  const moving = k < 11 ? Math.sin((Math.PI * k) / 11) : 0
  for (const [mx, side] of [[MACHINE_L, 1], [MACHINE_R, -1]] as const) {
    const x0 = side === 1 ? mx : mx - 3
    for (let y = 14 + j; y < BELT_Y; y++) {
      for (let x = x0; x <= x0 + 3; x++) {
        const isFrame = y === 14 + j || x === x0 + (side === 1 ? 3 : 0)
        if (isFrame) c.set(x, y, HAZARD[(x + y) % 3 === 0 ? 0 : 1] ?? 0)
        else c.set(x, y, RUBBER[0] ?? 0)
      }
    }
    for (let i = 0; i < 2; i++) {
      const fx = x0 + (side === 1 ? 1 : 1) + i
      for (let y = 15 + j; y < BELT_Y - 1; y++) {
        const swing = Math.round(moving * (y - 14 - j) * 0.3) * side
        c.set(fx + swing, y, RUBBER[i === 0 ? 3 : 2] ?? 0)
      }
    }
  }

  const px = 32
  const py = top + 8
  c.disc(px, py, 3.6, (x, y) => shade(STEEL, 4.6 - (x - px) * 0.35 - (y - py) * 0.35))
  c.disc(px, py, 2.6, (x, y) => shade(GLOW, 2.4 - Math.hypot(x - px, y - py) * 0.5 + (k >= 15 && k < 24 ? 0.8 : 0)))
  const PIECES: readonly (readonly (readonly [number, number])[])[] = [
    [[-1, 0], [0, 0], [1, 0], [0, -1], [-1, 1], [0, 1], [1, 1], [2, 1]],
    [[-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 0], [0, 0], [1, 0]],
    [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  ]
  const drawPiece = (stage: number, shift: number) => {
    for (const [dx, dy] of PIECES[Math.min(2, stage)] ?? []) {
      const x = px + dx + shift
      if (Math.hypot(x - px, dy) > 2.6) continue
      const isRibbon = stage === 3 && dx === 0
      const color = stage === 3 ? (isRibbon ? RIBBON[2] : PAPER[dy < 0 ? 4 : 3]) : CLAY[dy < 0 || (stage < 2 && dy === 0) ? 4 : 3]
      c.set(x, py + dy, color ?? 0)
    }
  }
  if (k < 11) {
    const shift = Math.round(smoothstep(0, 11, k) * 6)
    drawPiece(3, shift)
    drawPiece(0, shift - 6)
  } else drawPiece(k < 15 ? 0 : k < 19 ? 1 : k < 25 ? 2 : 3, 0)
  c.set(px - 1, py - 2, 0xfff4e0)

  const gx = 25
  const gy = top + 4
  c.disc(gx, gy, 2.4, STEEL[3] ?? 0)
  c.disc(gx, gy, 1.7, PAPER[4] ?? 0)
  const kick = Math.max(pistonA(k), pistonB(k) * 1.2)
  const angle = -2.3 + kick * 2.2 + (k >= 24 && k < 31 ? 1.2 * (1 - (k - 24) / 7) : 0)
  c.set(gx, gy, RIBBON[1] ?? 0)
  c.set(gx + Math.round(Math.cos(angle) * 1.4), gy + Math.round(Math.sin(angle) * 1.4), RIBBON[2] ?? 0)
  const lamp = k >= 25 && k < 32 ? 'green' : k >= 12 && k < 25 ? (k % 4 < 2 ? 'red' : 'dim') : 'dim'
  const lit = lamp === 'green' ? [0x3ab070, 0x7af0a0, 0xc4f8d0] : lamp === 'red' ? [0xa82a26, 0xf0503c, 0xf8a088] : [0x241a1a, 0x3a2a2a, 0x3a2a2a]
  c.set(39, top + 3, lit[1] ?? 0)
  c.set(40, top + 3, lit[1] ?? 0)
  c.set(39, top + 4, lit[0] ?? 0)
  c.set(40, top + 4, lit[0] ?? 0)
  if (lamp !== 'dim') c.set(39, top + 3, lit[2] ?? 0)
  for (let y = top + 12; y <= top + 14; y += 2) {
    for (let x = 28; x <= 36; x++) c.set(x, y, MINT[1] ?? 0)
  }

  for (const [hx, s] of [[24, pistonA(k)], [33, pistonB(k)]] as const) {
    const capY = Math.round(lerp(0, 3, s)) + j
    for (let y = capY + 2; y < top - 2; y++) {
      c.set(hx + 1, y, STEEL[7] ?? 0)
      c.set(hx + 2, y, STEEL[5] ?? 0)
      c.set(hx + 3, y, STEEL[3] ?? 0)
    }
    for (let x = hx - 1; x <= hx + 5; x++) {
      c.set(x, capY, shade(STEEL, 5.4 - (x - hx) * 0.4))
      c.set(x, capY + 1, shade(STEEL, 3.4 - (x - hx) * 0.3))
    }
    for (let y = top - 2; y < top; y++) {
      for (let x = hx - 1; x <= hx + 5; x++) {
        c.set(x, y, shade(STEEL, 3.6 + (x === hx - 1 ? 1.4 : 0) - (x === hx + 5 ? 1.4 : 0) - (y === top - 1 ? 0.8 : 0)))
      }
    }
  }
  c.rect(MACHINE_R + 1, top + 2, 2, 3, STEEL[4] ?? 0)
  c.set(MACHINE_R + 1, top + 2, STEEL[6] ?? 0)
  c.rect(MACHINE_R + 3, top + 1, 1, 5, STEEL[3] ?? 0)
  c.set(MACHINE_R + 3, top + 1, STEEL[5] ?? 0)

  for (const at of [15, 19]) {
    const t = k - at
    if (t < 0 || t > 4) continue
    for (const [dx, dir] of [[MACHINE_L - 1, -1], [MACHINE_R + 1, 1]] as const) {
      const x = dx + dir * (1 + t * 0.8)
      const y = BELT_Y + 1 - t * 0.5
      c.set(x, y, shade(FLOOR, 4.5 - t * 0.6))
      if (t < 3) c.set(x + dir, y + 1, shade(FLOOR, 4 - t * 0.6))
    }
  }
}

function drawSteam(c: Canvas, f: number): void {
  const k = f % CYCLE
  const puffs: [number, number, number, number][] = []
  for (let i = 0; i < 6; i++) {
    const t = (k - 25 - i * 0.8) / 8
    if (t < 0 || t >= 1) continue
    const r = (1.2 + i * 0.3) * (0.7 + ease.out(Math.min(1, t * 2.5)) * 0.9) * (1 - ease.in(beat(t, 0.55, 1)))
    const reach = ease.out(t) * (9 + i * 2.2)
    puffs.push([46 + reach, 10 - reach * 0.3 - t * 2 + (i % 2) * 1.2, r, t])
  }
  for (const born of [3, 14]) {
    const t = (k - born) / 12
    if (t < 0 || t >= 1) continue
    puffs.push([46 + t * 3, 10 - t * 3, 1 * (1 - t) + 0.3, 0.5 + t * 0.5])
  }
  for (const [x, y, r, t] of puffs.reverse()) {
    if (r < 0.5) continue
    c.disc(x, y, r, (px, py) => {
      const d = Math.hypot(px - x, py - y) / r
      const under = (py - y) / r * 0.7 + (px - x) / r * 0.4
      return shade(STEAM, 3.1 - Math.max(0, under) * 1.6 - (d > 0.75 && under > 0.1 ? 0.8 : 0) - t * 1.1)
    })
  }
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    drawRoom(c, f)
    drawConveyor(c, f)
    const k = f % CYCLE
    const run = belt(f)
    const settle = [0.5, 1, 1, 0.6, 0.3][k - 10] ?? 0
    for (let i = -4; i <= 4; i++) {
      const x = 8 + i * SPACING + run
      if (x < -8 || x > W + 8) continue
      const kind = ((i % 2) + 2) % 2
      if (x < 32) drawLump(c, x, kind, settle)
      else drawBox(c, x + 1)
    }
    drawMachine(c, f)
    drawSteam(c, f)
    out.push(c.px)
  }
  return out
}

const WRAPPED = 'In the porthole the round clay becomes a wrapped parcel, the payoff of the cycle.'
const BLAST = 'Steam blasts from the whistle: billows shot out of the valve faster than they can be followed.'

export const scene: Scene = {
  verb: 'Processing',
  render,
  hero: 29,
  snaps: [
    { frames: 25, box: [30, 13, 34, 17], colors: [...CLAY, ...PAPER, ...RIBBON], why: WRAPPED },
    { frames: 25 + CYCLE, box: [30, 13, 34, 17], colors: [...CLAY, ...PAPER, ...RIBBON], why: WRAPPED },
    { frames: [26, 29], box: [44, 6, 54, 14], colors: STEAM, why: BLAST },
    { frames: [26 + CYCLE, 29 + CYCLE], box: [44, 6, 54, 14], colors: STEAM, why: BLAST },
  ],
}
