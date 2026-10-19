import { Canvas, TAU, beat, clamp, ease, hash, hex, loopNoise, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('4f94d0 66a8dc 80bce6 9ccfee bce0f4 daeef8')
const CLOUD = hex('a8c8e0 cfe2f0 eef6fb ffffff')
const HAZE = hex('6c9cbc 86b2cc a2c6d8')
const SEA = hex('0b4f6c 106684 177e9a 2398ae 3eb2be 6ccac8 a6e2d8 d8f6ee')
const FOAM = hex('9ccfd0 cdeae6 f0fbf6 ffffff')
const SAND = hex('5e4c5c 7e6670 a08478 c2a386 dcbf98 ecd6ac f8eac8')
const WET = hex('4a3c4c 66525a 846c6c a28a7e 8ab4c0 b6d6dc')
const SHELL = hex('9a6a6a d8a0a0 f6dcd0')
const SHELL_DARK = 0x6a4a52
const SHELL_TONE = SHELL
const SHELL_LIGHT = 0xfff4ea
const CARAPACE = hex('0a1420 12263a 1b3c58 245878 307a98 50a4bc 8ad0dc')
const CLAW = hex('4e1a12 7e2e16 ae4a1c d46e26 ec983c f6c26a fce6aa fffbe8')
const PEBBLE = hex('3a3442 56505e 787280 9a94a0 bcb8c0 dedce0')
const QUARTZ = hex('c8b6a0 eee0c8 fffaf0')
const INK = 0x1a1018
const EYE = 0x0c0a12

const sunDir = { x: -0.55, y: -0.75, z: 0.37 }

const sine = (p: number) => (1 - Math.cos(Math.PI * p)) / 2
const sineIn = (p: number) => 1 - Math.cos((Math.PI / 2) * p)

function reach(f: number): number {
  if (f < 16) return 0
  if (f < 34) return sine(beat(f, 16, 34))
  if (f < 44) return 1
  return 1 - sine(beat(f, 44, 70))
}
const SHORE = 12
const RUN = 6
const front = (f: number) => SHORE + RUN * reach(f)
const damp = (f: number) => (f < 44 ? 0 : 1 - beat(f, 50, 94))

const REST = 145
const HIGH = 250
const LAND = 75
const CLAW_KEYS: readonly (readonly [number, number, (p: number) => number])[] = [
  [21, REST, sine],
  [25, REST - 10, sine],
  [43, HIGH, sine],
  [45, HIGH, sine],
  [51.5, HIGH - 25, sine],
  [58, HIGH, sine],
  [61, HIGH, sine],
  [LAND, REST, (p) => 0.5 * sineIn(p) + 0.5 * p * p],
]
function clawAngle(f: number): number {
  if (f >= LAND && f < LAND + 5) return REST + 7 * Math.sin(Math.PI * beat(f, LAND, LAND + 5))
  for (let i = 1; i < CLAW_KEYS.length; i++) {
    const [f0, a0] = CLAW_KEYS[i - 1] ?? [0, REST]
    const [f1, a1, curve] = CLAW_KEYS[i] ?? [0, REST, sine]
    if (f < f0) return a0
    if (f < f1) return a0 + (a1 - a0) * curve(beat(f, f0, f1))
  }
  return REST
}
const gapeOf = (f: number) => (f < 50 ? beat(f, 40, 43) : 1 - beat(f, 58, 61))

const TURNS: readonly (readonly [number, number])[] = [[2, 7], [10, 15], [81, 86], [88, 93]]
function turning(f: number): { angle: number; push: number } {
  let angle = 0
  let push = 0
  for (const [a, z] of TURNS) {
    const p = beat(f, a, z)
    angle += ease.inOut(p) * (TAU / 4)
    if (p > 0 && p < 1) push = Math.sin(Math.PI * p)
  }

  return { angle, push }
}

type Layer = Int32Array

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const t = f / LOOP
    const fr = front(f)
    const r = reach(f)
    const d = damp(f)

    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, 0.4 + y * 0.75, x, y))
    }
    for (const [cx, cy, s] of [[12, 2.6, 1], [44, 1.8, 0.8]] as const) {
      for (const [dx, dy, r] of [[0, 0, 2.2], [2.6, -0.8, 2], [5, 0.2, 1.8], [-2.4, 0.6, 1.5]] as const) {
        c.ellipse(cx + dx * s, cy + dy, r * s * 1.2, r * 0.8, (x, y) => (y > cy + 1 ? undefined : shade(CLOUD, 3 - (y - cy + 1.5) * 0.9 - (x - cx) * 0.05, x, y)))
      }
    }
    for (let x = 47; x < 62; x++) {
      const top = 6 - Math.round(Math.max(0, 1.6 - Math.abs(x - 52) * 0.25) + (x > 55 ? Math.max(0, 1 - Math.abs(x - 58) * 0.5) : 0))
      for (let y = top; y < 7; y++) c.set(x, y, shade(HAZE, y === top ? 2 : 1, x, y))
    }

    for (let y = 7; y < SHORE; y++) {
      for (let x = 0; x < W; x++) {
        const swell = Math.sin(x * 0.3 + y * 1.7 + TAU * t * 2) > 0.75 ? 0.8 : 0
        c.set(x, y, shade(SEA, 1 + (y - 7) * 0.9 + swell, x, y))
      }
    }
    for (const [i, [gx, gy]] of ([[6, 8], [19, 9], [29, 7], [37, 10], [50, 8], [58, 10], [24, 11], [44, 9]] as const).entries()) {
      const s = Math.sin(TAU * (t * 3 + hash(i, 4)))
      if (s > 0.55) c.set(gx, gy, SEA[7] ?? 0)
      if (s > 0.85) c.set(gx + 1, gy, SEA[6] ?? 0)
    }
    const crest = f >= 8 && f < 20 ? Math.sin(Math.PI * beat(f, 8, 20)) : 0
    for (let x = 0; x < W; x++) {
      if (crest > threshold(x, SHORE - 1) * 1.1) c.set(x, SHORE - 1, shade(FOAM, 1 + crest * 2, x, SHORE - 1))
    }

    for (let y = SHORE; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lobe = loopNoise(x * 0.16, 0.5, t, 2, 3) * 2.4 - 1.2
        const scallop = (loopNoise(x * 0.16, 0.5, t, 2, 3) - 0.46) * 3 + (loopNoise(x * 0.42, 2.5, t, 2, 11) - 0.46) * 3
        const edge = fr + scallop - 2.5 * (1 - r)
        const rest = SHORE + lobe * 0.6
        const wetEdge = Math.max(edge + 0.5, rest + d * (RUN + 0.5 + scallop - lobe * 0.6))
        if (y < edge - 1.5) {
          const sheen = Math.sin(x * 0.5 - y * 1.3 + f * 0.5) > 0.7 ? 1 : 0
          c.set(x, y, shade(SEA, 5.4 - (y - SHORE) * 0.25 + sheen, x, y))
          continue
        }
        if (y < edge + 0.5) {
          const lace = y < edge - 0.5 && loopNoise(x * 0.5, y * 0.5, t, 3, 9) < 0.42
          c.set(x, y, lace ? shade(SEA, 6, x, y) : shade(FOAM, 2.6 - (y < edge - 0.5 ? 0.8 : 0), x, y))
          continue
        }
        const ripple = (y + Math.sin(x * 0.22) * 0.9) % 3 < 0.8 ? -0.6 : 0
        const near = (y - SHORE) * 0.08
        if (y < wetEdge) {
          const glint = y === Math.floor(wetEdge) - 1 && hash(x, 7) < 0.25 ? 2 : 0
          c.set(x, y, shade(WET, 2.6 + ripple * 0.5 + glint, x, y))
          continue
        }
        c.set(x, y, shade(SAND, 4.4 + ripple + near, x, y))
      }
    }
    for (const [x, y] of [[50, 27], [52, 25], [54, 27]] as const) {
      c.set(x, y, shade(SAND, 2.8, x, y))
      c.set(x + 1, y, shade(SAND, 3.6, x, y))
    }
    c.sprite(55, 22, ['.bbbb.', 'baaaab', '.cccc.'], { a: SAND[0] ?? 0, b: SAND[2] ?? 0, c: SAND[6] ?? 0 })
    for (const [x, y] of [[53, 22], [61, 22], [62, 24], [58, 26], [52, 23]] as const) {
      c.set(x, y, SAND[6] ?? 0)
      c.set(x, y + 1, SAND[2] ?? 0)
    }
    c.sprite(6, 26, ['.ab', 'bcb', 'dbd'], { a: SHELL_LIGHT, b: SHELL_TONE[1] ?? 0, c: SHELL_TONE[2] ?? 0, d: SHELL_DARK })

    const theta = (clawAngle(f) * Math.PI) / 180
    const isAlert = f >= 21 && f < LAND - 4
    const bob = f >= 25 && f < 62 ? -1 : 0
    const turn = turning(f)
    const layer: Layer = new Int32Array(W * H).fill(-1)
    const put = (x: number, y: number, color: number) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) layer[iy * W + ix] = color
    }

    const shadowAt = (x: number, y: number, rx: number, ry: number) => {
      c.ellipse(x, y, rx, ry, (px, py) => {
        const v = c.get(px, py)
        return SAND.includes(v) ? shade(SAND, SAND.indexOf(v) - 1.6, px, py) : WET.includes(v) ? shade(WET, WET.indexOf(v) - 1, px, py) : undefined
      })
    }
    shadowAt(36, 28.6, 10, 1.5)
    shadowAt(37.5, 30.2, 4.5, 1)
    const palmX = 28 + Math.cos(theta) * 8
    const palmY = 20 + Math.sin(theta) * 8
    shadowAt(palmX + (palmY < 20 ? 4 : 1.5), 29.4 + (palmY < 20 ? 0.6 : 0), palmY < 20 ? 3.4 : 5, 1)

    const legs: readonly (readonly [number, number, number, number, number, number])[] = [
      [28, 21, 23, 19, 20, 27], [28, 22, 24, 21, 22, 28], [29, 23, 26, 23, 25, 28],
      [40, 21, 45, 19, 48, 27], [40, 22, 44, 21, 46, 28], [39, 23, 42, 23, 43, 28],
    ]
    const legLayer: [number, number, number][] = []
    for (const [ax, ay, kx, ky, fx, fy] of legs) {
      const lc = new Canvas()
      lc.line(ax, ay + bob, kx, ky + bob, 1)
      lc.line(kx, ky + bob, fx, fy, 1)
      for (let i = 0; i < W * H; i++) {
        if (lc.px[i] === 1) legLayer.push([i % W, Math.floor(i / W), (i % W) === kx && Math.floor(i / W) === ky + bob ? 1 : 0])
      }
    }

    const shell: readonly (readonly [number, number, number])[] = [
      [17, 29, 39], [18, 27, 41], [19, 27, 41], [20, 27, 41], [21, 27, 41], [22, 28, 40], [23, 30, 38],
    ]
    for (const [y, x0, x1] of shell) {
      for (let x = x0; x <= x1; x++) {
        const rel = (x - x0) / (x1 - x0)
        const spot = (y === 19 && (x === 30 || x === 31 || x === 37)) || (y === 20 && (x === 36 || x === 33 || x === 34)) ? 1.2 : 0
        const level = (y === 17 ? 5.6 : y === 18 ? 4.4 : y >= 22 ? 1.6 : 3) - rel * 1.4 + spot
        put(x, y + bob, shade(CARAPACE, level, x, y))
      }
    }
    put(33, 22 + bob, CARAPACE[0] ?? 0)
    put(34, 22 + bob, CARAPACE[0] ?? 0)
    put(35, 22 + bob, CARAPACE[0] ?? 0)

    const stalk = isAlert ? 5 : f === 20 || f === LAND - 4 ? 3 : 4
    for (const sx of [31, 37]) {
      const lean = isAlert ? 0 : 1
      for (let j = 1; j <= stalk; j++) {
        const x = sx + (j > stalk - 2 ? lean : 0)
        put(x, 17 - j + bob, shade(CARAPACE, 4 - j * 0.2, x, 0))
      }
      const ex = sx + lean
      const ey = 17 - stalk - 1 + bob
      put(ex, ey, EYE)
      put(ex, ey - 1, EYE)
      put(ex + (isAlert ? 0 : 1), ey - 1, isAlert ? EYE : EYE)
      put(ex, ey - 1, 0xe8f4f4)
    }

    const tipX = 39 - 2 * turn.push
    const tipY = 26 - 1.5 * turn.push
    const arm = new Canvas()
    arm.line(39, 21 + bob, 42, 24 + bob, 1)
    arm.line(42, 24 + bob, tipX + 1, tipY, 1)
    for (let i = 0; i < W * H; i++) if (arm.px[i] === 1) put(i % W, Math.floor(i / W), CLAW[3] ?? 0)
    put(tipX, tipY, CLAW[5] ?? 0)
    put(tipX, tipY + 1, CLAW[4] ?? 0)

    const px = 28
    const py = 20 + bob
    const gape = gapeOf(f)
    const sweep = (clawAngle(f + 1) - clawAngle(f - 1)) / 2
    const trail = Math.sign(sweep) * Math.max(0, 2 * (Math.abs(sweep) - 8))
    const samples = Math.ceil(Math.abs(trail) / 2)
    for (let j = samples; j >= 0; j--) {
      const at = theta - ((trail * j) / Math.max(1, samples)) * (Math.PI / 180)
      const ux = Math.cos(at)
      const uy = Math.sin(at)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = x - px
          const dy = y - py
          const u = dx * ux + dy * uy
          const v = -dx * uy + dy * ux
          if (u < 0 || u > 17.5) continue
          let half = 0
          let mid = 0
          let part = 0
          if (u < 4.5) {
            half = 1.3
            part = 0
          } else if (u < 11.5) {
            half = 3.2 * Math.sqrt(clamp(1 - ((u - 8) / 4.6) ** 2)) + 0.4
            part = 1
          } else {
            const k = (u - 11.5) / 6
            const open = gape * k * 1.6
            const upper = { mid: -1.5 - open + k * 0.9, half: Math.max(0.6, 1.4 * (1 - k * 0.75)) }
            const lower = { mid: 1.4 + open * 0.6 - k * 0.6, half: Math.max(0.6, 1.3 * (1 - k * 0.85)) }
            const isUpper = Math.abs(v - upper.mid) <= upper.half && u < 17.5
            const isLower = Math.abs(v - lower.mid) <= lower.half && u < 16.5
            if (!isUpper && !isLower) continue
            const g = isUpper ? upper : lower
            half = g.half
            mid = g.mid
            part = 2
          }
          const s = (v - mid) / Math.max(0.5, half)
          if (Math.abs(s) > 1) continue
          const nz = Math.sqrt(clamp(1 - s * s))
          const nx = -uy * s
          const ny = ux * s
          const lambert = nx * sunDir.x + ny * sunDir.y + nz * sunDir.z
          const base = part === 0 ? 1.6 : part === 1 ? 2.8 : 3.4 + ((u - 11.5) / 6) * 2.4
          put(x, y, shade(CLAW, base + lambert * 2.6, x, y))
        }
      }
    }

    const isCrab = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && (layer[y * W + x] ?? -1) >= 0
    for (const [x, y] of legLayer) c.set(x, y, CARAPACE[1] ?? 0)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isCrab(x, y)) continue
        if (isCrab(x - 1, y) || isCrab(x + 1, y) || isCrab(x, y - 1) || isCrab(x, y + 1)) c.set(x, y, INK)
      }
    }
    for (let i = 0; i < W * H; i++) {
      const v = layer[i] ?? -1
      if (v >= 0) c.set(i % W, Math.floor(i / W), v)
    }

    const hop = turn.push > 0.4 ? -1 : 0
    const ccx = 35.5
    const ccy = 27.6 + hop
    const ca = Math.cos(turn.angle)
    const sa = Math.sin(turn.angle)
    for (let y = Math.floor(ccy - 3); y <= Math.ceil(ccy + 3); y++) {
      for (let x = Math.floor(ccx - 4); x <= Math.ceil(ccx + 4); x++) {
        const nx = (x - ccx) / 3.8
        const ny = (y - ccy) / 2.7
        const d = nx * nx + ny * ny
        if (d > 1.2) continue
        if (d > 1) {
          if (y >= ccy || x > ccx + 1) c.set(x, y, INK)
          continue
        }
        const nz = Math.sqrt(1 - d)
        const sy = ny * ca + nz * sa
        const sz = -ny * sa + nz * ca
        const band = Math.abs(0.75 * nx + 0.66 * sy) < 0.2
        const freckle = Math.hypot(nx + 0.35, sy - 0.45, sz - 0.8) < 0.38
        const lambert = nx * sunDir.x + ny * sunDir.y + nz * sunDir.z
        if (band) c.set(x, y, shade(QUARTZ, 0.6 + lambert * 2, x, y))
        else if (freckle) c.set(x, y, PEBBLE[0] ?? 0)
        else c.set(x, y, shade(PEBBLE, 1.4 + lambert * 3.6, x, y))
      }
    }

    if (f >= LAND && f < LAND + 5) {
      const k = f - LAND
      for (const [i, dir] of [-1.4, -0.6, 0.4, 1.2].entries()) {
        const x = 14 + dir * (k + 1) * 1.2
        const y = 28 - (k + 1) * 1.4 + k * k * 0.45
        if (hash(i, k) < 0.85) c.set(x, y, shade(SAND, 5 - k * 0.5, 0, 0))
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Fiddle-faddling', render, hero: 44 }
