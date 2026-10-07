# ORION Manager

Gestor de proyectos tipo Jira/Scrum, en español, **local y de un solo usuario**.
Web en React, servidor Express y base SQLite en un archivo (`data/orion.db`).

## Requisitos

- Node 22.12 o superior (usa el módulo `node:sqlite` integrado; no requiere compilar nada)

## Uso

```bash
npm install
npm start        # compila la web y abre el servidor en http://localhost:4321
```

Tus datos quedan en `data/orion.db`. Para respaldarlos, copia la carpeta `data/`.

## Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | API (puerto 4321) + Vite con recarga en caliente (http://localhost:5173) |
| `npm run serve` | Solo el servidor, sirviendo la web ya compilada |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck y build de la web |
| `npm test` | Pruebas (Vitest): utilidades y API con SQLite en memoria |
| `npm run check` | lint + build + test |

Variables opcionales: `PORT` (por defecto 4321) y `ORION_DB` (ruta de la base).

## Estructura

```
server/   API Express + SQLite (db.ts: migraciones, repo.ts: lógica, app.ts: rutas)
shared/   tipos compartidos entre web, servidor y MCP
src/      web React (features/, components/, lib/)
tests/    pruebas
docs/     decisiones.md
```

Las decisiones de diseño están en [docs/decisiones.md](docs/decisiones.md).
