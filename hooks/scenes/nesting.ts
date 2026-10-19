import { clamp, frames, hex, lerp, mix, mod, particles, type Canvas, type Ramp, type Scene, type Snap } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const WALL = hex('0e0c22 15132e 1c1a3a 262448 33305a 46406c 5c5278')
const WOOD = hex('1c0e0a 32180e 4e2814 6e3c1c 935426 b46e34 d08c48 e8ac64')
const SKIN = hex('b07a62 e0a888 f6d0b0 fff0e0')
const CREAM = hex('8a6e52 c4a67e eed6ac fff4dc')
const RED = hex('2e0810 5a0e18 8a1820 b82a26 dc4a34 f27c50 fcb07c')
const TEAL = hex('0a1a2e 10304e 164c70 1e6e92 3292b0 5ab8c8 9adcdc')
const GOLD = hex('2e1806 5a340a 8a5612 b87c1c dca434 f4cc62 fcec9e')
const GREEN = hex('0a2012 103a1c 185a26 247e30 3ca23a 6cc24e a8e07a')
const PLUM = hex('2a0a26 4e1240 781c5a 9e2c72 c4488c e47aa8 f6b2cc')
const EYE = 0x1a0e18
const CHEEK = 0xf08080
const MOUTH = 0xc8283a

type Doll = { h: number; w: number; body: Ramp; scarf: Ramp; flower: number; art?: readonly string[] }
const DOLLS: Doll[] = [
  { h: 21, w: 14, body: RED, scarf: GOLD, flower: 0xd83030 },
  { h: 16, w: 11, body: TEAL, scarf: RED, flower: 0xd83030 },
  { h: 12, w: 9, body: GOLD, scarf: GREEN, flower: 0xd83030 },
  { h: 10, w: 7, body: GREEN, scarf: PLUM, flower: 0xf0b030 },
  { h: 8, w: 6, body: PLUM, scarf: RED, flower: 0xf0b030, art: ['.ssss.', 'sffffs', 'seffes', 'scffcs', '.ssss.', 'bbccbb', 'bccccb', '.bbbb.'] },
]
const FLOOR = 26
const lidRows = (d: Doll) => Math.round(d.h * 0.52)

const SPOTS = (() => {
  const xs: number[] = []
  let x = 10
  DOLLS.forEach((d, k) => {
    if (k > 0) x += (DOLLS[k - 1]?.w ?? 0) / 2 + 3 + d.w / 2
    xs.push(Math.round(x))
  })
  return xs
})()

function profile(v: number): number {
  const head = v <= 0.5 ? 0.66 * Math.sqrt(Math.max(0, 1 - ((v - 0.25) / 0.25) ** 2)) : 0
  const body = v >= 0.28 ? Math.sqrt(Math.max(0, 1 - ((v - 0.7) / 0.42) ** 2)) : 0
  return Math.min(Math.max(head, body), v > 0.9 ? 0.84 : 1)
}

type Pixel = { i: number; r: number; color: number }

function paint(d: Doll, isWinking: boolean): Pixel[] {
  const out: Pixel[] = []
  if (d.art) {
    d.art.forEach((row, r) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        const level = 4.4 - i * 0.6 + (r === 0 ? 0.6 : 0)
        const color =
          ch === 's' ? d.scarf[Math.round(level)] :
          ch === 'f' ? SKIN[i < 3 ? 3 : 2] :
          ch === 'e' ? (isWinking && i > 2 ? SKIN[1] : EYE) :
          ch === 'b' ? d.body[Math.round(level)] :
          ch === 'c' ? (r === 3 ? CHEEK : CREAM[r === 5 ? 3 : 2]) : undefined
        if (color !== undefined) out.push({ i, r, color })
      }
    })
    return out
  }
  const faceHalf = Math.max(1.2, d.w * 0.21)
  const faceTop = Math.round(d.h * 0.13)
  const faceBottom = Math.round(d.h * 0.37)
  const eyeRow = faceTop + Math.max(1, Math.round((faceBottom - faceTop) * 0.5))
  const apart = faceHalf >= 2.5 ? 1 : 0
  const [eyeL, eyeR] = d.w % 2 === 0 ? [d.w / 2 - 1 - apart, d.w / 2 + apart] : [(d.w - 1) / 2 - 1, (d.w - 1) / 2 + 1]
  const cx = d.w / 2
  const seam = lidRows(d) - 1
  for (let r = 0; r < d.h; r++) {
    const v = (r + 0.5) / d.h
    const hw = (d.w / 2) * profile(v)
    for (let i = 0; i < d.w; i++) {
      const dx = i + 0.5 - cx
      if (Math.abs(dx) > hw + 0.3) continue
      const s = dx / Math.max(1, hw)
      const isFace = r >= faceTop && r <= faceBottom && Math.abs(dx) <= faceHalf * Math.sqrt(1 - ((r + 0.5 - (faceTop + faceBottom + 1) / 2) / ((faceBottom - faceTop + 2) / 2)) ** 2)
      const isHead = v < 0.46
      const apronV = (v - 0.73) / 0.2
      const apronH = dx / (hw * 0.62)
      const isApron = !isHead && apronV * apronV + apronH * apronH <= 1
      let level = 3.1 - s * 1.5
      if (s > -0.66 && s < -0.36) level += 1.3
      if (Math.abs(s) > 0.84) level -= 0.8
      let color: number
      if (isFace) {
        color = SKIN[Math.round(clamp(2.2 - s * 0.8, 0, 3))] ?? 0
        if (d.h >= 12 && r === faceTop) color = d.scarf === GOLD ? 0x8a4a1c : 0x6a3a1c
        if (r === eyeRow && (i === eyeL || i === eyeR)) color = EYE
        if (d.h >= 12 && r === eyeRow + 1 && (i === eyeL - 1 || i === eyeR + 1)) color = CHEEK
        if (d.h >= 16 && r === eyeRow + 2 && Math.abs(dx) < 1) color = MOUTH
      } else if (isHead) {
        color = d.scarf[Math.round(clamp(level + (v < 0.1 ? 0.6 : 0), 0, 6))] ?? 0
      } else if (isApron) {
        color = CREAM[Math.round(clamp(2.3 - s * 1.2 + (apronV < -0.6 ? 0.4 : 0), 0, 3))] ?? 0
        const fr = Math.round(d.h * 0.74)
        if (d.h >= 9) {
          const fx = Math.round(dx - 0.5 + (d.w % 2 ? 0.5 : 0))
          if (r === fr && fx === 0) color = 0xf8e070
          else if (Math.abs(r - fr) + Math.abs(fx) === 1) color = d.flower
          else if (d.h >= 16 && r === fr + 2 && Math.abs(fx) === 1) color = GREEN[4] ?? 0
        }
      } else {
        color = d.body[Math.round(clamp(level, 0, 6))] ?? 0
      }
      if (r === seam && !isFace) color = mix(color, GOLD[5] ?? 0, 0.55)
      out.push({ i, r, color })
    }
  }
  return out
}
const PAINTED = DOLLS.map(d => paint(d, false))
const WINKING = paint(DOLLS[4] as Doll, true)

type Pose = { x: number; bottom: number; lid: number; squash: number; part: 'all' | 'lid' | 'base' | 'rim'; isWinking?: boolean }

function drawDoll(c: Canvas, k: number, p: Pose, mask: Uint8Array) {
  const d = DOLLS[k] as Doll
  const px = p.isWinking ? WINKING : PAINTED[k] ?? []
  const h = d.h - p.squash
  const spread = d.w >= 8 && p.squash > 0 ? p.squash : 0
  const left = Math.round(p.x - d.w / 2) - spread
  const seam = lidRows(d)
  for (const q of px) {
    const isLid = q.r < seam
    if (p.part === 'lid' && !isLid) continue
    if (p.part === 'base' && (isLid || q.r === seam)) continue
    if (p.part === 'rim' && q.r !== seam) continue
    const row = Math.round((q.r * h) / d.h)
    const rows = Math.max(1, Math.round(((q.r + 1) * h) / d.h) - row)
    const col = spread ? Math.round((q.i * (d.w + 2 * spread)) / d.w) : q.i
    const x = left + col
    const y = Math.round(p.bottom) - h + 1 + row - (isLid ? Math.round(p.lid) : 0)
    let color = q.color
    if (p.part === 'rim' && q.i > 0 && q.i < d.w - 1 && (px.some(o => o.r === q.r && o.i === q.i - 1) && px.some(o => o.r === q.r && o.i === q.i + 1))) color = 0x14080c
    for (let yy = y; yy < y + rows; yy++) {
      c.set(x, yy, color)
      if (spread > 0 && col + 1 < Math.round(((q.i + 1) * (d.w + 2 * spread)) / d.w)) c.set(x + 1, yy, color)
      if (x >= 0 && x < W && yy >= 0 && yy < H) mask[yy * W + x] = 1
    }
  }
}

type Out = { rise: readonly number[]; hop: readonly (readonly [number, number])[] }
const OUTS: Out[] = [
  { rise: [], hop: [] },
  { rise: [5, 7, 9, 10], hop: [[0.19, 11], [0.38, 11], [0.57, 9], [0.76, 5], [1, 0]] },
  { rise: [4, 6, 7, 8], hop: [[0.2, 9], [0.4, 9], [0.6, 7], [0.8, 4], [1, 0]] },
  { rise: [2, 4, 6], hop: [[0.25, 7], [0.5, 6], [0.75, 4], [1, 0]] },
  { rise: [2, 4, 5], hop: [[0.25, 6], [0.5, 5], [0.75, 3], [1, 0]] },
]
type In = { hop: readonly (readonly [number, number])[] }
const INS: In[] = [
  { hop: [] },
  { hop: [[0.05, 4], [0.2, 8], [0.45, 11], [0.72, 12], [0.92, 12], [1, 10], [1, 8], [1, 6], [1, 0]] },
  { hop: [[0.05, 3], [0.2, 7], [0.45, 9], [0.7, 10], [0.9, 10], [1, 8], [1, 7], [1, 5], [1, 0]] },
  { hop: [[0.06, 3], [0.25, 6], [0.55, 8], [0.82, 8], [1, 7], [1, 5], [1, 3], [1, 0]] },
  { hop: [[0.08, 3], [0.33, 5], [0.67, 6], [0.92, 6], [1, 5], [1, 4], [1, 2], [1, 0]] },
]
const OUT_START = 3
const OUT_AT: number[] = [0]
const IN_AT: number[] = []
for (let k = 1, at = OUT_START; k < DOLLS.length; k++) {
  OUT_AT.push(at)
  at += 4 + (OUTS[k]?.rise.length ?? 0) + (OUTS[k]?.hop.length ?? 0)
}
for (let k = 1, at = LOOP - 1; k < DOLLS.length; k++) {
  at -= INS[k]?.hop.length ?? 0
  IN_AT[k] = at
}
const TINY_AT = (OUT_AT[4] ?? 0) + 3 + (OUTS[4]?.rise.length ?? 0) + (OUTS[4]?.hop.length ?? 0)
const TINY_HOP = [1, 2, 3, 3, 2, 1]
const WINK_AT = TINY_AT + 3
const POP: Record<number, readonly number[]> = { 4: [1, 2, 3, 4], 5: [1, 3, 4, 5], 6: [1, 3, 5, 6] }

type State = { x: number; bottom: number; squash: number; lid: number; isInside: boolean; isFlying: boolean; isWinking: boolean }

function lidFor(k: number, up: number): number {
  const parent = DOLLS[k - 1] as Doll
  const child = DOLLS[k] as Doll
  const rise = parent.h - lidRows(parent)
  const gap = parent.h - child.h
  return Math.min(rise - gap + 2, Math.max(0, up - gap + 1))
}
function statesAt(f: number): State[] {
  const st: State[] = DOLLS.map((_, k) => ({ x: SPOTS[k] ?? 0, bottom: FLOOR, squash: 0, lid: 0, isInside: false, isFlying: false, isWinking: false }))
  for (let k = 1; k < DOLLS.length; k++) {
    const parent = DOLLS[k - 1] as Doll
    const me = st[k] as State
    const pa = st[k - 1] as State
    const rise = parent.h - lidRows(parent)
    const top = lidFor(k, rise)
    const px = SPOTS[k - 1] ?? 0
    const sx = SPOTS[k] ?? 0
    const out = OUTS[k] as Out
    const inn = INS[k] as In
    const o = OUT_AT[k] ?? 0
    const i = IN_AT[k] ?? 0
    const u = f - o
    const R = out.rise.length
    const Hp = out.hop.length
    if (u >= 0 && u < 2) pa.x += u === 0 ? 1 : -1
    if (u >= 0 && u < 2 + R) {
      const up = u < 2 ? 0 : out.rise[u - 2] ?? 0
      Object.assign(me, { x: px, bottom: FLOOR - up, isInside: true })
      pa.lid = lidFor(k, up)
    } else if (u >= 2 + R && u < 2 + R + Hp) {
      const n = u - 2 - R
      const [share, above] = out.hop[n] ?? [1, 0]
      Object.assign(me, { x: Math.round(lerp(px, sx, share)), bottom: FLOOR - above, isFlying: n < Hp - 1, squash: n === Hp - 2 ? -1 : 0 })
      pa.lid = n < Hp - 2 ? top : n === Hp - 2 ? top - 1 : Math.round(top * 0.35)
    } else if (u === 2 + R + Hp) {
      me.squash = 1
      pa.squash = 1
    } else if (u === 3 + R + Hp) {
      pa.lid = 1
    }
    const v = f - i
    if (v >= -4 && v < 0) pa.lid = (POP[top] ?? [])[v + 4] ?? top
    if (v === 0) {
      me.squash = 1
      pa.lid = top
    }
    if (v > 0 && v <= inn.hop.length) {
      const [share, above] = inn.hop[v - 1] ?? [1, 0]
      const isInside = share >= 1 && above <= rise
      Object.assign(me, { x: Math.round(lerp(sx, px, share)), bottom: FLOOR - above, isInside, isFlying: !isInside, squash: v === 1 ? -1 : 0 })
      pa.lid = isInside ? Math.min(top, lidFor(k, above)) : top
      if (v === inn.hop.length) pa.squash = 1
    }
    if (f < o || f >= i + inn.hop.length) Object.assign(me, { x: px, bottom: FLOOR, isInside: true })
  }
  const tiny = st[4] as State
  const t = f - TINY_AT
  if (t >= 0 && t < TINY_HOP.length) tiny.bottom = FLOOR - (TINY_HOP[t] ?? 0)
  if (t === TINY_HOP.length) tiny.squash = 1
  if (f >= WINK_AT && f < (IN_AT[4] ?? 0)) tiny.isWinking = true
  for (let k = 1; k < DOLLS.length; k++) {
    const me = st[k] as State
    const pa = st[k - 1] as State
    if (me.isInside && me.bottom === FLOOR) me.x = pa.x
  }
  return st
}
type Box = [x0: number, y0: number, x1: number, y1: number]

function boxOf(k: number, s: State): Box {
  const d = DOLLS[k] as Doll
  const spread = d.w >= 8 && s.squash > 0 ? s.squash : 0
  const left = Math.round(s.x - d.w / 2) - spread
  const bottom = Math.round(s.bottom)
  const right = Math.max(left + d.w - 1 + 2 * spread, Math.round(s.x + d.w * 0.5))
  return [Math.max(0, left), Math.max(0, bottom - (d.h - s.squash) + 1 - Math.round(s.lid)), Math.min(W - 1, right), bottom >= FLOOR - 1 ? 29 : bottom]
}
const unite = (a: Box | undefined, b: Box): Box => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b)

function meantSnaps(): Snap[] {
  const snaps: Snap[] = []
  const at = (f: number) => statesAt(mod(f, LOOP))
  const boxAt = (k: number, f: number) => boxOf(k, at(f)[k] as State)
  const over = (k: number, from: number, to: number, box?: Box) => {
    for (let f = from; f <= to; f++) box = unite(box, boxAt(k, f))
    return box as Box
  }
  for (let k = 1; k < DOLLS.length; k++) {
    const o = OUT_AT[k] ?? 0
    const lands = o + 1 + (OUTS[k]?.rise.length ?? 0) + (OUTS[k]?.hop.length ?? 0)
    const takeoff = lands - (OUTS[k]?.hop.length ?? 0) + 1
    snaps.push({ frames: [takeoff, lands + 1], box: over(k, takeoff - 1, lands + 1), why: 'it hops out of its parent fast, smeared back along its path, and squashes once it is down' })
    snaps.push({ frames: lands + 1, box: over(k - 1, lands, lands + 2), why: 'the hanging lid drops back with a clack, and the doll squashes for that one frame' })
    if (k === DOLLS.length - 1) snaps.push({ frames: o + 2, box: boxAt(k - 1, o + 2), why: 'the lid lifts and the tiniest\'s red scarf shows under it' })
    const i = IN_AT[k] ?? 0
    const len = INS[k]?.hop.length ?? 0
    let drops = i + 1
    while (drops < i + len && !at(drops)[k]?.isInside) drops++
    snaps.push({ frames: [i + 1, drops], box: over(k, i, drops), why: 'it springs off its crouch and hops back in fast, smeared back along its path' })
    snaps.push({ frames: i + len, box: over(k - 1, i + len - 1, i + len), why: 'the lid comes down on its head with a clack, and the doll squashes for that one frame' })
  }
  return snaps
}
function drawRoom(c: Canvas) {
  for (let y = 0; y < 27; y++) {
    for (let x = 0; x < W; x++) {
      const stripe = mod(x, 6) < 2 ? 0.5 : 0
      const slant = x - y * 0.5
      const isPane = slant > 3 && slant < 25 && y > 1 && y < 22
      const isBar = Math.abs(slant - 14) < 1 || Math.abs(y - 11.5) < 1
      const sun = isPane && !isBar ? 1.7 : 0
      const fall = 1.9 - (y / 27) * 0.5 - Math.abs(x - 24) / 50
      c.set(x, y, WALL[Math.round(clamp(fall + sun + stripe, 0, 6))] ?? 0)
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 27; y < H; y++) {
      const grain = y === 28 && mod(x + 5, 13) < 5 ? -0.6 : y === 29 && mod(x, 17) < 6 ? 0.5 : 0
      const sun = x - y * 0.5 > -8 && x - y * 0.5 < 16 ? 1 : 0
      const level = y === 27 ? 5.4 : y < 30 ? 4.2 - (y - 28) * 0.5 + grain + sun : y === 30 ? 3.6 : 1.6
      c.set(x, y, WOOD[Math.round(clamp(level, 0, 7))] ?? 0)
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawRoom(c)
    for (const p of particles(f, LOOP, 7, 60, 0x0d0)) {
      const x = Math.round(4 + p.r[1] * 26 + Math.sin(p.t * 0.12 + p.r[2] * 6) * 1.5)
      const y = Math.round(2 + p.r[3] * 6 + p.t * 0.22)
      const slant = x - y * 0.5
      if (slant > 4 && slant < 24 && y < 21 && Math.sin(Math.PI * p.age) > 0.3) c.tint(x, y, 0xd8d0f0, 0.45)
    }
    const mask = new Uint8Array(W * H)
    const st = statesAt(f)
    const was = statesAt(mod(f - 1, LOOP))
    const isOpen = (k: number) => (st[k]?.lid ?? 0) > 0.4
    const isCarried = (k: number) => k > 0 && (st[k]?.isInside === true || st[k]?.isFlying === true)
    st.forEach((s, k) => {
      if (s.isInside || s.bottom < FLOOR) return
      const w = DOLLS[k]?.w ?? 0
      for (let i = Math.round(s.x - w * 0.35); i <= Math.round(s.x + w * 0.5); i++) c.set(i, 27, mix(c.get(i, 27), WOOD[1] ?? 0, 0.6))
    })

    const smear = (k: number) => {
      const s = st[k] as State
      const p = was[k] as State
      if (s.isInside || !(s.isFlying || p.isFlying)) return
      const h = DOLLS[k]?.h ?? 0
      const dx = s.x - p.x
      const dTop = s.bottom - (h - s.squash) - (p.bottom - (h - p.squash))
      const dBottom = s.bottom - p.bottom
      const dy = Math.abs(dTop) > Math.abs(dBottom) ? dTop : dBottom
      if (Math.hypot(dx, dy) < 4) return
      const m = Math.max(Math.abs(Math.round(dx / 2)), Math.abs(Math.round(dy / 2)))
      for (let j = m; j >= 1; j--) {
        const back = { x: s.x - Math.round((dx / 2) * (j / m)), bottom: s.bottom - Math.round((dy / 2) * (j / m)) }
        drawDoll(c, k, { ...back, lid: 0, squash: s.squash, isWinking: s.isWinking, part: 'all' }, mask)
      }
    }
    const draw = (k: number) => {
      const s = st[k] as State
      const child = k + 1 < DOLLS.length && isCarried(k + 1) ? k + 1 : -1
      const pose = { x: s.x, bottom: s.bottom, lid: 0, squash: s.squash, isWinking: s.isWinking }
      if (isOpen(k)) {
        drawDoll(c, k, { ...pose, part: 'rim' }, mask)
        if (child >= 0) draw(child)
        drawDoll(c, k, { ...pose, part: 'base' }, mask)
        drawDoll(c, k, { ...pose, lid: s.lid, squash: 0, part: 'lid' }, mask)
      } else {
        if (child >= 0 && !st[child]?.isInside) draw(child)
        smear(k)
        drawDoll(c, k, { ...pose, part: 'all' }, mask)
      }
    }
    for (let k = 0; k < DOLLS.length; k++) if (!isCarried(k)) draw(k)
    for (let y = 28; y < 30; y++) {
      for (let x = 0; x < W; x++) {
        const src = 2 * 27 - y
        if (mask[src * W + x]) c.set(x, y, mix(c.get(x, y), c.get(x, src), 0.3))
      }
    }
  })
}
export const scene: Scene = { verb: 'Nesting', render, hero: 11, snaps: meantSnaps() }