// Entry point for `node --import`. Registers the hooks in audit-loader.mjs
// for the process that follows.
import { register } from 'node:module'
register('./audit-loader.mjs', import.meta.url)
