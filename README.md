# ORION Manager

Gestor de proyectos tipo Jira/Scrum, en español, **local y de un solo usuario**.
Web en React, servidor Express y base SQLite en un archivo (`data/orion.db`).
Las tarjetas del Backlog se exportan a **.md** con instrucciones para el chat de Claude de cada proyecto.

## Requisitos

- Node 22.12 o superior (usa el módulo `node:sqlite` integrado; no requiere compilar nada)

## Uso

```bash
npm install
npm start        # compila la web y abre el servidor en http://localhost:4321
```

Tus datos quedan en `data/orion.db` y las imágenes en `data/uploads/`. Para respaldarlos, copia la carpeta `data/`.

## Flujo de trabajo

1. **Por revisar:** registra cada reporte con *Nueva observación*: Título, Tipo (Bug, Mejora o Duda), Descripción y
   Screenshots (botón *Subir imágenes* o pegar con Ctrl+V). Queda pendiente de revisión.
2. Revisa el reporte y elige **Pasar al Backlog** (de a uno o en lote: crea la tarjeta), **Pedir más información** o **Rechazar**.
3. En el **Tablero**, ordena el Backlog arrastrando: lo de arriba va primero.
4. **Exporta a .md** las tarjetas que quieras enviar a Claude:
   - todo el Backlog: icono de exportar en el encabezado de la columna Backlog (o menú ⋮ → *Exportar Backlog a .md*);
   - varias tarjetas: márcalas y pulsa *Exportar .md* en la barra inferior;
   - una tarjeta: *Exportar .md para el chat* en su detalle.

   Pulsa **Copiar para el chat** y pégalo en el chat de Claude del proyecto (o **Descargar .md** y adjúntalo).
   Opcionalmente, las tarjetas pasan a *Por hacer* al exportarlas.
5. **El tablero no se mueve solo.** El .md le indica a Claude que reporte cada paso con una línea de estado, y tú mueves la tarjeta:

   | Claude escribe | Tú mueves la tarjeta a |
   | --- | --- |
   | `▶ #12 → En progreso` | En progreso |
   | `⏸ #12 → Por hacer: <qué falta>` | Por hacer |
   | `✅ #12 → En revisión QA` | En revisión QA |

6. Tú revisas el trabajo y la mueves a *Hecho* (o la devuelves a *Por hacer* con un comentario).

### Instrucciones para Claude (por proyecto)

Con el lápiz ✏️ junto al nombre del proyecto, completa **Instrucciones para Claude**: repositorio, stack, reglas de ramas,
cómo verificar… Ese texto encabeza cada .md exportado, para que Claude trabaje igual en cada tarea.

### Comando `orion` (en pausa)

El repositorio incluye el comando `orion` (`orion ayuda`) para que Claude Code tome tarjetas directamente desde la terminal.
Por ahora **no se usa**: el flujo es exportar .md y mover las tarjetas a mano.


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
