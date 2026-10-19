import { Canvas, TAU, beat, clamp, ease, fract, hash, hex, lerp, mod, noise, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const CX = 32
const CY = 10

const SPACE = hex('020309 040618 080b24 0e1434 1a1d48 2c2a5c')
const STAR = hex('1c2448 3a4a80 6a80b8 a8bce4 e4ecff ffffff')
const TUNNEL = hex('060a26 0d1a58 15338e 2058c4 3a8ae8 72bcff b8e6ff f0fcff')
const HULL = hex('060609 0c0d15 141622 1e2132 2a2f45 3a415c 4f5876 6a7696')
const PLANET = hex('1c0c1a 3a1624 5e2428 86382c ac5632 cc7a3e e4a256 f4c87e fbe6b0')
const RING = hex('3a3040 6a5a64 a08c84 cdb89c ecdcbc')
const SUIT = hex('2a1008 5a2410 9a4418 d06c22 f09a3a')
const GLOVE = hex('2c2a34 5a5866 9c98a6 d4d0d8 f4f2f4')
const SCREEN = hex('03140e 0a3a24 16683a 2ea456 7ae08a')
const LAMP = [0xf05a48, 0xf6c040, 0x5ae0a0, 0x58a8f8]

const JUMP = 22
const TUNNEL_END = 39
const V0 = 1 / 64
const VMAX = 0.16

function speed(f: number): number {
  if (f < 10) return V0
  if (f < JUMP) return lerp(V0, VMAX, ease.in(beat(f, 10, JUMP)))
  if (f <= TUNNEL_END) return VMAX
  return lerp(VMAX, V0, ease.out(beat(f, TUNNEL_END, 48)))
}

const DISTANCE: number[] = (() => {
  const d = [0]
  for (let f = 0; f < LOOP; f++) d.push((d[f] ?? 0) + speed(f))
  const total = d[LOOP] ?? 1
  const k = Math.max(1, Math.round(total)) / total
  return d.map(v => v * k)
})()

type Star = { x: number; y: number; z0: number }
const STARS: Star[] = Array.from({ length: 70 }, (_, i) => ({ x: hash(i, 1) * 2 - 1, y: hash(i, 2) * 2 - 1, z0: hash(i, 3) }))

const leftEdge = (y: number) => 9 - ((y - 1) * 8) / 19
const rightEdge = (y: number) => 54 + ((y - 1) * 8) / 19
const isWindow = (x: number, y: number) => y >= 1 && y <= 20 && x >= leftEdge(y) && x <= rightEdge(y)
const strutX = (y: number, side: number) => (side < 0 ? 21 - ((y - 1) * 3) / 19 : 43 + ((y - 1) * 3) / 19)
const isStrut = (x: number, y: number) => Math.round(strutX(y, -1)) === x || Math.round(strutX(y, 1)) === x

const PLANET_EDGE: number[] = (() => {
  const glide = (f: number) => 5 / (1 - 0.78 * (f / 26) ** 2)
  const step = (f: number) => (1 - 0.78 * (f / 26) ** 2 > 0.02 ? glide(f) - glide(f - 1) : Infinity)
  const s = [5]
  for (let f = 1; f < LOOP - TUNNEL_END - 1; f++) s.push((s[f - 1] ?? 0) + Math.min(2.2, step(f)))
  return s
})()
function planet(f: number): { x: number; y: number; r: number } | null {
  const s = PLANET_EDGE[f - TUNNEL_END - 1]
  if (s === undefined) return null
  const z = 5 / s
  return { x: CX + 13 / z, y: CY + 2.1 / z, r: 8 / z }
}
function cabinLight(f: number): { power: number; color: readonly number[] } {
  if (f === JUMP || f === TUNNEL_END + 1) return { power: 2.6, color: TUNNEL }
  if (f > JUMP && f <= TUNNEL_END) return { power: 1.2 + 0.2 * wave(f, LOOP, 12), color: TUNNEL }
  const p = planet(f)
  if (p) return { power: 0.3 + 0.7 * clamp((p.r - 7) / 14) * (1 - beat(f, 60, 66)), color: PLANET }
  if (f >= 10 && f < JUMP) return { power: 0.25 + 0.8 * ease.in(beat(f, 10, JUMP)), color: TUNNEL }
  return { power: 0.25, color: STAR }
}
function drawStars(c: Canvas, f: number): void {
  const v = (DISTANCE[f + 1] ?? 0) - (DISTANCE[f] ?? 0)
  const d = DISTANCE[f] ?? 0
  for (const [i, s] of STARS.entries()) {
    const z = 0.06 + 0.94 * fract(s.z0 - d)
    const at = (zz: number): [number, number] => [CX + (s.x * 34 * 0.32) / zz, CY + (s.y * 12 * 0.32) / zz]
    const [x, y] = at(z)
    const isSeen = isWindow(Math.round(x), Math.round(y))
    const bright = (1 - z) * 4.2 + (i % 9 === 0 ? 0.8 : 0) - 0.6
    const trail = v * 1.8
    if (speed(f) > 0.025 && z < 0.55) {
      const [tx, ty] = at(Math.min(1, z + trail))
      const [mx, my] = at(Math.min(1, z + trail * 0.35))
      const isIn = (px: number, py: number) => isWindow(px, py)
      c.line(tx, ty, mx, my, (px, py) => (isIn(px, py) ? shade(STAR, bright * 0.5 + speed(f) * 6) : undefined))
      c.line(mx, my, x, y, (px, py) => (isIn(px, py) ? shade(STAR, bright * 0.8 + speed(f) * 12) : undefined))
    }
    if (isSeen) c.set(x, y, shade(STAR, bright + 0.8 + speed(f) * 10))
  }
}
function drawTunnel(c: Canvas, f: number): void {
  const t = f - JUMP
  const fadeIn = beat(f, JUMP, JUMP + 4)
  const fadeOut = 1 - beat(f, TUNNEL_END - 5, TUNNEL_END + 1)
  for (let y = 1; y <= 20; y++) {
    for (let x = 0; x < W; x++) {
      if (!isWindow(x, y)) continue
      const dx = x - CX
      const dy = (y - CY) * 1.7
      const rho = Math.hypot(dx, dy)
      const phi = Math.atan2(dy, dx)
      const u = -2.5 * Math.log(rho + 3) + t * 0.13
      const ring = fract(u) < 0.3 ? 1 : 0
      const lane = Math.sin(phi * 6 + u * 2.4) > 0.6 ? 1 : 0
      const glow = Math.max(0, 1 - rho / 12)
      const level = (1.2 + ring * 2.2 + lane * 0.9 + glow * glow * 5) * Math.min(fadeIn + 0.3, fadeOut + 0.3, 1) - (rho > 24 ? 0.8 : 0)
      c.set(x, y, shade(TUNNEL, level))
    }
  }
  for (let k = 0; k < 16; k++) {
    const a = hash(k, 7) * TAU
    const r = mod(t * (2.6 + hash(k, 8) * 1.6) + hash(k, 9) * 40, 40)
    const len = 2 + r * 0.18
    const p = (q: number): [number, number] => [CX + Math.cos(a) * q, CY + (Math.sin(a) * q) / 1.7]
    const [x0, y0] = p(r)
    const [x1, y1] = p(r + len)
    c.line(x0, y0, x1, y1, (x, y) => (isWindow(x, y) ? TUNNEL[r > 8 ? 7 : 6] : undefined))
  }
}
function drawPlanet(c: Canvas, f: number): void {
  const p = planet(f)
  if (!p) return
  const tilt = -0.18
  const ringAt = (x: number, y: number) => {
    const rx = x - p.x
    const ry = y - p.y - rx * tilt
    const d = Math.hypot(rx / (p.r * 1.9), ry / (p.r * 0.32))
    return d > 0.78 && d < 1 && !(d > 0.86 && d < 0.9) ? d : 0
  }
  const ringColor = (x: number, y: number, d: number) => shade(RING, 3.6 - (d > 0.9 ? 0.8 : 0) - (x > p.x + p.r * 0.5 ? 1.2 : 0))
  for (let y = 1; y <= 20; y++) {
    for (let x = 0; x < W; x++) {
      if (!isWindow(x, y)) continue
      const d = ringAt(x, y)
      const isFar = y - p.y - (x - p.x) * tilt < 0
      if (d && isFar) c.set(x, y, ringColor(x, y, d))
      const nx = (x - p.x) / p.r
      const ny = (y - p.y) / p.r
      const rr = nx * nx + ny * ny
      if (rr <= 1) {
        const nz = Math.sqrt(1 - rr)
        const lit = -nx * 0.62 - ny * 0.45 + nz * 0.64
        const band = Math.sin(ny * 9 + Math.sin(nx * 3) * 0.6) * 0.7
        let level = 1 + Math.max(0, lit) * 6.2 + band
        if (rr > 0.86 && lit > 0.1) level += 1
        if (Math.abs(ny - nx * tilt + 0.16) < 0.05) level -= 2
        c.set(x, y, shade(PLANET, level))
      }
      if (d && !isFar) c.set(x, y, ringColor(x, y, d))
    }
  }
}
function drawCockpit(c: Canvas, f: number): void {
  const light = cabinLight(f)
  const near = (x: number, y: number) => {
    const d = Math.min(Math.abs(y - 21), Math.abs(x - leftEdge(clamp(y, 1, 20))), Math.abs(x - rightEdge(clamp(y, 1, 20))), y)
    return Math.max(0, 1 - d / 9)
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isWindow(x, y) && !isStrut(x, y)) continue
      const isDash = y >= 21
      let level = (isDash ? 1.6 : 1.2) + light.power * near(x, y) * 1.6
      if (y === 0 || (!isDash && (x === 3 || x === 60) && y > 3)) level -= 0.7
      if (!isDash && (x === 2 || x === 61) && (y === 5 || y === 15)) level += 1.4
      if (isDash && (x === 17 || x === 37) && y > 22) level -= 0.6
      if (y === 21) level = 3 + light.power * 1.4
      if (y === 22) level = 1.2 + light.power * 0.5
      if (isStrut(x, y)) level = 1.4 + light.power * 0.6
      c.set(x, y, shade(HULL, level))
      const isRim = (isWindow(x + 1, y) || isWindow(x - 1, y) || isWindow(x, y - 1)) && !isStrut(x, y)
      const catches = clamp((light.power - 0.4) / 0.5)
      const isLit = y < 21 || (y === 21 && light.color === TUNNEL)
      if (isRim && isLit && catches > 0) c.set(x, y, shade(light.color, (2 + light.power * 1.6) * catches))
    }
  }
  const sweep = (f / LOOP) * TAU * 3
  c.disc(10, 26.5, 3.3, SCREEN[0] ?? 0)
  for (let y = 23; y <= 30; y++) {
    for (let x = 6; x <= 14; x++) {
      const dx = x - 10
      const dy = y - 26.5
      if (dx * dx + dy * dy > 10.5) continue
      const a = mod(Math.atan2(dy, dx) - sweep, TAU)
      if (a > TAU - 1.1) c.set(x, y, shade(SCREEN, 1 + (a - (TAU - 1.1)) * 2.6))
      if (Math.abs(Math.hypot(dx, dy) - 2) < 0.4 && a <= TAU - 1.1) c.set(x, y, SCREEN[1] ?? 0)
    }
  }
  c.set(10, 26, SCREEN[4] ?? 0)
  c.rect(19, 24, 14, 6, SCREEN[0] ?? 0)
  for (let x = 20; x < 32; x++) {
    const wild = f > JUMP && f <= TUNNEL_END ? 2.4 : f >= 10 && f <= JUMP ? 1.4 : 0.8
    const y = Math.round(26.5 + Math.sin(x * 0.9 + f * 0.7) * wild * 0.9)
    c.set(x, y, SCREEN[3] ?? 0)
    if (x % 3 === 0) c.set(x, 28.5, SCREEN[1] ?? 0)
  }
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 5; k++) {
      const x = 51 + k * 2
      const y = 25 + r * 3
      const isOn = hash(k, r, Math.floor(f / 6)) > 0.35 || (f > JUMP && f <= TUNNEL_END && (k + r + Math.floor(f / 2)) % 2 === 0)
      c.set(x, y, isOn ? LAMP[(k + r) % LAMP.length] ?? 0 : HULL[2] ?? 0)
    }
  }
  const push = ease.inOut(beat(f, 5, 11)) * (1 - smoothstep(43, 50, f))
  const step = Math.round(push * 4)
  const gx = 43 + Math.floor((step + 1) / 2)
  const gy = 25 - Math.floor(step / 2)
  c.line(44, 30, gx, gy + 1, (x, y) => shade(HULL, 4.4 + light.power))
  c.rect(42, 30, 5, 2, HULL[3] ?? 0)
  for (let k = 0; k <= 8; k++) {
    const t = k / 8
    const ax = lerp(gx + 3, 66, t)
    const ay = lerp(gy + 2, 33, t)
    c.disc(ax, ay, 1.8, (x, y) => shade(SUIT, 2.4 + (y < ay - 0.5 ? 1 : 0) + light.power * 0.5))
  }
  c.sprite(gx - 1, gy - 1, ['.ggg.', 'gGGGs', 'gGGss', '.gss.'], {
    G: shade(GLOVE, 3 + light.power * 0.5), g: shade(GLOVE, 2 + light.power * 0.4), s: shade(GLOVE, 1.4),
  })
}
function galaxy(x: number, y: number): number {
  const d = Math.abs(y - 3 - x * 0.22) / 4.5
  const dust = noise(x * 0.3, y * 0.5, 0, 4) + noise(x * 0.8, y * 0.9, 0, 9) * 0.5
  const level = 1.2 + Math.max(0, 1 - d) * (1.2 + dust * 1.6) - (dust > 1.1 && d < 0.5 ? 1.2 : 0)
  return shade(SPACE, level)
}
function render(): Int32Array[] {
  return Array.from({ length: LOOP }, (_, f) => {
    const c = new Canvas()
    c.fill(galaxy)
    const isTunnel = f > JUMP && f <= TUNNEL_END
    const isFlash = f === JUMP || f === TUNNEL_END + 1
    if (isTunnel) drawTunnel(c, f)
    else if (!isFlash) {
      drawStars(c, f)
      drawPlanet(c, f)
    }
    if (isFlash) c.fill((x, y) => (isWindow(x, y) ? shade(TUNNEL, 7.4 - Math.hypot(x - CX, (y - CY) * 1.7) / 14) : undefined))
    if (f >= JUMP - 3 && f < JUMP) c.disc(CX, CY, lerp(0.7, 2.2, beat(f, JUMP - 3, JUMP - 1)), TUNNEL[7] ?? 0)
    drawCockpit(c, f)
    if (!isTunnel && !isFlash) return c.px
    const jolt = Math.floor(f / 2)
    const sx = isFlash ? 0 : jolt % 3 === 0 ? 1 : 0
    const sy = isFlash ? 1 : jolt % 2 === 1 ? 1 : 0
    const out = new Int32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) out[y * W + x] = c.px[clamp(y - sy, 0, H - 1) * W + clamp(x - sx, 0, W - 1)] ?? 0
    }
    return out
  })
}
export const scene: Scene = {
  verb: 'Hyperspacing',
  render,
  hero: 31,
  snaps: [
    { frames: [JUMP, JUMP + 1], why: 'the jump: a white flash floods the glass and lights the cabin, then the tunnel' },
    { frames: [TUNNEL_END + 1, TUNNEL_END + 2], why: 'the drop out: a white flash, then open stars and the ringed giant' },
  ],
}