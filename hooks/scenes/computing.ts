import { Canvas, TAU, beat, clamp, ease, hash, hex, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('172124 1f2d2d 293b39 344944 425a52 536b61 677f72 7e9586')
const CAB = hex('10131b 181d29 222939 2e374b 3d4860 505d78 6a7792 8f9ab2 c0c8d8')
const TRIM = hex('2b2620 4a4136 72665a 9c8e76 c4b596 e4d8bc')
const PANEL = hex('060709 0d0f14 161a22')
const METAL = hex('1b1a21 3e3b47 6b6774 a5a0aa d8d3d8')
const TAPE = hex('24150e 43281a 63402a')
const FLOOR = hex('17181c 23252b 33363d 464a50 5d6166 777b7c 939590')
const CARD = hex('a08e66 d8c69a f2e6c4')
const TUBE = 0xeaf4ff
const LAMP = [[0x2c2824, 0xfff1cc], [0x3a2412, 0xffb648], [0x3a2412, 0xffb648], [0x3a1410, 0xff5e3a]] as const
const GREEN = [0x0f2a18, 0x6cf08c] as const

const FLOOR_Y = 25

const vignette = (x: number, y: number) => (((x - 34) / 34) ** 2 + ((y - 12) / 22) ** 2) * 1.3

const flashAt = (f: number) => [1.3, 0.6, 0.25][f - 42] ?? 0

const DRIVES = [1, 13]
const SPINS: [number, number, number][][] = [
  [[12, 26, 8], [28, 35, -3]],
  [[16, 30, 7], [33, 40, -2]],
]
function reelAngle(d: number, f: number): number {
  let a = 0
  for (const [s, e, n] of SPINS[d] ?? []) a += ((n * TAU) / 3) * ease.inOut(beat(f, s, e))
  return a
}

function drawReel(c: Canvas, cx: number, cy: number, angle: number, speed: number, flash: number): void {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const r = Math.hypot(dx, dy)
      if (r > 3.2) continue
      const top = dy < 0 ? 0.7 : dy > 0 ? -0.4 : 0
      let color: number
      if (r < 0.5) color = PANEL[0] ?? 0
      else if (r < 1.5) color = shade(METAL, 3.3 + top + flash)
      else if (r > 2.6) color = shade(METAL, (dx + dy < -1 ? 2.8 : dx + dy > 1 ? 0.8 : 1.5) + flash)
      else if (speed > 0.75) color = shade(TAPE, 1.8 + flash)
      else {
        const isSpoke = Math.cos(3 * (Math.atan2(dy, dx) - angle)) > 0.72
        color = isSpoke ? shade(METAL, 2.4 + top + flash) : shade(TAPE, 0.8 + top * 0.6 + flash)
      }
      c.set(cx + dx, cy + dy, color)
    }
  }
}

function lampOn(i: number, j: number, f: number): boolean {
  if (f >= 42 && f < 45) return true
  if (f >= 38 && f < 42) return i <= (f - 38) * 2 + 1
  if (f >= 9 && f < 38) {
    const step = Math.floor(f / 2)
    if (j === 0) return mod(step, 7) === i || mod(step - 1, 7) === i
    return hash(i, j, step) > 0.5
  }
  const step = Math.floor(mod(f - 45, LOOP) / 3)
  if (j === 3) return ((step >> (6 - i)) & 1) === 1
  return (hash(i, j, 7) > 0.6) !== (j === 1 && i === 6 - (step % 7))
}

const BLANK = [' 22222', '222222', '222222', '222222', '111111']
const PUNCHED = [' 22222', '2h2hh2', '22222h', 'h2h222', '111111']
const CARD_PAINT = { '1': CARD[1] ?? 0, '2': CARD[2] ?? 0, h: PANEL[0] ?? 0 }

function drawCard(c: Canvas, x: number, y: number, art: string[], clipBelow: number): void {
  art.forEach((row, j) => {
    if (y + j >= clipBelow) return
    for (let i = 0; i < row.length; i++) {
      const k = row[i] as keyof typeof CARD_PAINT
      if (k in CARD_PAINT) c.set(x + i, y + j, CARD_PAINT[k])
    }
  })
}

function throatCard(f: number): [number, number] | null {
  if (f < 5) return [52, 8]
  if (f < 7) return [52, 7]
  if (f < 12) return [52, 8 + (f - 7)]
  if (f < 58) return null
  return [[46, 48, 50, 52, 53][f - 58] ?? 52, f < 61 ? 7 : 8]
}
const POP = [11, 6, 3, 2, 2, 2, 3, 4, 6, 9, 12, 15, 13, 14]
function popY(f: number): number | null {
  return POP[f - 42] ?? null
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const flash = flashAt(f)
    for (let y = 0; y < FLOOR_Y; y++) {
      for (let x = 0; x < W; x++) {
        const underTube = (x >= 3 && x <= 22) || (x >= 38 && x <= 60)
        const level = 5.6 - y * 0.16 + (underTube && y <= 4 ? 0.7 : 0) + flash - vignette(x, y)
        c.set(x, y, shade(WALL, y === FLOOR_Y - 1 ? 0.6 : level))
      }
    }
    for (let x = 0; x < W; x++) {
      const isTube = (x >= 3 && x <= 22) || (x >= 38 && x <= 60)
      c.set(x, 0, shade(CAB, isTube ? 5 : 1.5))
      if (isTube) c.set(x, 1, TUBE)
    }
    c.sprite(50, 2, [' rrr ', 'rfhfr', 'rfhhr', 'rfffr', ' rrr '], {
      r: shade(METAL, 2 + flash), f: shade(TRIM, 5 + flash), h: PANEL[0] ?? 0,
    })
    const face = (x0: number, x1: number, y0: number, y1: number, base: number, ramp: readonly number[] = CAB) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const edge = x === x0 ? 0.8 : x === x1 ? -0.9 : 0
          c.set(x, y, shade(ramp, base - (y - y0) * 0.06 + edge + flash - vignette(x, y) * 0.7))
        }
      }
    }
    DRIVES.forEach((x0, d) => {
      face(x0, x0 + 10, 4, 24, 4.4)
      for (let x = x0; x <= x0 + 10; x++) c.set(x, 3, shade(CAB, 7 + flash - (x === x0 + 10 ? 1 : 0)))
      for (let x = x0; x <= x0 + 10; x++) c.set(x, 24, shade(CAB, 1.4 + flash))
      for (let y = 5; y <= 20; y++) for (let x = x0 + 1; x <= x0 + 9; x++) c.set(x, y, PANEL[y === 5 ? 0 : 1] ?? 0)
      const angle = reelAngle(d, f)
      const speed = Math.abs(reelAngle(d, f + 0.5) - reelAngle(d, f - 0.5))
      const vel = reelAngle(d, f) - reelAngle(d, f - 1)
      drawReel(c, x0 + 4, 9, angle, speed, flash)
      drawReel(c, x0 + 4, 16, angle + 0.6, speed, flash)
      const bottom = 13 + Math.round(clamp(vel * 2.2, -6, 5))
      for (let y = 6; y <= 19; y++) {
        for (const x of [x0 + 8, x0 + 9]) c.set(x, y, y <= bottom ? shade(TAPE, y === bottom ? 2 : 1 + flash) : PANEL[2] ?? 0)
      }
      for (let x = x0 + 1; x <= x0 + 9; x++) c.set(x, 22, shade(TRIM, 3.6 + flash))
      c.set(x0 + 2, 22, LAMP[0][1])
      c.set(x0 + 4, 22, speed > 0.05 ? LAMP[1][1] : LAMP[1][0])
      c.set(x0 + 7, 22, PANEL[1] ?? 0)
      c.set(x0 + 8, 22, PANEL[1] ?? 0)
    })
    face(26, 42, 5, 24, 4.2)
    for (let x = 26; x <= 42; x++) c.set(x, 4, shade(CAB, 7 + flash - (x === 42 ? 1 : 0)))
    for (let y = 6; y <= 14; y++) for (let x = 27; x <= 41; x++) c.set(x, y, PANEL[1] ?? 0)
    let lit = 0
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 7; i++) {
        const isOn = lampOn(i, j, f)
        if (isOn) lit++
        c.set(28 + i * 2, 7 + j * 2, (LAMP[j] ?? LAMP[0])[isOn ? 1 : 0])
      }
    }
    for (let y = 6; y <= 14; y++) for (let x = 27; x <= 41; x++) if (c.get(x, y) === PANEL[1]) c.set(x, y, PANEL[lit > 16 ? 2 : 1] ?? 0)
    for (let x = 27; x <= 41; x++) c.set(x, 16, shade(TRIM, 3.4 + flash))
    for (let i = 0; i < 7; i++) c.set(28 + i * 2, 16, shade(METAL, hash(i, 3) > 0.5 ? 4 : 1.5))
    for (let x = 25; x <= 43; x++) {
      c.set(x, 18, shade(TRIM, 5 + flash - (x === 43 ? 1.2 : 0)))
      c.set(x, 19, shade(TRIM, 2.2 + flash))
    }
    for (let y = 20; y <= 23; y++) c.set(34, y, shade(CAB, 2.4 + flash))
    c.set(33, 21, shade(METAL, 3.5))
    c.set(35, 21, shade(METAL, 3.5))
    for (let x = 26; x <= 42; x++) c.set(x, 24, shade(CAB, 1.4 + flash))
    face(45, 63, 14, 24, 4.4)
    for (let x = 45; x <= 63; x++) {
      c.set(x, 13, shade(TRIM, 5 + flash))
      for (let y = 14; y <= 17; y++) c.set(x, y, shade(TRIM, 3.8 - (y - 14) * 0.25 + flash + (x === 45 ? 0.6 : 0)))
      c.set(x, 18, shade(CAB, 2.2 + flash))
      c.set(x, 24, shade(CAB, 1.4 + flash))
    }
    for (let x = 52; x <= 57; x++) c.set(x, 13, PANEL[0] ?? 0)
    const isBusy = f >= 13 && f < 42
    c.set(47, 16, isBusy ? GREEN[0] : GREEN[1])
    c.set(49, 16, isBusy && Math.floor(f / 3) % 2 === 0 ? LAMP[1][1] : LAMP[1][0])
    drawCard(c, 45, 7, BLANK, 10)
    const throat = throatCard(f)
    if (throat) drawCard(c, throat[0], throat[1], BLANK, 13)
    for (let y = 10; y <= 12; y++) for (let x = 44; x <= 51; x++) c.set(x, y, shade(CAB, (y === 10 ? 6 : 3.4) + flash + (x === 44 ? 0.8 : x === 51 ? -0.8 : 0)))
    for (let y = 15; y <= 19; y++) for (let x = 56; x <= 63; x++) c.set(x, y, PANEL[y === 15 ? 0 : 1] ?? 0)
    drawCard(c, 57, 15, PUNCHED, 20)
    const py = popY(f)
    if (py !== null) drawCard(c, 57, py, PUNCHED, 20)
    for (let x = 56; x <= 63; x++) c.set(x, 20, shade(CAB, 6 + flash))
    for (let y = FLOOR_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const row = y < 27 ? 0 : y < 30 ? 1 : 2
        const col = Math.floor(((x - 32) * 10) / (6 * (y - 15)) + 0.5)
        const isDark = (row + col) % 2 !== 0
        const under = (x >= 1 && x <= 11) || (x >= 13 && x <= 23) || (x >= 26 && x <= 42) || x >= 45
        const shadow = under ? (y === FLOOR_Y ? 1.6 : y === FLOOR_Y + 1 ? 0.7 : 0) : 0
        c.set(x, y, shade(FLOOR, 4 - (y - FLOOR_Y) * 0.1 - (isDark ? 0.7 : 0) - shadow + flash * 0.6 - vignette(x, y)))
      }
    }
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Computing',
  render,
  hero: 44,
  snaps: [
    { frames: [42, 45], box: [0, 0, W - 1, H - 1], why: 'every lamp lights at once and the whole room flashes, fading back over three frames until the lamps drop to the idle count' },
    { frames: [42, 44], box: [57, 2, 62, 19], why: 'the finished card shoots up out of the stacker like toast, four and five pixels a frame, easing into its hang' },
  ],
}