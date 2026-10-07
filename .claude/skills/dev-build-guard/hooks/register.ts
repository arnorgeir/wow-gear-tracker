import type { Register } from 'claude-code'

// `npm run dev` binds 127.0.0.1:3000. favicon.ico is static, so probing it
// never renders a page or touches the database.
const PROBE = 'http://127.0.0.1:3000/favicon.ico'
const POLL_MS = 5000
const BUILD = /\b(npm run build|next build)\b/
// A build from another folder (a worktree) has its own .next and is safe.
const CHANGES_DIR = /(^|[;&|]\s*)(cd|pushd)\s/

export const isBuild = (command: string) =>
  BUILD.test(command) && !CHANGES_DIR.test(command)

export const register: Register = on => {
  let devUp = false

  on('session.start', async ($, e, next) => {
    const check = async () => {
      try {
        await $.http.fetch(PROBE)
        devUp = true
      } catch {
        devUp = false
      }
      $.ui.status(devUp ? '⚠ dev server on :3000, no build here' : undefined)
    }
    await check()
    $.clock.every(POLL_MS, () => void check())
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) =>
    devUp && isBuild(e.command)
      ? {
          deny:
            `${$.plugin.name}: a dev server is serving :3000. Building into the same .next ` +
            'wedges it (every fresh compile answers 500). Stop dev first, or build in a separate worktree.',
        }
      : next(e),
  ).catch(($, e, next) => next(e))
}
