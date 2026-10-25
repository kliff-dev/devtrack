import { execFile } from 'node:child_process'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

/**
 * Dev only: runs the activity collector (collector/cli.ts) when the server starts and
 * on POST /api/sync, so "Sync now" in the app refreshes public/data/sync.json without
 * leaving the browser. A production build just serves the file from the last sync.
 */
function devtrackSync(): Plugin {
  let inFlight: Promise<string> | undefined

  const runCollector = (server: ViteDevServer) => {
    inFlight ??= new Promise<string>((resolve, reject) => {
      const cli = join(server.config.root, 'collector', 'cli.ts')
      execFile(
        process.execPath,
        ['--disable-warning=ExperimentalWarning', cli, '--json'],
        { cwd: server.config.root, windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
        (error, stdout, stderr) => {
          const report = stderr.trim()
          if (error) {
            reject(new Error(report || error.message))
            return
          }
          if (report) server.config.logger.info(report, { timestamp: true })
          resolve(stdout)
        },
      )
    }).finally(() => {
      inFlight = undefined
    })
    return inFlight
  }

  return {
    name: 'devtrack-sync',
    apply: 'serve',
    configureServer(server) {
      runCollector(server).catch((error: Error) =>
        server.config.logger.warn(`devtrack sync failed: ${error.message}`, { timestamp: true }),
      )
      server.middlewares.use('/api/sync', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json')
        runCollector(server).then(
          (json) => res.end(json),
          (error: Error) => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          },
        )
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devtrackSync()],
})
