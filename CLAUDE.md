# ORION — Reglas del proyecto

- Idioma de la UI y de los commits: español. Commits convencionales (`feat:`, `fix:`). Correo de los commits: mariobranez.sis24@tecba.edu.bo.
- TypeScript estricto; sin `any` salvo justificación.
- App 100 % local y de un solo usuario: web (Vite + React) + servidor Express + SQLite (`node:sqlite`) en `data/orion.db`. Sin nube ni login.
- Toda validación y regla de flujo (qué columnas se pueden mover, numeración, etc.) vive en el servidor (`server/` y `shared/flow.ts`), no solo en la UI. El comando `orion` (`cli/`) usa la misma capa.
- Nunca subas `data/` (la base y los adjuntos son datos del usuario).
- Antes de dar una tarea por terminada: `npm run lint && npm run build && npm test` (atajo: `npm run check`).
- Flujo actual (modo semiautomático): Por revisar → (persona) Backlog → (Claude Code con `orion`, desde la carpeta vinculada del proyecto) Por hacer → En progreso → En revisión QA → En revisión humano → (persona) Hecho. Claude nunca mueve a Hecho, no toca tarjetas en "En revisión humano" ni hace push. Un commit por tarjeta en la rama actual.
- Cada proyecto se vincula a su carpeta de VS Code (`projects.repo_path`); "Preparar para Claude" (`server/link.ts`) escribe `.orion.json`, la sección entre marcas `ORION:inicio/fin` en su CLAUDE.md y permisos en `.claude/settings.json`, sin tocar lo demás.
- Sprints = solo registro (pestaña Sprints, `server/sprints.ts`): nombre, fechas sin cruces, objetivo y estado; un solo activo; se pueden completar sprints pasados sin iniciarlos. Las tarjetas no se asignan a sprints desde la UI (se gestionan en el Kanban). Dailies con fecha pasada: la foto del tablero se reconstruye con el historial.
- La pestaña Testing se reemplazó por Daily Scrum (evidencias, exportación a PDF con pdfmake cargado bajo demanda). Las pruebas de la app las hacen las personas.
- Fuera de alcance por ahora: login, Rounds, servidor MCP, Brief, Links, Mensajes, lanzar Claude automáticamente desde ORION.
- Si algo del spec es ambiguo, elige la opción más simple, documéntala en `docs/decisiones.md` y continúa.
