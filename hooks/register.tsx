import type { EngineInterface, Register } from 'claude-code'

import { iconOf, type IconSize } from './about'
import { readFrames } from './baked'
import { FRAME_MS } from './engine'
import { FILMS } from './frames'
import { HALF_BLOCK, SIZE_ORDER, cellsOf, encode, encodeAt, fit, pairGlyph, sizesThatFit, widestThatFits, type Size } from './terminal'

const KEY = 'picture'
const GROW_KEY = 'size-up'
const SHRINK_KEY = 'size-down'
const LOOPS = 3
const COAST_FRAMES = 12
const SPIN_UP = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3]
const spunUp = (tick: number) => SPIN_UP[tick] ?? tick - (SPIN_UP.length - 4)
const SPINNER_FRAMES = Math.round((30 * 60 * 1000) / FRAME_MS)
const SPINNER_KEY = 'isSpinnerOn'
const SIZE_KEY = 'spinnerSize'
const NAME = 'verbs'
const MAKER = 'Ollie Wagner'
const SITE = 'https://ollie.md/verbs'
const COPYRIGHT = `Copyright © 2026 ${MAKER}`
const CREDIT = 'Pixel-art verbs by '
const ABOUT_KEY = 'about'
const ICON_KEY = 'about-icon'
const ABOUT_LAYOUT: Record<Size, { icon: IconSize; aboveName: number; aboveMaker: number }> = {
  large: { icon: 'big', aboveName: 1, aboveMaker: 1 },
  medium: { icon: 'big', aboveName: 1, aboveMaker: 0 },
  small: { icon: 'small', aboveName: 0, aboveMaker: 0 },
}
const SF_GLYPHS = {
  info: ' \u{100174} ',
  grow: ' \u{10017C} ',
  shrink: ' \u{10017D} ',
  back: '\u{100189} back',
  backAlone: ' \u{100189} ',
  external: '\u{10012F}',
}
const TEXT_GLYPHS: typeof SF_GLYPHS = { info: '(i)', grow: ' + ', shrink: ' − ', back: '‹ back', backAlone: ' ‹ ', external: '↗' }
const SF_PRO_FONTS = ['/Library/Fonts/SF-Pro-Text-Regular.otf', '/Library/Fonts/SF-Pro.ttf']
const DEFAULT_SIZE: Size = 'medium'
const isSize = (value: unknown): value is Size => SIZE_ORDER.includes(value as Size)
const slug = (verb: string) => verb.normalize('NFD').replace(/[̀-ͯ']/g, '').toLowerCase()
type Film = (typeof FILMS)[number]
const BY_SLUG = new Map(FILMS.map(film => [slug(film.verb), film]))
function find(name: string): Film | undefined {
  const s = slug(name.trim().replace(/…$/, ''))
  if (s === '') return undefined

  return BY_SLUG.get(s) ?? FILMS.find(film => slug(film.verb).startsWith(s)) ?? FILMS.find(film => slug(film.verb).includes(s))
}

let glyph: number | undefined
async function readGlyph($: EngineInterface): Promise<void> {
  if (glyph !== undefined) return
  try {
    glyph = pairGlyph(await $.env.get('TERM_PROGRAM'))
  } catch {
    glyph = HALF_BLOCK
  }
}

const NO_COLOR_TEXT = 'The pictures are off because NO_COLOR is set.'

const ALL_TEXT = `${FILMS.length} verbs, in the spinner's order.`
let isColorless: boolean | undefined
async function readColor($: EngineInterface): Promise<boolean> {
  if (isColorless !== undefined) return isColorless
  try {
    const noColor = await $.env.get('NO_COLOR')
    isColorless = noColor !== undefined && noColor !== ''
  } catch {
    isColorless = false
  }
  return isColorless
}
const cache = new Map<string, readonly string[]>()
async function pagesOf($: EngineInterface, film: Film, size: Size = 'large'): Promise<readonly string[]> {
  const key = `${size} ${glyph} ${film.verb}`
  const kept = cache.get(key)
  if (kept !== undefined) return kept
  let frames: Int32Array[] = []
  try {
    frames = readFrames(await $.fs.read(`${$.plugin.root}/hooks/frames/${film.file}.txt`))
  } catch {}
  if (frames.length === 0) $.ui.log(`verbs: no frames in hooks/frames/${film.file}.txt`, { to: 'debug' })
  const pages = frames.map(frame => encodeAt(size, frame, glyph ?? HALF_BLOCK))
  cache.set(key, pages)
  const oldest = cache.keys().next().value
  if (cache.size > 6 && oldest !== undefined) cache.delete(oldest)
  return pages
}

type Player = {
  cells: string
  verb: string
  size: Size
  tick: number
  frame: number
  isPlaying: boolean
  isStill?: boolean
  drawnAt?: number
  cancel: () => void
}
type Page = { cells: string; verb: string; frame?: number }
const players = new Map<string, Player>()
const refusal = (error: unknown) => ({ deny: String(error) })
function play(
  $: EngineInterface,
  requestId: string,
  first: Page,
  step: (tick: number) => Page | undefined,
  { size = 'large', isStoppedByRefusal = false, from = 0 }: { size?: Size; isStoppedByRefusal?: boolean; from?: number } = {},
): Player {
  let tick = from
  let isBlitting = true
  const player: Player = { frame: 0, ...first, size, tick, isPlaying: true, cancel: () => stop() }
  const stop = () => {
    player.isPlaying = false
    timer.cancel()
    step = () => undefined
  }
  const timer = $.clock.every(FRAME_MS, () => {
    tick++
    player.tick = tick
    const page = step(tick)
    if (page === undefined) return stop()
    const isNewVerb = page.verb !== player.verb
    player.cells = page.cells
    player.verb = page.verb
    player.frame = page.frame ?? tick
    if (!isBlitting && tick - (player.drawnAt ?? tick) > 24) return stop()
    if (!isBlitting || isNewVerb) return $.ui.invalidate('ui.render')
    void $.ui.blit({ requestId, key: KEY, cells: page.cells }).catch(refusal).then(result => {
      if (result.deny === undefined || !isBlitting) return
      isBlitting = false
      if (isStoppedByRefusal) return stop()
      $.ui.log(`verbs: blit refused (${result.deny}); redrawing instead`, { to: 'debug' })
      $.ui.invalidate('ui.render')
    })
  })
  players.set(requestId, player)
  return player
}
function hold(requestId: string, page: Page, size: Size): Player {
  const player: Player = {
    frame: 0,
    ...page,
    size,
    tick: 0,
    isPlaying: true,
    cancel: () => {
      player.isPlaying = false
    },
  }
  players.set(requestId, player)
  return player
}
function playOne($: EngineInterface, requestId: string, film: Film, pages: readonly string[], size: Size, from = 0): Player {
  const page = (index: number) => ({ cells: pages[index % pages.length] ?? '', verb: film.verb, frame: index % pages.length })
  const end = pages.length * (LOOPS - 1) + (film.hero % pages.length)
  const coast = Math.min(COAST_FRAMES, pages.length)
  const ticks = Math.round(coast / 0.6)
  const slowing = (2 * (ticks - coast)) / ticks ** 2
  const step = (tick: number) => {
    const into = tick - (end - coast)
    if (into <= 0) return page(tick)
    if (into > ticks) return undefined
    return page(end - coast + Math.min(coast, Math.round(into - (slowing * into ** 2) / 2)))
  }
  return play($, requestId, step(from) ?? page(end), step, { size, from })
}
function playAll($: EngineInterface, requestId: string, index: number, pages: readonly string[], size: Size, from?: number): Player {
  let start = 0
  let next: readonly string[] | undefined
  const readNext = () => {
    next = undefined
    const film = FILMS[index + 1]
    const wanted = index + 1
    if (film !== undefined) void pagesOf($, film, size).then(read => (next = wanted === index + 1 ? read : next))
  }
  readNext()
  let shown: Page = { cells: pages[from ?? 0] ?? '', verb: FILMS[index]?.verb ?? '', frame: from ?? 0 }

  return play($, requestId, shown, ticks => {
    const tick = from === undefined ? spunUp(ticks) : from + ticks
    while (tick - start >= pages.length) {
      if (FILMS[index + 1] === undefined) return undefined
      if (next === undefined) return shown
      index++
      pages = next
      start = tick
      readNext()
    }
    const film = FILMS[index]
    if (film === undefined) return undefined
    shown = { cells: pages[tick - start] ?? '', verb: film.verb, frame: tick - start }
    return shown
  }, { size })
}
let isSpinnerOn = true

const unnamedVerbs = new Map<string, string>()
let spinnerSize: Size = DEFAULT_SIZE
let aboutOver: string | undefined

let isStill = false
let glyphs = TEXT_GLYPHS
let version: string | undefined
async function hasSfPro($: EngineInterface) {
  const home = (await $.env.get('HOME')) ?? ''
  for (const font of [...SF_PRO_FONTS, ...SF_PRO_FONTS.map(f => f.replace('/Library', `${home}/Library`))]) {
    if (await $.fs.exists(font)) return true
  }
  return false
}
async function readVersion($: EngineInterface) {
  try {
    return String(JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)).version ?? '') || undefined
  } catch {
    return undefined
  }
}
const LATEST_URL = 'https://raw.githubusercontent.com/olliewagner/verbs/main/.claude-plugin/plugin.json'
const CHECKED_KEY = 'updateCheckedAt'
const DAY_MS = 24 * 60 * 60 * 1000
const CHECK_DELAY_MS = 5000
function isLater(a: string, b: string): boolean {
  const parse = (v: string) => /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())?.slice(1).map(Number)
  const x = parse(a)
  const y = parse(b)
  if (x === undefined || y === undefined) return false
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) > (y[i] ?? 0)

  return false
}
async function checkForUpdate($: EngineInterface) {
  try {
    if (version === undefined) return
    const quiet = await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')
    if (quiet !== undefined && quiet !== '') return
    const now = await $.clock.now()
    const checkedAt = await recall($, CHECKED_KEY)
    if (typeof checkedAt === 'number' && now - checkedAt >= 0 && now - checkedAt < DAY_MS) return
    await keep($, CHECKED_KEY, now)
    const response = await $.http.fetch(LATEST_URL)
    if (!response.ok) return
    const latest = String(JSON.parse(response.text).version ?? '')
    if (!isLater(latest, version)) return
    $.ui.toast(
      `verbs ${latest} is out; this is ${version}. To update, run claude plugin marketplace update verbs, then claude plugin update verbs@verbs, and restart Claude Code.`,
      { timeoutMs: 15000 },
    )
  } catch {}
}
async function recall($: EngineInterface, key: string): Promise<unknown> {
  try {
    return await $.store.get(key)
  } catch {
    return undefined
  }
}
async function keep($: EngineInterface, key: string, value: unknown) {
  try {
    await $.store.set(key, value)
  } catch {}
}
async function setSize($: EngineInterface, size: Size) {
  spinnerSize = size
  await keep($, SIZE_KEY, size)
  $.ui.invalidate('ui.render')
}
function setAbout($: EngineInterface, requestId: string | undefined) {
  aboutOver = requestId
  if (requestId === undefined) for (const icon of [...icons.values()]) icon.cancel()
  $.ui.invalidate('ui.render')
}
const iconCache = new Map<string, readonly string[]>()
function iconPages(size: IconSize): readonly string[] {
  const key = `${size} ${glyph}`
  const kept = iconCache.get(key)
  if (kept !== undefined) return kept
  const { width, height, frames } = iconOf(size)
  const pages = frames.map(frame => encode(frame, width, height, glyph ?? HALF_BLOCK))
  iconCache.set(key, pages)
  return pages
}
type IconPlayer = { size: IconSize; cells: string; cancel: () => void }
const icons = new Map<string, IconPlayer>()
function playIcon($: EngineInterface, requestId: string, size: IconSize): IconPlayer {
  const pages = iconPages(size)
  let tick = 0
  const icon: IconPlayer = {
    size,
    cells: pages[0] ?? '',
    cancel: () => {
      timer?.cancel()
      if (icons.get(requestId) === icon) icons.delete(requestId)
    },
  }
  const timer = isStill ? undefined : $.clock.every(FRAME_MS, () => {
    tick++
    if (tick >= SPINNER_FRAMES) return icon.cancel()
    const cells = pages[tick % pages.length] ?? ''
    if (cells === icon.cells) return
    icon.cells = cells
    void $.ui.blit({ requestId, key: ICON_KEY, cells }).catch(refusal).then(result => {
      if (result.deny !== undefined) icon.cancel()
    })
  })
  icons.set(requestId, icon)
  return icon
}
async function readMotion($: EngineInterface) {
  try {
    isStill = (await $.settings.read()).prefersReducedMotion === true
  } catch {
    isStill = false
  }
}

const OPENERS: readonly (readonly string[])[] = [['open'], ['xdg-open'], ['rundll32.exe', 'url.dll,FileProtocolHandler']]
async function openSite($: EngineInterface) {
  for (const opener of OPENERS) {
    try {
      if ((await $.process.run([...opener, SITE])).exitCode === 0) return
    } catch {}
  }
}
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    isSpinnerOn = (await recall($, SPINNER_KEY)) !== false
    const stored = await recall($, SIZE_KEY)
    spinnerSize = isSize(stored) ? stored : DEFAULT_SIZE
    glyphs = (await hasSfPro($)) ? SF_GLYPHS : TEXT_GLYPHS
    version = await readVersion($)
    $.clock.after(CHECK_DELAY_MS, () => void checkForUpdate($))
    await $.command.register({
      name: 'verb',
      description: "Play a spinner verb's pixel-art flip book in the transcript",
      argumentHint: '[verb, or none for a random one]',
    })
    await $.command.register({
      name: 'verbs',
      description: 'Play every spinner verb in turn; `/verbs on|off` shows them while Claude works, `/verbs small|medium|large` at what size',
      argumentHint: '[on|off|small|medium|large]',
    })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (aboutOver !== undefined && (e.agentId === undefined || e.agentId === aboutOver)) setAbout($, undefined)
    const still = e.agentId === undefined ? [...players.values()].filter(player => player.isStill && player.isPlaying) : []
    for (const player of still) player.cancel()
    if (still.length > 0) $.ui.invalidate('ui.render')
    return next(e)
  })
  on('command.run', { command: 'verb' }, async ($, e) => {
    if (await readColor($)) return { text: NO_COLOR_TEXT }
    if (FILMS.length === 0) return { text: 'No verbs are drawn yet.' }
    const film = e.args.trim() === '' ? FILMS[Math.floor(Math.random() * FILMS.length)] : find(e.args)
    return { text: film === undefined ? `No verb matches "${e.args.trim()}".` : `${film.verb}…` }
  })
  on('command.run', { command: 'verbs' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      isSpinnerOn = arg === 'on'
      await keep($, SPINNER_KEY, isSpinnerOn)
      $.ui.invalidate('ui.render')
      if (isSpinnerOn && (await readColor($))) return { text: NO_COLOR_TEXT }
      return { text: isSpinnerOn ? 'The spinner now plays its verb while Claude works.' : 'The spinner is back to words alone.' }
    }
    if (isSize(arg)) {
      spinnerSize = arg
      await keep($, SIZE_KEY, spinnerSize)
      $.ui.invalidate('ui.render')
      if (await readColor($)) return { text: NO_COLOR_TEXT }
      const name = { small: 'half', medium: 'three-quarter', large: 'full' }[arg]
      return { text: `The spinner plays its verb at ${name} size, or the largest below it that fits the terminal.` }
    }
    if (arg !== '') {
      return { text: `Unknown option "${e.args.trim()}": /verbs takes on, off, small, medium or large, or nothing to play all ${FILMS.length} verbs.` }
    }
    return { text: (await readColor($)) ? NO_COLOR_TEXT : ALL_TEXT }
  })
  on('ui.render', { component: 'CommandOutput', props: { command: 'verb' } }, async ($, e, next) => {
    if (e.surface !== 'terminal' || (await readColor($))) return next(e)
    const film = FILMS.find(candidate => e.props.text.endsWith(`${candidate.verb}…`))
    if (film === undefined) return next(e)
    const size = widestThatFits(e.viewport)
    if (size === undefined) return next(e)
    await readGlyph($)
    const { Raster } = $.ui.resolve(e)
    let player = players.get(e.requestId)
    if (player === undefined || player.size !== size) {
      const pages = await pagesOf($, film, size)
      if (pages.length === 0) return next(e)
      const latest = players.get(e.requestId)
      if (latest !== undefined && latest.size === size) player = latest
      else if (latest !== undefined && !latest.isPlaying) {
        player = hold(e.requestId, { cells: pages[film.hero % pages.length] ?? '', verb: film.verb, frame: film.hero }, size)
      } else {
        latest?.cancel()
        player = playOne($, e.requestId, film, pages, size, latest?.tick)
      }
    }
    player.drawnAt = player.tick
    return <Raster key={KEY} {...cellsOf(size)} cells={player.cells} />
  })
  on('ui.render', { component: 'CommandOutput', props: { command: 'verbs' } }, async ($, e, next) => {
    const firstFilm = FILMS[0]
    if (e.surface !== 'terminal' || !e.props.text.endsWith(ALL_TEXT) || firstFilm === undefined || (await readColor($))) {
      return next(e)
    }
    await readGlyph($)
    const { Box, Raster, Text } = $.ui.resolve(e)
    const fitting = widestThatFits(e.viewport)
    const size = fitting ?? 'small'
    let player = players.get(e.requestId)
    if (player === undefined || player.size !== size) {
      const was = player
      let index = was === undefined ? 0 : Math.max(0, FILMS.findIndex(film => film.verb === was.verb))
      let pages = await pagesOf($, FILMS[index] ?? firstFilm, size)
      for (let film = FILMS[index + 1]; pages.length === 0 && film !== undefined; film = FILMS[index + 1]) {
        index++
        pages = await pagesOf($, film, size)
      }
      if (pages.length === 0) return next(e)
      const latest = players.get(e.requestId)
      const verb = FILMS[index]?.verb ?? ''
      const frame = latest?.verb === verb ? latest.frame : undefined
      if (latest !== undefined && latest.size === size) player = latest
      else if (latest !== undefined && !latest.isPlaying) player = hold(e.requestId, { cells: pages[(frame ?? 0) % pages.length] ?? '', verb, frame }, size)
      else {
        latest?.cancel()
        player = playAll($, e.requestId, index, pages, size, frame)
      }
    }
    player.drawnAt = player.tick
    const playing = player
    const index = FILMS.findIndex(film => film.verb === playing.verb)
    return (
      <Box flexDirection="column">
        {fitting !== undefined && <Raster key={KEY} {...cellsOf(fitting)} cells={player.cells} />}
        <Text dimColor>{`${player.verb}…  ${index + 1} of ${FILMS.length}`}</Text>
      </Box>
    )
  })
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface === 'terminal' && (await readColor($))) return next(e)
    const isUnnamed = e.surface === 'terminal' && isSpinnerOn && e.props.word === ''
    let unnamed = unnamedVerbs.get(e.requestId)
    if (!isUnnamed) unnamedVerbs.delete(e.requestId)
    else if (unnamed === undefined) {
      unnamed = FILMS[Math.floor(Math.random() * FILMS.length)]?.verb
      if (unnamed !== undefined) unnamedVerbs.set(e.requestId, unnamed)
    }
    const word = isUnnamed ? (unnamed ?? '') : e.props.word
    const own = await next(word === e.props.word ? e : { ...e, props: { ...e.props, word } })
    if (e.surface !== 'terminal' || !isSpinnerOn) return own
    const film = find(word)
    if (film === undefined || slug(film.verb) !== slug(word)) return own
    const size = fit(spinnerSize, e.viewport)
    if (size === undefined) return own
    await readGlyph($)
    const isAbout = aboutOver === e.requestId
    const isCurrent = (current: Player) => current.verb === film.verb && current.size === size && current.isPlaying
    let player = players.get(e.requestId)
    if (player === undefined || !isCurrent(player)) {
      const pages = await pagesOf($, film, size)
      if (pages.length === 0) return own
      await readMotion($)
      const latest = players.get(e.requestId)
      if (latest !== undefined && isCurrent(latest)) player = latest
      else if (isStill) {
        latest?.cancel()
        player = hold(e.requestId, { cells: pages[film.hero % pages.length] ?? '', verb: film.verb, frame: film.hero }, size)
        player.isStill = true
      } else {
        const from = latest?.verb === film.verb && latest.isPlaying ? latest.frame : undefined
        latest?.cancel()
        const frameAt = (tick: number) => (from === undefined ? spunUp(tick) : from + tick)
        const page = (tick: number) => ({ cells: pages[frameAt(tick) % pages.length] ?? '', verb: film.verb, frame: frameAt(tick) })
        player = play($, e.requestId, page(0), tick => (tick < SPINNER_FRAMES ? page(tick) : undefined), {
          size,
          isStoppedByRefusal: true,
        })
      }
    }
    const { Box, Button, Raster, Text } = $.ui.resolve(e)
    const { columns, rows } = cellsOf(player.size)
    const press = (key: string, label: string, onPress: () => void) => (
      <Button key={key} plain dimColor label={label} onPress={onPress} />
    )
    const fitting = sizesThatFit(e.viewport)
    const larger = fitting[fitting.indexOf(size) + 1]
    const smaller = fitting[fitting.indexOf(size) - 1]
    const back = e.viewport === undefined || columns + 1 + [...glyphs.back].length <= e.viewport.columns ? glyphs.back : glyphs.backAlone
    const corner = (
      <Box key="corner" flexDirection="column" justifyContent="flex-end" height={rows} marginLeft={1}>
        {!isAbout && larger !== undefined && press(GROW_KEY, glyphs.grow, () => void setSize($, larger))}
        {!isAbout && smaller !== undefined && press(SHRINK_KEY, glyphs.shrink, () => void setSize($, smaller))}
        {isAbout ? press('about-back', back, () => setAbout($, undefined)) : press(ABOUT_KEY, glyphs.info, () => setAbout($, e.requestId))}
      </Box>
    )
    if (isAbout) {

      const layout = ABOUT_LAYOUT[player.size]
      let icon = icons.get(e.requestId)
      if (icon?.size !== layout.icon) {
        icon?.cancel()
        icon = playIcon($, e.requestId, layout.icon)
      }
      const { width, height } = iconOf(layout.icon)
      const linked = `${MAKER} ${glyphs.external}`
      const site = [...`${CREDIT}${linked}`].length <= columns ? linked : MAKER
      return (
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Box key="about-page" flexDirection="column" justifyContent="center" alignItems="center" width={columns} height={rows}>
              <Raster key={ICON_KEY} columns={width} rows={height / 2} cells={icon.cells} />
              <Box key="about-name" marginTop={layout.aboveName}>
                <Text weight="bold">{NAME}</Text>
                {version !== undefined && <Text dimColor>{`  Version ${version}`}</Text>}
              </Box>
              <Box key="about-by" marginTop={layout.aboveMaker}>
                <Text dimColor>{CREDIT}</Text>
                <Button key="about-site" plain label={site} onPress={() => void openSite($)} />
              </Box>
              <Box key="about-copyright">
                <Text dimColor>{COPYRIGHT}</Text>
              </Box>
            </Box>
            {corner}
          </Box>
          {own}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Raster key={KEY} columns={columns} rows={rows} cells={player.cells} />
          {corner}
        </Box>
        {own}
      </Box>
    )
  })
}