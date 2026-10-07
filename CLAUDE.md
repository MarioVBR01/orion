# ORION — Reglas del proyecto

- Idioma de la UI y de los commits: español. Commits convencionales (`feat:`, `fix:`).
- TypeScript estricto; sin `any` salvo justificación.
- App 100 % local y de un solo usuario: web (Vite + React) + servidor Express + SQLite (`node:sqlite`) en `data/orion.db`. Sin nube ni login.
- Toda validación y regla de flujo (qué columnas se pueden mover, numeración, etc.) vive en el servidor (`server/`), no solo en la UI. El MCP usa la misma capa (`server/repo.ts`).
- Nunca subas `data/` (la base y los adjuntos son datos del usuario).
- Antes de dar una tarea por terminada: `npm run lint && npm run build && npm test` (atajo: `npm run check`).
- No muevas tarjetas a Hecho desde el MCP; eso lo hace un humano.
- Si algo del spec es ambiguo, elige la opción más simple, documéntala en `docs/decisiones.md` y continúa.
