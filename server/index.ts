import { join, resolve } from 'node:path'
import { openDb } from './db'
import { createApp } from './app'

const root = resolve(import.meta.dirname, '..')
const dbFile = process.env.ORION_DB ?? join(root, 'data', 'orion.db')
const port = Number(process.env.PORT ?? 4321)

const db = openDb(dbFile)
const app = createApp(db, { staticDir: join(root, 'dist') })

app.listen(port, '127.0.0.1', () => {
  console.log(`ORION escuchando en http://localhost:${port}`)
  console.log(`Base de datos: ${dbFile}`)
})
