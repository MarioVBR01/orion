export const HELP = `orion: trabaja las tarjetas del tablero ORION desde la terminal.

Configuración (una vez por repo):
  orion proyectos                      Lista los proyectos (código y nombre)
  orion init <CÓDIGO> [--claude-md]    Vincula este repo a un proyecto (.orion.json);
                                       --claude-md agrega a CLAUDE.md las instrucciones para Claude Code

Trabajo diario:
  orion tablero                        Resumen de columnas y tarjetas abiertas
  orion siguiente [--ver]              Toma la siguiente tarjeta (Por hacer y luego Backlog, en el orden
                                       del tablero): la asigna y la pasa a En progreso. --ver solo la muestra
  orion ver <N>                        Detalle completo: reporte, criterios, adjuntos (rutas), comentarios
  orion tomar <N>                      Asigna la tarjeta N y la pasa a En progreso
  orion criterio <N> <i> [--no]        Marca el criterio de aceptación i como cumplido (o pendiente)
  orion trabajo <N> --rama R --commit C [--pr URL]
                                       Registra rama, commit y PR en la tarjeta
  orion comentar <N> "texto"           Agrega un comentario
  orion terminar <N> -c "resumen"      Pasa a En revisión QA con el resumen de lo que cambiaste
  orion mover <N> <columna> [-c "comentario"]
                                       Columnas: backlog, por-hacer, progreso, qa, humano, hecho
  orion listar [--columna X] [--asignado claude]

Opciones:
  --proyecto <CÓDIGO>   Proyecto a usar (si no, .orion.json o ORION_PROYECTO)
  --como "Nombre"       Actor que firma las acciones (por defecto: claude)
  --json                Salida en JSON

Reglas: como "claude" solo se mueve entre Backlog, Por hacer, En progreso y En revisión QA.
Mover a "Hecho" lo hace un humano desde el tablero.`

export const CLAUDE_MD_SNIPPET = `## Tablero ORION

Este repo trabaja con las tarjetas del tablero ORION mediante el comando \`orion\` (ver \`orion ayuda\`).
Cuando te pidan "toma la siguiente tarjeta" o "trabaja el backlog":

1. \`orion siguiente\`: toma la tarjeta (queda En progreso y asignada a ti). Lee el reporte
   (¿Dónde?/¿Qué hice?/¿Qué esperaba?/¿Qué pasó?), los criterios de aceptación y abre las imágenes adjuntas
   (\`orion ver <N>\` muestra sus rutas).
2. Crea una rama \`orion/<N>-<resumen-corto>\` e implementa el cambio. Si algo es ambiguo, pregunta con
   \`orion comentar <N> "..."\` y avisa al usuario en vez de adivinar.
3. Verifica (tests/lint/build del repo). Marca cada criterio cumplido con \`orion criterio <N> <i>\`.
4. Haz commit y registra el trabajo: \`orion trabajo <N> --rama <rama> --commit <sha>\`.
5. \`orion terminar <N> -c "qué cambiaste, archivos clave y cómo probarlo"\`: queda En revisión QA.

Nunca muevas tarjetas a Hecho: eso lo hace un humano tras revisar.
`
