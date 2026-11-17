import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { reloadForNewVersion } from './utils/staleVersion.ts'
import { UpdatePrompt } from './components/UpdatePrompt.tsx'

// A screen's file failed to load — almost always a new deploy replacing it under
// a page that was already open. Reload onto the new version instead of erroring.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <UpdatePrompt />
    </ErrorBoundary>
  </StrictMode>,
)
