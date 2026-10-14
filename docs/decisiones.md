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

## Alcance actual (pedido del usuario)

22. **Fuera de alcance por ahora:** login, Rounds, servidor MCP, Brief, Links y Mensajes. Se quitaron de las pestañas y del menú.
23. **La IA trabaja con el comando `orion`** en lugar del servidor MCP. Claude Code lo ejecuta desde la terminal del repo del proyecto. Usa la misma lógica y las mismas reglas que el servidor (`server/cards.ts`), directamente sobre `data/orion.db`, así que no necesita que el servidor esté corriendo. Los cambios se ven en el tablero en 5 s o menos.
24. **`orion siguiente`** toma la tarjeta de más arriba en *Por hacer* y, si no hay, la de más arriba en *Backlog* (el orden lo decide el usuario arrastrando). Salta las asignadas a otra persona. Al tomarla, la asigna a `claude` y la mueve a *En progreso*.
25. **Vincular un repo:** `orion init <CÓDIGO>` crea `.orion.json` en el repo. Con `--claude-md` además agrega a su `CLAUDE.md` las instrucciones de trabajo (rama, criterios, `trabajo`, `terminar`). El proyecto también se puede elegir con `--proyecto` o con `ORION_PROYECTO`.
26. **Adjuntos para la IA:** `orion ver` muestra la ruta en disco de cada imagen, para que Claude Code pueda abrirlas.

## Fase 3: Por revisar

27. **Sin Rounds:** una observación pasa **a mano** al Backlog con "Pasar al Backlog", de a una o en lote, y se convierte en tarjeta. El tipo se mapea así: bug → Bug, mejora → Historia, duda → Tarea. Al pasarla se eligen la prioridad y las etiquetas iniciales.
28. **Estados de una observación:** pendiente → (esperando información ↔ pendiente, al editarla) → en Backlog | rechazada (con motivo; se puede reabrir). Las acciones en lote son atómicas.
29. **La tarjeta conserva** el reporte, los adjuntos, el autor original ("Por Rodri BC") y la observación de origen. La descripción queda vacía para notas, para no repetir el reporte.
30. **Remitente:** texto libre con sugerencias de los Miembros del proyecto, primero los del rol del canal. Si se deja vacío, se usa el nombre de Ajustes.
31. **Adjuntos** en `data/uploads/<proyecto>/` (imágenes, PDF y video de hasta 15 MB), servidos en `/uploads`. Se suben al agregarlos: arrastrando, pegando con Ctrl+V o con el selector de archivos.
32. **Contador de la pestaña:** suma las observaciones abiertas (pendientes y esperando información) de ambos canales.

## Cambio de enfoque: exportar .md en vez de automatizar (pedido del usuario)

33. **Sin automatización con Claude por ahora.** El equipo todavía no está familiarizado con ese tipo de desarrollo. El comando `orion` se conserva en el código, pero en pausa y sin menciones en la interfaz.
34. **Exportar a .md** (`shared/exportMd.ts`, ruta `POST /api/projects/:pid/cards/export`). Arma un mensaje para el chat de Claude del proyecto con:
    1. Instrucciones del proyecto.
    2. Cómo trabajar.
    3. Tabla de **líneas de estado** (`▶ #N → En progreso`, `⏸ #N → Por hacer: …`, `✅ #N → En revisión QA`) con la columna a la que la persona mueve la tarjeta.
    4. Bloque de cierre por tarea.
    5. Tabla final (si hay varias tareas).
    6. Detalle de cada tarjeta: descripción, reporte, criterios, rutas en disco de las imágenes y comentarios.
35. **Las tarjetas salen en el orden del tablero** (columna y posición), sin importar el orden en que se seleccionaron.
36. **La vista previa no tiene efectos.** Al *Copiar* o *Descargar* se registra la exportación: historial `exportada` con el nombre del archivo, `exported_at` y la marca `.md` en la tarjeta. Si se marca la opción, además pasan a *Por hacer*. Copiar y descargar en el mismo diálogo cuentan como una sola exportación.
37. **Nombre del archivo:** `LGG-12.md` para una tarjeta y `LGG-tareas-AAAA-MM-DD.md` para varias.
38. **Instrucciones para Claude por proyecto** (`projects.ai_instructions`): se editan en el modal del proyecto y encabezan cada .md. Si están vacías, la sección se omite y el diálogo de exportación avisa.
39. **Por revisar simplificado** según la referencia: Título, Tipo (Bug: algo está roto, Mejora: algo podría funcionar mejor, Duda: no sé si es un error), Descripción y Screenshots (botón *Subir imágenes* o Ctrl+V). Se agrega un campo opcional *Reportado por* para no perder quién reporta. El reporte estructurado (¿Dónde?/¿Qué hice?…) queda solo para las observaciones antiguas y se sigue mostrando.
40. **Al pasar al Backlog**, la descripción de la observación se vuelve la descripción de la tarjeta.

## Automatización semiautomática con Claude + Daily Scrum (pedido del usuario)

41. **La IA vuelve al tablero en modo semiautomático.** La persona abre Claude Code en la carpeta del proyecto y le da la orden (copiada desde *Trabajar con Claude*). ORION no lanza a Claude. El comando `orion` sale de pausa.
42. **Claude recorre todas las etapas hasta "En revisión humano":** Backlog → Por hacer → En progreso → En revisión QA → En revisión humano. `shared/flow.ts` permite a `claude` esas columnas, pero le prohíbe mover a Hecho y mover tarjetas que ya están en "En revisión humano". Ahí decide la persona.
43. **"En revisión QA" es la autoverificación de Claude:** ejecuta los comandos detectados del `package.json` (`npm test`, `npm run typecheck`, `npm run lint`, o `npm run build` si no hay typecheck) y marca los criterios. Las pruebas reales de la aplicación las hacen las personas en "En revisión humano".
44. **Comandos nuevos:** `orion qa` (En progreso → QA; `terminar` queda como alias), `orion entregar` (QA → En revisión humano; exige estar en QA y un comentario de cómo probar) y `orion bloquear` (vuelve a Por hacer con la pregunta). `siguiente`/`tomar` pasan por Por hacer para que quede en el historial.
45. **Git:** un commit por tarjeta en la rama actual (en YALEH, `v1-yaleh`), con mensaje `<tipo>: <resumen> (ORION #N)`; sin ramas ni push.
46. **Carpeta vinculada por proyecto** (`projects.repo_path`), validada al guardar. El comando `orion` reconoce el proyecto por la carpeta actual, además de `.orion.json`, `--proyecto` y `ORION_PROYECTO`.
47. **"Preparar para Claude"** (`server/link.ts`, también `orion init`) escribe `.orion.json`, reemplaza solo la sección del `CLAUDE.md` entre marcas `ORION:inicio/fin` (respeta CRLF/LF y el resto del archivo) y agrega permisos a `.claude/settings.json` sin borrar los existentes. Se puede repetir sin duplicar nada.
48. **Daily Scrum reemplaza a Testing.** Hay uno por proyecto y fecha, con notas, participantes (ayer / hoy / impedimentos) y la foto de las columnas al guardar. La actividad del tablero (tarjetas creadas y movidas) va desde el día siguiente al daily anterior (o el día previo, si es el primero) hasta el final del día del daily. "Agregar Claude (IA)" rellena su "ayer" con las tarjetas que movió.
49. **PDF** con pdfmake, generado en el navegador y cargado solo al exportar, para no hacer más pesada la app. La fuente Roboto no tiene flechas ni emojis: en el PDF "→" se muestra como "»" y los emojis se quitan.
50. **Exportar a .md** se mantiene como alternativa manual, para proyectos sin carpeta o para otros chats.

## Sprints y dailies con fecha pasada (pedido del usuario)

51. **Dailies de cualquier fecha hasta hoy.** El botón *Nuevo Daily Scrum* está siempre disponible (antes, si existía el de hoy, solo lo abría). La fecha de un daily se puede cambiar al editarlo.
52. **La foto del tablero de un daily** se reconstruye con el historial al final del día del daily (o al momento de guardar, si es hoy). Así un daily de septiembre muestra el tablero de septiembre. Las tarjetas creadas después de esa fecha no cuentan; las archivadas tampoco.
53. **Sprints al estilo Jira** (pestaña *Sprints*):
    - Sprints abiertos (el activo primero), Backlog al final y sprints completados plegados.
    - En cada sprint: nombre, fechas o *Añadir fechas*, número de actividades y contadores gris/azul/verde (por hacer: Backlog y Por hacer; en curso: En progreso, QA y revisión humana; hecho).
    - Botones *Iniciar sprint* y *Completar sprint*, menú ⋯ con Editar y Eliminar, *+ Crear* en línea, y arrastrar o mover en lote entre sprints.
54. **Reglas de sprint:**
    - Numeración propia por proyecto, con nombre por defecto `<CÓDIGO> Sprint N`. Las fechas pueden ser pasadas.
    - Solo un sprint activo a la vez, y para iniciarlo hacen falta fechas.
    - Al completarlo, las tarjetas no terminadas van al Backlog o a un sprint futuro; las terminadas se quedan como evidencia.
    - Un sprint completado no se elimina ni recibe tarjetas. Al eliminar un sprint, sus tarjetas vuelven al Backlog.
    - Todo cambio de sprint queda en el historial de la tarjeta.
55. **El sprint no reemplaza las columnas:** el tablero sigue mostrando todas las tarjetas, con un filtro por sprint que se recuerda por proyecto (Todos, Sprint activo, un sprint o Sin sprint).
56. **Claude prioriza el sprint activo:** `orion siguiente` toma primero las tarjetas del sprint activo (Por hacer y luego Backlog) y después el resto.
57. **Daily ↔ sprint:** cada daily muestra a qué sprint pertenece su fecha, con "día N de M" y el objetivo, en la lista, en el editor y en el PDF.

## Sprints como registro (pedido del usuario)

58. **La pestaña Sprints solo registra sprints:** nombre, fechas, duración, objetivo y estado, con el sprint activo destacado (día N de M y barra de tiempo). Las tarjetas se gestionan en el tablero Kanban y en Por revisar. Se quitan de la vista la lista de tarjetas por sprint, el Backlog, el arrastre, el selector de sprint en la tarjeta y el filtro por sprint del tablero. Esto reemplaza los puntos 53 y 55.
59. **Registrar sprints pasados:** un sprint futuro con fechas se puede *Completar* directamente, sin iniciarlo. Para iniciar o completar hacen falta fechas.
60. **Las fechas no se cruzan entre sprints** del mismo proyecto. Así cada día pertenece a un solo sprint, y el Daily Scrum lo muestra sin ambigüedad.
61. **Cualquier sprint se puede editar o eliminar** porque es solo un registro: eliminarlo no afecta al tablero. Esto reemplaza la restricción del punto 54.
62. **El soporte de `sprintId` en tarjetas** (API y `orion siguiente`, que prioriza el sprint activo) se conserva en el servidor por compatibilidad, pero no tiene efecto mientras la interfaz no asigne tarjetas a sprints.
