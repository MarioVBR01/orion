#!/usr/bin/env node
// Lanzador del comando `orion`: ejecuta cli/index.ts con SQLite integrado y tsx,
// sin importar desde qué carpeta (repo de tu proyecto) lo llames.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../cli/index.ts', import.meta.url))
const tsx = import.meta.resolve('tsx')

const r = spawnSync(process.execPath, ['--experimental-sqlite', '--no-warnings', '--import', tsx, cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
