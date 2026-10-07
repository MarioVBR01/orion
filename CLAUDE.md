# ORION — Reglas del proyecto

- Idioma de la UI y de los commits: español. Commits convencionales (`feat:`, `fix:`).
- TypeScript estricto; sin `any` salvo justificación.
- Nunca subas credenciales ni `serviceAccount.json`; usa `.env.local` y `.gitignore`.
- Toda regla de permisos debe existir en Firestore Rules, no solo en la UI.
- Antes de dar una tarea por terminada: `npm run lint && npm run build && npm test`.
- No muevas tarjetas a Hecho desde el MCP; eso lo hace un humano.
- Si algo del spec es ambiguo, elige la opción más simple, documéntala en `docs/decisiones.md` y continúa.
