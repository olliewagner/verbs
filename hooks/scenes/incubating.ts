import { PALETTE, clamp, ease, frames, hash, hex, mix, mod, noise, shade, smoothstep, wave, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const AGAR = hex('010207 03061a 070c26 0c1434 14204a 1c2c5c 263c6e')
const CYAN = hex('041c26 083444 0c5260 12807e 22b0a0 6ae6c8 d0fff0')
const MAGENTA = hex('1c0624 360c44 5a1466 8c2088 c63ca8 ee78cc ffcff0')
const AMBER = hex('240e06 441a08 72300c a8540e d8861e f6be44 fff0a0')
const LIME: Ramp = PALETTE.slime.slice(1)
const VIOLET = hex('120a2a 22124a 361c70 5030a0 7450cc a080ec d8c8ff')
const ROSE = hex('240810 461020 741c34 a82e44 dc5050 f68a72 ffd4bc')

const RAMPS = [AGAR, CYAN, MAGENTA, AMBER, LIME, VIOLET, ROSE]
const rampOf = new Map<number, Ramp>(RAMPS.flatMap(r => r.map(c => [c, r] as [number, Ramp])))
function nearest(r: Ramp, m: number): number {
  const dist = (a: number) => Math.abs(((a >> 16) & 255) - ((m >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((m >> 8) & 255)) + Math.abs((a & 255) - (m & 255))
  return r.reduce((best, k) => (dist(k) < dist(best) ? k : best))
}
function glaze(c: number, over: number, t: number): number {
  const r = rampOf.get(c)
  return r ? nearest(r, mix(c, over, t)) : mix(c, over, t)
}
type Colony = {
  x: number
  y: number
  birth: number
  grow: number
  size: number
  life: number
  rings: readonly Ramp[]
  ringW: number
  fingers: number
  seed: number
}
const HERO: Colony = { x: 32, y: 16, birth: 0, grow: 40, size: 13, life: 71, rings: [AMBER, ROSE, MAGENTA, VIOLET, CYAN], ringW: 2.7, fingers: 11, seed: 1 }
const COLONIES: Colony[] = [
  HERO,
  { x: 11, y: 9, birth: 30, grow: 30, size: 6, life: 62, rings: [LIME, CYAN], ringW: 2.4, fingers: 5, seed: 2 },
  { x: 53, y: 23, birth: 46, grow: 28, size: 6.5, life: 64, rings: [ROSE, MAGENTA, VIOLET], ringW: 2.4, fingers: 6, seed: 3 },
  { x: 14, y: 25, birth: 58, grow: 26, size: 5, life: 56, rings: [AMBER, LIME], ringW: 2.4, fingers: 5, seed: 4 },
  { x: 52, y: 7, birth: 14, grow: 26, size: 5, life: 58, rings: [VIOLET, CYAN], ringW: 2.4, fingers: 4, seed: 5 },
  { x: 4, y: 17, birth: 40, grow: 22, size: 3.5, life: 48, rings: [ROSE, AMBER], ringW: 2.2, fingers: 4, seed: 6 },
  { x: 60, y: 15, birth: 4, grow: 22, size: 3.5, life: 50, rings: [CYAN, LIME], ringW: 2.2, fingers: 4, seed: 7 },
]
const hollowR = (k: Colony, r: number, a: number) => r * (1 + (noise(Math.cos(a) * 2 + k.seed * 3, Math.sin(a) * 2, 2, k.seed) - 0.5) * 0.5)

const ringAt = (k: Colony, r: number, a: number, x: number, y: number) =>
  (r + (noise(x / 3, y / 3, 3, k.seed) - 0.5) * 2.4 + (noise(Math.cos(a) * 1.8 + k.seed * 2, Math.sin(a) * 1.8, 4, k.seed) - 0.5) * 1.6) / k.ringW
function shape(k: Colony, a: number): number {
  const lumps = (noise(Math.cos(a) * 1.2 + k.seed * 7, Math.sin(a) * 1.2, 0, k.seed) - 0.5) * 0.34
  const frills = (noise(Math.cos(a) * 3.2 + k.seed * 5, Math.sin(a) * 3.2, 1, k.seed) - 0.5) * 0.2
  const scallops = Math.abs(Math.sin(a * k.fingers + k.seed)) * 0.08
  return 1 + lumps + frills + scallops
}
type State = { outer: number; inner: number; fade: number; pulse: number; age: number }
function state(k: Colony, f: number): State | undefined {
  const age = mod(f - k.birth, LOOP)
  if (age > k.life) return undefined
  const grown = smoothstep(0, 1, age / k.grow)
  const late = clamp((age - k.grow) / (k.life - k.grow))
  const outer = k.size * (0.08 + grown * 0.92 + late * 0.3)
  const inner = late > 0.2 ? (outer + 0.4) * ease.in((late - 0.2) / 0.8) : 0
  const fade = clamp((k.life - age) / 10) * clamp((age + 1) / 3)
  const pulse = k === HERO && age >= k.grow - 2 && age < k.grow + 12 ? ((age - k.grow + 2) / 12) * k.size * 1.5 : -10
  return { outer, inner, fade, pulse, age }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const states = COLONIES.map(k => state(k, f))
    const hero = states[0]
    const flash = hero && hero.age >= HERO.grow && hero.age < HERO.grow + 8 ? [0.6, 1.1, 1.3, 1.1, 0.8, 0.55, 0.35, 0.15][hero.age - HERO.grow] ?? 0 : 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const mottle = noise(x / 10, y / 6, 0, 3)
        let glow = 0
        let halo = -1
        let haloR = 0
        let haloA = 0
        COLONIES.forEach((k, i) => {
          const st = states[i]
          if (!st) return
          const a = Math.atan2(y - k.y, x - k.x)
          const r = Math.hypot(x - k.x, y - k.y) / shape(k, a)
          glow += clamp(1 - (r - st.outer) / (k.size * 0.9)) * st.fade * (hollowR(k, r, a) > st.inner ? 1 : 0.4)
          if (r > st.outer && r - st.outer < Math.min(1.4, st.age * 0.45, (st.fade - 0.4) * 7)) {
            halo = i
            haloR = r
            haloA = a
          }
        })
        const k = COLONIES[halo]
        const rampOut = k ? k.rings[Math.max(0, Math.floor(ringAt(k, haloR, haloA, x, y))) % k.rings.length] : undefined
        const haloFade = (1 - (states[halo]?.fade ?? 1)) * 2.5
        c.set(x, y, rampOut ? shade(rampOut, 1.2 + flash - haloFade) : shade(AGAR, 1.5 + mottle * 1.2 + glow * 1.4 + flash))
      }
    }
    for (let i = 0; i < 4; i++) {
      const mx = 6 + hash(i, 1) * 52 + wave(f, LOOP, 1, hash(i, 2)) * 4
      const my = hash(i, 3) * 28 + 2 + wave(f, LOOP, 1, hash(i, 4)) * 2
      c.disc(mx, my, 2.2, (x, y) => glaze(c.get(x, y), 0x3a4a78, Math.hypot(x - mx, y - my) < 1.2 ? 0.28 : 0.16))
    }
    const body: (Ramp | undefined)[] = []
    COLONIES.forEach((k, i) => {
      const s = states[i]
      if (!s) return
      const reach = Math.ceil(s.outer * 1.5) + 1
      for (let y = Math.floor(k.y - reach); y <= k.y + reach; y++) {
        for (let x = Math.floor(k.x - reach); x <= k.x + reach; x++) {
          const a = Math.atan2(y - k.y, x - k.x)
          const r = Math.hypot(x - k.x, y - k.y) / shape(k, a)
          const rIn = hollowR(k, r, a)
          if (r > s.outer || rIn < s.inner) continue
          const at = Math.max(0, ringAt(k, r, a, x, y))
          const ring = Math.floor(at)
          const within = at - ring
          const ramp = k.rings[ring % k.rings.length] ?? CYAN
          const front = clamp(1 - (s.outer - r) / 1.5) * 2.2
          const spent = s.inner > 0 ? clamp(1 - (rIn - s.inner) / 2) * 2.5 : 0
          const pulse = Math.abs(r - s.pulse) < 1.3 ? 2.4 : r < s.pulse ? clamp(2.4 - (s.pulse - r - 1.3) * 0.6, 0, 2.4) : 0
          const ridge = within > 0.72 ? 1 : 0
          const level = 2.8 + Math.max(ridge, front) - spent + pulse - (1 - s.fade) * 5
          if (level < 0) continue
          c.set(x, y, shade(ramp, level))
          if (x >= 0 && x < W && y >= 0 && y < H) body[y * W + x] = ramp
        }
      }
    })
    const drawn = Array.from({ length: W * H }, (_, i) => c.get(i % W, Math.floor(i / W)))
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!body[y * W + x]) continue
        const v = drawn[y * W + x]
        const around = [drawn[y * W + x - 1], drawn[y * W + x + 1], drawn[(y - 1) * W + x], drawn[(y + 1) * W + x]]
        if (around.includes(v)) continue
        const ramp = body[y * W + x]
        const shared = around.find((o, j) => around.indexOf(o) !== j && ramp?.includes(o ?? -1))
        if (shared !== undefined) c.set(x, y, shared)
      }
    }
    COLONIES.forEach((k, i) => {
      const s = states[i]
      if (s && s.age < k.grow * 0.6 && s.inner === 0) c.set(k.x, k.y, shade(k.rings[0] ?? CYAN, 6 - s.age / k.grow * 3))
    })
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - 31.5, (y - 15.5) * 1.02)
        if (d > 33.2) c.set(x, y, 0x010104)
        else if (d > 32.2) c.set(x, y, glaze(c.get(x, y), 0x010104, 0.75))
        else if (d > 31.2) c.set(x, y, nearest(x < 32 ? VIOLET : CYAN, mix(c.get(x, y), x < 32 ? 0x2a1050 : 0x082a3a, 0.5)))
      }
    }
    for (let x = 22; x <= 41; x++) c.set(x, 29, glaze(c.get(x, 29), 0x9ab8d0, 0.22))
    for (let x = 22; x <= 41; x += 4) c.set(x, 28, glaze(c.get(x, 28), 0x9ab8d0, x === 22 || x === 42 || x === 30 || x === 38 ? 0.22 : 0.12))
  })
}
export const scene: Scene = {
  verb: 'Incubating',
  render,
  hero: 44,
  snaps: [
    { frames: 43, box: [26, 27, 41, 29], colors: [0xa56a39, 0x308c90, 0x6ae6c8, 0x774024, 0xf6be44], why: 'the bloom pulse lights the rim under the scale bar' },
    { frames: 45, box: [42, 11, 45, 15], colors: [...CYAN.slice(5, 7), 0xf6be44], why: 'the bloom pulse reaches the rim' },
    { frames: 25, box: [35, 7, 39, 10], colors: [0x22124a, 0x083444], why: 'the growing front crosses into the next ring\'s colour' },
    { frames: 61, box: [52, 25, 56, 27], colors: [0x360c44, 0x37164c], why: 'the growing front crosses into the next ring\'s colour' },
  ],
}