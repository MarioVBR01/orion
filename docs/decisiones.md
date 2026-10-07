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

## Fase 2: tablero

12. **Identificador de tarjeta en la URL y la API:** el `number` del proyecto (#1871), no el id interno. Así coincide con lo que se ve y con lo que usará el MCP.
13. **Actor:** las acciones desde la web se registran con el nombre de Ajustes. El MCP registrará `claude`.
14. **Reglas del flujo en el servidor** (`shared/flow.ts`, usado por `server/cards.ts`): Claude solo mueve entre Backlog, Por hacer, En progreso y En revisión QA, y nunca a Hecho. Devolver de "En revisión humano" a "Por hacer" exige comentario, que se guarda como comentario de la tarjeta y en el historial. El humano puede mover libremente.
15. **💡 Ideas:** captura rápida que crea tarjetas en Backlog con la etiqueta `idea` (tipo historia, prioridad baja). Es la interpretación más simple de "ideas/sugerencias".
16. **⋮ Más opciones:** seleccionar las tarjetas visibles, ver y restaurar archivadas, y exportar el tablero a JSON.
17. **Acciones masivas** (mover, asignar, etiquetar, archivar) se ejecutan en una sola transacción: si una tarjeta viola el flujo, no se aplica ninguna.
18. **Movimiento optimista:** la tarjeta cambia de columna al instante y vuelve a su lugar si el servidor rechaza el movimiento.
19. **Con búsqueda activa**, el orden de una tarjeta arrastrada se calcula entre sus vecinas visibles.
20. **Sprints:** el selector y el filtro por sprint quedan para la fase 6, junto con el burndown.
21. **Adjuntos de tarjeta:** por ahora solo se muestran. La subida llega en la fase 3, con las observaciones.
