# ORION Manager

Gestor de proyectos tipo Jira/Scrum, en español, **local y de un solo usuario**.
Web en React, servidor Express y base SQLite en un archivo (`data/orion.db`).
La IA (Claude Code) trabaja las tarjetas del Backlog con el comando `orion`.

## Requisitos

- Node 22.12 o superior (usa el módulo `node:sqlite` integrado; no requiere compilar nada)

## Uso

```bash
npm install
npm start        # compila la web y abre el servidor en http://localhost:4321
```

Tus datos quedan en `data/orion.db` y las imágenes en `data/uploads/`. Para respaldarlos, copia la carpeta `data/`.

## Flujo de trabajo

1. **Por revisar:** registra los reportes de clientes o testers con *Nueva observación*:
   ¿Dónde? / ¿Qué hice? / ¿Qué esperaba? / ¿Qué pasó? / 📎 Imagen. Puedes pegar capturas con Ctrl+V.
2. Revisa cada reporte y elige **Pasar al Backlog** (crea la tarjeta), **Pedir más información** o **Rechazar**.
3. En el **Tablero**, ordena el Backlog arrastrando: lo de arriba es lo siguiente. Si quieres que algo se haga ya,
   muévelo a *Por hacer*, que tiene prioridad sobre el Backlog.
4. **La IA trabaja la tarjeta** con el comando `orion` (ver abajo) y la deja en *En revisión QA* con su resumen.
5. Tú revisas y la mueves a *Hecho*, o la devuelves a *Por hacer* con un comentario.

## Comando `orion` (para Claude Code)

Instálalo una vez como comando global, desde esta carpeta:

```bash
npm link          # deja disponible `orion` en cualquier terminal
```

En el repo del proyecto que vas a desarrollar (por ejemplo, el código de LaGuardiaGO):

```bash
orion init LGG --claude-md   # vincula el repo al proyecto y agrega las instrucciones a su CLAUDE.md
```

Luego, en Claude Code dentro de ese repo, basta con pedir:

> toma la siguiente tarjeta del backlog de ORION e impleméntala

Claude hará lo siguiente:

1. Ejecuta `orion siguiente`: la tarjeta pasa a *En progreso*, asignada a 🤖 claude.
2. Lee el reporte, los criterios y las imágenes, e implementa el cambio en una rama.
3. Registra rama y commit con `orion trabajo`.
4. Cierra con `orion terminar <N> -c "resumen"`: la tarjeta queda en *En revisión QA*.

Lo ves en vivo en el tablero. Claude **no puede** mover tarjetas a *Hecho*.

| Comando | Qué hace |
| --- | --- |
| `orion tablero` | Resumen de columnas y tarjetas abiertas |
| `orion siguiente [--ver]` | Toma la siguiente tarjeta (Por hacer y luego Backlog) |
| `orion ver <N>` | Detalle: reporte, criterios, rutas de imágenes, comentarios |
| `orion criterio <N> <i>` | Marca un criterio de aceptación como cumplido |
| `orion trabajo <N> --rama R --commit C` | Registra el trabajo |
| `orion comentar <N> "…"` | Comenta en la tarjeta |
| `orion terminar <N> -c "…"` | Pasa a En revisión QA con el resumen |
| `orion mover <N> <columna>` | backlog, por-hacer, progreso, qa, humano, hecho |

`orion ayuda` muestra todos los comandos y opciones.

## Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | API (puerto 4321) + Vite con recarga en caliente (http://localhost:5173) |
| `npm run serve` | Solo el servidor, sirviendo la web ya compilada |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck y build de la web |
| `npm test` | Pruebas (Vitest): utilidades, API y comando `orion` con bases temporales |
| `npm run check` | lint + build + test |
| `npm run orion -- <comando>` | El comando `orion` sin instalarlo globalmente |

Variables opcionales:
- `PORT`: puerto del servidor (por defecto 4321).
- `ORION_DB`: ruta de la base.
- `ORION_UPLOADS`: carpeta de adjuntos.
- `ORION_PROYECTO`: proyecto por defecto del comando `orion`.

## Estructura

```
server/   API Express + SQLite (db.ts: migraciones; repo, cards, observations: lógica; app.ts: rutas)
cli/      comando `orion` (usa la misma lógica que el servidor)
bin/      lanzador del comando
shared/   tipos y reglas compartidas (flujo de columnas, búsqueda, orden)
src/      web React (features/, components/, lib/)
tests/    pruebas
docs/     decisiones.md
```

Las decisiones de diseño están en [docs/decisiones.md](docs/decisiones.md).
