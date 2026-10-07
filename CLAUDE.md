# ORION — Reglas del proyecto

- Idioma de la UI y de los commits: español. Commits convencionales (`feat:`, `fix:`).
- TypeScript estricto; sin `any` salvo justificación.
- App 100 % local y de un solo usuario: web (Vite + React) + servidor Express + SQLite (`node:sqlite`) en `data/orion.db`. Sin nube ni login.
- Toda validación y regla de flujo (qué columnas se pueden mover, numeración, etc.) vive en el servidor (`server/` y `shared/flow.ts`), no solo en la UI. El comando `orion` (`cli/`) usa la misma capa.
- Nunca subas `data/` (la base y los adjuntos son datos del usuario).
- Antes de dar una tarea por terminada: `npm run lint && npm run build && npm test` (atajo: `npm run check`).
- El comando `orion` (actor `claude`) nunca mueve tarjetas a Hecho; eso lo hace un humano.
- Fuera de alcance por ahora: login, Rounds, servidor MCP, Brief, Links, Mensajes.
- Si algo del spec es ambiguo, elige la opción más simple, documéntala en `docs/decisiones.md` y continúa.
