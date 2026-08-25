// Entry point for `node --import`. Registers the hooks in audit-loader.mjs
// for the process that follows.
//
// Imported as a default rather than `import { register }` on purpose: a named
// import of something that does not exist throws while the module is being
// linked, before any line below can run. On a Node older than 20.6 that would
// take `npm run build` down with a stack trace, turning a check that is meant
// to catch content mistakes into the thing that stops the app being built.
// Checked and skipped instead — the check is a safety net, not a gate.
import module from 'node:module'

if (typeof module.register !== 'function') {
  console.warn(
    `Skipping the parameter overlap check: it needs Node 20.6 or newer, and this is ${process.version}.`,
  )
  process.exit(0)
}

module.register('./audit-loader.mjs', import.meta.url)
