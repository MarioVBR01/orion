/** 404 */
export class NotFoundError extends Error {}

/** 400: la petición viola una regla de negocio (p. ej. flujo de columnas). */
export class RuleError extends Error {}
