import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Every build gets an id (the commit, else the time); the same id is baked into the bundle as
// __BUILD_ID__ and written to dist/version.json, so a running copy can tell it is stale
// (src/lib/backend-guard.ts).
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || String(Date.now())
  } catch {
    return String(Date.now())
  }
}
const BUILD_ID = buildId()

function versionFile(): Plugin {
  return {
    name: 'version-json',
    closeBundle() {
      mkdirSync('dist', { recursive: true })
      writeFileSync('dist/version.json', JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() }))
    },
  }
}

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss(), versionFile()],
  resolve: {
    alias: {
      exceljs: 'exceljs/dist/exceljs.min.js',
    },
  },
})
