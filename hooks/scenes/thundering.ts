import { Canvas, PALETTE, TAU, clamp, hash, hex, mod, noise, particles, random, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60
const STRIKE = 24
const RAIN = [
  { count: 9, speed: 2, span: 40, len: 3, color: 0x323a50, land: 21 },
  { count: 8, speed: 3, span: 45, len: 5, color: 0x4a5470, land: 24 },
  { count: 7, speed: 4, span: 48, len: 8, color: 0x7380a0, land: 25 },
]

const SKY = hex('161a28 1f2534 2a313f 38424b 4b5754 636f5c 7e8865 9ea372 c0bb84 ddd39c')
const CLOUD = hex('07080f 0d0f1a 141725 1c2031 262b3e 323849 40465a 545a6c 6e7084 9290aa b9b4d0 e0dcf2 fbf8ff')
const FLASH = hex('c9c4e4 dcd8f2 eeeaff fbf9ff')
const LAND = hex('07090b 0c1110 121a15 19241a 223020 2d3d26 3a4b2c 4a5a33')
const HILL = hex('1e2530 262e38 2f3840')
const TREE = hex('050708 0a0e0e 121918 1d2724 2f3b33')
const FIRE = PALETTE.fire
const SMOKE = PALETTE.smoke

const FLASHES = [0.75, 1, 0.1, 0.6, 0.3, 0.14, 0.06]
const flashAt = (f: number) => FLASHES[f - STRIKE] ?? 0

const FLICKERS: [number, number, number, number][] = [
  [9, 14, 3, 1.2], [10, 15, 4, 0.6], [15, 52, 2, 0.9], [16, 52, 2, 0.4], [18, 30, 4, 1.4], [19, 31, 4, 0.7], [21, 36, 3, 0.8],
]

const TREE_X = 45
const groundY = (x: number) => 23 - 2.6 * Math.exp(-(((x - TREE_X) / 8.5) ** 2))
const hillY = (x: number) => 21.6 - 1.4 * noise(x / 9, 0, 0, 4) - (x < 20 ? 0.9 * Math.exp(-(((x - 9) / 7) ** 2)) : 0)

const TIERS = [
  { y: 0, width: 19, depth: 4.6, level: 0.4 },
  { y: 3.4, width: 14, depth: 3.8, level: 1.4 },
  { y: 6.6, width: 10.5, depth: 2.8, level: 2.4 },
]

function tierEdge(k: number, x: number, f: number): number {
  const t = TIERS[k] ?? TIERS[0]!
  const th = (TAU * f) / LOOP
  const base = t.y + (k > 0 ? 1.2 - x * 0.035 : 0)
  let bulge = 0
  const near = Math.floor(x / t.width)
  for (let i = near - 1; i <= near + 1; i++) {
    const cx = (i + 0.5) * t.width + (hash(i, k, 1) - 0.5) * t.width * 0.5 + Math.sin(th + i * 1.7 + k) * 1.2
    const half = t.width * (0.46 + hash(i, k, 2) * 0.16) + Math.sin(th * 2 + i * 2.1 + k) * 0.6
    const u = (x - cx) / half
    if (Math.abs(u) < 1) bulge = Math.max(bulge, Math.sqrt(1 - u * u) * t.depth * (0.7 + hash(i, k, 3) * 0.5))
  }
  return base + bulge
}

function cloudAt(x: number, y: number, f: number): number | undefined {
  for (let k = 0; k < TIERS.length; k++) {
    const t = TIERS[k] ?? TIERS[0]!
    const e = tierEdge(k, x, f)
    if (y + 0.5 > e) continue
    const belly = clamp(1 - (e - y - 0.5) / (t.depth + 1.5))
    const rim = e - y < 1.2 ? 0.6 + k * 0.5 : 0
    const gap = 0.6 * Math.exp(-(((x - 12) / 16) ** 2))
    return t.level + belly * 1.1 + rim + gap * (0.7 + k * 0.25)
  }
  return undefined
}

const BOLT: [number, number][][] = [
  [[42, 0], [40, 2], [42, 3], [41, 5], [44, 6], [43, 8], [45, 9], [45, 10]],
  [[40, 2], [37, 4], [38, 5], [35, 7], [34, 8]],
  [[44, 6], [47, 7], [48, 9], [50, 10]],
]

function drawLeader(c: Canvas, upTo: number) {
  BOLT.forEach(path => {
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i] ?? [0, 0]
      const [bx, by] = path[i + 1] ?? [0, 0]
      if (by > upTo) return
      c.line(ax, ay, bx, by, CLOUD[9] ?? 0)
    }
  })
}

function drawBolt(c: Canvas, isFull: boolean) {
  const core = new Map<number, number>()
  BOLT.forEach((path, k) => {
    if (k > 0 && !isFull) return
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i] ?? [0, 0]
      const [bx, by] = path[i + 1] ?? [0, 0]
      const probe = new Canvas()
      probe.line(ax, ay, bx, by, 1)
      probe.px.forEach((v, n) => {
        if (v === 1 && !core.has(n)) core.set(n, k === 0 ? 0xffffff : (CLOUD[11] ?? 0))
      })
    }
  })
  for (const n of core.keys()) {
    for (const d of [-1, 1]) if (!core.has(n + d)) c.set((n % W) + d, Math.floor(n / W), CLOUD[9] ?? 0)
  }
  for (const [n, color] of core) c.set(n % W, Math.floor(n / W), color)
}

function treeMask(sway: number): Map<number, number> {
  const m = new Map<number, number>()
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) m.set(Math.round(y) * W + Math.round(x), v)
  }
  const crown: [number, number, number, number][] = [
    [40, 13.5, 3, 2.2], [44.5, 11.6, 3.4, 2.3], [49.5, 12.6, 3.2, 2.2], [53, 14.6, 2, 1.4], [37, 15.2, 1.8, 1.2], [46, 14, 4, 1.8],
  ]
  for (const [cx, cy, rx, ry] of crown) {
    const dx = cy < 13 ? sway : Math.round(sway * 0.5)
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) put(x + dx, y, 2)
      }
    }
  }
  for (let y = 16; y <= 22; y++) {
    put(TREE_X, y, 1)
    if (y >= 18) put(TREE_X + 1, y, 1)
  }
  put(TREE_X - 1, 21, 1)
  put(TREE_X + 2, 21, 1)
  for (const [x, y] of [[44, 15], [43, 14], [42, 14], [46, 15], [47, 14], [48, 14], [49, 13]] as const) put(x, y, 1)
  return m
}

type Fx = { x: number; y: number; vx: number; vy: number; life: number; age: number }

function render(): Int32Array[] {
  const out: Int32Array[] = []
  const rng = random(0x5e7a11)
  const sparks: Fx[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const flash = flashAt(f)
    const isWhite = flash > 0.9
    const after = f - STRIKE
    const gust = Math.sin((TAU * f * 2) / LOOP) * 0.5 + 0.5
    const sway = gust > 0.7 ? 1 : 0
    const tree = treeMask(sway)
    const glows = FLICKERS.filter(([ff]) => ff === f).map(([, x, y, p]) => ({ x, y, p }))
    if (flash > 0) glows.push({ x: 40, y: 2, p: flash * 1.1 })
    if (f === STRIKE - 1) glows.push({ x: 34, y: 2, p: 0.9 })
    const cloudLight = (x: number, y: number) =>
      glows.reduce((s, g) => s + g.p * Math.max(0, 1 - Math.hypot(x - g.x, (y - g.y) * 1.4) / 13) ** 1.6, 0)
    const burn = after >= 2 && after < 30 ? (1 - (after - 2) / 28) ** 1.4 : 0
    const fireLight = (x: number, y: number) => burn * Math.max(0, 1 - Math.hypot(x - TREE_X, y - 11) / 7) ** 1.5

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const gy = groundY(x)
        const t = tree.get(y * W + x)
        if (t !== undefined) {
          const isEdge = !tree.has(y * W + x - 1) || !tree.has((y - 1) * W + x)
          const lit = fireLight(x, y) * 3
          if (isWhite) c.set(x, y, TREE[0] ?? 0)
          else c.set(x, y, shade(TREE, 0.6 + (isEdge ? 1.4 : 0) + (t === 2 ? 0.4 : 0) + flash * 1.5 + lit * 0.6, x, y))
          if (isEdge && lit > 0.9 && !isWhite) c.set(x, y, shade(FIRE, 1 + lit * 1.4, x, y))
          continue
        }
        if (y >= gy) {
          const wave = Math.sin(x * 0.32 - y * 0.9 - (TAU * f * 3) / LOOP) * 0.5 + 0.5
          const near = (y - 22) / 10
          const level = 4.4 - near * 3.2 + (wave > 0.72 ? 0.9 : 0) * (1 - near * 0.5) + fireLight(x, y) * 2 + flash * 2.5
          c.set(x, y, isWhite ? (LAND[0] ?? 0) : shade(LAND, level, x, y))
          continue
        }
        if (y >= hillY(x)) {
          c.set(x, y, isWhite ? (LAND[1] ?? 0) : shade(HILL, 1 + flash * 2 - (x > 30 ? 0.4 : 0), x, y))
          continue
        }
        const cl = cloudAt(x, y, f)
        if (cl !== undefined) {
          const lit = cloudLight(x, y)
          if (isWhite) c.set(x, y, shade(FLASH, 1 + cl * 0.5, x, y))
          else c.set(x, y, shade(CLOUD, cl + lit * (2 + cl * 1.3) + fireLight(x, y) * 0.8, x, y))
          continue
        }
        const gap = 1.6 * Math.exp(-(((x - 12) / 13) ** 2))
        const level = (y - 9) * 0.62 + gap + flash * 4 + cloudLight(x, y) * 1.5
        c.set(x, y, isWhite ? shade(FLASH, 3, x, y) : shade(SKY, level, x, y))
      }
    }

    for (let i = 0; i < 16; i++) {
      const bx = Math.floor(hash(i, 3) * 62) + 1
      const by = 29 + Math.floor(hash(i, 5) * 3)
      const h = 2 + Math.floor(hash(i, 7) * 3)
      const lean = gust > 0.55 ? 1 : 0
      for (let k = 0; k < h; k++) {
        const x = bx + (k >= h - 1 ? lean : 0)
        c.set(x, by - k, isWhite ? (LAND[0] ?? 0) : shade(LAND, 1.2 + k * 0.6 + flash * 2, x, by - k))
      }
    }

    if (f === STRIKE - 2) drawLeader(c, 3)
    if (f === STRIKE - 1) drawLeader(c, 8)
    if (after === 0 || after === 3) drawBolt(c, after === 0)

    for (const p of particles(f, LOOP, 9, 16, 31)) {
      const born = f - p.t
      if (born < STRIKE + 3 || born > STRIKE + 30) continue
      const x = TREE_X + p.t * (0.45 + p.r[1] * 0.3) + Math.sin(p.t * 0.5 + p.r[2] * 6) * 0.6
      const y = 11 - p.t * 0.55
      const r = 0.7 + p.age * 1.6
      const a = (1 - p.age) * 1.2
      for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
        for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
          const d = Math.hypot(xx - x, yy - y) / r
          if (d > 1 || a * (1.1 - d) < 0.3) continue
          c.set(xx, yy, shade(SMOKE, 1 + a * 1.6 + fireLight(xx, yy) * 2, xx, yy))
        }
      }
    }
    if (burn > 0) {
      const lick = (f * 5) % 3
      for (const [k, tall] of [[-1, 0.5], [0, 1], [1, 0.6]] as const) {
        const fx = TREE_X + k
        const h = Math.max(k === 0 ? 1 : 0, Math.round(burn * tall * (4 + (lick === k + 1 ? 1 : 0))))
        for (let j = 0; j < h; j++) c.set(fx, 10 - j, shade(FIRE, 7.6 - (j / h) * 4.5 - Math.abs(k) * 1.2, fx, 10 - j))
      }
    }

    if (after >= 0 && after < 3) {
      for (let n = 0; n < (after === 0 ? 8 : 3); n++) {
        const a = rng() * TAU
        const s = 0.8 + rng() * 1.2
        sparks.push({ x: TREE_X, y: 12, vx: Math.cos(a) * s * 1.3, vy: Math.sin(a) * s - 0.8, life: 6 + Math.floor(rng() * 7), age: 0 })
      }
    }
    for (const s of sparks) {
      if (s.age >= s.life) continue
      c.set(s.x, s.y, shade(FIRE, 8 - (s.age / s.life) * 4, 0, 0))
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.25
      s.vx *= 0.9
      s.age++
    }

    for (const [layer, { count, speed, span, len, color, land }] of RAIN.entries()) {
      for (let i = 0; i < count; i++) {
        const head = mod(hash(i, 11, layer) * span + f * speed, span) - len
        const x0 = Math.floor(hash(i, 13, layer) * W)
        const floor = land + Math.floor(hash(i, 17, layer) * (layer === 2 ? 8 : 3))
        const tint = isWhite ? (FLASH[layer] ?? 0) : color
        for (let k = 0; k < len; k++) {
          const yy = Math.round(head) + k
          if (yy > floor) break
          c.set(mod(x0 + Math.floor(yy / 2), W), yy, tint)
        }
        const tip = Math.round(head) + len - 1
        if (layer === 2 && !isWhite && tip > floor && tip - speed <= floor) {
          const sx = mod(x0 + Math.floor(floor / 2), W)
          c.set(sx - 1, floor - 1, color)
          c.set(sx + 1, floor - 1, color)
        }
        if (layer === 2 && !isWhite && tip - speed > floor && tip - 2 * speed <= floor) {
          const sx = mod(x0 + Math.floor(floor / 2), W)
          c.set(sx - 1, floor - 1, color)
          c.set(sx + 1, floor - 1, color)
        }
      }
    }

    const shake = after === 1 ? 1 : after === 2 ? -1 : after === 4 ? 1 : 0
    if (shake !== 0) {
      const src = c.copy()
      for (let y = 0; y < H; y++) {
        const sy = Math.min(H - 1, Math.max(0, y - shake))
        for (let x = 0; x < W; x++) c.px[y * W + x] = src[sy * W + x] ?? 0
      }
    }
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Thundering',
  render,
  hero: STRIKE + 3,
  snaps: [
    { frames: [9, 11], box: [8, 0, 20, 8], why: 'lightning flickers inside the cloud and fades' },
    { frames: [15, 17], box: [46, 0, 58, 8], why: 'lightning flickers inside the cloud and fades' },
    { frames: [18, 20], box: [22, 0, 38, 9], why: 'lightning flickers inside the cloud and fades' },
    { frames: [21, 23], box: [30, 0, 48, 9], why: 'the cloud flickers on and off as the stepped leader feels its way down' },
    { frames: [STRIKE, STRIKE + 2], why: 'the strike: the bolt lights the whole picture, it goes white, then the dark gap before the restrike' },
    { frames: [STRIKE + 3, STRIKE + 5], why: 'the restrike flashes the whole picture again, sparks fly, and the light fades' },
    { colors: RAIN.map(r => r.color), why: 'rain: now and then two streaks cross or land side by side and read as one shape' },
  ],
}
