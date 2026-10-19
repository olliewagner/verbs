import { Canvas, TAU, beat, clamp, ease, hex, mod, shade, smoothstep, type Scene, type Snap } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const CX = 32

const WALL = hex('0f1c24 15292f 1d3a3e 274d4c 33615a 467868 5f9077 7ea988 a6c39c d2deb4')
const WOOD = hex('1e1214 2f1b19 46271e 653726 8a4c2e b06838 d68f4c eec24a')
const ROOF = hex('140c0e 21140f 331d14 4a2a1a 643a22 82502e a8703e')
const FACE = hex('7a6a56 a8967a d4c4a2 efe4c8 fbf6e8')
const BRASS = hex('2c1a08 4e300c 7a4c10 a8701a d1982a eec24a fae58a fffbd8')
const BIRD = hex('0e1430 141c3c 22377a 3c62b8 6e9ae4 b4d2f8')
const BELLY = hex('3a3040 6e5c58 b8a07e e6d2ac f6ead0')
const STEEL = hex('22222e 4a4a5c 7c7c92 b4b4c8 ecece8')
const BEAK = hex('5a2a10 c06a1c f0a030 ffd070')
const STAR = hex('a8701a d1982a fae58a fffbd8')
const MARK = WALL[9] ?? 0

function sunAt(x: number, y: number): number {
  const s = x + 0.6 * y
  if (s < 23 || s > 65 || (s >= 45 && s <= 46.5)) return 0
  return s < 24.5 || s > 63.5 ? 0.5 : 1
}

const TWITCH = 18
const TWITCH2 = 26
const HOLD_FROM = 29.5
const HOLD_FOR = 4
const GO = 34
const WHIRL_END = 64

const SHEET =
  '.......................a.' +
  '...........' +
  'aoihfccfhia' +
  '..' +
  'aihxcchia' +
  'aixcccfhia' +
  '......' +
  'aoiihh' +
  'ddddddss' +
  'zioa' +
  '....'
const JOLTS: readonly (readonly [number, number, boolean])[] = [
  [TWITCH, 1, false], [TWITCH2, -1, true], [GO, 1, true], [37, 1, false], [40, 1, false], [43, 1, true], [47, -1, false],
  [50, -1, true], [54, 1, true], [57, 1, false], [60, 1, true], [64, -1, false], [70, 1, true], [74, -1, true], [92, 1, false],
]
const shake = (f: number) => clamp(JOLTS.reduce((s, [t, d]) => s + (f === t ? d : f === t + 1 ? -d : 0), 0), -1, 1)
function jangle(f: number, k: number): number {
  return clamp(Math.round(JOLTS.reduce((s, [t, , isHard]) => {
    const dt = mod(f - t, LOOP)
    const lag = dt - k
    return !isHard || lag < 0 || lag > 12 ? s : s + 1.3 * Math.exp(-lag / 4) * Math.sin(lag * 0.9)
  }, 0)), -1, 1)
}
function run(f: number, a: number, b: number, up: number, down: number): number {
  if (f <= a) return 0
  if (f >= b) return 1
  const speed = (t: number) => smoothstep(a, a + up, t) * (1 - smoothstep(b - down, b, t))
  const area = (to: number) => {
    let s = 0
    for (let t = a; t < to; t += 0.125) s += speed(t + 0.0625) * 0.125
    return s
  }

  return area(f) / area(b)
}
const MINUTE = 0
const HOUR = 90
const FLICK_MINUTE: Readonly<Record<number, number>> = { 18: 30, 19: 13, 20: -5, 21: 1, 25: -12, 26: 42, 27: 18, 28: -7, 29: 2 }
const FLICK_HOUR: Readonly<Record<number, number>> = { 25: 8, 26: -20, 27: -8, 28: 3 }

function hands(f: number): [number, number] {
  const creep = ease.inOut(beat(f, 30, GO))
  const whirl = run(f, GO, WHIRL_END, 7, 12)
  const settle = f > WHIRL_END ? 1 - Math.exp(-(f - WHIRL_END) / 1.5) * Math.cos((f - WHIRL_END) * 0.9) : 0
  const minute = MINUTE + (FLICK_MINUTE[f] ?? 0) - 24 * creep + (1080 + 24 + 16) * whirl - 16 * settle
  const hour = HOUR + (FLICK_HOUR[f] ?? 0) + 12 * creep - (720 + 12 + 10) * whirl + 10 * settle
  return [minute, hour]
}

function swing(f: number): number {
  const t = f - clamp(f - HOLD_FROM, 0, HOLD_FOR)
  const rate = 6 / (LOOP - HOLD_FOR)
  return rate * t + 0.25 - rate * HOLD_FROM
}
function pendulum(f: number): number {
  const amp = 0.24 + 0.44 * smoothstep(GO - 1, GO + 4, f) * (1 - smoothstep(58, 80, f))

  return amp * Math.sin(TAU * swing(f))
}

function spring(f: number, out: number, back: number): [number, number, boolean] {
  if (f < out || f > back + 1) return [0, 0, false]
  if (f === out) return [6, 0, true]
  if (f === back) return [5, 0, true]
  if (f === back + 1) return [1, 0, true]
  if (f === back - 1) return [10.6, 0, false]
  const t = f - out - 1
  return [9 + 2.6 * Math.exp(-t / 2.5) * Math.cos(t * Math.PI), 2.2 * Math.exp(-t / 5) * Math.sin(t * 0.9), false]
}
const SPRINGS = [
  { out: 43, back: 68, side: 1, y: 16 },
  { out: 54, back: 72, side: -1, y: 19 },
] as const
const GEAR_LOOSE = 46
const GEAR_OFF = 49
const RAIL = 23
type Gear = { x: number; y: number; turn: number; vx: number; vy: number; isBehind: boolean }
const GEAR_PATH: (Gear | undefined)[] = (() => {
  const path: (Gear | undefined)[] = []
  let x = CX + 10
  let y = 6
  let vx = 0.95
  let vy = -1.4
  let turn = 0
  for (let f = 0; f < LOOP; f++) {
    if (f < GEAR_LOOSE || x > W + 3) {
      path.push(undefined)
      continue
    }
    if (f < GEAR_OFF) {
      path.push({ x: CX + 10, y: 8 - (f - GEAR_LOOSE), turn: f - GEAR_LOOSE, vx: 0, vy: 0, isBehind: true })
      continue
    }
    path.push({ x, y, turn, vx, vy, isBehind: f === GEAR_OFF })
    if (y < RAIL || vy !== 0) {
      vy += 0.28
      y += vy
      if (y > RAIL) {
        y = RAIL - (y - RAIL) * 0.4
        vy = vy > 1.6 ? -vy * 0.42 : 0
        if (vy === 0) y = RAIL
      }
    }
    x += vx
    turn += 1
  }
  return path
})()
const GEAR_POSES = [
  ['..t..', '.ggg.', 'tgogt', '.ggg.', '..t..'],
  ['...t.', 'tggg.', '.gog.', '.gggt', '.t...'],
  ['t...t', '.ggg.', '.gog.', '.ggg.', 't...t'],
  ['.t...', '.gggt', '.gog.', 'tggg.', '...t.'],
]
const CUCKOO = [
  '....hH...',
  '...hhheH.',
  '..bhhhhkk',
  'tbbbwww..',
  'ttbbwwu..',
  '...uu....',
]
const CUCKOO_CALL = [
  '....hH..k',
  '...hhhek.',
  '..bhhhhm.',
  'tbbbwwwqq',
  'ttbbwwu..',
  '...uu....',
]
const CUCKOO_SAG = [
  '.........',
  '....hH...',
  '..bhhheH.',
  'tbbhhhhkk',
  'ttbbwww..',
  '...uuu...',
]
const DEPTH: Readonly<Record<string, number>> = { i: 4, h: 4, f: 5, c: 5, x: 6, d: 5, s: 5, z: 4 }
const MOTES = [[51, 3, 0.1], [56, 11, 0.45], [47, 19, 0.8], [19, 18, 0.3], [54, 22, 0.65]] as const
function motes(f: number): Set<number> {
  const stir = smoothstep(GO - 2, GO + 6, f) * (1 - smoothstep(60, 80, f))
  const at = new Set<number>()
  for (const [x0, y0, p] of MOTES) {
    const x = x0 + 1.5 * Math.sin(TAU * (f / LOOP + p)) + 2 * stir * Math.sin(TAU * ((3 * f) / LOOP + p))
    const y = y0 + 2 * Math.sin(TAU * (f / LOOP + 1.3 * p) + 1) + 1.5 * stir * Math.cos(TAU * ((4 * f) / LOOP + p))
    at.add(Math.round(y) * W + Math.round(x))
  }
  return at
}

const SNAPS: readonly Snap[] = (() => {
  const snaps: Snap[] = []
  const frames = (keep: (f: number) => boolean) => Array.from({ length: LOOP }, (_, f) => f).filter(keep)
  const stage = (f: number) => SHEET[mod(f, LOOP)] ?? '.'
  for (const f of frames(f => stage(f) !== stage(f - 1) && ('.aoi'.includes(stage(f)) || '.aoi'.includes(stage(f - 1))))) {
    snaps.push({ frames: f, box: [CX - 6, 3, CX + 6, 11], why: 'The cuckoo door swings a pose a frame (shut, ajar, open), and the cuckoo comes out of the dark doorway into the light.' })
  }
  for (const [t] of JOLTS) {
    snaps.push({ frames: [t, t + 1], box: [CX - 18, 0, CX + 18, 25], why: 'A knock jolts the case a pixel one way and then the other, swinging 2 px in a frame; where it lands on the thin hands or a lunge, a pixel is the whole shape.' })
  }
  for (const { out: from, back, side, y } of SPRINGS) {
    const near = CX + side * 11
    const far = CX + side * 25
    snaps.push({ frames: [from - 2, back + 1], box: [Math.min(near, far), y - 4, Math.max(near, far), y + 4], why: 'A spring bursts out on a smear frame, boings longer and shorter on alternate frames, and is sucked back in over two smear frames.' })
  }
  for (const f of frames(f => 'cx'.includes(stage(f)) || 'cx'.includes(stage(f - 1)))) {
    snaps.push({ frames: f, box: [CX + 4, 4, CX + 13, 11], why: 'Arcs of sound leave the beak while the cuckoo calls, and stop when it shuts.' })
  }
  snaps.push({ frames: [60, 61], box: [CX - 10, 1, CX + 10, 8], why: 'The biggest lunge bursts out of the gable in lines that fly out and fade.' })
  for (const [t] of JOLTS.filter(([, , isHard]) => isHard)) {
    snaps.push({ frames: [t, t + 1], box: [CX - 21, 6, CX + 21, 23], colors: [MARK, WALL[7] ?? 0], why: 'Rattle marks flash beside the case on a hard knock and fly out, fading, the frame after.' })
  }
  GEAR_PATH.forEach((g, f) => {
    if (g === undefined) return
    const speed = Math.hypot(g.vx, g.vy)
    const tail = speed > 2 ? [g.x - (g.vx / speed) * 5, g.y - (g.vy / speed) * 5] : [g.x, g.y]
    snaps.push({
      frames: f,
      box: [Math.floor(Math.min(g.x, tail[0] ?? g.x)) - 4, Math.floor(Math.min(g.y, tail[1] ?? g.y)) - 3, Math.ceil(Math.max(g.x, tail[0] ?? g.x)) + 4, Math.ceil(Math.max(g.y, tail[1] ?? g.y)) + 3],
      why: 'The gear tumbles a sixteenth of a turn a frame, so its little pose changes every frame, and its sunward tooth glints.',
    })
  })
  return snaps
})()
type Layer = Map<number, number>
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const sx = shake(f)
    const cx = CX + sx
    const clock: Layer = new Map()
    const fx: Layer = new Map()
    const put = (x: number, y: number, col: number, layer: Layer = clock) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) layer.set(iy * W + ix, col)
    }
    const lit = (x: number, y: number) => sunAt(x, y) * 1.1

    const a = pendulum(f)
    const bob = (angle: number) => [CX + Math.sin(angle) * 8, 21 + Math.cos(angle) * 8] as const
    const [bobX, bobY] = bob(a)
    const [lastX, lastY] = bob(pendulum(f - 1))
    for (let k = 0; k <= 8; k++) {
      const x = CX + Math.sin(a) * k
      const y = 21 + Math.cos(a) * k
      if (y >= 24) put(x, y, shade(BRASS, 2.4 + lit(x, y), 0, 0))
    }
    if (Math.hypot(bobX - lastX, bobY - lastY) > 2) {
      put((bobX + lastX) / 2, (bobY + lastY) / 2, BRASS[2] ?? 0)
      put((bobX + lastX) / 2, (bobY + lastY) / 2 + 1, BRASS[1] ?? 0)
    }
    for (let y = Math.floor(bobY - 2); y <= bobY + 2; y++) {
      for (let x = Math.floor(bobX - 2); x <= bobX + 2; x++) {
        const d = Math.hypot(x - bobX, (y - bobY) * 1.15)
        if (d <= 1.9) put(x, y, shade(BRASS, 4 + ((x - bobX) * 0.7 - (y - bobY) * 0.7) * 0.9 + lit(x, y), 0, 0))
      }
    }
    for (const [k, wx] of [CX - 9, CX + 9].entries()) {
      const top = 26 + jangle(f, k)
      for (let y = 25; y < top; y++) put(wx, y, (top - y) % 2 ? STEEL[2] ?? 0 : STEEL[1] ?? 0)
      const cone = ['.a.', 'aba', 'aba', 'aba', '.a.']
      cone.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.') return
        const x = wx - 1 + i
        const y = top + j
        put(x, y, shade(BRASS, (ch === 'b' ? 3 : 2) + (i === 2 ? 1.4 : i === 0 ? -0.6 : 0) + lit(x, y), 0, 0))
      }))
    }
    const caseAt = new Set<number>()
    const wood = (x: number, y: number, col: number) => {
      put(x, y, col)
      caseAt.add(Math.round(y) * W + Math.round(x))
    }
    for (let y = 10; y <= 22; y++) {
      for (let x = cx - 11; x <= cx + 11; x++) {
        const edge = x === cx + 11 ? 1.4 : x === cx - 11 ? -1 : 0
        const frame = (x === cx - 9 || x === cx + 9) && y >= 11 && y <= 21 ? (x > cx ? 1 : -0.6) : 0
        wood(x, y, shade(WOOD, 3 + edge + frame + lit(x, y), x, y))
      }
    }
    for (let x = cx - 12; x <= cx + 12; x++) {
      wood(x, 23, shade(WOOD, 4.4 + lit(x, 23) + (x > cx + 9 ? 0.8 : 0), 0, 0))
      wood(x, 24, shade(WOOD, 2.2 + lit(x, 24), 0, 0))
      if (x > cx - 11 && x < cx + 11 && (x - cx + 32) % 4 < 2) wood(x, 25, shade(WOOD, 1.8 + lit(x, 25), 0, 0))
    }
    const roofTop = (k: number) => Math.floor((k + 1) / 2)
    for (let y = 1; y <= 9; y++) {
      for (let x = cx - 10; x <= cx + 10; x++) {
        const under = roofTop(Math.abs(x - cx)) + 3
        if (y < under) continue
        const plank = (x - cx + 30) % 3 === 0 ? -0.8 : 0
        wood(x, y, shade(WOOD, 3.6 + plank + lit(x, y) + (x > cx ? 0.4 : 0) - (y === under ? 1.4 : 0), x, y))
      }
    }
    const stage = SHEET[f] ?? '.'
    const door = stage === '.' ? 'shut' : stage === 'a' ? 'ajar' : 'open'
    for (let y = 3; y <= 8; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const isArch = y === 3 || (y === 4 && Math.abs(x - cx) === 2)
        if (y === 3 && Math.abs(x - cx) > 1) continue
        if (isArch || Math.abs(x - cx) === 3) {
          wood(x, y, shade(WOOD, x === cx + 3 && y > 4 ? 2.2 : 1.2, 0, 0))
          continue
        }
        const isDoor = door === 'shut' || (door === 'ajar' && x <= cx)
        const level = !isDoor ? 0.3 + (y === 4 ? 0.3 : 0)
          : door === 'ajar' ? 4.4 + (x === cx ? 1.2 : 0)
            : 3 + (x === cx + 2 ? 1.4 : 0) - (x === cx - 1 ? 0.6 : 0)
        wood(x, y, x === cx + 1 && y === 6 && door === 'shut' ? BRASS[6] ?? 0 : shade(WOOD, level + lit(x, y) * 0.5, 0, 0))
      }
    }
    if (door === 'open') {
      for (let y = 4; y <= 8; y++) wood(cx - 4, y, shade(WOOD, 5.6, 0, 0))
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k <= 17; k++) {
        const x = cx + side * k
        const top = roofTop(k)
        const isTooth = k >= 3 && k <= 16 && k % 2 === 1
        for (let t = 0; t < (isTooth ? 4 : 3); t++) {
          const level = (side > 0 ? 4 : 2.4) + (t === 0 ? 1.2 : t >= 2 ? -1 : 0) + lit(x, top + 2) * 0.8
          wood(x, top + t, shade(ROOF, level, x, top + t))
        }
      }
    }
    wood(cx, 0, ROOF[6] ?? 0)
    for (let y = 9; y <= 23; y++) {
      for (let x = cx - 7; x <= cx + 7; x++) {
        const dx = x - cx
        const dy = y - 16
        const r = Math.hypot(dx, dy)
        const toSun = r > 0 ? (dx * 0.7 - dy * 0.7) / r : 0
        if (r > 5.4 && r <= 6.4 && toSun < -0.45) wood(x, y, shade(WOOD, 1.8 + lit(x, y) * 0.5, 0, 0))
        if (r > 5.4) continue
        if (r > 4.4) wood(x, y, BRASS[toSun > 0.4 ? 6 : toSun > -0.5 ? 4 : 3] ?? 0)
        else wood(x, y, FACE[r > 3.4 && toSun > 0.3 ? 2 : 3] ?? 0)
      }
    }
    const toSun = (nx: number, ny: number) => (nx * 0.7 - ny * 0.7) / Math.hypot(nx, ny)
    for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const) {
      const bx = cx + dx * 6
      const by = 16 + dy * 4
      const cells = [
        [0, 0, 2.2], [dx, dy, 2.2], [2 * dx, 2 * dy, 4 + 1.6 * toSun(dx, dy)],
        [dx, 0, 3.6 + 1.6 * toSun(0, -dy)], [2 * dx, dy, 3.6 + 1.6 * toSun(0, -dy)],
        [0, dy, 3.6 + 1.6 * toSun(-dx, 0)], [dx, 2 * dy, 3.6 + 1.6 * toSun(-dx, 0)],
      ] as const
      for (const [ox, oy, level] of cells) wood(bx + ox, by + oy, shade(WOOD, level + lit(bx + ox, by + oy), 0, 0))
    }
    for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]] as const) put(cx + dx, 16 + dy, FACE[1] ?? 0)
    const [minute, hour] = hands(f)
    const [lastMinute, lastHour] = hands(f - 1)
    const hand = (deg: number, len: number, col: number) => {
      const r = (deg * Math.PI) / 180
      for (let k = 1; k <= len; k++) put(cx + Math.sin(r) * k, 16 - Math.cos(r) * k, col)
    }
    for (const [now, last, len] of [[minute, lastMinute, 4], [hour, lastHour, 2]] as const) {
      const sweep = now - last
      if (Math.abs(sweep) < 20) continue
      const steps = Math.min(4, Math.floor(Math.abs(sweep) / 12))
      for (let s = steps; s >= 1; s--) hand(now - (sweep * s) / (steps + 1), len, FACE[s > steps / 2 ? 2 : 1] ?? 0)
    }
    hand(hour, 2, WOOD[0] ?? 0)
    hand(minute, 4, WOOD[0] ?? 0)
    put(cx, 16, BRASS[5] ?? 0)
    for (const { out: from, back, side, y: y0 } of SPRINGS) {
      if (f === from - 1 || f === from - 2) {
        put(cx + side * 12, y0, STEEL[f === from - 1 ? 3 : 2] ?? 0)
      }
      const [len, tip, isBlur] = spring(f, from, back)
      if (len <= 0) continue
      const period = clamp(Math.round(len / 3), 2, 4)
      for (let k = 0; k < Math.round(len); k++) {
        const x = cx + side * (12 + k)
        const y = Math.round(y0 + tip * (k / Math.max(1, len)) ** 2)
        if (isBlur) {
          put(x, y - 1, STEEL[2] ?? 0)
          put(x, y, STEEL[3] ?? 0)
          put(x, y + 1, STEEL[1] ?? 0)
          continue
        }
        const p = k % period
        if (p === 0) put(x, y, STEEL[3] ?? 0)
        else if (p === period - 1 && period > 2) {
          put(x, y - 1, STEEL[2] ?? 0)
          put(x, y + 1, STEEL[3] ?? 0)
        } else {
          put(x, y - 1, STEEL[4] ?? 0)
          put(x, y + 1, STEEL[1] ?? 0)
        }
      }
      const tx = cx + side * (12 + Math.round(len))
      const ty = Math.round(y0 + tip)
      put(tx, ty - 1, BRASS[6] ?? 0)
      put(tx, ty, BRASS[4] ?? 0)
      put(tx, ty + 1, BRASS[2] ?? 0)
      if (isBlur) {
        for (const dy of [-2, 2]) for (let k = 1; k < len - 1; k += 2) put(cx + side * (12 + k), y0 + dy, MARK, fx)
      }
    }
    if ('ihfcxdsz'.includes(stage)) {
      const isDizzy = stage === 'd' || stage === 's'
      const at = SHEET.indexOf('d')
      const sway = (g: number) => (isDizzy ? Math.round(1.2 * Math.sin(((g - at) * TAU) / 10)) : 0)
      const by = DEPTH[stage] ?? 6
      const dim = stage === 'i' ? 2 : stage === 'h' || stage === 'z' ? 1 : 0
      const isSagging = stage === 's' || stage === 'z' || (stage === 'i' && f > at)
      const art = stage === 'c' || stage === 'x' ? CUCKOO_CALL : isSagging ? CUCKOO_SAG : CUCKOO
      art.forEach((row, j) => [...row].forEach((ch, i) => {
        const x = cx - 4 + i + (j <= 2 ? sway(f - 1) : sway(f))
        const y = by + j
        if (stage === 'i' && (y < 4 || y > 8 || x < cx - 2 || x > cx + 2)) return
        const col = ch === 'h' ? BIRD[3 - dim]
          : ch === 'H' ? BIRD[4 - dim]
            : ch === 'b' ? BIRD[2 - dim]
              : ch === 't' ? BIRD[Math.max(0, 1 - dim)]
                : ch === 'w' ? BELLY[3 - dim]
                  : ch === 'u' ? BELLY[2 - dim]
                    : ch === 'e' ? (isDizzy ? STEEL[4] : BIRD[0])
                      : ch === 'k' ? BEAK[2 - dim]
                        : ch === 'q' ? BEAK[1]
                          : ch === 'm' ? BEAK[0] : undefined
        if (col !== undefined) put(x, y, col)
      }))
      if (stage === 'c' || stage === 'x') {
        let n = 0
        while ('cx'.includes(SHEET[f - n - 1] ?? '.')) n++
        const ax = cx + 6 + Math.min(n, 2)
        const ay = by + 2
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1]] as const) put(ax + dx, ay + dy, MARK, fx)
        if (n >= 1) for (const [dx, dy] of [[0, -2], [1, -1], [1, 0], [1, 1], [0, 2]] as const) put(ax + 2 + dx, ay + dy, MARK, fx)
      }
      if (isDizzy) {
        const t = f - at
        const shown = Math.min(t + 1, SHEET.lastIndexOf('s') - f + 1)
        for (let k = 0; k < 3; k++) {
          const ang = t * 0.36 + (k * TAU) / 3
          const x = cx + 1 + sway(f - 1) + Math.cos(ang) * 4.5
          const y = by - 2 + Math.sin(ang) * 1.2
          const isFront = Math.sin(ang) > 0
          if (shown <= 1 || !isFront) {
            put(x, y, STAR[shown <= 1 ? 1 : 0] ?? 0, fx)
            continue
          }
          put(x, y, STAR[3] ?? 0, fx)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, STAR[2] ?? 0, fx)
        }
      }
      const burst = stage === 'x' && f > 55 ? 0 : SHEET[f - 1] === 'x' && f > 56 ? 1 : -1
      if (burst >= 0) {
        for (const [dx, dy] of [[-6, -2], [-7, -3], [6, -2], [7, -3], [-7, 1], [-8, 1], [7, 1], [8, 1]] as const) {
          put(cx + dx + Math.sign(dx) * burst, 6 + dy - (dy < 0 ? burst : 0), burst ? WALL[7] ?? 0 : MARK, fx)
        }
      }
    }
    const g = GEAR_PATH[f]
    if (g !== undefined) {
      const pose = GEAR_POSES[Math.floor(g.turn) % 4] ?? []
      const gx = Math.round(g.x + sx * (g.isBehind ? 1 : 0))
      const gy = Math.round(g.y)
      pose.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.') return
        const x = gx - 2 + i
        const y = gy - 2 + j
        if (g.isBehind && caseAt.has(y * W + x)) return
        const toSun = i - j
        const isGlint = ch === 't' && toSun >= 2 && g.turn % 4 < 2 && sunAt(x, y) > 0
        const col = isGlint ? BRASS[7] : ch === 'o' ? BRASS[1] : ch === 't' ? BRASS[toSun > 0 ? 6 : toSun < 0 ? 3 : 4] : BRASS[toSun > 0 ? 5 : toSun < 0 ? 3 : 4]
        put(x, y, col ?? 0)
      }))
      const speed = Math.hypot(g.vx, g.vy)
      if (speed > 2) {
        const ux = g.vx / speed
        const uy = g.vy / speed
        for (const k of [4, 5]) put(gx - ux * k, gy - uy * k, MARK, fx)
      }
    }
    const knock = JOLTS.find(([t, , isHard]) => isHard && (f === t || f === t + 1))
    if (knock !== undefined) {
      const away = f - knock[0]
      for (const side of [-1, 1]) {
        for (const [dx, y] of [[19, 7], [19, 8], [14, 12], [14, 13], [14, 21], [14, 22]] as const) {
          put(CX + side * (dx + away), y, away ? WALL[7] ?? 0 : MARK, fx)
        }
      }
    }
    const dust = motes(f)
    c.fill((x, y) => {
      const sun = sunAt(x, y)
      const shadow = sun > 0 && clock.has((y - 2) * W + x + 3)
      if (sun === 1 && !shadow && y < 26 && dust.has(y * W + x)) return WALL[8] ?? 0
      const light = shadow ? 0.6 : sun * 2.8
      if (y >= 26) {
        const rail = y === 26 ? 2.4 : y === 27 ? -0.6 : 0
        const panel = y > 27 && (x % 16 === 3 || y === 31) ? -0.8 : 0
        return shade(WOOD, 1.6 + rail + panel + light * 0.6, x, y)
      }
      const stripe = x % 8 < 2 ? -1 : 0
      const mx = x % 8
      const my = y % 6
      const motif = (mx === 5 && (my === 2 || my === 4)) || (my === 3 && (mx === 4 || mx === 5 || mx === 6)) ? 1 : 0
      return shade(WALL, 2.4 + stripe + motif + light, x, y)
    })
    for (const [k, col] of clock) c.px[k] = col
    for (const [k, col] of fx) c.px[k] = col

    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Discombobulating', render, hero: 61, snaps: SNAPS }