# ORION Manager

Gestor de proyectos tipo Jira/Scrum, en español, sobre Firebase (Auth, Firestore, Storage, Hosting).

## Requisitos

- Node 20 o superior
- Firebase CLI (`npm i -g firebase-tools`)
- Java 11 o superior (para los emuladores)

## Configuración

1. Copia `.env.example` como `.env.development.local` (para `npm run dev`), `.env.dev.local` (para el deploy a dev) y `.env.prod.local` (para el deploy a prod). Rellena cada uno con la configuración web de su proyecto Firebase.
2. En la consola de Firebase, activa **Authentication → Sign-in method → Correo electrónico/contraseña**.
3. Abre `/setup` en la app para crear el **primer administrador**. Esa pantalla solo funciona una vez.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck y build |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:rules` | Pruebas de las Security Rules con el emulador de Firestore |
| `npm run deploy:dev` | Build y deploy a `orion-pm-dev` |
| `npm run deploy:prod` | Build y deploy a `orion-pm-prod` |

## Entornos

| Alias | Proyecto | URL |
| --- | --- | --- |
| `dev` | `orion-pm-dev` | https://orion-pm-dev.web.app |
| `prod` | `orion-pm-prod` | (pendiente) |

Las decisiones de diseño están en [docs/decisiones.md](docs/decisiones.md).
