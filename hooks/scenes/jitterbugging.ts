import { TAU, beat, clamp, ease, frames, hex, lerp, shade, smoothstep, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const BEAT = 4

const WALL = hex('080914 0d0f20 13172e 1a203e 232b50')
const SHELL = hex('1a1828 2a2434 3e3240 56443e 70583e 8c7044 a88a4e c4a660')
const VELVET = hex('1a0408 2e070e 460c16 62121e 821a26 a0283a')
const FLOOR = hex('1e100a 2e180e 422414 5a3218 74421e 8f5626 aa6c30 c48640 dca457 f0c47a')
const GOLD = hex('3a2608 6a4a12 a07a22 d0aa3e f2d878 fff4c0')
const SKIN = hex('3a1e16 6a3a26 9a5c3a c88456 e8ae7c f8d2a4')
const CREAM = hex('5a4e44 8e8070 c0b29a e6dcc4 fbf6ea')
const NAVY = hex('0a0b1a 141834 20264c 303a6a')
const HAT = hex('1e120c 3a2416 5a3a22')
const RED = hex('3a0610 640e1a 941a24 c42a2c e64836 fa7a58')
const HAIR = hex('2a0e08 561e0e 853414 b04e1e')
const TUX = hex('07070e 101020 1a1a30')

const FLOOR_Y = 29
const STAGE_Y = 16

type V = readonly [number, number]
type Pose = { hip: V; neck: V; ha: V; hb: V; fa: V; fb: V }
type Row = readonly [number, number, number, number, number, number, number, number, number, number, number, number, number]

const LEAD: Row[] = [
  [0, 27, 22.6, 27.6, 17.7, 30.5, 21.8, 31.8, 19.8, 29, 29, 25.5, 29],
  [4, 26, 22.9, 25.7, 18, 30.5, 21.6, 30.8, 20.2, 28, 29, 23.5, 29],
  [8, 27, 22.6, 27.4, 17.7, 31.5, 21.2, 29.5, 21.5, 29, 29, 25.5, 29],
  [12, 26.5, 22.8, 25.9, 17.9, 33, 20.8, 23.8, 21.8, 28.8, 29, 24.6, 29],
  [16, 26, 23, 24.7, 18.3, 31.8, 20.6, 21.5, 18.6, 28.6, 29, 23.6, 29],
  [20, 27, 22.6, 27.6, 17.7, 30.5, 21, 24.5, 21.5, 29.4, 29, 25.6, 29],
  [24, 28, 22.6, 28.6, 17.6, 32.4, 14.2, 25.2, 21.4, 30, 29, 26.4, 29],
  [44, 28, 22.6, 28.6, 17.6, 32.8, 14, 25.2, 21.4, 30, 29, 26.4, 29],
  [47, 27.6, 23.4, 28.6, 18.6, 31.6, 22.4, 32.2, 22.2, 30.6, 29, 24.6, 29],
  [51, 27.6, 24.2, 28.8, 19.4, 31.4, 23, 32, 22.8, 30.6, 29, 24.6, 29],
  [56, 27.5, 22.2, 27.7, 17.2, 29.8, 11.8, 31, 12.2, 30.4, 29, 24.8, 29],
  [61, 27.5, 22.3, 27.6, 17.3, 29.5, 12, 30.6, 12.4, 30.4, 29, 24.8, 29],
  [66, 27.6, 22.8, 28.2, 17.9, 32, 20.5, 32.6, 21, 30.4, 29, 24.8, 29],
  [69, 27.6, 23.6, 28.4, 18.8, 32.4, 21.8, 33, 22.2, 30.4, 29, 24.8, 29],
  [74, 26.6, 22.6, 26.1, 17.6, 33, 19.6, 21.2, 14.8, 28.6, 29, 24.2, 29],
  [80, 26.6, 22.6, 26.2, 17.6, 33, 19.4, 21.4, 14.6, 28.6, 29, 24.2, 29],
  [87, 27, 22.6, 27.4, 17.7, 30.5, 21.6, 31.4, 20, 29, 29, 25.5, 29],
  [91, 27, 23, 27.6, 18.1, 30.5, 22, 31.8, 20.2, 29, 29, 25.5, 29],
]
const FOLLOW: Row[] = [
  [0, 33, 23.2, 32.6, 18.7, 30.5, 21.8, 28.8, 18.4, 31.6, 29, 34.6, 29],
  [4, 34, 23.4, 34.4, 18.9, 30.5, 21.6, 29.6, 18.8, 32.6, 29, 36, 29],
  [8, 35.6, 23.2, 35.6, 18.7, 31.5, 21.2, 37.2, 21, 34.2, 29, 37.4, 29],
  [12, 37.4, 23.3, 37.9, 18.8, 33, 20.8, 40.4, 19.4, 35.8, 29, 39.6, 28.6],
  [16, 38.4, 23.4, 39.7, 19, 31.8, 20.6, 42.6, 16.8, 36.8, 29, 40.6, 29],
  [20, 35, 23.2, 34.6, 18.7, 30.5, 21, 37.6, 20.2, 33.4, 29, 36.8, 28],
  [24, 34.8, 23.2, 34.7, 18.7, 32.4, 14.2, 37, 21.6, 33.9, 29, 36.3, 29],
  [44, 34.8, 23, 34.7, 18.5, 32.8, 14, 37, 21.6, 34.3, 29, 35.9, 29],
  [47, 33, 23.8, 32.4, 19.2, 29.2, 18.8, 29.6, 18.6, 32, 29, 34.6, 29],
  [51, 33, 24.6, 32.2, 20, 29.4, 19.6, 29.8, 19.4, 32, 29, 34.6, 29],
  [67, 34, 23.9, 33.6, 19.4, 32.4, 21.8, 36.6, 20, 33, 29, 35.6, 29],
  [69, 34, 24, 33.6, 19.5, 32.4, 21.8, 36.8, 20.4, 33, 29, 35.6, 29],
  [74, 35, 23.2, 35.7, 18.6, 33, 19.6, 40.2, 14.4, 34, 29, 38.2, 28.2],
  [80, 35, 23.2, 35.8, 18.6, 33, 19.4, 40.4, 14.2, 34, 29, 38.2, 28.2],
  [87, 33, 23.2, 32.6, 18.7, 30.5, 21.6, 28.8, 18.4, 31.6, 29, 34.6, 29],
  [91, 33, 23.6, 32.8, 19.1, 30.5, 22, 28.8, 18.8, 31.6, 29, 34.6, 29],
]

const toPose = (r: Row): Pose => ({
  hip: [r[1], r[2]], neck: [r[3], r[4]], ha: [r[5], r[6]], hb: [r[7], r[8]], fa: [r[9], r[10]], fb: [r[11], r[12]],
})
const mixV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
const mixPose = (a: Pose, b: Pose, t: number): Pose => ({
  hip: mixV(a.hip, b.hip, t), neck: mixV(a.neck, b.neck, t), ha: mixV(a.ha, b.ha, t),
  hb: mixV(a.hb, b.hb, t), fa: mixV(a.fa, b.fa, t), fb: mixV(a.fb, b.fb, t),
})
const offset = (p: Pose, d: V): Pose => ({
  hip: [p.hip[0] + d[0], p.hip[1] + d[1]], neck: [p.neck[0] + d[0], p.neck[1] + d[1]],
  ha: [p.ha[0] + d[0], p.ha[1] + d[1]], hb: [p.hb[0] + d[0], p.hb[1] + d[1]], fa: p.fa, fb: p.fb,
})

function keyed(rows: Row[], f: number): Pose {
  const keys = [...rows, [LOOP, ...rows[0]!.slice(1)] as unknown as Row]
  for (let k = 0; k + 1 < keys.length; k++) {
    const a = keys[k]!
    const b = keys[k + 1]!
    if (f >= a[0] && f < b[0]) return mixPose(toPose(a), toPose(b), ease.inOut((f - a[0]) / (b[0] - a[0])))
  }
  return toPose(rows[0]!)
}

function joint(a: V, b: V, l1: number, l2: number, bend: number): V {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const d = clamp(Math.hypot(dx, dy), 0.01, l1 + l2 - 0.01)
  const cos = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
  const ang = Math.atan2(dy, dx) + Math.acos(cos) * bend
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1]
}

const rot = (v: V, a: number): V => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]

const spinOf = (f: number) => TAU * 2 * ease.inOut(beat(f, 26, 44))

const AIR_FROM = 51
const AIR_TO = 67

function aerial(f: number, start: Pose, end: Pose): Pose & { flip: number } {
  const t = beat(f, AIR_FROM, AIR_TO)
  const hip: V = [lerp(start.hip[0], end.hip[0], t) - Math.sin(Math.PI * t) * 1.5, lerp(start.hip[1], end.hip[1], t) - 16.2 * 4 * t * (1 - t)]
  const flip = -TAU * (clamp((t - 0.05) / 0.9) + smoothstep(0.05, 0.95, t)) / 2
  const straddle = Math.sin(Math.PI * smoothstep(0.15, 0.85, t)) ** 2
  const air = {
    neck: [-0.4, -4.6] as V,
    ha: [-3.2, -3.4] as V,
    hb: [3, -3.6] as V,
    fa: mixV([-2, 1.4], [-4.6, 3.6], straddle),
    fb: mixV([-0.6, 2.2], [4.4, 3.4], straddle),
  }
  const into = ease.inOut(smoothstep(0, 0.16, t))
  const outOf = ease.inOut(smoothstep(0.84, 1, t))
  const local = (k: 'neck' | 'ha' | 'hb' | 'fa' | 'fb'): V => {
    const a = sub(start[k], start.hip)
    const b = sub(end[k], end.hip)
    return mixV(mixV(a, air[k], into), b, outOf)
  }
  const place = (k: 'neck' | 'ha' | 'hb' | 'fa' | 'fb') => add(hip, rot(local(k), flip))
  return { hip, neck: place('neck'), ha: place('ha'), hb: place('hb'), fa: place('fa'), fb: place('fb'), flip }
}

function limb(c: Canvas, a: V, b: V, paint: number, thick = false, paint2 = paint): void {
  c.line(a[0], a[1], b[0], b[1], paint)
  if (!thick) return
  const steep = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0])
  c.line(a[0] + (steep ? 1 : 0), a[1] + (steep ? 0 : 1), b[0] + (steep ? 1 : 0), b[1] + (steep ? 0 : 1), paint2)
}

type Dancer = { pose: Pose; facing: number; spin: number; flare: number; lag: number; lit: number }

function drawLead(c: Canvas, d: Dancer): void {
  const { pose: p, facing, lit } = d
  const up = norm(sub(p.neck, p.hip))
  const shoulder = mixV(p.neck, p.hip, 0.14)
  for (const [foot, back] of [[p.fb, true], [p.fa, false]] as const) {
    const knee = joint(p.hip, foot, 3.7, 3.7, -facing)
    const tone = shade(NAVY, (back ? 1.2 : 2) + lit)
    limb(c, p.hip, knee, tone, true, shade(NAVY, (back ? 0.8 : 1.4) + lit))
    limb(c, knee, foot, tone, true, shade(NAVY, (back ? 0.8 : 1.4) + lit))
    c.set(foot[0], foot[1], shade(CREAM, 3))
    c.set(foot[0] + facing, foot[1], shade(HAT, 1.6))
  }
  drawArm(c, shoulder, p.hb, 3, 3, facing, shade(CREAM, 1.6 + lit), shade(SKIN, 2.4 + lit))
  const side: V = [-up[1], up[0]]
  for (let k = -1; k <= 1; k++) {
    const o: V = [side[0] * k, side[1] * k]
    limb(c, add(p.hip, o), add(p.neck, o), shade(CREAM, 2.6 + lit - k * facing * 0.6 - (k === 0 ? 0 : 0.2)))
  }
  limb(c, add(p.hip, side), add(p.hip, [-side[0], -side[1]]), shade(NAVY, 2 + lit))
  c.set(p.neck[0] + up[0] * -1 + facing * 0.4, p.neck[1] - up[1] * 1, shade(RED, 2.6))
  c.set(p.neck[0] + up[0] * -2 + facing * 0.4, p.neck[1] - up[1] * 2, shade(RED, 2))
  const head = add(p.neck, [up[0] * 2.1, up[1] * 2.1])
  c.disc(head[0], head[1], 1.3, (x, y) => shade(SKIN, 3.2 + lit + ((x - head[0]) * facing > 0 ? 0.6 : -0.4)))
  c.set(head[0] - facing * 1, head[1], shade(HAT, 0.6))
  for (let k = -2; k <= 2; k++) c.set(head[0] + up[0] * 1.3 + side[0] * k + facing * 0.3, head[1] + up[1] * 1.3 + side[1] * k, shade(HAT, 1 + lit))
  for (let k = -1; k <= 1; k++) c.set(head[0] + up[0] * 2.3 + side[0] * k, head[1] + up[1] * 2.3 + side[1] * k, shade(HAT, 1.8 + lit + (k === -facing ? 0.5 : 0)))
  drawArm(c, shoulder, p.ha, 3, 3, facing, shade(CREAM, 3.2 + lit), shade(SKIN, 3.4 + lit))
}

function drawFollow(c: Canvas, d: Dancer): void {
  const { pose: p, facing, flare, spin, lag, lit } = d
  const up = norm(sub(p.neck, p.hip))
  const down: V = [-up[0], -up[1]]
  const side: V = [-up[1], up[0]]
  const shoulder = mixV(p.neck, p.hip, 0.14)
  for (const foot of [p.fb, p.fa]) {
    const knee = joint(p.hip, foot, 3.4, 3.4, -facing)
    limb(c, p.hip, knee, shade(SKIN, 3 + lit))
    limb(c, knee, foot, shade(SKIN, 3.3 + lit))
    c.set(foot[0], foot[1], shade(RED, 3.4))
    c.set(foot[0] + facing, foot[1], shade(RED, 2.4))
  }
  drawArm(c, shoulder, p.hb, 2.8, 2.8, facing, shade(SKIN, 2.6 + lit), shade(SKIN, 3 + lit))
  const hemC = add(add(p.hip, [down[0] * 4.2, down[1] * 4.2]), [lag + Math.sin(spin) * flare * 0.8, -flare * 1.1])
  const hemW = 2.3 + flare * 2.4
  const waist = add(p.hip, [up[0] * 0.6, up[1] * 0.6])
  const poly: V[] = [
    add(waist, [side[0] * 1.3, side[1] * 1.3]),
    add(hemC, [side[0] * hemW, side[1] * hemW]),
    add(hemC, [-side[0] * hemW, -side[1] * hemW]),
    add(waist, [-side[0] * 1.3, -side[1] * 1.3]),
  ]
  const ax = norm(sub(hemC, waist))
  const len = Math.hypot(hemC[0] - waist[0], hemC[1] - waist[1])
  c.poly(poly, (x, y) => {
    const v = (x - waist[0]) * ax[0] + (y - waist[1]) * ax[1]
    const u = (x - waist[0]) * -ax[1] + (y - waist[1]) * ax[0]
    const fold = Math.floor((u + spin * 1.3) / 1.6) & 1
    if (v > len - 0.9 && flare > 0.35 && fold === 0) return shade(CREAM, 3.4 + lit)
    return shade(RED, 2.6 + lit + fold * 0.9 - (u * facing < -1 ? 0.6 : 0))
  })
  for (const k of [0, 1]) {
    const o: V = [side[0] * k * -facing, side[1] * k * -facing]
    limb(c, add(p.hip, o), add(p.neck, o), shade(RED, 3 + lit - k * 0.8))
  }
  const head = add(p.neck, [up[0] * 2, up[1] * 2])
  c.disc(head[0] - facing * 0.5 * Math.cos(spin) + up[0] * 0.4, head[1] + up[1] * 0.4, 1.7, (x, y) => shade(HAIR, 2 + lit + (y < head[1] ? 0.6 : 0)))
  c.disc(head[0] + facing * 0.5 * Math.cos(spin), head[1] - up[1] * -0.3, 1.05, shade(SKIN, 3.6 + lit))
  c.set(head[0] - facing * 1.4 * Math.cos(spin) + up[0] * 1.2, head[1] + up[1] * 1.2, shade(CREAM, 4))
  drawArm(c, shoulder, p.ha, 2.8, 2.8, facing, shade(SKIN, 3.4 + lit), shade(SKIN, 3.8 + lit))
}

function drawArm(c: Canvas, shoulder: V, hand: V, l1: number, l2: number, facing: number, sleeve: number, skin: number): void {
  const elbow = joint(shoulder, hand, l1, l2, facing)
  limb(c, shoulder, elbow, sleeve)
  limb(c, elbow, hand, sleeve)
  c.set(hand[0], hand[1], skin)
}

function norm(v: V): V {
  const l = Math.hypot(v[0], v[1]) || 1
  return [v[0] / l, v[1] / l]
}

type Player = { x: number; y: number; facing: number; kind: 'bass' | 'sax' | 'trumpet' | 'trombone' | 'drums' }
const BAND: Player[] = [
  { x: 7, y: 8, facing: 1, kind: 'bass' },
  { x: 13, y: 9, facing: 1, kind: 'sax' },
  { x: 19, y: 8, facing: 1, kind: 'trumpet' },
  { x: 45, y: 8, facing: -1, kind: 'trumpet' },
  { x: 51, y: 9, facing: -1, kind: 'trombone' },
  { x: 56, y: 8, facing: -1, kind: 'drums' },
]

const BOB = [0, 1, 1, 0, 1, 0]

function drawPlayer(c: Canvas, p: Player, f: number, i: number): void {
  const onBeat = Math.floor(f / BEAT) % 2 === BOB[i]
  const y = p.y + (onBeat ? 1 : 0)
  const accent = Math.floor(f / (BEAT * 2)) % 2 === 0 && f % (BEAT * 2) < 3
  const brass = (x: number, yy: number, hot = false) => c.set(x, yy, shade(GOLD, hot ? 3.4 : 2.3))
  c.rect(p.x - 1, y + 2, 3, 4, shade(TUX, 1.4))
  c.set(p.x + (p.facing > 0 ? 1 : -1), y + 2, shade(CREAM, 1.6))
  c.rect(p.x - 1, y, 2, 2, shade(SKIN, 1.6))
  c.set(p.x - 1, y, shade(TUX, 0.6))
  if (p.facing < 0) c.set(p.x, y, shade(TUX, 0.6))
  else c.set(p.x - 1, y + 1, shade(TUX, 0.6))
  const mx = p.x + (p.facing > 0 ? 1 : -2)
  if (p.kind === 'trumpet') {
    const lift = accent ? 1 : 0
    for (let k = 1; k <= 4; k++) brass(mx + p.facing * k, y + 1 - (k > 2 ? lift : 0))
    brass(mx + p.facing * 5, y - lift, true)
    brass(mx + p.facing * 5, y + 1 - lift, true)
  } else if (p.kind === 'sax') {
    brass(mx + p.facing, y + 1)
    for (let k = 2; k <= 4; k++) brass(mx + p.facing * 2, y + k)
    brass(mx + p.facing * 3, y + 4, true)
    brass(mx + p.facing * 3, y + 3 - (accent ? 1 : 0), true)
  } else if (p.kind === 'trombone') {
    const slide = 2 + (onBeat ? 2 : 0)
    for (let k = 1; k <= 3 + slide; k++) brass(mx + p.facing * k, y + 1)
    brass(mx + p.facing * (4 + slide), y + 2)
    brass(mx + p.facing * 1, y, true)
    brass(mx + p.facing * 2, y - 1, true)
  } else if (p.kind === 'bass') {
    const bx = p.x + 2
    c.ellipse(bx, y + 4, 1.4, 2.4, (x) => shade(HAT, 1.6 + (x < bx ? 0.6 : 0)))
    c.line(bx, y - 3, bx, y + 2, shade(TUX, 1.2))
    c.set(bx, y - 4, shade(HAT, 1.2))
  } else {
    c.disc(p.x - 3, y + 5, 2, (x, yy) => shade(CREAM, 1.8 + (yy < y + 5 ? 0.4 : 0) - (x > p.x - 3 ? 0.3 : 0)))
    c.set(p.x - 3, y + 5, shade(RED, 1.6))
    const crash = accent ? 1 : 0
    c.line(p.x - 6, y + 1 - crash, p.x - 4, y + 1, shade(GOLD, accent ? 3.6 : 2.4))
    c.set(p.x - 2 - (onBeat ? 1 : 0), y + 2 + (onBeat ? 0 : 1), shade(CREAM, 2))
  }
  if (p.kind !== 'bass' && p.kind !== 'drums') {
    c.rect(p.x - 2, p.y + 5, 5, 3, shade(VELVET, 2.4))
    c.rect(p.x - 2, p.y + 5, 5, 1, shade(GOLD, 2))
    c.set(p.x, p.y + 6, shade(GOLD, 1.4))
  }
}

function drawHall(c: Canvas, f: number, spot: number): void {
  const pulse = Math.floor(f / BEAT) % 2
  for (let y = 0; y <= STAGE_Y; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 32, (y - 19) * 1.15)
      const ring = Math.floor((r - 10) / 3)
      let color = shade(WALL, 1.4 + (y > 10 ? 0.4 : 0))
      if (r >= 10 && r < 34) color = shade(SHELL, 1.7 + (ring % 2) * 1.1 - ring * 0.18 - (y < 6 ? 0.5 : 0) + (Math.abs(x - 32) < 1 + y * 0.5 ? 0.5 + spot * 0.8 : 0))
      else if (r < 10) color = shade(WALL, 2.2 + (Math.abs(x - 32) < 1 + y * 0.5 ? 0.8 + spot : 0))
      c.set(x, y, color)
    }
  }
  for (let x = 0; x < W; x++) {
    c.set(x, STAGE_Y, shade(GOLD, 2.4 + (x % 8 === 0 ? 0.6 : 0)))
    c.set(x, STAGE_Y + 1, shade(VELVET, 1.4))
    c.set(x, STAGE_Y + 2, shade(VELVET, 0.8))
  }
  for (let k = 0; k < 11; k++) {
    const x = 2 + k * 6
    const on = (k + pulse) % 2 === 0
    c.set(x, STAGE_Y + 1, shade(GOLD, on ? 5 : 2.6))
    if (on) c.set(x + 1, STAGE_Y + 1, shade(GOLD, 3))
  }
  for (let y = STAGE_Y + 3; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = ((x + 0.5 - 32) / (y + 8.5)) * 7
      const uPrev = ((x - 0.5 - 32) / (y + 8.5)) * 7
      const board = Math.floor(u)
      const isSeam = board !== Math.floor(uPrev)
      const pool = ((x - 31) / 17) ** 2 + ((y - 28) / 3.6) ** 2
      let lit = 3 + (y - 19) * 0.12 + (pool < 1 ? 2 + spot * 0.8 : pool < 1.7 ? 1 : 0) - (isSeam ? 1 : 0) + ((board & 1) === 0 ? 0.3 : 0)
      for (let k = 0; k < 11; k++) {
        const bx = 2 + k * 6
        if (x === bx && (k + pulse) % 2 === 0 && y < 25) lit += 2.6 - (y - 19) * 0.4
      }
      c.set(x, y, shade(FLOOR, lit))
    }
  }
  for (let y = 0; y < STAGE_Y + 3; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < 4 ? x : x > 59 ? 63 - x : -1
      if (edge < 0) continue
      const fold = Math.sin((x + (x > 59 ? 1 : 0)) * 1.6) * 0.8
      c.set(x, y, shade(VELVET, 2.2 + fold + (edge === 3 ? -0.8 : 0) - y * 0.03))
    }
  }
  for (let x = 0; x < W; x++) {
    const drop = 2 + Math.round(Math.abs(Math.sin(((x - 4) * Math.PI) / 8)) * 1.6)
    for (let y = 0; y < drop; y++) c.set(x, y, shade(VELVET, 3 - y * 0.5))
    c.set(x, drop, shade(GOLD, 2.4 - (x % 2) * 0.6))
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const spin = f >= 24 && f < 46 ? spinOf(f) : 0
    const inAir = f >= AIR_FROM && f < AIR_TO
    const apex = inAir ? Math.sin(Math.PI * beat(f, AIR_FROM, AIR_TO)) : 0
    const spot = apex
    drawHall(c, f, spot)
    BAND.forEach((p, i) => drawPlayer(c, p, f, i))

    const dip = (k: number) => ((f + LOOP - k) % BEAT < 2 ? 0.45 : 0)
    let lead = keyed(LEAD, f)
    let follow = keyed(FOLLOW, f)
    if (!(f >= 47 && f < AIR_TO + 2)) {
      lead = offset(lead, [0, dip(0)])
      follow = offset(follow, [0, dip(1)])
    }
    let followFacing = -1
    let flare = 0
    let lag = 0
    if (spin > 0) {
      const hand: V = [33 + Math.sin(spin) * 0.9, 13.4 + Math.abs(Math.cos(spin)) * 0.5]
      lead = { ...lead, ha: hand }
      followFacing = Math.cos(spin) >= 0 ? -1 : 1
      flare = Math.sin(Math.PI * beat(f, 25, 46)) ** 0.6
      follow = { ...follow, ha: hand, hb: add(follow.hip, [-Math.cos(spin) * 3, -2.6 + Math.abs(Math.sin(spin))]) }
    }
    if (inAir) {
      const a = aerial(f, keyed(FOLLOW, AIR_FROM), keyed(FOLLOW, AIR_TO))
      follow = a
      flare = 0.25 + apex * 0.2
    }
    const prev = keyed(FOLLOW, (f + LOOP - 1) % LOOP).hip
    lag = clamp(-(follow.hip[0] - prev[0]) * 0.9, -1.5, 1.5)
    if (f >= AIR_TO && f < AIR_TO + 6) flare = Math.max(flare, (1 - beat(f, AIR_TO, AIR_TO + 6)) * 0.8)
    if (f >= 8 && f < 22) flare = Math.max(flare, Math.sin(Math.PI * beat(f, 8, 22)) * 0.45)

    for (const [hx, size] of [[lead.hip[0], 4], [follow.hip[0], inAir ? 3.2 - apex * 1.6 : 3.6]] as const) {
      c.ellipse(hx, FLOOR_Y + 0.6, size, 0.9, (x, y) => shade(FLOOR, 2.6 + (y - 19) * 0.12 - (inAir && size < 3.6 ? 0.2 : 1)))
    }

    const bulb = f === 59 ? 1 : f === 60 ? 0.5 : f === 61 ? 0.25 : 0
    const lit = 0.6 + bulb * 0.7
    drawLead(c, { pose: lead, facing: 1, spin: 0, flare: 0, lag: 0, lit })
    drawFollow(c, { pose: follow, facing: followFacing, spin, flare, lag, lit: lit + spot * 0.4 })

    const crowd = [[3, 27, 0], [9, 29, 1], [55, 29, 1], [61, 27, 0]] as const
    for (const [cx, cy, k] of crowd) {
      const y = cy + (Math.floor(f / BEAT) % 2 === k ? 1 : 0)
      const inward = cx < 32 ? 1 : -1
      c.ellipse(cx, y + 4, 3.6, 2.6, (x) => shade(TUX, x * inward > cx * inward + 2 ? 1.6 : 0.6))
      c.disc(cx, y, 1.6, (x) => shade(TUX, x * inward > cx * inward + 0.5 ? 2.2 : 0.8))
      c.set(cx + inward * 2, y, shade(SKIN, 1.2))
    }
    if (bulb > 0) {
      const [bx, by] = [57, 25]
      const r = bulb > 0.6 ? 3 : bulb > 0.3 ? 2 : 1
      for (let k = -r; k <= r; k++) {
        c.set(bx + k, by, shade(GOLD, 5 - Math.abs(k) * (bulb > 0.6 ? 0.8 : 1.4)))
        c.set(bx, by + k, shade(GOLD, 5 - Math.abs(k) * (bulb > 0.6 ? 0.8 : 1.4)))
      }
      if (bulb > 0.6) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) c.set(bx + dx, by + dy, shade(GOLD, 4))
    }
  })
}

export const scene: Scene = {
  verb: 'Jitterbugging', render, hero: 59,
  snaps: [
    { frames: 52, box: [30, 13, 36, 29], colors: [...RED.slice(2, 5), 0xe8ae7c, 0x1a203e], why: 'the toss: he throws her up off the floor' },
    { frames: [55, 56], box: [30, 11, 40, 15], colors: [0x232b50, 0x13172e], why: 'her body sweeps across the bandshell as she starts the backflip' },
    { frames: [57, 59], box: [25, 11, 34, 16], colors: [0x232b50, 0xb04e1e, 0xfbf6ea, 0xf8d2a4, 0xc42a2c], why: 'her head and hair whip round under her in the backflip' },
    { frames: 59, box: [54, 22, 60, 28], colors: [...GOLD.slice(3, 6)], why: 'a photographer\'s flashbulb pops at the top of the toss' },
    { frames: 60, box: [32, 12, 38, 16], colors: [0xb04e1e, 0x232b50], why: 'her hair whips round as the backflip comes over' },
    { frames: 61, box: [36, 11, 41, 13], colors: [0xb04e1e, 0xf8d2a4, 0x232b50, 0xfbf6ea], why: 'her head comes up out of the backflip' },
  ],
}
