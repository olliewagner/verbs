import { H, W } from './engine'

export type Size = 'small' | 'medium' | 'large'

export const SIZE_ORDER: readonly Size[] = ['small', 'medium', 'large']

export const HALF_BLOCK = 0x2584
export const FIVE_EIGHTHS_BLOCK = 0x2585

export function pairGlyph(termProgram: string | undefined): number {
  return termProgram === 'Apple_Terminal' ? FIVE_EIGHTHS_BLOCK : HALF_BLOCK
}

type Lab = readonly [number, number, number]

const labs = new Map<number, Lab>()
function lab(c: number): Lab {
  const kept = labs.get(c)
  if (kept !== undefined) return kept
  const linear = (v: number) => (v <= 10.31475 ? v / 3294.6 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  const r = linear((c >> 16) & 255)
  const g = linear((c >> 8) & 255)
  const b = linear(c & 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817028649 * g + 0.6299787379 * b)
  const out = [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const
  if (labs.size > 8192) labs.clear()
  labs.set(c, out)

  return out
}

function at(px: Int32Array, x: number, y: number): number {
  return (px[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))] ?? 0) & 0xffffff
}

function standout(px: Int32Array, x0: number, x1: number, y0: number, y1: number): number {
  let l0 = 0
  let a0 = 0
  let b0 = 0
  let n = 0
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const [l, a, b] = lab(at(px, x, y))
      l0 += l
      a0 += a
      b0 += b
      n++
    }
  }
  l0 /= n
  a0 /= n
  b0 /= n
  let best = at(px, x0, y0)
  let bestScore = -1
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = at(px, x, y)
      let count = 0
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (at(px, xx, yy) === c) count++
      const [l, a, b] = lab(c)
      const score = count * ((l - l0) ** 2 + (a - a0) ** 2 + (b - b0) ** 2)
      if (score > bestScore + 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && l > lab(best)[0])) {
        best = c
        bestScore = score
      }
    }
  }
  return best
}
function half(px: Int32Array): Int32Array {
  const w = W / 2
  const h = H / 2
  const picked = new Int32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) picked[y * w + x] = standout(px, 2 * x, 2 * x + 1, 2 * y, 2 * y + 1)
  const out = picked.slice()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = picked[y * w + x] ?? 0
      const around: number[] = []
      if (x > 0) around.push(picked[y * w + x - 1] ?? 0)
      if (x < w - 1) around.push(picked[y * w + x + 1] ?? 0)
      if (y > 0) around.push(picked[(y - 1) * w + x] ?? 0)
      if (y < h - 1) around.push(picked[(y + 1) * w + x] ?? 0)
      if (around.includes(c)) continue
      const l = lab(c)[0]
      if (around.every(v => lab(v)[0] < l - 0.12)) continue
      const block = [at(px, 2 * x, 2 * y), at(px, 2 * x + 1, 2 * y), at(px, 2 * x, 2 * y + 1), at(px, 2 * x + 1, 2 * y + 1)]
      const mean = [0, 0, 0]
      for (const v of block) for (let k = 0; k < 3; k++) mean[k]! += (lab(v)[k] ?? 0) / 4
      let best: number | undefined
      let bestDistance = Infinity
      for (const v of around) {
        if (!block.includes(v)) continue
        const [vl, va, vb] = lab(v)
        const distance = (vl - (mean[0] ?? 0)) ** 2 + (va - (mean[1] ?? 0)) ** 2 + (vb - (mean[2] ?? 0)) ** 2
        if (distance < bestDistance) {
          best = v
          bestDistance = distance
        }
      }
      if (best !== undefined) out[y * w + x] = best
    }
  }
  return out
}
function quarterSpan(i: number): readonly [number, number] {
  const base = 4 * Math.floor(i / 3)
  const k = i % 3
  return k === 0 ? [base, base] : k === 1 ? [base + 1, base + 2] : [base + 3, base + 3]
}
function threeQuarters(px: Int32Array): Int32Array {
  const w = (W * 3) / 4
  const h = (H * 3) / 4
  const out = new Int32Array(w * h)
  for (let y = 0; y < h; y++) {
    const [y0, y1] = quarterSpan(y)
    for (let x = 0; x < w; x++) {
      const [x0, x1] = quarterSpan(x)
      out[y * w + x] = x0 === x1 && y0 === y1 ? at(px, x0, y0) : standout(px, x0, x1, y0, y1)
    }
  }
  return out
}

export const SIZES: Record<Size, { width: number; height: number; scale: (px: Int32Array) => Int32Array }> = {
  small: { width: W / 2, height: H / 2, scale: half },
  medium: { width: (W * 3) / 4, height: (H * 3) / 4, scale: threeQuarters },
  large: { width: W, height: H, scale: px => px },
}
export function cellsOf(size: Size): { columns: number; rows: number } {
  return { columns: SIZES[size].width, rows: SIZES[size].height / 2 }
}
export function encodeAt(size: Size, frame: Int32Array, glyph: number): string {
  const { width, height, scale } = SIZES[size]
  return encode(scale(frame), width, height, glyph)
}
export function encode(px: Int32Array, width: number, height: number, glyph: number): string {
  const words = new Uint32Array(width * (height / 2) * 3)
  for (let row = 0; row < height / 2; row++) {
    for (let x = 0; x < width; x++) {
      const cell = (row * width + x) * 3
      words[cell] = glyph
      words[cell + 1] = (px[(2 * row + 1) * width + x] ?? 0) & 0xffffff
      words[cell + 2] = (px[2 * row * width + x] ?? 0) & 0xffffff
    }
  }
  const bytes = new Uint8Array(words.buffer)
  let binary = ''

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[])
  }
  return btoa(binary)
}

const CORNER_COLUMNS = 4
const MOST_OF_HEIGHT = 0.4
export function sizesThatFit(viewport: { columns: number; rows: number } | undefined): readonly Size[] {
  const fitting = SIZE_ORDER.filter(size => {
    const { columns, rows } = cellsOf(size)
    return viewport === undefined || (columns + CORNER_COLUMNS <= viewport.columns && rows <= viewport.rows * MOST_OF_HEIGHT)
  })
  return fitting.length > 0 ? fitting : ['small']
}
export function fit(preferred: Size, viewport: { columns: number; rows: number } | undefined): Size {
  const fitting = sizesThatFit(viewport)
  const limit = SIZE_ORDER.indexOf(preferred)
  return [...fitting].reverse().find(size => SIZE_ORDER.indexOf(size) <= limit) ?? 'small'
}