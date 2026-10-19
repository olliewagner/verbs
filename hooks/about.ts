import { Canvas, W, hex } from './engine'

export type IconSize = 'big' | 'small'
export type Icon = { width: number; height: number; frames: readonly Int32Array[] }

const [BASE, BASE_LIT, HOLE] = [0x22130d, 0x3d2416, 0xfbe8bd]
const SKY = hex('4f8fcb 6eaedc 96cbe8 c4e3ee')
const [HILL, GRASS_LIT, GRASS, GRASS_DARK] = [0xa9cfb9, 0x8cc04e, 0x5f9a3a, 0x437429]
const KID = { '#': 0x241d3a, r: 0xd8373f, d: 0x9b2338 }

type Pose = 'stand' | 'crouch' | 'hooray' | 'star'

const ART: Record<IconSize, {
  width: number
  height: number
  holes: readonly number[]
  holeRows: readonly number[]
  x0: number
  x1: number
  y0: number
  sky: readonly number[]
  hills: readonly string[]
  ground: number
  grass: readonly number[]
  poses: Record<Pose, readonly string[]>
}> = {
  big: {
    width: 16,
    height: 16,
    holes: [1, 14],
    holeRows: [1, 5, 9, 13],
    x0: 3,
    x1: 12,
    y0: 1,
    sky: [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
    hills: ['.##......#', '####...###', '##########'],
    ground: 12,
    grass: [GRASS_LIT, GRASS, GRASS_DARK],
    poses: {
      stand: ['..##..', '..##..', '.rrrr.', '.rrrr.', '..dd..', '.#..#.', '.#..#.'],
      crouch: ['..##..', '..##..', 'rrrrrr', '.dddd.', '##..##'],
      hooray: ['.r..r.', '.r##r.', '..##..', '..rr..', '..rr..', '..dd..', '..##..', '..##..'],
      star: ['r.##.r', '.r##r.', '..rr..', '..dd..', '.#..#.', '#....#'],
    },
  },
  small: {
    width: 12,
    height: 10,
    holes: [1, 10],
    holeRows: [1, 4, 7],
    x0: 3,
    x1: 8,
    y0: 1,
    sky: [0, 0, 1, 2, 3, 3],
    hills: ['#....#', '##..##'],
    ground: 7,
    grass: [GRASS_LIT, GRASS],
    poses: {
      stand: ['.##.', '.##.', 'rrrr', '.dd.', '#..#'],
      crouch: ['.##.', '.##.', 'rrrr', '#..#'],
      hooray: ['r##r', 'r##r', '.rr.', '.dd.', '.##.'],
      star: ['r##r', '.##.', '.rr.', '#..#'],
    },
  },
}

const BEATS: readonly (readonly [pose: Pose, frames: number, big: number, small: number, shadow: number])[] = [
  ['stand', 26, 0, 0, 4],
  ['crouch', 2, 0, 0, 6],
  ['hooray', 1, 1, 1, 4],
  ['star', 1, 3, 1, 2],
  ['star', 2, 4, 2, 2],
  ['star', 1, 3, 1, 2],
  ['hooray', 1, 1, 1, 4],
  ['crouch', 2, 0, 0, 6],
]
function draw(size: IconSize, pose: Pose, lift: number, shadow: number): Int32Array {
  const a = ART[size]
  const c = new Canvas()
  c.rect(0, 0, a.width, a.height, BASE)
  for (const x of a.holes) {
    c.rect(x, 0, 1, a.height, BASE_LIT)
    for (const y of a.holeRows) c.rect(x, y, 1, 2, HOLE)
  }
  const span = a.x1 - a.x0 + 1
  a.sky.forEach((step, i) => c.rect(a.x0, a.y0 + i, span, 1, SKY[step] ?? 0))
  c.sprite(a.x0, a.ground - a.hills.length, a.hills, { '#': HILL })
  a.grass.forEach((color, i) => c.rect(a.x0, a.ground + i, span, 1, color))
  const width = size === 'big' ? shadow : Math.max(2, shadow - 2)
  c.rect((a.x0 + a.x1 + 1 - width) / 2, a.ground, width, 1, GRASS)
  const art = a.poses[pose]
  const artWidth = art[0]?.length ?? 0
  c.sprite((a.x0 + a.x1 + 1 - artWidth) / 2, a.ground - art.length - lift, art, KID)
  const out = new Int32Array(a.width * a.height)
  for (let y = 0; y < a.height; y++) out.set(c.px.subarray(y * W, y * W + a.width), y * a.width)
  return out
}
const icons = new Map<IconSize, Icon>()
export function iconOf(size: IconSize): Icon {
  const kept = icons.get(size)
  if (kept !== undefined) return kept
  const frames = BEATS.flatMap(([pose, n, big, small, shadow]) => {
    const frame = draw(size, pose, size === 'big' ? big : small, shadow)
    return Array.from({ length: n }, () => frame)
  })
  const icon = { width: ART[size].width, height: ART[size].height, frames }
  icons.set(size, icon)
  return icon
}