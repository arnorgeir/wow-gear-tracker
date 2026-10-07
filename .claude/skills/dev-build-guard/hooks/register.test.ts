import { describe, expect, mock, test } from 'claude-code/testing'
import { isBuild } from './register'

const UP = { status: 200, ok: true, headers: {}, text: '' }
const start = { cwd: '/repo', surface: 'terminal' as const, isInteractive: true }

describe('isBuild', () => {
  test('matches builds in this folder', () => {
    expect(isBuild('npm run build')).toBe(true)
    expect(isBuild('npm run typecheck && npm run build')).toBe(true)
    expect(isBuild('npx next build')).toBe(true)
  })
  test('lets other folders and other commands through', () => {
    expect(isBuild('cd ../wt && npm run build')).toBe(false)
    expect(isBuild('npm run dev')).toBe(false)
    expect(isBuild('npm test')).toBe(false)
  })
})

describe('dev server up', () => {
  test('shows the warning and denies a build', async ($, on) => {
    mock.clock(on)
    on('session.start', async ($, e) => ({ cwd: e.cwd }))
    const statuses: (string | undefined)[] = []
    on('http.fetch', async () => ({ value: UP }))
    on('ui.status', async ($, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    on('tool.call', async () => ({ result: 'ran', isError: false }) as never)
    await $.session.start(start)

    expect(statuses.at(-1)).toMatch(/dev server/)
    const built = await $.tool.call({ tool: 'Bash', command: 'npm run build' })
    expect(built.deny).toMatch(/wedges it/)
    const tested = await $.tool.call({ tool: 'Bash', command: 'npm test' })
    expect(tested.deny).toBeUndefined()
    expect(tested.result).toBe('ran')
  })
})

describe('dev server down', () => {
  test('clears the warning and lets a build run', async ($, on) => {
    mock.clock(on)
    on('session.start', async ($, e) => ({ cwd: e.cwd }))
    const statuses: (string | undefined)[] = []
    on('http.fetch', async () => ({ deny: 'ECONNREFUSED' }))
    on('ui.status', async ($, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    on('tool.call', async () => ({ result: 'ran', isError: false }) as never)
    await $.session.start(start)

    expect(statuses.at(-1)).toBeUndefined()
    const built = await $.tool.call({ tool: 'Bash', command: 'npm run build' })
    expect(built.deny).toBeUndefined()
    expect(built.result).toBe('ran')
  })

  test('picks up a dev server started later', async ($, on) => {
    const clock = mock.clock(on)
    on('session.start', async ($, e) => ({ cwd: e.cwd }))
    let up = false
    const statuses: (string | undefined)[] = []
    on('http.fetch', async () => {
      return up ? { value: UP } : { deny: 'ECONNREFUSED' }
    })
    on('ui.status', async ($, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    await $.session.start(start)
    up = true
    await clock.advance(5000)
    expect(statuses.at(-1)).toMatch(/dev server/)
  })
})
