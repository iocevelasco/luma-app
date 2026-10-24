import { describe, expect, it } from 'vitest';
import {
  canInProject,
  capabilitiesInProject,
  isReadCapability,
  PROJECT_CAPABILITIES,
  type Capability,
  type ProjectRole,
} from './index.js';

const VISIBLE = { providersVisibleToClient: true };
const HIDDEN = { providersVisibleToClient: false };

describe('grilla de capacidades por obra', () => {
  it('el gerente puede todo lo que la grilla conoce', () => {
    const everything = new Set<Capability>(
      (Object.keys(PROJECT_CAPABILITIES) as ProjectRole[]).flatMap(
        (role) => PROJECT_CAPABILITIES[role],
      ),
    );

    for (const capability of everything) {
      expect(canInProject('gerente', capability, VISIBLE)).toBe(true);
    }
  });

  describe('supervisor', () => {
    // Las dos lecturas de la matriz que ajustan permisos respecto de la v1.
    // Si alguna de estas se afloja, que sea por una decisión y no por un
    // refactor distraído.
    it('crea tareas y reporta avance, pero no replanifica ni cierra', () => {
      expect(canInProject('supervisor', 'activity.create')).toBe(true);
      expect(canInProject('supervisor', 'activity.report')).toBe(true);
      expect(canInProject('supervisor', 'activity.plan')).toBe(false);
      expect(canInProject('supervisor', 'activity.review')).toBe(false);
    });

    it('no ve plata: ni presupuesto, ni Consultor, ni montos de contratación', () => {
      expect(canInProject('supervisor', 'budget.read')).toBe(false);
      expect(canInProject('supervisor', 'budget.write')).toBe(false);
      expect(canInProject('supervisor', 'advisor.use')).toBe(false);
      expect(canInProject('supervisor', 'engagement.write')).toBe(false);
    });

    it('sí hace lo del sitio: asistencia, materiales, fotos', () => {
      expect(canInProject('supervisor', 'crew.attendance.write')).toBe(true);
      expect(canInProject('supervisor', 'material.write')).toBe(true);
      expect(canInProject('supervisor', 'activity.evidence.write')).toBe(true);
    });

    it('suma personal a su obra pero no administra el roster', () => {
      expect(canInProject('supervisor', 'crew.create')).toBe(true);
      expect(canInProject('supervisor', 'crew.manage')).toBe(false);
    });

    it('asigna proveedores a actividades pero no administra el directorio', () => {
      expect(canInProject('supervisor', 'provider.assign')).toBe(true);
      expect(canInProject('supervisor', 'provider.manage')).toBe(false);
      expect(canInProject('supervisor', 'provider.create')).toBe(true);
      expect(canInProject('supervisor', 'material.invoice.write')).toBe(true);
      expect(canInProject('supervisor', 'expense.read')).toBe(false);
      expect(canInProject('cliente', 'material.invoice.read', VISIBLE)).toBe(false);
      expect(canInProject('contador', 'material.invoice.read')).toBe(false);
      expect(canInProject('cliente', 'provider.create', VISIBLE)).toBe(false);
    });
  });

  describe('cliente', () => {
    it('no escribe nada', () => {
      const writes: Capability[] = [
        'project.update',
        'project.invite',
        'budget.write',
        'payment.write',
        'expense.write',
        'activity.create',
        'activity.plan',
        'activity.report',
        'activity.review',
        'activity.evidence.write',
        'material.write',
        'milestone.report',
        'milestone.publish',
        'crew.create',
        'crew.manage',
        'crew.attendance.write',
        'provider.manage',
        'provider.assign',
        'engagement.write',
      ];

      for (const capability of writes) {
        expect(canInProject('cliente', capability, VISIBLE)).toBe(false);
      }
    });

    it('no ve presupuesto ni Consultor aunque la obra sea suya', () => {
      expect(canInProject('cliente', 'budget.read', VISIBLE)).toBe(false);
      expect(canInProject('cliente', 'advisor.use', VISIBLE)).toBe(false);
    });

    it('ve proveedores sólo si la obra lo habilitó', () => {
      expect(canInProject('cliente', 'provider.read', VISIBLE)).toBe(true);
      expect(canInProject('cliente', 'provider.read', HIDDEN)).toBe(false);
    });

    it('sin contexto de obra, una capacidad con flag se niega', () => {
      // Negar por no saber: el default correcto de un permiso.
      expect(canInProject('cliente', 'provider.read')).toBe(false);
    });

    it('el flag no le abre nada más que proveedores', () => {
      expect(capabilitiesInProject('cliente', VISIBLE)).toEqual([
        'project.read',
        'activity.read',
        'payment.read',
        'milestone.read',
        'document.read',
        'provider.read',
      ]);
      expect(capabilitiesInProject('cliente', HIDDEN)).toEqual([
        'project.read',
        'activity.read',
        'payment.read',
        'milestone.read',
        'document.read',
      ]);
    });
  });

  it('el flag de proveedores no afecta a gerente ni supervisor', () => {
    expect(canInProject('gerente', 'provider.read', HIDDEN)).toBe(true);
    expect(canInProject('supervisor', 'provider.read', HIDDEN)).toBe(true);
  });

  it('toda capacidad declarada la tiene al menos el gerente', () => {
    for (const role of Object.keys(PROJECT_CAPABILITIES) as ProjectRole[]) {
      for (const capability of PROJECT_CAPABILITIES[role]) {
        expect(PROJECT_CAPABILITIES.gerente).toContain(capability);
      }
    }
  });
});

describe('documentación de obra', () => {
  it('la lee el gerente, el supervisor y el cliente', () => {
    // Es la columna derecha de la matriz: los tres "acceden a documentación
    // registrada para la obra".
    for (const role of ['gerente', 'supervisor', 'cliente'] as const) {
      expect(canInProject(role, 'document.read', VISIBLE)).toBe(true);
    }
  });

  it('la carga sólo el gerente', () => {
    expect(canInProject('gerente', 'document.write')).toBe(true);
    expect(canInProject('supervisor', 'document.write')).toBe(false);
    expect(canInProject('cliente', 'document.write', VISIBLE)).toBe(false);
  });

  it('el cliente la ve sin depender de ningún flag de la obra', () => {
    // A diferencia de proveedores: la matriz se la abre siempre.
    expect(canInProject('cliente', 'document.read', HIDDEN)).toBe(true);
  });
});

describe('hitos y eventualidades', () => {
  it('los tres roles los leen', () => {
    for (const role of ['gerente', 'supervisor', 'cliente'] as const) {
      expect(canInProject(role, 'milestone.read', VISIBLE)).toBe(true);
    }
  });

  it('el supervisor reporta pero no publica hacia el cliente', () => {
    // Su fila dice "notificar eventualidades SOLAMENTE al gerente". Publicar
    // hacia afuera es una decisión del gerente, siempre.
    expect(canInProject('supervisor', 'milestone.report')).toBe(true);
    expect(canInProject('supervisor', 'milestone.publish')).toBe(false);
  });

  it('el gerente hace las dos cosas', () => {
    expect(canInProject('gerente', 'milestone.report')).toBe(true);
    expect(canInProject('gerente', 'milestone.publish')).toBe(true);
  });

  it('el cliente no reporta nada', () => {
    expect(canInProject('cliente', 'milestone.report', VISIBLE)).toBe(false);
    expect(canInProject('cliente', 'milestone.publish', VISIBLE)).toBe(false);
  });
});

describe('cobros y gastos', () => {
  it('el cliente ve el cronograma de cobros', () => {
    expect(canInProject('cliente', 'payment.read', VISIBLE)).toBe(true);
  });

  it('el cliente NUNCA ve gastos', () => {
    // Con cobros y gastos se despeja el margen del ejecutante restando.
    expect(canInProject('cliente', 'expense.read', VISIBLE)).toBe(false);
    expect(canInProject('cliente', 'expense.read', HIDDEN)).toBe(false);
  });

  it('el cliente no registra ni un cobro ni un gasto', () => {
    expect(canInProject('cliente', 'payment.write', VISIBLE)).toBe(false);
    expect(canInProject('cliente', 'expense.write', VISIBLE)).toBe(false);
  });

  it('el supervisor no ve ninguna de las dos', () => {
    for (const capability of ['payment.read', 'payment.write', 'expense.read', 'expense.write'] as const) {
      expect(canInProject('supervisor', capability)).toBe(false);
    }
  });

  it('el gerente hace todo', () => {
    for (const capability of ['payment.read', 'payment.write', 'expense.read', 'expense.write'] as const) {
      expect(canInProject('gerente', capability)).toBe(true);
    }
  });
});

describe('contador', () => {
  it('lleva cobros y gastos', () => {
    for (const capability of [
      'payment.read',
      'payment.write',
      'expense.read',
      'expense.write',
    ] as const) {
      expect(canInProject('contador', capability)).toBe(true);
    }
  });

  it('no toca nada de obra', () => {
    // Su trabajo es conciliar plata. Darle el resto "por las dudas" lo
    // convierte en un segundo gerente.
    for (const capability of [
      'activity.read',
      'activity.plan',
      'crew.read',
      'provider.read',
      'document.read',
      'milestone.read',
      'project.update',
      'project.invite',
    ] as const) {
      expect(canInProject('contador', capability, VISIBLE)).toBe(false);
    }
  });

  it('no ve el presupuesto ni el Consultor', () => {
    expect(canInProject('contador', 'budget.read')).toBe(false);
    expect(canInProject('contador', 'advisor.use')).toBe(false);
  });

  it('su grilla entera son cinco capacidades', () => {
    expect(capabilitiesInProject('contador', VISIBLE)).toEqual([
      'project.read',
      'payment.read',
      'payment.write',
      'expense.read',
      'expense.write',
    ]);
  });
});

describe('modo sólo lectura (suscripción vencida)', () => {
  it('deja sólo las capacidades .read, para cualquier rol', () => {
    for (const role of ['gerente', 'supervisor', 'contador', 'cliente'] as const) {
      const caps = capabilitiesInProject(role, { providersVisibleToClient: true }, { readOnly: true });
      expect(caps.length).toBeGreaterThan(0);
      expect(caps.every(isReadCapability)).toBe(true);
    }
  });

  it('el gerente sigue viendo todo lo que veía, pero no puede escribir nada', () => {
    const caps = capabilitiesInProject('gerente', undefined, { readOnly: true });
    expect(caps).toContain('budget.read');
    expect(caps).toContain('expense.read');
    expect(caps).not.toContain('activity.plan');
    expect(caps).not.toContain('advisor.use');
  });

  it('sin readOnly no cambia nada', () => {
    expect(capabilitiesInProject('gerente', undefined, {})).toEqual(capabilitiesInProject('gerente'));
  });
});

describe('project.delete', () => {
  it('es sólo del gerente: ningún otro rol puede mandar la obra a la papelera', () => {
    expect(canInProject('gerente', 'project.delete')).toBe(true);
    for (const role of ['supervisor', 'contador', 'cliente'] as const) {
      expect(canInProject(role, 'project.delete', VISIBLE)).toBe(false);
    }
  });

  it('con la suscripción vencida tampoco se elimina: es una escritura', () => {
    expect(capabilitiesInProject('gerente', VISIBLE, { readOnly: true })).not.toContain(
      'project.delete',
    );
  });
});
describe('compras visibles para el cliente', () => {
  const OPEN = { providersVisibleToClient: false, purchasesVisibleToClient: true };
  const purchases: Capability[] = ['material.read', 'material.cost.read', 'material.invoice.read'];

  it('cerradas por defecto: sin el flag el cliente no ve compras', () => {
    for (const capability of purchases) {
      expect(canInProject('cliente', capability)).toBe(false);
      expect(canInProject('cliente', capability, VISIBLE)).toBe(false);
      expect(canInProject('cliente', capability, HIDDEN)).toBe(false);
    }
  });

  it('con el flag ve compras, costos y facturas, pero no las modifica', () => {
    for (const capability of purchases) {
      expect(canInProject('cliente', capability, OPEN)).toBe(true);
    }
    expect(canInProject('cliente', 'material.write', OPEN)).toBe(false);
    expect(canInProject('cliente', 'material.invoice.write', OPEN)).toBe(false);
  });

  it('abrir compras no le da Finanzas: gastos y presupuesto siguen cerrados', () => {
    expect(canInProject('cliente', 'expense.read', OPEN)).toBe(false);
    expect(canInProject('cliente', 'budget.read', OPEN)).toBe(false);
  });

  it('el flag no cambia lo de los demás roles', () => {
    expect(canInProject('supervisor', 'material.cost.read')).toBe(true);
    expect(canInProject('contador', 'material.read', OPEN)).toBe(false);
  });
});

describe('project.update — el flag que abre Compras', () => {
  it('es sólo del gerente, aunque la obra tenga todos los flags abiertos', () => {
    const OPEN_ALL = { providersVisibleToClient: true, purchasesVisibleToClient: true };
    expect(canInProject('gerente', 'project.update', OPEN_ALL)).toBe(true);
    for (const role of ['supervisor', 'contador', 'cliente'] as const) {
      expect(canInProject(role, 'project.update', OPEN_ALL)).toBe(false);
    }
  });
});
