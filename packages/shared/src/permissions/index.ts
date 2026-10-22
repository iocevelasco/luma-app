/**
 * Quién puede hacer qué en una obra.
 *
 * ESTE ARCHIVO ES LA GRILLA. Si querés cambiar un permiso, cambiás una celda
 * de `PROJECT_CAPABILITIES` y no tocás ningún controller: los routers de la
 * API y los gates de la UI leen de acá. Dos copias de esta tabla —una en el
 * middleware y otra en el frontend— se desincronizan a la primera semana, y
 * la que se desincroniza es siempre la que decide qué botón se muestra.
 *
 * El rol NO se guarda como un string suelto en cada chequeo. Se resuelve una
 * vez por request (ver `project.middleware.ts`) y después todo se pregunta
 * por capacidad, nunca por rol: `can('activity.write')` y no
 * `role === 'supervisor'`. La diferencia importa cuando mañana entre un rol
 * nuevo —un arquitecto, un inspector— y haya que agregarlo en un solo lugar.
 */

/**
 * Rol de una persona **en una obra puntual**, no en la Empresa.
 *
 * - `gerente`: quien la gestiona. Hoy es siempre quien la creó
 *   (`Project.createdBy`), por eso no tiene fila en `ProjectMembership`.
 * - `supervisor`: está en el sitio. Reporta lo que pasa, no planifica ni
 *   maneja plata. Reemplaza al "Asistente de Obra" de la v1, que era un rol
 *   de Empresa y por eso entraba a TODAS sus obras.
 * - `contador`: lleva la plata. Cobros y gastos, nada de obra — no ve
 *   actividades, ni personal, ni proveedores, ni documentación. Es el único
 *   rol además del gerente que ve gastos, y por lo tanto el margen.
 * - `cliente`: quien paga. Sólo lectura, y de una parte acotada.
 *
 * El proveedor NO está acá a propósito: no tiene membresía ni cuenta. Su
 * permiso nace del `ProviderEngagement` y viaja en un enlace firmado.
 */
export type ProjectRole = 'gerente' | 'supervisor' | 'contador' | 'cliente';

/**
 * Roles que SÍ se invitan y por lo tanto se guardan en `ProjectMembership`.
 * `gerente` queda afuera porque se deriva de `createdBy`: una obra sin dueño
 * no existe, y tenerlo en dos lugares abre la puerta a que discrepen.
 */
export type InvitableProjectRole = Exclude<ProjectRole, 'gerente'>;

export const INVITABLE_PROJECT_ROLES: readonly InvitableProjectRole[] = [
  'supervisor',
  'contador',
  'cliente',
] as const;

/**
 * Función de una persona dentro de la Empresa: personal administrativo, no
 * obrero (eso es `CrewMember`). Reusa el vocabulario de los roles de obra para
 * que la persona se llame igual en todos lados, pero **no es un permiso**:
 * figurar acá como supervisor no da acceso a ninguna obra — el acceso se
 * invita obra por obra.
 *
 * `cliente` queda afuera: quien paga no es parte de la Empresa, es parte de
 * una obra puntual (ver `removeMember`, que lo deja intacto a propósito).
 */
export type CompanyStaffRole = Exclude<ProjectRole, 'cliente'>;

export const COMPANY_STAFF_ROLES: readonly CompanyStaffRole[] = [
  'gerente',
  'supervisor',
  'contador',
] as const;

/**
 * Las acciones que la app sabe gatear. El nombre es `recurso.verbo` y se lee
 * como la fila de la matriz del cliente que lo justifica.
 */
export type Capability =
  // La obra en sí
  | 'project.read'
  | 'project.update'
  | 'project.invite'
  // Presupuesto y Consultor IA — información económica interna
  | 'budget.read'
  | 'budget.write'
  | 'advisor.use'
  // Actividades: planificar es del gerente, reportar es del supervisor
  | 'activity.read'
  // Crear es distinto de planificar: el supervisor crea tareas, pero
  // modificarlas (fechas, alcance, cancelar) y borrarlas es del gerente.
  | 'activity.create'
  | 'activity.plan'
  | 'activity.report'
  | 'activity.review'
  | 'activity.evidence.write'
  // Materiales y herramientas
  | 'material.read'
  | 'material.write'
  // Facturas de materiales: un gasto acotado. Quien las tiene carga y ve las
  // facturas de lo que compró, pero no Finanzas ni el total gastado.
  | 'material.invoice.read'
  | 'material.invoice.write'
  // Personal en obra: sumar gente, administrar el roster y la asistencia.
  // Lo que cada uno tiene que hacer son tareas: `activity.*`.
  | 'crew.read'
  | 'crew.create'
  | 'crew.manage'
  | 'crew.attendance.write'
  // Cobros del cliente: el cronograma acordado y lo recibido
  | 'payment.read'
  | 'payment.write'
  // Gastos de la obra. NUNCA para el cliente: cobros menos gastos es el margen
  | 'expense.read'
  | 'expense.write'
  // Hitos y eventualidades
  | 'milestone.read'
  | 'milestone.report'
  | 'milestone.publish'
  // Documentación de obra: permisos, condiciones del sitio, planos y renders
  | 'document.read'
  | 'document.write'
  // Proveedores: el directorio, la asignación y la plata comprometida
  | 'provider.read'
  // Dar de alta un proveedor desde la obra. Sin `provider.manage` queda sólo
  // en esa obra: la libreta de la Empresa la cuida el gerente.
  | 'provider.create'
  | 'provider.manage'
  | 'provider.assign'
  | 'engagement.write';

/**
 * La grilla. Una fila por rol; lo que no está listado, no se puede.
 *
 * Dos lecturas de la matriz del cliente que conviene tener a la vista porque
 * son las que ajustan permisos respecto de la v1:
 *
 * 1. **El supervisor crea, pero no replanifica.** Es quien está en la obra y
 *    reparte el trabajo del día, así que crea tareas (`activity.create`) y
 *    las mueve por el flujo (`activity.report`). Pero modificar una tarea
 *    —fechas, alcance, responsable, cancelarla— y borrarla es planificar, y
 *    eso queda en el gerente (`activity.plan`). Cerrarla tampoco: eso es
 *    `activity.review`.
 * 2. **El supervisor no ve plata.** Ni presupuesto, ni Consultor, ni montos
 *    de contratación. La matriz le da compras y herramientas, no economía.
 * 3. **El cliente ve cobros, nunca gastos.** `payment.read` sí,
 *    `expense.read` no. No es pudor: con el total cobrado y el total gastado,
 *    la utilidad del ejecutante sale de una resta, y la regla 13 dice que esa
 *    cifra no es visible para el cliente. El supervisor no tiene ninguna de
 *    las dos — no ve plata.
 * 4. **El supervisor reporta hacia adentro, no hacia el cliente.** Tiene
 *    `milestone.report` (crear una eventualidad interna) pero no
 *    `milestone.publish`, que es lo que hace falta para que un hito tenga
 *    audiencia `cliente`. Su fila en la matriz dice "notificar eventualidades
 *    **solamente al gerente**"; publicar hacia afuera es del gerente.
 *
 * El cliente tiene `provider.read` en la grilla, pero esa capacidad además
 * pasa por el flag `providersVisibleToClient` de la obra — ver
 * `canInProject()`. Es el único permiso que depende de la obra y no sólo del
 * rol, y por eso es el único con una excepción escrita.
 */
export const PROJECT_CAPABILITIES: Record<ProjectRole, readonly Capability[]> = {
  gerente: [
    'project.read',
    'project.update',
    'project.invite',
    'budget.read',
    'budget.write',
    'advisor.use',
    'payment.read',
    'payment.write',
    'expense.read',
    'expense.write',
    'activity.read',
    'activity.create',
    'activity.plan',
    'activity.report',
    'activity.review',
    'activity.evidence.write',
    'material.read',
    'material.write',
    'material.invoice.read',
    'material.invoice.write',
    'milestone.read',
    'milestone.report',
    'milestone.publish',
    'document.read',
    'document.write',
    'crew.read',
    'crew.create',
    'crew.manage',
    'crew.attendance.write',
    'provider.read',
    'provider.create',
    'provider.manage',
    'provider.assign',
    'engagement.write',
  ],
  supervisor: [
    'project.read',
    'activity.read',
    'activity.create',
    'activity.report',
    'activity.evidence.write',
    'material.read',
    'material.write',
    // Carga la factura de lo que compró. Sin `expense.*`: no ve Finanzas, ni
    // cobros, así que tampoco puede calcular el margen.
    'material.invoice.read',
    'material.invoice.write',
    'milestone.read',
    'milestone.report',
    'document.read',
    'crew.read',
    // Suma gente a SU obra —crear o traer de la Empresa—, pero no edita, no
    // da de baja ni saca: el CRUD del roster sigue siendo del gerente.
    'crew.create',
    'crew.attendance.write',
    'provider.read',
    // El que está en la obra encuentra al corralón de la esquina: lo carga
    // desde Compras sin esperar al gerente, pero sólo para esta obra.
    'provider.create',
    'provider.assign',
  ],
  // La documentación es la columna derecha de la matriz: el cliente accede a
  // permisos, condiciones del sitio, planos y renders. Es lo único operativo
  // que la matriz le abre explícitamente, así que no pasa por ningún flag.
  /**
   * Sólo plata. No tiene `activity.read` ni nada de obra a propósito: su
   * trabajo es conciliar cobros y gastos, y darle acceso al resto "por las
   * dudas" convierte un rol acotado en un segundo gerente.
   *
   * Sí ve gastos, y por lo tanto el margen. Es inevitable: no se puede llevar
   * la contabilidad de una obra sin ver los dos lados.
   */
  contador: ['project.read', 'payment.read', 'payment.write', 'expense.read', 'expense.write'],
  cliente: [
    'project.read',
    'activity.read',
    // Ve el cronograma acordado y lo que pagó — su fila de la matriz. NO ve
    // `expense.read`: con el total cobrado y el total gastado, el margen del
    // ejecutante sale de una resta (regla 13).
    'payment.read',
    // Lee hitos, pero sólo los de audiencia `cliente` — ese filtro no es un
    // permiso sino parte de la consulta, y vive en el controller.
    'milestone.read',
    'document.read',
    'provider.read',
  ],
} as const;

/** Capacidades que además dependen de un flag de la obra, no sólo del rol. */
const CLIENT_GATED_BY_PROJECT_FLAG: Partial<Record<Capability, 'providersVisibleToClient'>> = {
  'provider.read': 'providersVisibleToClient',
};

/** Lo que de la obra necesita saber `canInProject` para resolver las excepciones. */
export interface ProjectCapabilityContext {
  providersVisibleToClient: boolean;
}

/**
 * ¿Este rol puede hacer esto en esta obra? Única función que responde la
 * pregunta, en la API y en la UI.
 *
 * `project` es opcional porque la mayoría de las capacidades no dependen de
 * la obra. Si falta y la capacidad sí dependía de un flag, devuelve `false`:
 * negar por no saber es el default correcto de un permiso.
 */
export function canInProject(
  role: ProjectRole,
  capability: Capability,
  project?: ProjectCapabilityContext,
): boolean {
  if (!PROJECT_CAPABILITIES[role].includes(capability)) return false;

  if (role === 'cliente') {
    const flag = CLIENT_GATED_BY_PROJECT_FLAG[capability];
    if (flag) return project?.[flag] === true;
  }

  return true;
}

/**
 * ¿Es una capacidad de sólo mirar? Son las que quedan cuando la suscripción de
 * la Empresa dueña de la obra venció: se ve todo, no se cambia nada.
 *
 * Va por convención de nombre (`recurso.read`) y no por una lista aparte a
 * propósito: una capacidad nueva de lectura entra sola, y una de escritura
 * nunca se cuela en el modo sólo lectura por olvidarse de sacarla de la lista.
 */
export function isReadCapability(capability: Capability): boolean {
  return capability.endsWith('.read');
}

export interface CapabilityOptions {
  /** La suscripción de la Empresa dueña de la obra venció: sólo lectura. */
  readOnly?: boolean;
}

/** Todo lo que un rol puede hacer en una obra concreta, flags ya aplicados. */
export function capabilitiesInProject(
  role: ProjectRole,
  project?: ProjectCapabilityContext,
  options: CapabilityOptions = {},
): Capability[] {
  return PROJECT_CAPABILITIES[role].filter(
    (capability) =>
      canInProject(role, capability, project) &&
      (!options.readOnly || isReadCapability(capability)),
  );
}
