import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './ui.css'

// ONE PAGE, TWO UNIVERSES (src/Shell.tsx). The page itself is the shell, which holds a copy of the app for each universe
// in a frame of its own; a frame's address says which it is (?universe=avium, ?universe=arterra), and that copy is the
// app. The app is loaded only where it runs, so the shell stays a few lines.
const root = ReactDOM.createRoot(document.getElementById('root')!)
// THE RECORDS AS MAIN HAS THEM NOW (src/data/live.js): the registry says what has changed since the commit this build was
// made from, and the app lays it over the records it carries. It waits for the answer only so long, then loads with
// what it has and takes the change when it comes (the App's live poll). A local build knows no commit and asks nothing.
const BUILT = import.meta.env.VITE_BUILT_SHA || ''
const live = (): Promise<unknown> => {
  if (!/^[0-9a-f]{40}$/.test(BUILT)) return Promise.resolve(null)
  ;(globalThis as any).__aviumBuilt = BUILT
  const ask = fetch(`https://avium-registry.avium.workers.dev/live?built=${BUILT}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
  return Promise.race([ask, new Promise(r => setTimeout(() => r(null), 2500))])
}
if (new URLSearchParams(window.location.search).has('universe'))
  live().then((d) => { (globalThis as any).__aviumLive = d; return import('./App') })
    .then(({ default: App }) => root.render(<React.StrictMode><App /></React.StrictMode>))
else
  import('./Shell').then(({ default: Shell }) => root.render(<Shell />))
