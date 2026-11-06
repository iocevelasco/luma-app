import { describe, expect, it } from 'vitest';
import {
  PROJECT_CAPABILITIES,
  capabilitiesInProject,
  type Capability,
  type ProjectRole,
} from '../permissions/index.js';
import {
  LIVE_RESOURCES,
  LIVE_RESOURCE_READ_CAPABILITY,
  LIVE_WRITE_EFFECTS,
  canReceiveLiveResource,
  isLiveResource,
  liveResourcesForCapability,
  liveStreamPath,
} from './index.js';

const ROLES = Object.keys(PROJECT_CAPABILITIES) as ProjectRole[];
const ALL_CAPABILITIES = new Set<Capability>(ROLES.flatMap((role) => PROJECT_CAPABILITIES[role]));

describe('tiempo real: cobertura de la grilla', () => {
  it('toda capacidad de escritura de Actividades o Materiales dice qué refresca', () => {
    // Si este test falla, una capacidad nueva de `activity.*` o `material.*`
    // no avisaría a nadie. Agregala a `LIVE_WRITE_EFFECTS` (o decidí que no
    // cambia nada en vivo y sumala con `[]`).
    //
    // Los prefijos salen de la capacidad de lectura de cada recurso en vivo
    // (`activity.read` → `activity.`): sumar un recurso a `LIVE_RESOURCES` hace
    // que este test también le exija sus escrituras, sin tocarlo.
    const prefixes = LIVE_RESOURCES.map(
      (resource) => `${LIVE_RESOURCE_READ_CAPABILITY[resource].split('.')[0]}.`,
    );
    const missing = [...ALL_CAPABILITIES].filter(
      (capability) =>
        prefixes.some((prefix) => capability.startsWith(prefix)) &&
        !capability.endsWith('.read') &&
        !(capability in LIVE_WRITE_EFFECTS),
    );
    expect(missing).toEqual([]);
  });

  it('los prefijos cubren al menos las escrituras que hoy se avisan', () => {
    // Si esto falla, el cálculo de prefijos dejó de ver las capacidades reales.
    const prefixes = LIVE_RESOURCES.map(
      (resource) => `${LIVE_RESOURCE_READ_CAPABILITY[resource].split('.')[0]}.`,
    );
    for (const capability of Object.keys(LIVE_WRITE_EFFECTS)) {
      expect(prefixes.some((prefix) => capability.startsWith(prefix))).toBe(true);
    }
  });

  it('ninguna capacidad de lectura publica nada', () => {
    for (const capability of ALL_CAPABILITIES) {
      if (capability.endsWith('.read')) {
        expect(liveResourcesForCapability(capability)).toEqual([]);
      }
    }
  });

  it('todo efecto apunta a un recurso en vivo y a una capacidad que existe en la grilla', () => {
    for (const [capability, resources] of Object.entries(LIVE_WRITE_EFFECTS)) {
      expect(ALL_CAPABILITIES.has(capability as Capability)).toBe(true);
      for (const resource of resources ?? []) expect(isLiveResource(resource)).toBe(true);
    }
    for (const resource of LIVE_RESOURCES) {
      expect(ALL_CAPABILITIES.has(LIVE_RESOURCE_READ_CAPABILITY[resource])).toBe(true);
    }
  });

  it('borrar una actividad también avisa a Materiales', () => {
    expect(liveResourcesForCapability('activity.plan')).toEqual(['activities', 'materials']);
  });
});

describe('tiempo real: quién se entera de qué', () => {
  const caps = (role: ProjectRole, purchasesVisibleToClient = false) =>
    capabilitiesInProject(role, { providersVisibleToClient: false, purchasesVisibleToClient });

  it('el supervisor recibe Actividades y Materiales', () => {
    const supervisor = caps('supervisor');
    expect(canReceiveLiveResource(supervisor, 'activities')).toBe(true);
    expect(canReceiveLiveResource(supervisor, 'materials')).toBe(true);
  });

  it('el contador no recibe ninguno: no tiene lectura de obra', () => {
    const contador = caps('contador');
    expect(canReceiveLiveResource(contador, 'activities')).toBe(false);
    expect(canReceiveLiveResource(contador, 'materials')).toBe(false);
  });

  it('el cliente recibe Actividades y Materiales sólo si el gerente le abrió las compras', () => {
    expect(canReceiveLiveResource(caps('cliente', false), 'activities')).toBe(true);
    expect(canReceiveLiveResource(caps('cliente', false), 'materials')).toBe(false);
    expect(canReceiveLiveResource(caps('cliente', true), 'materials')).toBe(true);
  });

  it('acepta tanto un arreglo como un Set', () => {
    const supervisor = caps('supervisor');
    expect(canReceiveLiveResource(new Set(supervisor), 'materials')).toBe(true);
  });
});

describe('tiempo real: utilidades', () => {
  it('isLiveResource rechaza lo que no es un recurso', () => {
    expect(isLiveResource('activities')).toBe(true);
    expect(isLiveResource('expenses')).toBe(false);
    expect(isLiveResource(undefined)).toBe(false);
  });

  it('arma la ruta del stream', () => {
    expect(liveStreamPath('abc')).toBe('/api/projects/abc/live');
  });
});
