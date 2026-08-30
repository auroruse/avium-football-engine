import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// WHICH STADIUMS HAVE A PHOTOGRAPH, read off the directory instead of typed out by hand. The list
// is a predicate in half a dozen places -- whether a venue card draws a picture, whether a row in
// the stadium browser offers one -- so the app has to KNOW before it renders, and a browser cannot
// list a directory over HTTP. Vite serves public/ verbatim and import.meta.glob only reaches src/,
// so the enumeration happens here, at build and on dev start, and arrives as a virtual module.
// Adding a JPEG to public/avium/stadiums is now the whole job; forgetting the manifest is not possible.
const VID = 'virtual:stadium-images'
const stadiumImages = () => {
  const dir = path.resolve('public/avium/stadiums')
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
    server.watcher.add(path.resolve('public/avium/stadiums'))
    const bust = (f) => {
      if (!/public[/\\]avium[/\\]stadiums[/\\]/.test(f)) return
      const mod = server.moduleGraph.getModuleById('\0' + VID)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
    }
    server.watcher.on('add', bust); server.watcher.on('unlink', bust)
  },
})

// Same trick for the player-stats archive: public/avium/pstats holds one TSV per competition-season
// plus changelog.tsv, and the app needs the file list before it can fetch any of them.
const PID = 'virtual:pstats'
const pstatsFiles = () => {
  const dir = path.resolve('public/avium/pstats')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { recursive: true })
    .map(f => String(f).split(path.sep).join('/'))
    .filter(f => /\.(tsv|md)$/i.test(f) && !/README\.md$/i.test(f))
    .map(f => f.normalize('NFC'))
    .sort()
}
const pstatsManifest = () => ({
  name: 'pstats-manifest',
  resolveId: (id) => (id === PID ? '\0' + PID : null),
  load: (id) => (id === '\0' + PID
    ? `export const PSTATS_FILES = ${JSON.stringify(pstatsFiles())};`
    : null),
  configureServer(server) {
    server.watcher.add(path.resolve('public/avium/pstats'))
    const bust = (f) => {
      if (!/public[/\\]avium[/\\]pstats[/\\]/.test(f)) return
      const mod = server.moduleGraph.getModuleById('\0' + PID)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
    }
    server.watcher.on('add', bust); server.watcher.on('unlink', bust); server.watcher.on('change', bust)
  },
})

export default defineConfig({
  plugins: [react(), stadiumManifest(), pstatsManifest()],
  base: './',
})
