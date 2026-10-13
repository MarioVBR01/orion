export const HELP = `orion: trabaja las tarjetas del tablero ORION desde la terminal del proyecto.

Flujo de Claude: Backlog → Por hacer → En progreso → En revisión QA → En revisión humano.
Desde "En revisión humano" decide una persona (prueba la app y mueve a Hecho o reporta errores).

Configuración (una vez por proyecto):
  orion proyectos                      Lista los proyectos (código y nombre)
  orion init <CÓDIGO>                  Vincula la carpeta actual al proyecto y la prepara para Claude Code
                                       (.orion.json, sección "Tablero ORION" en CLAUDE.md y permisos)

Trabajo (en la carpeta del proyecto):
  orion tablero                        Resumen de columnas y tarjetas abiertas
  orion siguiente [--ver]              Toma la siguiente tarjeta (Por hacer y luego Backlog, en el orden del
                                       tablero): Por hacer → En progreso, asignada a ti. --ver solo la muestra
  orion ver <N>                        Detalle: descripción, criterios, imágenes (rutas), comentarios
  orion tomar <N>                      Toma una tarjeta concreta
  orion bloquear <N> -c "qué falta"    Devuelve a Por hacer con la pregunta
  orion trabajo <N> --commit C [--rama R]
                                       Registra el commit de la tarjeta
  orion qa <N> -c "qué cambiaste"      En progreso → En revisión QA
  orion criterio <N> <i> [--no]        Marca el criterio de aceptación i como cumplido (o pendiente)
  orion entregar <N> -c "cómo probarlo"
                                       En revisión QA → En revisión humano (tras verificar)
  orion comentar <N> "texto"           Agrega un comentario
  orion mover <N> <columna> [-c "…"]   Columnas: backlog, por-hacer, progreso, qa, humano
  orion listar [--columna X] [--asignado claude]

Opciones:
  --proyecto <CÓDIGO>   Proyecto a usar (si no: carpeta vinculada, .orion.json u ORION_PROYECTO)
  --como "Nombre"       Actor que firma las acciones (por defecto: claude)
  --json                Salida en JSON

Como "claude" nunca se mueve a Hecho ni se tocan tarjetas en "En revisión humano".`
