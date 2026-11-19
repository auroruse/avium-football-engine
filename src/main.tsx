import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './ui.css'

// ONE PAGE, TWO UNIVERSES (src/Shell.tsx). The page itself is the shell, which holds a copy of the app for each universe
// in a frame of its own; a frame's address says which it is (?universe=avium, ?universe=arterra), and that copy is the
// app. The app is loaded only where it runs, so the shell stays a few lines.
const root = ReactDOM.createRoot(document.getElementById('root')!)
if (new URLSearchParams(window.location.search).has('universe'))
  import('./App').then(({ default: App }) => root.render(<React.StrictMode><App /></React.StrictMode>))
else
  import('./Shell').then(({ default: Shell }) => root.render(<Shell />))
