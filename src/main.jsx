import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { applyTheme, readThemePreference } from './lib/theme'
import { applyReduceMotion, readReduceMotion } from './lib/motion'
import { watchTypeScale } from './lib/typeScale'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/AuthContext'
import { EntitlementsProvider } from './lib/EntitlementsContext'
import { PetsProvider } from './lib/PetsContext'
import { RevenueCatProvider } from './lib/RevenueCatContext'

// Before the first paint, so a dark-mode owner never gets a white flash on
// launch.
applyTheme(readThemePreference())
applyReduceMotion(readReduceMotion())
// Text follows the phone's own Dynamic Type setting — see lib/typeScale.js.
// Measured again whenever the app comes back to the foreground, since that
// setting is usually changed in the middle of trying to read something here.
watchTypeScale()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost, above the providers too — an uncaught error in any of
        them (or anywhere below) would otherwise unmount the whole tree
        with no fallback UI, which is exactly what "blank screen" looks
        like from the outside. */}
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          {/* Above PetsProvider, which reads the pet limit from it. */}
          <EntitlementsProvider>
            <PetsProvider>
              <RevenueCatProvider>
                <App />
              </RevenueCatProvider>
            </PetsProvider>
          </EntitlementsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
