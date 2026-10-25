import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { fetchSyncFile } from './lib/sync.ts'
import { DevTrackProvider } from './store/DevTrackProvider.tsx'

// Loaded before the first render so a first launch with real activity skips the demo content.
const initialSync = await fetchSyncFile()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevTrackProvider initialSync={initialSync}>
      <App />
    </DevTrackProvider>
  </StrictMode>,
)
