import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/AuthContext'
import { PetsProvider } from './lib/PetsContext'
import { RevenueCatProvider } from './lib/RevenueCatContext'

// DIAGNOSTIC: third and innermost layer of crash reporting, for the
// white-screen investigation.
//
//   1. index.html's inline window.onerror / unhandledrejection handler —
//      registered before this module is even fetched, so it is the only one
//      that can report a throw during module evaluation (the likeliest cause
//      of a blank screen in a bundled build, where this file's body never
//      runs at all).
//   2. This try/catch — a synchronous failure in createRoot().render(), e.g.
//      a provider throwing during its first render, or #root missing.
//   3. ErrorBoundary inside the tree — React render errors once mounted.
//
// Reuses the reporter defined in index.html rather than duplicating it, and
// falls back to raw DOM text if that somehow is not present.
function reportFatal(error) {
  if (typeof window !== 'undefined' && typeof window.__qolShowFatalError === 'function') {
    window.__qolShowFatalError('App failed to start (render threw)', error)
    return
  }

  // Deliberately no React, no CSS, no imports — whatever just failed, this
  // still has to produce readable text.
  const text =
    'App failed to start (render threw)\n\n' +
    'NAME:    ' + (error?.name ?? '(none)') + '\n' +
    'MESSAGE: ' + (error?.message ?? String(error)) + '\n\n' +
    'STACK:\n' + (error?.stack ?? '(no stack)')

  const pre = document.createElement('pre')
  pre.setAttribute(
    'style',
    'white-space:pre-wrap;word-break:break-word;padding:16px;margin:0;' +
      'font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;background:#fff;color:#000;',
  )
  pre.textContent = text
  document.body.appendChild(pre)
}

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('#root element not found in index.html')

  createRoot(rootElement).render(
    <StrictMode>
      {/* Outermost, above the providers too — an uncaught error in any of
          them (or anywhere below) would otherwise unmount the whole tree
          with no fallback UI, which is exactly what "blank screen" looks
          like from the outside. */}
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <PetsProvider>
              <RevenueCatProvider>
                <App />
              </RevenueCatProvider>
            </PetsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (error) {
  reportFatal(error)
}
