import { Canvas, clamp, hash, hex, lerp, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('2c1e1c 3e2a24 54382c 6c4a36 886044 a47a52')
const WOOD = hex('1e1214 2f1b19 46271e 653726 8a4c2e b06838 d68f4c')
const BOARD = hex('0d1a16 13241d 1a3025 223c2c 2c4a34 385a3e')
const CHALK = hex('6d8a7a 9fb8a8 d0dece f2f6ec')
const RED = hex('3a0810 6a0f16 a01a1c cf2a20 ec4a2a f87a46 fcae7a')
const YELLOW = hex('7a4a08 c08a14 eec03a fde27a')
const BLUE = hex('0c1846 152c78 2048ac 3670d6 62a2ee')
const FACE = hex('8e8a8e c8c2c0 eeeae4 fffcf6')
const BEAK = hex('1c1818 3a3230 6a6058 b4a894 e2d8c4 fbf4e6')
const MOUTH = hex('3a0e1a 6a2030 b0505a')
const GREY = hex('2a2830 4a4650 6e6a72 9a96a0')
const CAP = hex('0b0b12 16161f 24242f 383848')
const GOLD = hex('8a5a10 d29a28 f8d466')

const BOARD_X0 = 2
const BOARD_X1 = 61
const BOARD_Y0 = 2
const BOARD_Y1 = 20
const PERCH_Y = 22
const FEET_X = 46

const A: [number, number] = [21, 6]
const B: [number, number] = [16, 12]
const C: [number, number] = [29, 15]

type Key = [frame: number, value: number, isStrike?: boolean]

const smooth = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t)
const strike = (t: number) => t * t

function keyed(keys: readonly Key[], f: number): number {
  for (let i = 0; i < keys.length; i++) {
    const [f0, v0] = keys[i] as Key
    const [f1, v1, isStrike] = (keys[i + 1] ?? [LOOP + (keys[0]?.[0] ?? 0), keys[0]?.[1] ?? 0]) as Key
    if (f >= f0 && f < f1) return lerp(v0, v1, (isStrike ? strike : smooth)((f - f0) / (f1 - f0)))
  }
  return keys[0]?.[1] ?? 0
}

const JAB_A = 18
const JAB_B = 30
const SLAM = 48

const LEAN: Key[] = [[0, 0], [6, 0], [13, -0.5], [14, -0.5], [JAB_A, 0.7, true], [22, 0.2], [25, -0.5], [26, -0.5], [JAB_B, 0.7, true], [34, 0.2], [44, -1.1], [45, -1.1], [SLAM, 1, true], [54, 0.8], [63, 0.1], [68, 0]]
const PUFF: Key[] = [[0, 0], [16, 0], [JAB_A, 0.4], [22, 0.1], [28, 0.1], [JAB_B, 0.45], [34, 0.1], [36, 0.15], [44, 0.6], [SLAM, 1], [54, 0.9], [66, 0]]
const TIP_X: Key[] = [[0, C[0]], [6, C[0]], [13, 30], [14, 30], [JAB_A, A[0], true], [22, A[0]], [25, 25], [26, 25], [JAB_B, B[0], true], [34, B[0]], [44, 37], [45, 37], [SLAM, C[0], true], [54, C[0]]]
const TIP_Y: Key[] = [[0, C[1]], [6, C[1]], [13, 3], [14, 3], [JAB_A, A[1], true], [22, A[1]], [25, 7], [26, 7], [JAB_B, B[1], true], [34, B[1]], [44, -3], [45, -3], [SLAM, C[1], true], [54, C[1]]]

const SQUAWKS = [[JAB_A, JAB_A + 2], [JAB_B, JAB_B + 2], [SLAM, SLAM + 7]] as const

type Pose = { lean: number; puff: number; beak: number; tip: [number, number]; cap: number; trail: number }

const HOP = [0, 1.5, 3, 3.5, 3, 1.5, 0, 0.8, 0]

function poseAt(f: number): Pose {
  return {
    lean: keyed(LEAN, f),
    puff: keyed(PUFF, f),
    beak: SQUAWKS.some(([f0, f1]) => f >= f0 && f <= f1) ? 1 : 0,
    tip: [keyed(TIP_X, f), keyed(TIP_Y, f)],
    cap: HOP[f - SLAM] ?? 0,
    trail: [1, 2, 3, 4, 5].reduce((sum, k) => sum + keyed(LEAN, mod(f - k, LOOP)), 0) / 5,
  }
}

type Part = 'head' | 'face' | 'eye' | 'body' | 'red' | 'yellow' | 'blue' | 'tail' | 'tailTip' | 'tuft'
type Hit = { part: Part; nx: number; ny: number }

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, angle: number): [boolean, number, number] {
  const dx = x - cx
  const dy = y - cy
  const u = (dx * Math.cos(angle) + dy * Math.sin(angle)) / rx
  const v = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / ry
  return [u * u + v * v <= 1, u, v]
}

function frame(p: Pose) {
  const bx = FEET_X + 0.5 - p.lean * 1.4
  const by = PERCH_Y - 7.5
  const hx = FEET_X - 2.2 - p.lean * 3
  const hy = PERCH_Y - 14.2 + Math.max(0, -p.lean) * 0.6
  const angle = -0.28 - p.lean * 0.18
  return { bx, by, hx, hy, angle, hr: 3.4 + p.puff * 0.5 }
}

function parrotAt(x: number, y: number, p: Pose): Hit | undefined {
  const { bx, by, hx, hy, angle, hr } = frame(p)
  const px = x + 0.5
  const py = y + 0.5
  const head = Math.hypot(px - hx, py - hy) <= hr
  if (head) {
    if (Math.abs(px - (hx - 1.3)) < 0.6 && Math.abs(py - (hy - 0.2)) < 0.6) return { part: 'eye', nx: 0, ny: 0 }
    const [isFace] = ellipse(px, py, hx - 1.5, hy + 0.6, 1.7, 1.6, 0)
    return { part: isFace ? 'face' : 'head', nx: (px - hx) / hr, ny: (py - hy) / hr }
  }
  const [isWing, wu, wv] = ellipse(px, py, bx + 1.6, by + 1.6, 2.9, 5.6, angle)
  if (isWing) return { part: wv < -0.15 ? 'red' : wv < 0.25 ? 'yellow' : 'blue', nx: wu, ny: wv }
  const [isBody, u, v] = ellipse(px, py, bx - 0.3, by, 4.6 + p.puff * 0.8, 6 + p.puff * 0.5, angle)
  if (isBody) return { part: 'body', nx: u, ny: v }
  const t0x = bx + 1.8
  const t0y = by + 5
  const t1x = FEET_X + 6 - p.trail * 1.5
  const t1y = PERCH_Y + 10
  const along = ((px - t0x) * (t1x - t0x) + (py - t0y) * (t1y - t0y)) / ((t1x - t0x) ** 2 + (t1y - t0y) ** 2)
  if (along >= 0 && along <= 1) {
    const cx = lerp(t0x, t1x, along)
    const cy = lerp(t0y, t1y, along)
    const half = lerp(1.7, 0.6, along)
    if (Math.hypot(px - cx, py - cy) <= half) return { part: along > 0.62 ? 'tailTip' : 'tail', nx: (px - cx) / half, ny: along }
  }
  if (p.puff > 0.25) {
    const [nearBody] = ellipse(px, py, bx, by, 5 + p.puff * 0.8, 6.8 + p.puff * 0.5, angle)
    const nearHead = Math.hypot(px - hx, py - hy) <= hr + 1
    if ((nearBody || nearHead) && hash(x, y, 3) < p.puff * 0.45 && py < by + 2) return { part: 'tuft', nx: 0, ny: 0 }
  }
  return undefined
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const p = poseAt(f)
    const { bx, by, hx, hy } = frame(p)
    const gx = Math.round(bx - 4 - p.lean * 0.6)
    const gy = Math.round(by + 2.5)

    const sun = (x: number, y: number) => {
      const u = x - y * 0.55
      if (y < 3 || y > 30 || u < 0 || u > 27) return 0
      if (Math.abs(u - 13.5) < 0.8 || y === 12) return 0.15
      return u < 1 || u > 26 || y === 3 ? 0.5 : 1
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lit = sun(x, y)
        const shadow = parrotAt(x - 3, y - 1, p) ? 1.3 : 0
        let col: number
        if (x >= BOARD_X0 && x <= BOARD_X1 && y >= BOARD_Y0 && y <= BOARD_Y1) {
          const smudge = mod(x * 0.6 + y * 1.4, 13) < 2.2 && x > 34 ? 0.6 : 0
          col = shade(BOARD, 1.5 + lit * 2.2 + smudge - shadow)
        } else if (x >= BOARD_X0 - 1 && x <= BOARD_X1 + 1 && y >= BOARD_Y0 - 1 && y <= BOARD_Y1 + 1) {
          const isLitEdge = y === BOARD_Y0 - 1 || x === BOARD_X0 - 1
          col = shade(WOOD, (isLitEdge ? 4 : 2.6) + lit * 1.5)
        } else if (y === BOARD_Y1 + 2) {
          col = shade(WOOD, 4.4 + lit * 1.4)
        } else if (y === BOARD_Y1 + 3) {
          col = shade(WOOD, 1.6 + lit)
        } else if (y > BOARD_Y1 + 3) {
          const panel = mod(x - 2, 12)
          const rail = y === BOARD_Y1 + 4 || y === H - 1
          const stile = panel === 0 || panel === 1
          col = shade(WOOD, (rail ? 3 : stile ? 2.6 : panel === 2 ? 1.4 : 2) + lit * 1.2 - shadow * 0.6)
        } else {
          col = shade(WALL, 2.4 + lit * 1.8 - shadow * 0.8)
        }
        c.set(x, y, col)
      }
    }

    const chalk = (x: number, y: number, level = 2) => {
      if (c.get(x, y) !== 0) c.set(x, y, shade(CHALK, level + sun(x, y) * 0.8))
    }
    for (const [row, x0, x1] of [[5, 5, 26], [8, 5, 19], [11, 5, 22], [5, 49, 59], [8, 51, 58]] as const) {
      for (let x = x0; x <= x1; x++) {
        if (hash(Math.floor((x + row) / 5), row) < 0.22 && mod(x + row, 5) === 0) continue
        if (mod(x + row * 2, 7) === 6) continue
        const dy = Math.round(Math.sin(x * 1.9 + row * 1.3) * 0.7)
        chalk(x, row + dy)
        if (mod(x * 3 + row, 4) === 0) chalk(x, row + dy - 1, 1)
      }
    }
    for (let x = 5; x <= 26; x++) if (x % 3 !== 2) chalk(x, 14, 1)
    for (let x = 17; x <= 24; x++) chalk(x, 17)
    chalk(23, 16)
    chalk(22, 15)
    chalk(23, 18)
    chalk(22, 19)
    for (let i = 0; i < 7; i++) {
      chalk(26 + i, 12)
      chalk(26 + i, 18)
      chalk(26, 12 + i)
      chalk(32, 12 + i)
    }
    for (const [x, y] of [[28, 14], [30, 14], [29, 16], [28, 17], [31, 16]] as const) chalk(x, y, 1)
    chalk(34, 19, 1)
    chalk(35, 18, 1)
    for (const [x, col] of [[8, CHALK[3]], [9, CHALK[3]], [12, CHALK[2]], [20, WOOD[2]], [21, 0x3a3a52], [22, 0x3a3a52], [23, 0x3a3a52]] as const) {
      c.set(x, BOARD_Y1 + 1, col ?? 0)
    }

    for (let x = 36; x <= 56; x++) {
      c.set(x, PERCH_Y, shade(WOOD, x === 36 ? 3 : 5))
      c.set(x, PERCH_Y + 1, shade(WOOD, 2.2))
    }
    for (let y = PERCH_Y + 2; y < H; y++) {
      c.set(50, y, shade(WOOD, 4))
      c.set(51, y, shade(WOOD, 2.4))
    }

    const [tx, ty] = p.tip
    const len = Math.hypot(tx - gx, ty - gy)
    const back = 4 / Math.max(1, len)
    c.line(gx + (gx - tx) * back, gy + (gy - ty) * back, tx, ty, WOOD[5] ?? 0)
    c.set(Math.round(tx), Math.round(ty), 0x161212)

    for (let y = -4; y < H; y++) {
      for (let x = 28; x < W; x++) {
        const hit = parrotAt(x, y, p)
        if (!hit) continue
        const edgeL = !parrotAt(x - 1, y, p) || !parrotAt(x, y - 1, p)
        const edgeR = !parrotAt(x + 1, y, p) || !parrotAt(x, y + 1, p)
        const light = -hit.nx * 0.9 - hit.ny * 0.6 + (edgeL ? 1 : 0) - (edgeR ? 1.1 : 0)
        let col: number
        switch (hit.part) {
          case 'eye': col = f === 3 || f === 4 ? shade(FACE, 1) : 0x0c0808; break
          case 'face': col = shade(FACE, 2.4 + light * 0.6); break
          case 'head': col = shade(RED, 3.4 + light); break
          case 'body': col = shade(RED, 3 + light); break
          case 'red': col = shade(RED, 3.2 + light * 0.8); break
          case 'yellow': col = shade(YELLOW, 2 + light * 0.8); break
          case 'blue': col = shade(BLUE, 2.4 + light * 0.8 - (mod(Math.floor(hit.nx * 2.2), 2) === 0 ? 0.6 : 0)); break
          case 'tail': col = shade(RED, 2.6 - hit.nx * 0.8 + (edgeR ? -0.8 : 0)); break
          case 'tailTip': col = shade(BLUE, 2.6 - hit.nx * 0.8); break
          case 'tuft': col = shade(RED, 2.4); break
        }
        c.set(x, y, col)
      }
    }

    const kx = Math.round(hx - 3.6) - 3
    const ky = Math.round(hy - 1.6)
    const beakPaint = { u: BEAK[4] ?? 0, U: BEAK[5] ?? 0, s: BEAK[3] ?? 0, l: BEAK[1] ?? 0, L: BEAK[2] ?? 0, m: MOUTH[0] ?? 0, t: MOUTH[2] ?? 0 }
    c.sprite(kx, ky, p.beak ? ['.UUuu', 'Uuuuu', 'us.mm', 's.mtm', '..llL', '...lL'] : ['.UUuu', 'Uuuuu', 'uusLL', 's.lll', '...l.'], beakPaint)
    const capX = Math.round(hx) - 3
    const capY = Math.round(hy - 3.4 - 1.6 - p.cap)
    for (let i = 0; i < 7; i++) {
      c.set(capX + i, capY, shade(CAP, i < 2 ? 3 : 2))
      c.set(capX + i + 1, capY + 1, shade(CAP, 1))
    }
    for (let i = 2; i < 6; i++) c.set(capX + i, capY + 2, shade(CAP, 0.5))
    const swing = clamp((p.trail - p.lean) * 2 + p.cap * 0.5 + (f < 8 ? Math.sin((f / 8) * Math.PI) * 0.6 : 0), -1.5, 1.5)
    c.set(capX + 4, capY - 1, GOLD[1] ?? 0)
    c.line(capX + 7, capY + 1, Math.round(capX + 8 + swing), capY + 3, GOLD[1] ?? 0)
    c.set(Math.round(capX + 8 + swing), capY + 4, GOLD[2] ?? 0)

    for (const dx of [-1, 0, 1]) c.set(FEET_X + dx, PERCH_Y - 1 + (dx === 0 ? 0 : 1), shade(GREY, 2 - dx * 0.5))
    c.set(gx, gy, shade(GREY, 2.6))
    c.set(gx + 1, gy, shade(GREY, 1.6))
    c.set(gx, gy + 1, shade(GREY, 1.4))

    if (p.beak) {
      const big = f >= SLAM
      const r = big ? 2 + mod(f - SLAM, 3) * 0.5 : 2
      const ox = kx
      const oy = ky + 3
      for (const [dx, dy] of [[-0.8, -0.7], [-1, 0.05], [-0.8, 0.75]] as const) {
        const len = big ? Math.min(2.4, 1.2 + (f - SLAM) * 0.6) : 1.2
        c.line(ox + dx * r, oy + dy * r, ox + dx * (r + len), oy + dy * (r + len), big ? 0xfff2c8 : (CHALK[3] ?? 0))
      }
    }

    for (const [at, [sx, sy], n] of [[JAB_A, A, 5], [JAB_B, B, 5], [SLAM, C, 9]] as const) {
      const age = f - at
      if (age < 0 || age > 9) continue
      for (let k = 0; k < n; k++) {
        const ang = Math.PI * (0.6 + 1.6 * hash(k, at))
        const sp = 0.6 + hash(at, k) * 0.8
        const x = sx + Math.cos(ang) * sp * age
        const y = sy + Math.sin(ang) * sp * age * 0.7 + age * age * 0.05
        if (age > 6 && (k + age) % 2) continue
        c.set(x, y, shade(CHALK, 3 - age * 0.3))
      }
    }

    for (let k = 0; k < 6; k++) {
      const x = Math.round(6 + hash(k, 1) * 26 + Math.sin((f / LOOP) * Math.PI * 2 + k) * 2)
      const y = Math.round(mod(3 + hash(k, 2) * 26 + (f / LOOP) * 6 * (k % 2 ? 1 : -1), 26) + 3)
      if (sun(x, y) >= 1 && !parrotAt(x, y, p)) c.tint(x, y, 0xfff0c0, 0.4)
    }

    if (f >= SLAM) {
      const t = f - SLAM
      const x = Math.round(52 + Math.sin(t * 0.5) * 2.5 + t * 0.15)
      const y = Math.round(6 + t * 1.45)
      const isTilted = Math.floor(t / 3) % 2 === 0
      c.set(x, y, RED[4] ?? 0)
      c.set(x + (isTilted ? 1 : -1), y + 1, RED[3] ?? 0)
      c.set(x + (isTilted ? 2 : -2), y + 2, BLUE[3] ?? 0)
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Pontificating',
  render,
  hero: SLAM + 1,
  snaps: [
    { frames: SLAM, box: [30, 15, 39, 17], colors: [WOOD[5] ?? 0], why: 'the pointer slams down onto the cracker' },
  ],
}
