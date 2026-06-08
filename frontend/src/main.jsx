import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/accessibility.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AccessibilityProvider } from './contexts/AccessibilityContext.jsx'
import { AppointmentProvider } from './contexts/AppointmentContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AccessibilityProvider>
        <AppointmentProvider>
          <App />
        </AppointmentProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  </StrictMode>,
)
