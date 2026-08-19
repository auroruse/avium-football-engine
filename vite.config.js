import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// WHICH STADIUMS HAVE A PHOTOGRAPH, read off the directory instead of typed out by hand. The list
// is a predicate in half a dozen places -- whether a venue card draws a picture, whether a row in
// the stadium browser offers one -- so the app has to KNOW before it renders, and a browser cannot
// list a directory over HTTP. Vite serves public/ verbatim and import.meta.glob only reaches src/,
// so the enumeration happens here, at build and on dev start, and arrives as a virtual module.
// Adding a JPEG to public/stadiums is now the whole job; forgetting the manifest is not possible.
const VID = 'virtual:stadium-images'
const stadiumImages = () => {
  const dir = path.resolve('public/stadiums')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g)$/i.test(f))
    .map(f => f.replace(/\.(jpe?g)$/i, '').normalize('NFC'))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

const stadiumManifest = () => ({
  name: 'stadium-manifest',
  resolveId: (id) => (id === VID ? '\0' + VID : null),
  load: (id) => (id === '\0' + VID
    ? `export const STADIUM_IMAGES = ${JSON.stringify(stadiumImages())};`
    : null),
  // A photograph dropped in while the dev server is running invalidates the module, so the list
  // refreshes without a restart.
  configureServer(server) {
    server.watcher.add(path.resolve('public/stadiums'))
    const bust = (f) => {
      if (!/public[/\\]stadiums[/\\]/.test(f)) return
      const mod = server.moduleGraph.getModuleById('\0' + VID)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
    }
    server.watcher.on('add', bust); server.watcher.on('unlink', bust)
  },
})

export default defineConfig({
  plugins: [react(), stadiumManifest()],
  base: './',
})
