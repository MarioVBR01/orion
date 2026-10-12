# ORION — Reglas del proyecto

- Idioma de la UI y de los commits: español. Commits convencionales (`feat:`, `fix:`).
- TypeScript estricto; sin `any` salvo justificación.
- App 100 % local y de un solo usuario: web (Vite + React) + servidor Express + SQLite (`node:sqlite`) en `data/orion.db`. Sin nube ni login.
- Toda validación y regla de flujo (qué columnas se pueden mover, numeración, etc.) vive en el servidor (`server/` y `shared/flow.ts`), no solo en la UI. El comando `orion` (`cli/`) usa la misma capa.
- Nunca subas `data/` (la base y los adjuntos son datos del usuario).
- Antes de dar una tarea por terminada: `npm run lint && npm run build && npm test` (atajo: `npm run check`).
- Flujo actual: Por revisar → (a mano) Backlog → exportar .md (`shared/exportMd.ts`) que se pega en el chat de Claude de cada proyecto. El tablero NO se mueve solo: el .md pide a Claude líneas de estado (`▶ / ⏸ / ✅ #N → columna`) y la persona mueve las tarjetas. Nunca se indica Hecho.
- El comando `orion` (cli/) existe pero está en pausa; si se retoma, nunca mueve a Hecho.
- Fuera de alcance por ahora: login, Rounds, servidor MCP, Brief, Links, Mensajes, automatización con Claude.
- Si algo del spec es ambiguo, elige la opción más simple, documéntala en `docs/decisiones.md` y continúa.
