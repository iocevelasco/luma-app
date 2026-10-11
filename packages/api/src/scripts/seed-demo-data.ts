/**
 * Puebla la organización de un usuario existente con datos de demo: 10 obras,
 * cada una con 10 actividades, 10 materiales, 10 partes de mano de obra y un
 * presupuesto de 10 líneas — para poder navegar todas las vistas del panel
 * con información real.
 *
 * Uso:
 *   SEED_EMAIL=alguien@ejemplo.com pnpm --filter @luma/api exec tsx src/scripts/seed-demo-data.ts
 *
 * Si no se pasa SEED_EMAIL, usa 'iocevelasco@gmail.com'. El usuario debe
 * existir y ser owner de una Organization (se registra normal o vía
 * seed:admin antes de correr este script).
 *
 * Es re-ejecutable: antes de crear, borra cualquier obra propia con el
 * prefijo `SEED_PREFIX` (y todo lo que cuelga de ellas) para no duplicar.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { Activity } from '../models/Activity.js';
import { Budget } from '../models/Budget.js';
import { BudgetLine } from '../models/BudgetLine.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { MaterialItem } from '../models/MaterialItem.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';

const SEED_PREFIX = 'Obra Demo — ';

const roundMoney = (n: number) => Math.round(n * 100) / 100;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pick<T>(arr: T[], n: number, offset = 0): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(offset + i) % arr.length]);
  return out;
}

const FOREMEN = [
  'Jorge Fernández',
  'Miguel Ríos',
  'Carlos Sosa',
  'Diego Herrera',
  'Roberto Paz',
  'Luis Benítez',
  'Martín Acosta',
  'Pablo Ibáñez',
  'Sergio Molina',
  'Hernán Duarte',
];

const WORKERS = [
  'Juan Pérez',
  'Pedro Gómez',
  'Ramón Silva',
  'Oscar Medina',
  'Walter Cabrera',
  'Alberto Rojas',
  'Gustavo Núñez',
  'Franco Torres',
  'Emanuel Flores',
  'Nicolás Vega',
  'Matías Correa',
  'Federico Luna',
  'Damián Rivas',
  'Ezequiel Campos',
  'Agustín Ponce',
  'Maximiliano Ortiz',
  'Cristian Aguirre',
  'Rodrigo Salas',
  'Leandro Funes',
  'Ariel Quiroga',
];

const ACTIVITY_TEMPLATES: Array<{ name: string; area: string }> = [
  { name: 'Movimiento de suelos y excavación', area: 'Terreno' },
  { name: 'Fundaciones y platea', area: 'Subsuelo' },
  { name: 'Estructura de hormigón armado', area: 'Estructura' },
  { name: 'Mampostería de elevación', area: 'Planta baja' },
  { name: 'Instalación eléctrica', area: 'Planta baja' },
  { name: 'Instalación sanitaria y gas', area: 'Baños y cocina' },
  { name: 'Revoque grueso', area: 'Planta alta' },
  { name: 'Revoque fino y cielorrasos', area: 'Interior' },
  { name: 'Colocación de pisos y revestimientos', area: 'Living-comedor' },
  { name: 'Colocación de aberturas', area: 'Fachada' },
  { name: 'Pintura interior y exterior', area: 'General' },
  { name: 'Impermeabilización y terminación de techo', area: 'Techo' },
];

const MATERIAL_TEMPLATES: Array<{
  name: string;
  unit: 'un' | 'm' | 'm2' | 'm3' | 'kg' | 'l' | 'bolsa' | 'rollo' | 'global';
  supplier: string;
}> = [
  { name: 'Cemento Portland', unit: 'bolsa', supplier: 'Corralón San Martín' },
  { name: 'Arena gruesa', unit: 'm3', supplier: 'Distribuidora del Sur' },
  { name: 'Hierro del 8 (12m)', unit: 'un', supplier: 'Materiales Rossi' },
  { name: 'Ladrillo hueco 18x18x33', unit: 'un', supplier: 'Corralón San Martín' },
  { name: 'Cal hidráulica', unit: 'bolsa', supplier: 'Corralón Estrella' },
  { name: 'Cerámico piso 60x60', unit: 'm2', supplier: 'Barugel Azulay' },
  { name: 'Caño PVC 110mm cloacal', unit: 'm', supplier: 'Distribuidora del Sur' },
  { name: 'Cable unipolar 2.5mm', unit: 'rollo', supplier: 'Easy' },
  { name: 'Pintura látex interior', unit: 'l', supplier: 'Pinturería Rex' },
  { name: 'Membrana asfáltica 4mm', unit: 'm2', supplier: 'Materiales Rossi' },
];

const MATERIAL_STATUSES = ['pendiente', 'solicitado', 'comprado', 'en_obra'] as const;

const BUDGET_CHAPTERS: Array<{ chapter: string; name: string; unit: string }> = [
  { chapter: 'Movimiento de suelos', name: 'Excavación y retiro de suelo sobrante', unit: 'm3' },
  { chapter: 'Fundaciones', name: 'Platea de fundación', unit: 'm3' },
  { chapter: 'Estructura', name: 'Estructura de hormigón armado', unit: 'm3' },
  { chapter: 'Mampostería', name: 'Muros de elevación', unit: 'm2' },
  { chapter: 'Instalaciones eléctricas', name: 'Instalación eléctrica completa', unit: 'gl' },
  { chapter: 'Instalaciones sanitarias', name: 'Instalación sanitaria y gas', unit: 'gl' },
  { chapter: 'Revoques', name: 'Revoque grueso y fino', unit: 'm2' },
  { chapter: 'Pisos y revestimientos', name: 'Provisión y colocación de piso', unit: 'm2' },
  { chapter: 'Aberturas', name: 'Aberturas de aluminio', unit: 'un' },
  { chapter: 'Terminaciones', name: 'Pintura interior y exterior', unit: 'm2' },
];

interface ProjectTemplate {
  name: string;
  description: string;
  location: string;
  size: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  currency: string;
  budgetType: 'cerrado' | 'abierto' | 'con_margen';
  status: 'active' | 'archived';
  completedActivities: number;
  unitCostBase: number;
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: 'Edificio Palermo Soho',
    description: 'Edificio de 6 pisos con locales en planta baja y 12 departamentos.',
    location: 'Palermo, CABA',
    size: '1450m²',
    estimatedStartDate: '2026-02-02',
    estimatedEndDate: '2027-01-30',
    currency: 'USD',
    budgetType: 'con_margen',
    status: 'active',
    completedActivities: 4,
    unitCostBase: 180,
  },
  {
    name: 'Casa Quinta Nordelta',
    description: 'Casa de fin de semana con pileta y quincho sobre lote de 800m².',
    location: 'Nordelta, Tigre',
    size: '320m²',
    estimatedStartDate: '2026-04-10',
    estimatedEndDate: '2026-12-15',
    currency: 'USD',
    budgetType: 'cerrado',
    status: 'active',
    completedActivities: 3,
    unitCostBase: 210,
  },
  {
    name: 'Torre Puerto Madero',
    description: 'Torre residencial premium con cocheras subterráneas.',
    location: 'Puerto Madero, CABA',
    size: '3200m²',
    estimatedStartDate: '2025-11-03',
    estimatedEndDate: '2026-08-20',
    currency: 'USD',
    budgetType: 'con_margen',
    status: 'active',
    completedActivities: 6,
    unitCostBase: 260,
  },
  {
    name: 'Complejo Villa Devoto',
    description: 'Complejo de 4 duplex con cochera compartida.',
    location: 'Villa Devoto, CABA',
    size: '680m²',
    estimatedStartDate: '2025-08-01',
    estimatedEndDate: '2026-04-30',
    currency: 'ARS',
    budgetType: 'cerrado',
    status: 'archived',
    completedActivities: 10,
    unitCostBase: 145000,
  },
  {
    name: 'Local Comercial Belgrano',
    description: 'Refacción integral de local comercial en avenida principal.',
    location: 'Belgrano, CABA',
    size: '140m²',
    estimatedStartDate: '2026-01-12',
    estimatedEndDate: '2026-05-10',
    currency: 'ARS',
    budgetType: 'abierto',
    status: 'archived',
    completedActivities: 9,
    unitCostBase: 98000,
  },
  {
    name: 'Ampliación Vivienda Unifamiliar Córdoba',
    description: 'Ampliación de dos dormitorios y baño en suite sobre vivienda existente.',
    location: 'Córdoba Capital',
    size: '85m²',
    estimatedStartDate: '2026-05-18',
    estimatedEndDate: '2026-11-01',
    currency: 'ARS',
    budgetType: 'abierto',
    status: 'active',
    completedActivities: 2,
    unitCostBase: 110000,
  },
  {
    name: 'Galpón Industrial Zárate',
    description: 'Galpón industrial con estructura metálica y oficinas administrativas.',
    location: 'Zárate, Buenos Aires',
    size: '2100m²',
    estimatedStartDate: '2026-03-01',
    estimatedEndDate: '2026-10-30',
    currency: 'USD',
    budgetType: 'cerrado',
    status: 'active',
    completedActivities: 5,
    unitCostBase: 95,
  },
  {
    name: 'Remodelación Oficinas Rosario',
    description: 'Remodelación de dos plantas de oficinas corporativas.',
    location: 'Rosario, Santa Fe',
    size: '520m²',
    estimatedStartDate: '2026-06-01',
    estimatedEndDate: '2026-12-20',
    currency: 'ARS',
    budgetType: 'con_margen',
    status: 'active',
    completedActivities: 1,
    unitCostBase: 130000,
  },
  {
    name: 'Dúplex Recoleta',
    description: 'Reciclado integral de dúplex en edificio de categoría.',
    location: 'Recoleta, CABA',
    size: '210m²',
    estimatedStartDate: '2026-07-15',
    estimatedEndDate: '2027-02-28',
    currency: 'USD',
    budgetType: 'cerrado',
    status: 'active',
    completedActivities: 0,
    unitCostBase: 240,
  },
  {
    name: 'Barrio Cerrado Escobar — Lote 14',
    description: 'Vivienda unifamiliar de dos plantas en barrio cerrado.',
    location: 'Escobar, Buenos Aires',
    size: '410m²',
    estimatedStartDate: '2026-08-01',
    estimatedEndDate: '2027-04-15',
    currency: 'USD',
    budgetType: 'abierto',
    status: 'active',
    completedActivities: 0,
    unitCostBase: 190,
  },
];

async function main() {
  const email = (process.env.SEED_EMAIL ?? 'iocevelasco@gmail.com').trim().toLowerCase();

  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(
      `No existe un usuario con email ${email}. Registralo desde la app (o con pnpm seed:admin) antes de correr este script.`,
    );
  }

  const membership = await OrganizationMember.findOne({ user: user._id, role: 'owner' });
  if (!membership) {
    throw new Error(`El usuario ${email} no es owner de ninguna Organization.`);
  }

  const organizationId = membership.organization;

  // Idempotencia: borrar la corrida anterior de datos de demo (y todo lo que cuelga).
  const previous = await Project.find({
    organization: organizationId,
    name: { $regex: `^${SEED_PREFIX}` },
  }).select('_id');
  const previousIds = previous.map((p) => p._id);
  if (previousIds.length > 0) {
    const budgets = await Budget.find({ project: { $in: previousIds } }).select('_id');
    const budgetIds = budgets.map((b) => b._id);
    await Promise.all([
      BudgetLine.deleteMany({ budget: { $in: budgetIds } }),
      Budget.deleteMany({ project: { $in: previousIds } }),
      LaborRecord.deleteMany({ project: { $in: previousIds } }),
      MaterialItem.deleteMany({ project: { $in: previousIds } }),
      Activity.deleteMany({ project: { $in: previousIds } }),
    ]);
    await Project.deleteMany({ _id: { $in: previousIds } });
    console.log(`🧹 Borrada corrida anterior: ${previousIds.length} obras y sus datos asociados.`);
  }

  let totalActivities = 0;
  let totalMaterials = 0;
  let totalLabor = 0;
  let totalBudgetLines = 0;

  for (let pIdx = 0; pIdx < PROJECT_TEMPLATES.length; pIdx++) {
    const tpl = PROJECT_TEMPLATES[pIdx];

    const project = await Project.create({
      organization: organizationId,
      createdBy: user._id,
      name: `${SEED_PREFIX}${tpl.name}`,
      description: tpl.description,
      location: tpl.location,
      size: tpl.size,
      estimatedStartDate: tpl.estimatedStartDate,
      estimatedEndDate: tpl.estimatedEndDate,
      currency: tpl.currency,
      budgetType: tpl.budgetType,
      status: tpl.status,
    });

    const totalSpanDays = Math.max(
      1,
      Math.round(
        (new Date(`${tpl.estimatedEndDate}T00:00:00Z`).getTime() -
          new Date(`${tpl.estimatedStartDate}T00:00:00Z`).getTime()) /
          86_400_000,
      ),
    );
    const step = Math.max(1, Math.floor(totalSpanDays / ACTIVITY_TEMPLATES.length));

    const activityTemplates = pick(ACTIVITY_TEMPLATES, 10, pIdx);
    const createdActivities: Array<{ id: mongoose.Types.ObjectId; endDate: string }> = [];

    for (let i = 0; i < activityTemplates.length; i++) {
      const at = activityTemplates[i];
      const start = addDays(tpl.estimatedStartDate, i * step);
      const end = addDays(start, step - 1 < 1 ? 3 : step + 2);

      let status: 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
      if (i < tpl.completedActivities) {
        status = 'completada';
      } else if (i === tpl.completedActivities && tpl.status === 'active') {
        status = 'en_curso';
      } else if (tpl.status === 'archived') {
        status = i === activityTemplates.length - 1 ? 'cancelada' : 'completada';
      } else {
        status = 'pendiente';
      }

      const activity = await Activity.create({
        project: project._id,
        name: at.name,
        area: at.area,
        startDate: start,
        endDate: end,
        responsible: { name: FOREMEN[(pIdx + i) % FOREMEN.length] },
        status,
        notes: i % 3 === 0 ? `Seguimiento de "${at.name}" según planificación semanal.` : undefined,
        createdBy: user._id,
      });
      createdActivities.push({
        id: activity._id as mongoose.Types.ObjectId,
        endDate: end,
      });
      totalActivities++;
    }

    for (let i = 0; i < createdActivities.length; i++) {
      const activity = createdActivities[i];
      const expectedCount = 3 + ((pIdx + i) % 6);
      const presentNames = pick(WORKERS, Math.max(1, expectedCount - (i % 2)), pIdx * 3 + i);

      await LaborRecord.create({
        project: project._id,
        activity: activity.id,
        date: activity.endDate,
        expectedCount,
        presentNames,
        createdBy: user._id,
      });
      totalLabor++;
    }

    const materialTemplates = pick(MATERIAL_TEMPLATES, 10, pIdx);
    for (let i = 0; i < materialTemplates.length; i++) {
      const mt = materialTemplates[i];
      const quantity = roundMoney(5 + ((pIdx + 1) * (i + 2) * 1.7));
      const status = MATERIAL_STATUSES[(pIdx + i) % MATERIAL_STATUSES.length];

      await MaterialItem.create({
        project: project._id,
        activity: i % 2 === 0 ? createdActivities[i % createdActivities.length].id : null,
        name: mt.name,
        quantity,
        unit: mt.unit,
        status,
        statusChangedBy: status === 'pendiente' ? undefined : user._id,
        statusChangedAt: status === 'pendiente' ? undefined : new Date(),
        estimatedCost: roundMoney(quantity * (tpl.unitCostBase * 0.15) * (0.8 + (i % 3) * 0.2)),
        supplier: mt.supplier,
        createdBy: user._id,
      });
      totalMaterials++;
    }

    const budgetLines = BUDGET_CHAPTERS.map((bc, i) => {
      const quantity = roundMoney(8 + ((pIdx + 1) * (i + 3) * 1.3));
      const unitCost = roundMoney(tpl.unitCostBase * (0.6 + (i % 5) * 0.15));
      return {
        chapter: bc.chapter,
        order: i + 1,
        name: bc.name,
        unit: bc.unit,
        quantity,
        unitCost,
        total: roundMoney(quantity * unitCost),
      };
    });
    const totalAmount = roundMoney(budgetLines.reduce((sum, l) => sum + l.total, 0));

    const budget = await Budget.create({
      project: project._id,
      version: 1,
      currency: tpl.currency,
      totalAmount,
      contingencyAmount: roundMoney(totalAmount * 0.08),
      importMode: 'manual',
      importedBy: user._id,
      importedAt: new Date(),
    });

    for (const line of budgetLines) {
      await BudgetLine.create({
        budget: budget._id,
        project: project._id,
        ...line,
      });
      totalBudgetLines++;
    }

    console.log(`✅ ${project.name}`);
  }

  console.log('');
  console.log(`Obras: ${PROJECT_TEMPLATES.length}`);
  console.log(`Actividades: ${totalActivities}`);
  console.log(`Materiales: ${totalMaterials}`);
  console.log(`Partes de mano de obra: ${totalLabor}`);
  console.log(`Líneas de presupuesto: ${totalBudgetLines} (en ${PROJECT_TEMPLATES.length} presupuestos)`);
  console.log('');
  console.log(`Listo. Entrá con ${email} para ver las 10 obras en el panel.`);
}

main()
  .catch((err) => {
    console.error('❌', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
