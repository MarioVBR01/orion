# Decisiones del proyecto

Registro de decisiones tomadas cuando el spec era ambiguo o hubo que ajustarlo.

## Cambio de rumbo: app local de un solo usuario

El usuario decidió no usar Firebase: ORION será local y solo lo usará él. Firebase, Hosting, Auth, roles, reglas, invitaciones y CI de deploy quedan fuera del alcance. Los tres primeros commits del historial de git tienen la versión con Firebase, por si algún día se retoma.

1. **Arquitectura:** servidor Express local y base SQLite (`data/orion.db`). Se descartó guardar en el navegador (IndexedDB) porque el servidor MCP (fase 5) tiene que leer y mover tarjetas, y no puede acceder al almacenamiento del navegador. El MCP reutilizará `server/repo.ts` sobre el mismo archivo.
2. **SQLite integrado de Node (`node:sqlite`)** en lugar de `better-sqlite3`, que se cae con Node 22.12 en esta máquina. En Node 22.12 se necesita la opción `--experimental-sqlite` (ya está en los scripts); desde Node 22.13 no hace falta.
3. **Sin login.** Hay un único usuario; su nombre se guarda en Ajustes y se usa como autor.
4. **Miembros → personas de referencia** por proyecto (nombre, correo y rol informativo). Sirven como autores, asignados y remitentes ("Por Rodri BC"). Los roles no restringen nada.
5. **Se quitan** las pantallas Usuarios, Testers y Cambiar contraseña. El canal "Testers" de Por revisar se mantiene como etiqueta de origen.
6. **El flujo de columnas sí se valida en el servidor** (por ejemplo, Claude/MCP no puede mover a Hecho y una devolución exige comentario), aunque no haya roles.
7. **Datos en vivo:** React Query refresca cada 5 s, así se ven los cambios que hace el MCP.
8. **Numeración:** el proyecto usa su `id` autoincremental (#1, #2…). Las tarjetas usan un contador por proyecto (`card_counter`), incrementado en una transacción, con `UNIQUE(project_id, number)`.
9. **Orden de tarjetas:** fractional indexing con claves string base-62 (`src/lib/order.ts`).
10. **Migraciones** versionadas con `PRAGMA user_version` en `server/db.ts`.
11. **Fechas** en ISO (UTC) en la base; se muestran con `Intl.DateTimeFormat('es-BO')`.
