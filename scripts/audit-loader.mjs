// Lets plain Node import the app's data files.
//
// src/lib/conditions.js imports its organ icons from a .jsx file, and Vite
// resolves both the extension and the JSX for it. Node does neither, so any
// script that wants to READ the condition definitions — the overlap check
// below, and anything like it later — cannot simply import them.
//
// Rather than duplicating the parameter lists somewhere Node can read (which
// would drift from the real ones within a week, and a check that drifts from
// what it checks is worse than no check), these two hooks teach Node the two
// things it is missing:
//
//   resolve  retry a failed bare path with .jsx and .js appended
//   load     hand back a stub for any .jsx file, with one no-op export per
//            name the real file exports
//
// The stubs are only ever components — nothing in a data file reads a value
// out of one — so a no-op function is a faithful enough stand-in.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    for (const extension of ['.jsx', '.js']) {
      try {
        return await next(specifier + extension, context)
      } catch {
        // try the next extension
      }
    }
    throw error
  }
}

export async function load(url, context, next) {
  if (!url.endsWith('.jsx')) return next(url, context)

  const source = await readFile(fileURLToPath(url), 'utf8')
  const names = new Set()
  for (const match of source.matchAll(/export\s+(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1])
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.split(/\s+as\s+/).pop().trim()
      if (name) names.add(name)
    }
  }

  // An exported array gets an empty array rather than a function. Several of
  // these files export a list the data layer maps over (the wellbeing
  // concepts, for one), and a function there throws on the first `.map()`
  // rather than simply producing nothing.
  const stubs = [...names]
    .map((name) => {
      const isArray = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[`).test(source)
      return `export const ${name} = ${isArray ? '[]' : '() => null'}`
    })
    .join('\n')
  return {
    format: 'module',
    shortCircuit: true,
    source: `${stubs}\nexport default () => null\n`,
  }
}
