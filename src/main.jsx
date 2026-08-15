import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext'
import { PetsProvider } from './lib/PetsContext'
import { RevenueCatProvider } from './lib/RevenueCatContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PetsProvider>
          <RevenueCatProvider>
            <App />
          </RevenueCatProvider>
        </PetsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
