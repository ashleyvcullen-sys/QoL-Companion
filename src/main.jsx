import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './lib/AuthContext'
import { PetsProvider } from './lib/PetsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost, above the providers too — an uncaught error in any of
        them (or anywhere below) would otherwise unmount the whole tree
        with no fallback UI, which is exactly what "blank screen" looks
        like from the outside. */}
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PetsProvider>
            <App />
          </PetsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
