import { H, W } from './engine'

export type Baked = { verb: string; palette: readonly number[]; isWide?: boolean; data: string }

export function decodeFrames({ palette, isWide = false, data }: Baked): Int32Array[] {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const frames: Int32Array[] = []
  let previous: Int32Array = new Int32Array(W * H)
  let at = 0
  while (at < bytes.length) {
    const frame = previous.slice()
    for (let px = 0; px < W * H; ) {
      px += bytes[at++] ?? W * H
      const count = bytes[at++] ?? 0
      for (let i = 0; i < count; i++) {
        const index = isWide ? (bytes[at++] ?? 0) | ((bytes[at++] ?? 0) << 8) : (bytes[at++] ?? 0)
        frame[px++] = palette[index] ?? 0
      }
    }
    frames.push(frame)
    previous = frame
  }

  return frames
}

export function readFrames(text: string): Int32Array[] {
  try {
    const baked: unknown = JSON.parse(text)
    return isBaked(baked) ? decodeFrames(baked) : []
  } catch {
    return []
  }
}
function isBaked(value: unknown): value is Baked {
  if (typeof value !== 'object' || value === null) return false
  const { verb, palette, isWide, data } = value as Record<string, unknown>

  return (
    typeof verb === 'string' &&
    Array.isArray(palette) &&
    palette.every(colour => Number.isInteger(colour) && colour >= 0 && colour <= 0xffffff) &&
    (isWide === undefined || typeof isWide === 'boolean') &&
    typeof data === 'string'
  )
}
export function encodeFrames(verb: string, frames: readonly Int32Array[]): Baked {
  const palette: number[] = []
  const indexOf = new Map<number, number>()
  const runs: number[] = []
  const isIndex: boolean[] = []
  let previous: Int32Array = new Int32Array(W * H)
  for (const frame of frames) {
    for (let px = 0; px < W * H; ) {
      let same = 0
      while (px < W * H && same < 255 && frame[px] === previous[px]) {
        same++
        px++
      }
      const changed: number[] = []
      while (px < W * H && changed.length < 255 && frame[px] !== previous[px]) {
        const colour = frame[px] ?? 0
        let index = indexOf.get(colour)
        if (index === undefined) {
          index = palette.push(colour) - 1
          indexOf.set(colour, index)
        }
        changed.push(index)
        px++
      }
      runs.push(same, changed.length, ...changed)
      isIndex.push(false, false, ...changed.map(() => true))
    }
    previous = frame
  }
  const isWide = palette.length > 256
  const bytes = isWide ? runs.flatMap((b, i) => (isIndex[i] ? [b & 0xff, b >> 8] : [b])) : runs
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.slice(i, i + 0x8000))
  return { verb, palette, ...(isWide && { isWide }), data: btoa(binary) }
}