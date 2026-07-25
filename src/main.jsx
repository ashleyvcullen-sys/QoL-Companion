import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext'
import { PetsProvider } from './lib/PetsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PetsProvider>
          <App />
        </PetsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
