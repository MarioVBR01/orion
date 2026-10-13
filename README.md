# ORION Manager

Gestor de proyectos tipo Jira/Scrum, en español, **local y de un solo usuario**.
Web en React, servidor Express y base SQLite en un archivo (`data/orion.db`).
Cada proyecto se vincula a su carpeta de VS Code y **Claude Code trabaja el tablero** desde ahí.

## Requisitos

- Node 22.12 o superior (usa el módulo `node:sqlite` integrado; no requiere compilar nada)
- Claude Code (extensión de VS Code) con tu cuenta, para el trabajo de la IA
- El comando `orion` instalado una vez: `npm link` desde esta carpeta

## Uso

```bash
npm install
npm link         # una vez: deja disponible el comando `orion` en cualquier terminal
npm start        # compila la web y abre el servidor en http://localhost:4321
```

Tus datos quedan en `data/orion.db` y las imágenes en `data/uploads/`. Para respaldarlos, copia la carpeta `data/`.

## Flujo de trabajo

```
Por revisar ─(tú)─▶ Backlog ─(Claude)─▶ Por hacer ▶ En progreso ▶ En revisión QA ▶ En revisión humano ─(tú)─▶ Hecho
                                                                                          │
                                                       si falla: devolver a Por hacer con comentario o reportar en Por revisar
```

1. **Por revisar:** registra cada reporte con *Nueva observación*: Título, Tipo (Bug, Mejora o Duda), Descripción y
   Screenshots (botón *Subir imágenes* o pegar con Ctrl+V).
2. Revisa el reporte y elige **Pasar al Backlog** (de a uno o en lote), **Pedir más información** o **Rechazar**.
3. En el **Tablero**, ordena el Backlog arrastrando: lo de arriba va primero. Lo que pongas en *Por hacer* va antes que el Backlog.
4. **Trabajar con Claude** (botón en la cabecera del proyecto):
   1. *Preparar para Claude* (una vez): deja la carpeta lista.
   2. *Abrir en VS Code*, abrir Claude Code y pegar la orden ("Trabaja el backlog de ORION…").
   3. Claude toma cada tarjeta, la implementa con **un commit por tarjeta** en la rama actual, la verifica (pruebas del
      proyecto) y la deja en **En revisión humano** con instrucciones de cómo probarla. El tablero se mueve solo.
5. **Tú pruebas la aplicación** y mueves a **Hecho**, o devuelves la tarjeta a *Por hacer* con un comentario, o reportas el
   error en *Por revisar*. Claude nunca mueve a Hecho ni hace push.
6. **Daily Scrum:** registra cada día qué hizo, qué hará y los impedimentos de cada persona (y de Claude). ORION agrega la
   actividad del tablero del periodo y el estado de las columnas. Exporta cada daily a **PDF** como evidencia.

### Vincular un proyecto con su carpeta

En el lápiz ✏️ del proyecto completa **Carpeta del proyecto (VS Code)** y luego, en *Trabajar con Claude*, pulsa
**Preparar para Claude**. Eso agrega a la carpeta:

| Archivo | Para qué |
| --- | --- |
| `.orion.json` | Indica a qué proyecto de ORION pertenece la carpeta |
| `CLAUDE.md` (sección "Tablero ORION") | El flujo que sigue Claude; el resto del archivo no se toca |
| `.claude/settings.json` | Permisos para usar `orion`, las pruebas y git sin pedir confirmación en cada paso |

Desde la terminal de la carpeta también sirve `orion init <CÓDIGO>`.

**Instrucciones para Claude** (mismo modal): stack, reglas del proyecto… Se incluyen en los .md exportados.

### Comando `orion` (lo usa Claude)

| Comando | Qué hace |
| --- | --- |
| `orion siguiente` | Toma la siguiente tarjeta: Por hacer → En progreso, asignada a claude |
| `orion ver <N>` | Detalle: descripción, criterios, rutas de imágenes, comentarios |
| `orion bloquear <N> -c "…"` | Devuelve a Por hacer con la pregunta (falta información) |
| `orion trabajo <N> --commit C --rama R` | Registra el commit de la tarjeta |
| `orion qa <N> -c "…"` | Pasa a En revisión QA con el resumen del cambio |
| `orion criterio <N> <i>` | Marca un criterio de aceptación como cumplido |
| `orion entregar <N> -c "…"` | Pasa a En revisión humano con cómo probarlo |
| `orion tablero` | Resumen del tablero |

`orion ayuda` muestra todos. Como `claude`, el comando nunca mueve a Hecho ni toca tarjetas en "En revisión humano".

### Exportar a .md (alternativa manual)

Para proyectos sin carpeta vinculada o para enviar tareas a otro chat: seleccionar tarjetas → *Exportar .md*
(o el icono en la columna Backlog). Ese .md pide a Claude líneas de estado (`▶ / ⏸ / ✅ #N → columna`) y tú mueves las tarjetas.

## Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | API (puerto 4321) + Vite con recarga en caliente (http://localhost:5173) |
| `npm run serve` | Solo el servidor, sirviendo la web ya compilada |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck y build de la web |
| `npm test` | Pruebas (Vitest): utilidades, API, comando `orion`, carpeta vinculada, Daily y PDF |
| `npm run check` | lint + build + test |
| `npm run orion -- <comando>` | El comando `orion` sin instalarlo globalmente |

Variables opcionales:
- `PORT`: puerto del servidor (por defecto 4321).
- `ORION_DB`: ruta de la base.
- `ORION_UPLOADS`: carpeta de adjuntos.
- `ORION_PROYECTO`: proyecto por defecto del comando `orion`.

## Estructura

```
server/   API Express + SQLite (db.ts: migraciones; repo, cards, observations, dailies: lógica;
          link.ts: preparar carpeta; app.ts: rutas)
cli/      comando `orion` (usa la misma lógica que el servidor)
bin/      lanzador del comando
shared/   tipos y reglas compartidas (flujo de columnas, búsqueda, orden, exportación .md)
src/      web React (features/, components/, lib/)
tests/    pruebas
docs/     decisiones.md
```

Las decisiones de diseño están en [docs/decisiones.md](docs/decisiones.md).
