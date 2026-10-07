# Decisiones del proyecto

Registro de decisiones tomadas cuando el spec era ambiguo o había que ajustarlo.

## Fase 1

1. **Firebase SDK 12 en lugar de 10.** Es la versión actual y mantiene la misma API modular. `@firebase/rules-unit-testing` 5 también la requiere.
2. **Tailwind CSS v4** con `@tailwindcss/vite`. Las clases propias (`btn-primary`, `input`, `card`…) se declaran con `@utility` en `src/index.css`.
3. **IDs de proyectos Firebase:** `orion-pm-dev` y `orion-pm-prod`, porque `orion-dev` y `orion-prod` ya están tomados a nivel global. Los alias de `.firebaserc` siguen siendo `dev` y `prod`.
4. **Alta de usuarios sin Cloud Functions.** El admin o PM crea la cuenta de Auth con una *app secundaria* de Firebase, para no cerrar su propia sesión. Después escribe `users/{uid}` con su sesión, y las reglas validan quién puede asignar cada rol. Así la fase 1 funciona en el plan Spark.
5. **Sin registro público.** Aunque alguien cree una cuenta de Auth por la API, no puede hacer nada sin un documento `users/{uid}` con `active == true`, y ese documento solo lo pueden crear admin o PM (reglas).
6. **Primer administrador (bootstrap).** La pantalla `/setup` crea el primer admin y escribe `meta/bootstrap` en el mismo batch. Cuando ese documento existe, las reglas impiden cualquier otro auto-alta como admin.
7. **Desactivar un usuario** pone `active = false`. Las reglas bloquean todo acceso, pero la cuenta de Auth sigue existiendo, porque deshabilitarla requiere el Admin SDK. Se hará cuando haya Functions.
8. **Un PM global** puede crear usuarios con rol `dev`, `qa`, `cliente` o `tester` (lo necesita para dar de alta testers). Solo el admin puede crear o promover a `admin` o `project_manager`.
9. **Visibilidad de proyectos.** El proyecto guarda `memberIds[]` (desnormalizado de `members/`) para poder consultar "mis proyectos" con `array-contains`. Los dos se actualizan siempre en el mismo batch.
10. **Numeración de proyectos (#6)** con un contador global en `meta/counters.project`, dentro de una transacción.
11. **Numeración de tarjetas.** La regla exige que `number` esté en el tramo `(contador antes, contador después]` de la misma escritura. Esto permite crear varias tarjetas en un batch (aceptar un round) sin repetir números.
12. **Rol efectivo.** El `admin` global tiene todos los permisos en todos los proyectos. El resto de los permisos depende del rol en el proyecto (`members/{uid}.role`), no del rol global.
13. **Contadores por columna** en la pantalla Proyectos con agregaciones `count()` de Firestore. No se descargan las tarjetas.
14. **Orden de tarjetas.** Fractional indexing con claves string base-62 (`src/lib/order.ts`).

## Cambio: login con Google (pedido del usuario)

15. **Proyecto Firebase:** `orion-66851` (creado por el usuario) reemplaza a `orion-pm-dev` como entorno `dev`.
16. **Autenticación solo con Google** (`signInWithPopup`). Se eliminan la contraseña, "Cambiar contraseña" y la recuperación de contraseña, porque Google las gestiona.
17. **Alta por invitación:** el admin o PM crea `invites/{correo}` con rol global y proyectos (`{ pid: rol }`). En el primer ingreso con Google el cliente "reclama" la invitación en un batch: crea `users/{uid}`, `members/{uid}`, se agrega a `memberIds` y borra la invitación. Las reglas exigen `email_verified`, que el correo del token coincida y que el rol sea exactamente el de la invitación.
18. **Invitar desde Miembros** a un correo sin cuenta crea o amplía su invitación con ese proyecto. Si es un rol de proyecto `viewer`, el rol global es `cliente`.
