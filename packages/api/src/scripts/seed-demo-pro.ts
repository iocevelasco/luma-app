/**
 * Llena la cuenta de demostración `demo-pro@luma.test` con todo lo que la app
 * puede mostrar: obras en distintas etapas con sus actividades, materiales,
 * inventario, Depósito, presupuesto, cobros, gastos, hitos, documentos,
 * proveedores, personal, notificaciones y un equipo con un usuario por rol.
 *
 *   SEED_CONFIRM_DB=<nombre de la base> pnpm seed:demo-pro
 *
 * Si `demo-pro@luma.test` no existe la crea (Empresa, plan Pro pagado con 1 obra
 * extra y 4 obras vacías); si existe, llena sus obras y no crea ninguna: paga
 * el plan con 1 obra extra, así que **no se crean obras nuevas** y la
 * facturación sigue cuadrando. Cada obra queda en una etapa distinta (casi
 * terminada, a mitad, recién empezada, por empezar).
 *
 * Re-ejecutable: borra todo lo que cuelga de esas obras (la misma lista que
 * usa la purga, `PROJECT_OWNED`) y lo que esta cuenta tiene en la Empresa, y lo
 * vuelve a crear con fechas relativas a hoy.
 *
 * Usuarios de obra, todos con la contraseña `Demo12345!`:
 *   demo-pro-cogerente@luma.test    gerente (otro gerente, no el dueño)
 *   demo-pro-supervisor@luma.test   supervisor
 *   demo-pro-arquitecto@luma.test   arquitecto
 *   demo-pro-contador@luma.test     contador
 *   demo-pro-cliente@luma.test      cliente
 *
 * Los archivos (documentos, facturas) llevan una `key` de relleno: no hay nada
 * detrás. Alcanza para ver listados, tarjetas y filtros; abrir el archivo no
 * funciona. Por eso tampoco hay fotos de evidencia ni de materiales.
 *
 * Sólo contra una base local o un entorno demo alojado: crea cuentas con una
 * contraseña conocida. En el contenedor de un entorno demo corre compilado:
 *   SEED_CONFIRM_DB=luma_demo SEED_ALLOW_REMOTE_DB=luma_demo \
 *     node dist/scripts/seed-demo-pro.js
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  LEGAL_VERSION,
  PLAN,
  addMonths,
  stockItemKey,
  usdToBolivares,
  type CompanyStaffRole,
  type DocumentCategory,
  type ExpenseCategory,
  type InvitableProjectRole,
  type MaterialStatus,
  type MaterialUnit,
  type MilestoneAudience,
  type MilestoneSeverity,
  type MilestoneType,
  type PaymentMethod,
  type ProviderRequirementType,
} from '@luma/shared';
import { DATABASE_CONFIG, SERVER_CONFIG } from '../config/app.config.js';
import { Activity, type IActivity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { ActivityProvider } from '../models/ActivityProvider.js';
import { Budget } from '../models/Budget.js';
import { BudgetLine } from '../models/BudgetLine.js';
import { CrewMember } from '../models/CrewMember.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { Expense } from '../models/Expense.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { MaterialItem } from '../models/MaterialItem.js';
import { Milestone } from '../models/Milestone.js';
import { Notification } from '../models/Notification.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Payment } from '../models/Payment.js';
import { PaymentScheduleItem } from '../models/PaymentScheduleItem.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { ProjectDocument } from '../models/ProjectDocument.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { ProjectProvider } from '../models/ProjectProvider.js';
import { Provider } from '../models/Provider.js';
import { ProviderEngagement } from '../models/ProviderEngagement.js';
import { StockMovement } from '../models/StockMovement.js';
import { Subscription } from '../models/Subscription.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User, type IUser } from '../models/User.js';
import { caracasDayKey, currentRate } from '../services/bcv.service.js';
import { createPersonalOrganization } from '../services/organization.service.js';
import { addCustomSpecialty } from '../services/custom-specialty.service.js';
import { importFromDeposit, sendToDeposit } from '../services/deposit.service.js';
import { recordPurchaseEntries } from '../services/inventory.service.js';
import { PROJECT_OWNED } from '../services/project-deletion.service.js';

const OWNER_EMAIL = 'demo-pro@luma.test';
const PASSWORD = 'Demo12345!';
/** Marca en `notes` de lo que se crea en la Empresa, para poder borrarlo después. */
const TAG = 'SEED_DEMO_PRO';
const DAY = 24 * 60 * 60 * 1000;
/** Bolívares por dólar de la demo: el cobro en Bs congela `1 / VES_PER_USD`. */
const VES_PER_USD = 880;
const VES_RATE = Math.round((1 / VES_PER_USD) * 1_000_000) / 1_000_000;

type Id = mongoose.Types.ObjectId;
const idOf = (doc: { _id: unknown }) => doc._id as Id;

/** `YYYY-MM-DD` de hoy más `offset` días. */
function dayKey(offset: number): string {
  return new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

// ── Equipo ──────────────────────────────────────────────────────────────────

const TEAM: Array<{
  email: string;
  name: string;
  role: InvitableProjectRole;
  staffRole?: CompanyStaffRole;
  phone?: string;
}> = [
  { email: 'demo-pro-cogerente@luma.test', name: 'Carla Mendoza', role: 'gerente', staffRole: 'gerente', phone: '+58 412 555 0101' },
  { email: 'demo-pro-supervisor@luma.test', name: 'Tomás Rivas', role: 'supervisor', staffRole: 'supervisor', phone: '+58 414 555 0102' },
  { email: 'demo-pro-arquitecto@luma.test', name: 'Andrea Salazar', role: 'arquitecto' },
  { email: 'demo-pro-contador@luma.test', name: 'Paula Quintero', role: 'contador', staffRole: 'contador', phone: '+58 424 555 0104' },
  { email: 'demo-pro-cliente@luma.test', name: 'Luis Ferrer', role: 'cliente' },
];

// ── Proveedores y personal de la Empresa ────────────────────────────────────

const PROVIDERS = [
  { name: 'Hernán Giménez', companyName: 'Giménez Electricidad', specialty: 'electricidad', phone: '+58 412 555 0201' },
  { name: 'Marta Ledesma', companyName: 'Sanitarios Ledesma', specialty: 'plomeria', phone: '+58 414 555 0202' },
  { name: 'Roberto Aguirre', companyName: 'Aguirre Estructuras', specialty: 'estructura', phone: '+58 416 555 0203' },
  { name: 'Lucía Pereyra', companyName: 'Pinturas Pereyra', specialty: 'pintura', phone: '+58 424 555 0204' },
  { name: 'Carlos Duarte', companyName: 'Carpintería Duarte', specialty: 'carpinteria', phone: '+58 412 555 0205' },
  { name: 'Ana Sosa', companyName: 'Drywall Caracas', specialty: 'drywall', phone: '+58 414 555 0206' },
  { name: 'Pedro Marín', companyName: 'Cerámicas Marín', specialty: 'pisos_revestimientos', phone: '+58 416 555 0207' },
  { name: 'Elena Brito', companyName: 'Acabados Brito', specialty: 'acabados', phone: '+58 424 555 0208' },
] as const;

const CREW = [
  { name: 'Jesús Marcano', specialty: 'albanileria', isLead: true, dailyRate: 40, phone: '+58 412 555 0301' },
  { name: 'Yorman Pérez', specialty: 'albanileria', isLead: false, dailyRate: 28, phone: '+58 414 555 0302' },
  { name: 'Endry Rojas', specialty: 'electricidad', isLead: true, dailyRate: 42, phone: '+58 416 555 0303' },
  { name: 'Luis Colmenares', specialty: 'plomeria', isLead: false, dailyRate: 34, phone: '+58 424 555 0304' },
  { name: 'Carlos Brito', specialty: 'pintura', isLead: false, dailyRate: 26, phone: '+58 412 555 0305' },
  { name: 'Wilmer Torres', specialty: 'drywall', isLead: true, dailyRate: 36, phone: '+58 414 555 0306' },
  { name: 'Hormigonera 350L', kind: 'equipo', specialty: 'estructura', isLead: false, dailyRate: 15 },
  { name: 'Andamio tubular', kind: 'equipo', specialty: 'albanileria', isLead: false, dailyRate: 8 },
] as const;

// ── Plantillas compartidas ──────────────────────────────────────────────────

const MATERIALS: Array<{
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitCostUsd: number;
  specialty: string;
}> = [
  { name: 'Cemento gris 42,5 kg', unit: 'bolsa', quantity: 24, unitCostUsd: 9, specialty: 'albanileria' },
  { name: 'Arena lavada', unit: 'm3', quantity: 4, unitCostUsd: 30, specialty: 'albanileria' },
  { name: 'Cabilla 3/8"', unit: 'un', quantity: 40, unitCostUsd: 8, specialty: 'estructura' },
  { name: 'Porcelanato 60x60', unit: 'm2', quantity: 22, unitCostUsd: 18, specialty: 'pisos_revestimientos' },
  { name: 'Pegamento para porcelanato', unit: 'bolsa', quantity: 8, unitCostUsd: 7, specialty: 'pisos_revestimientos' },
  { name: 'Tubo PVC 2"', unit: 'm', quantity: 30, unitCostUsd: 4, specialty: 'plomeria' },
  { name: 'Grifería monocomando', unit: 'un', quantity: 2, unitCostUsd: 65, specialty: 'plomeria' },
  { name: 'Cable THW 12', unit: 'rollo', quantity: 3, unitCostUsd: 85, specialty: 'electricidad' },
  { name: 'Tomacorriente doble', unit: 'un', quantity: 14, unitCostUsd: 3, specialty: 'electricidad' },
  { name: 'Plancha de drywall 1/2"', unit: 'un', quantity: 26, unitCostUsd: 14, specialty: 'drywall' },
  { name: 'Perfil metálico (riel y parante)', unit: 'un', quantity: 40, unitCostUsd: 4.5, specialty: 'drywall' },
  { name: 'Pintura caucho clase A', unit: 'l', quantity: 36, unitCostUsd: 7, specialty: 'pintura' },
  { name: 'Masilla para pared', unit: 'kg', quantity: 25, unitCostUsd: 1.2, specialty: 'pintura' },
  { name: 'MDF 18 mm', unit: 'un', quantity: 6, unitCostUsd: 48, specialty: 'carpinteria' },
  { name: 'Impermeabilizante acrílico', unit: 'l', quantity: 18, unitCostUsd: 6, specialty: 'acabados' },
];

const BUDGET_CHAPTERS: Array<{ chapter: string; name: string; unit: string; weight: number }> = [
  { chapter: 'Demolición', name: 'Demolición y retiro de escombros', unit: 'gl', weight: 0.07 },
  { chapter: 'Albañilería', name: 'Obra gris y reparaciones', unit: 'm2', weight: 0.16 },
  { chapter: 'Instalaciones eléctricas', name: 'Instalación eléctrica completa', unit: 'gl', weight: 0.12 },
  { chapter: 'Instalaciones sanitarias', name: 'Tuberías, desagües y piezas', unit: 'gl', weight: 0.13 },
  { chapter: 'Drywall y cielos', name: 'Tabiquería y cielo raso en drywall', unit: 'm2', weight: 0.12 },
  { chapter: 'Pisos y revestimientos', name: 'Provisión y colocación de porcelanato', unit: 'm2', weight: 0.17 },
  { chapter: 'Carpintería', name: 'Gabinetes, puertas y mesones', unit: 'un', weight: 0.11 },
  { chapter: 'Pintura y acabados', name: 'Pintura, impermeabilización y detalles', unit: 'm2', weight: 0.12 },
];

const DOCUMENT_TITLES: Array<{ category: DocumentCategory; title: string; space?: string }> = [
  { category: 'render', title: 'Render principal', space: 'Vista general' },
  { category: 'render', title: 'Render de acabados', space: 'Interior' },
  { category: 'plano', title: 'Plano de arquitectura', space: 'Planta' },
  { category: 'plano', title: 'Plano de instalaciones', space: 'Planta' },
  { category: 'permiso_municipal', title: 'Permiso de construcción municipal' },
  { category: 'permiso_edificio', title: 'Autorización de la junta de condominio' },
  { category: 'condiciones_sitio', title: 'Condiciones del sitio y accesos' },
  { category: 'horario_trabajo', title: 'Horario de trabajo permitido' },
  { category: 'otra', title: 'Acta de entrega de llaves' },
];

// ── Las 4 obras ─────────────────────────────────────────────────────────────

type ActivityStatus = 'pendiente' | 'en_curso' | 'en_revision' | 'completada' | 'cancelada';

interface ActivitySpec {
  name: string;
  specialty: string;
  /** Días desde hoy en que arranca. */
  start: number;
  days: number;
  status: ActivityStatus;
  responsible: string;
  notes?: string;
  /** La revisión la rechazó: vuelve a estar en curso con el motivo. */
  rejected?: string;
}

interface ObraSpec {
  description: string;
  location: string;
  size: string;
  startOffset: number;
  endOffset: number;
  /** Lo que el cliente ve de la obra. */
  visibility: Pick<
    IProject,
    'providersVisibleToClient' | 'purchasesVisibleToClient' | 'expensesVisibleToClient' | 'paymentsVisibleToClient'
  >;
  /** Presupuesto en USD. El contrato con el cliente es un 25% más. */
  budgetUsd: number;
  /** Qué parte del presupuesto ya se gastó (sin contar la factura de compras). */
  spentShare: number;
  activities: ActivitySpec[];
  /** Cuántas cuotas ya se cobraron y por qué medio. */
  payments: Array<{ installment: number; method: PaymentMethod; share: number; currency: 'USD' | 'VES' }>;
  milestones: Array<{
    type: MilestoneType;
    audience: MilestoneAudience;
    severity: MilestoneSeverity;
    title: string;
    description: string;
    offset: number;
    attendees?: string[];
  }>;
  engagements: Array<{
    provider: number;
    status: 'solicitada' | 'cotizada' | 'aprobada' | 'rechazada';
    quoted?: number;
    advance?: number;
    requirements?: Array<{ type: ProviderRequirementType; detail: string; met: boolean }>;
  }>;
}

const OBRAS: ObraSpec[] = [
  // 0 — Casi terminada.
  {
    description: 'Reforma completa del baño principal: nueva distribución sanitaria, porcelanato y cielo raso en drywall.',
    location: 'Los Palos Grandes, Caracas',
    size: '9 m²',
    startOffset: -60,
    endOffset: 10,
    visibility: { providersVisibleToClient: true, purchasesVisibleToClient: true, expensesVisibleToClient: true, paymentsVisibleToClient: true },
    budgetUsd: 9_000,
    spentShare: 0.3,
    activities: [
      { name: 'Demolición y retiro de escombros', specialty: 'otra', start: -58, days: 4, status: 'completada', responsible: 'Jesús Marcano' },
      { name: 'Reubicación de puntos sanitarios', specialty: 'plomeria', start: -52, days: 6, status: 'completada', responsible: 'Luis Colmenares' },
      { name: 'Instalación eléctrica del baño', specialty: 'electricidad', start: -46, days: 4, status: 'completada', responsible: 'Endry Rojas' },
      { name: 'Impermeabilización de piso y paredes', specialty: 'acabados', start: -41, days: 3, status: 'completada', responsible: 'Jesús Marcano' },
      { name: 'Colocación de porcelanato', specialty: 'pisos_revestimientos', start: -36, days: 8, status: 'completada', responsible: 'Jesús Marcano', notes: 'Corte en 45° en la esquina de la ducha.' },
      { name: 'Cielo raso en drywall', specialty: 'drywall', start: -20, days: 4, status: 'en_revision', responsible: 'Wilmer Torres' },
      { name: 'Colocación de sanitarios y grifería', specialty: 'plomeria', start: -6, days: 4, status: 'en_curso', responsible: 'Luis Colmenares' },
      { name: 'Pintura y detalles finales', specialty: 'pintura', start: 2, days: 4, status: 'pendiente', responsible: 'Carlos Brito' },
      { name: 'Ducha de vidrio templado', specialty: 'carpinteria', start: -30, days: 3, status: 'cancelada', responsible: 'Carlos Duarte', notes: 'El cliente prefirió cortina.' },
    ],
    payments: [
      { installment: 0, method: 'zelle', share: 1, currency: 'USD' },
      { installment: 1, method: 'pago_movil', share: 1, currency: 'VES' },
    ],
    milestones: [
      { type: 'etapa_concluida', audience: 'cliente', severity: 'info', title: 'Obra gris terminada', description: 'Demolición, sanitarios y electricidad listos para recibir revestimiento.', offset: -40 },
      { type: 'vicio_oculto', audience: 'cliente', severity: 'critico', title: 'Filtración en la pared medianera', description: 'Al demoler apareció humedad antigua. Se trató antes de impermeabilizar.', offset: -55 },
      { type: 'cambio_proyecto', audience: 'cliente', severity: 'atencion', title: 'Se elimina la ducha de vidrio', description: 'El cliente pasa a cortina; baja el presupuesto de carpintería.', offset: -32 },
      { type: 'decision_made', audience: 'interno', severity: 'info', title: 'Porcelanato de segunda línea', description: 'Se compra el lote completo para evitar diferencias de tono.', offset: -45 },
      { type: 'otro', audience: 'interno', severity: 'info', title: 'Acceso de camiones por la calle lateral', description: 'La junta autoriza descargar de 8 a 10 a. m.', offset: -50 },
    ],
    engagements: [
      { provider: 1, status: 'aprobada', quoted: 1_800, advance: 500 },
      { provider: 5, status: 'aprobada', quoted: 950, advance: 250 },
    ],
  },
  // 1 — A mitad de camino.
  {
    description: 'Cocina nueva con isla, gabinetes a medida y revestimiento hasta el techo. Incluye adecuación eléctrica y de gas.',
    location: 'Altamira, Caracas',
    size: '18 m²',
    startOffset: -35,
    endOffset: 40,
    visibility: { providersVisibleToClient: false, purchasesVisibleToClient: true, expensesVisibleToClient: false, paymentsVisibleToClient: true },
    budgetUsd: 15_000,
    spentShare: 0.3,
    activities: [
      { name: 'Desmontaje de la cocina existente', specialty: 'otra', start: -34, days: 3, status: 'completada', responsible: 'Yorman Pérez' },
      { name: 'Tabiquería y cielo raso en drywall', specialty: 'drywall', start: -30, days: 6, status: 'completada', responsible: 'Wilmer Torres' },
      { name: 'Instalación eléctrica y tomacorrientes', specialty: 'electricidad', start: -24, days: 6, status: 'completada', responsible: 'Endry Rojas' },
      { name: 'Tuberías de agua y gas', specialty: 'plomeria', start: -16, days: 6, status: 'en_curso', responsible: 'Luis Colmenares', rejected: 'Falta la prueba de presión del tramo de gas.' },
      { name: 'Revestimiento de pared', specialty: 'pisos_revestimientos', start: -8, days: 8, status: 'en_curso', responsible: 'Jesús Marcano' },
      { name: 'Detalle de yesería en la cornisa', specialty: 'custom_yeseria', start: 4, days: 3, status: 'pendiente', responsible: 'Wilmer Torres' },
      { name: 'Gabinetes y mesón', specialty: 'carpinteria', start: 6, days: 10, status: 'pendiente', responsible: 'Carlos Duarte' },
      { name: 'Pintura', specialty: 'pintura', start: 20, days: 5, status: 'pendiente', responsible: 'Carlos Brito' },
      { name: 'Instalación de electrodomésticos', specialty: 'otra', start: 30, days: 2, status: 'pendiente', responsible: 'Yorman Pérez' },
    ],
    payments: [
      { installment: 0, method: 'transferencia_usd', share: 1, currency: 'USD' },
      { installment: 1, method: 'tarjeta_debito', share: 0.5, currency: 'USD' },
    ],
    milestones: [
      { type: 'compra_significativa', audience: 'interno', severity: 'info', title: 'Pedido de gabinetes a la carpintería', description: 'Anticipo del 40%. Entrega estimada en 5 semanas.', offset: -10 },
      { type: 'retraso', audience: 'cliente', severity: 'atencion', title: 'Demora en el tramo de gas', description: 'La inspección de la empresa de gas se reprogramó una semana.', offset: -4 },
      { type: 'reunion', audience: 'cliente', severity: 'info', title: 'Reunión de definición de acabados', description: 'Se eligió el color del mesón y la grifería.', offset: -20, attendees: ['Luis Ferrer', 'Andrea Salazar', 'Carla Mendoza'] },
      { type: 'process_started', audience: 'cliente', severity: 'info', title: 'Arranca el revestimiento', description: 'Se empieza por la pared de la isla.', offset: -8 },
    ],
    engagements: [
      { provider: 4, status: 'aprobada', quoted: 3_200, advance: 1_200, requirements: [
        { type: 'area_desocupada', detail: 'Cocina vacía antes de tomar medidas', met: true },
        { type: 'materiales_en_obra', detail: 'MDF y herrajes en obra', met: false },
      ] },
      { provider: 3, status: 'cotizada', quoted: 780 },
    ],
  },
  // 2 — Recién empezada.
  {
    description: 'Acondicionamiento de local comercial: entrepiso metálico, divisiones, instalaciones y fachada con aviso.',
    location: 'Chacao, Caracas',
    size: '95 m²',
    startOffset: -14,
    endOffset: 75,
    visibility: { providersVisibleToClient: false, purchasesVisibleToClient: false, expensesVisibleToClient: false, paymentsVisibleToClient: false },
    budgetUsd: 28_000,
    spentShare: 0.12,
    activities: [
      { name: 'Levantamiento y trámite de permisos', specialty: 'otra', start: -14, days: 5, status: 'completada', responsible: 'Tomás Rivas' },
      { name: 'Demolición de tabiques', specialty: 'albanileria', start: -9, days: 4, status: 'completada', responsible: 'Jesús Marcano' },
      { name: 'Entrepiso metálico', specialty: 'estructura', start: -4, days: 12, status: 'en_curso', responsible: 'Roberto Aguirre' },
      { name: 'Divisiones en drywall', specialty: 'drywall', start: 0, days: 10, status: 'en_curso', responsible: 'Wilmer Torres' },
      { name: 'Instalación eléctrica y datos', specialty: 'electricidad', start: 10, days: 10, status: 'pendiente', responsible: 'Endry Rojas' },
      { name: 'Aire acondicionado', specialty: 'otra', start: 22, days: 5, status: 'pendiente', responsible: 'Tomás Rivas' },
      { name: 'Piso de porcelanato', specialty: 'pisos_revestimientos', start: 28, days: 12, status: 'pendiente', responsible: 'Jesús Marcano' },
      { name: 'Pintura', specialty: 'pintura', start: 42, days: 8, status: 'pendiente', responsible: 'Carlos Brito' },
      { name: 'Fachada y aviso luminoso', specialty: 'acabados', start: 52, days: 10, status: 'pendiente', responsible: 'Elena Brito' },
    ],
    payments: [
      { installment: 0, method: 'tarjeta_credito', share: 1, currency: 'USD' },
    ],
    milestones: [
      { type: 'permisologia', audience: 'cliente', severity: 'atencion', title: 'Permiso municipal en trámite', description: 'La alcaldía pidió un plano de estructura firmado por ingeniero.', offset: -12 },
      { type: 'process_started', audience: 'cliente', severity: 'info', title: 'Arranca la estructura del entrepiso', description: 'Llegan los perfiles el lunes.', offset: -4 },
      { type: 'reunion', audience: 'interno', severity: 'info', title: 'Coordinación con el proveedor de aire', description: 'Se define el recorrido de ductos antes del drywall.', offset: -2, attendees: ['Tomás Rivas', 'Carla Mendoza'] },
    ],
    engagements: [
      { provider: 2, status: 'aprobada', quoted: 7_400, advance: 2_200, requirements: [
        { type: 'personal_libre', detail: 'Cuadrilla de 4 soldadores', met: true },
        { type: 'actividad_previa', detail: 'Demolición terminada', met: true },
      ] },
      { provider: 0, status: 'solicitada', requirements: [{ type: 'actividad_previa', detail: 'Divisiones levantadas', met: false }] },
      { provider: 7, status: 'rechazada', quoted: 5_900 },
    ],
  },
  // 3 — Por empezar.
  {
    description: 'Remodelación de dos plantas de oficinas: tabiquería, piso técnico, iluminación y baños.',
    location: 'El Rosal, Caracas',
    size: '210 m²',
    startOffset: 5,
    endOffset: 110,
    visibility: { providersVisibleToClient: true, purchasesVisibleToClient: false, expensesVisibleToClient: false, paymentsVisibleToClient: true },
    budgetUsd: 45_000,
    spentShare: 0,
    activities: [
      { name: 'Visita técnica y presupuesto', specialty: 'otra', start: -12, days: 4, status: 'completada', responsible: 'Tomás Rivas' },
      { name: 'Levantamiento de medidas', specialty: 'otra', start: 5, days: 3, status: 'pendiente', responsible: 'Andrea Salazar' },
      { name: 'Demolición de acabados', specialty: 'albanileria', start: 9, days: 8, status: 'pendiente', responsible: 'Jesús Marcano' },
      { name: 'Tabiquería de oficinas', specialty: 'drywall', start: 18, days: 14, status: 'pendiente', responsible: 'Wilmer Torres' },
      { name: 'Instalación eléctrica', specialty: 'electricidad', start: 30, days: 14, status: 'pendiente', responsible: 'Endry Rojas' },
      { name: 'Baños', specialty: 'plomeria', start: 34, days: 16, status: 'pendiente', responsible: 'Luis Colmenares' },
      { name: 'Piso técnico y porcelanato', specialty: 'pisos_revestimientos', start: 52, days: 16, status: 'pendiente', responsible: 'Jesús Marcano' },
      { name: 'Pintura y acabados', specialty: 'pintura', start: 74, days: 12, status: 'pendiente', responsible: 'Carlos Brito' },
    ],
    payments: [
      { installment: 0, method: 'binance', share: 1, currency: 'USD' },
    ],
    milestones: [
      { type: 'reunion', audience: 'cliente', severity: 'info', title: 'Reunión de arranque', description: 'Se acuerda el cronograma de pagos y el horario fuera de oficina.', offset: -8, attendees: ['Luis Ferrer', 'Carla Mendoza', 'Tomás Rivas'] },
      { type: 'permisologia', audience: 'cliente', severity: 'info', title: 'Carta de la administración del edificio', description: 'Autoriza trabajar sábados y usar el montacargas.', offset: -6 },
    ],
    engagements: [
      { provider: 5, status: 'cotizada', quoted: 6_800 },
      { provider: 6, status: 'solicitada' },
    ],
  },
];

// ── Armado ─────────────────────────────────────────────────────────────────

async function ensureTeamUser(person: (typeof TEAM)[number], passwordHash: string): Promise<IUser> {
  const fields = {
    name: person.name,
    password: passwordHash,
    role: 'user' as const,
    email_verified: true,
    termsVersion: LEGAL_VERSION,
    termsAcceptedAt: new Date(),
  };
  const existing = await User.findOne({ email: person.email });
  if (existing) {
    existing.set(fields);
    return existing.save();
  }
  return User.create({ email: person.email, ...fields });
}

async function wipe(organization: Id, projectIds: Id[]) {
  const activityIds = await Activity.find({ project: { $in: projectIds } }).distinct('_id');
  await Promise.all([
    ActivityCrew.deleteMany({ activity: { $in: activityIds } }),
    ActivityProvider.deleteMany({ activity: { $in: activityIds } }),
  ]);
  for (const { model } of PROJECT_OWNED) {
    await model.deleteMany({ project: { $in: projectIds } });
  }
  await Promise.all([
    // Los movimientos del Depósito cuelgan de la Empresa, no de una obra.
    StockMovement.deleteMany({ organization }),
    Provider.deleteMany({ organization, scope: 'organization', notes: TAG }),
    CrewMember.deleteMany({ organization, scope: 'organization', notes: TAG }),
    Project.updateMany({ _id: { $in: projectIds } }, { $set: { customSpecialties: [] } }),
  ]);
}

/**
 * La cuenta Pro de la demo: dueña de una Empresa que ya pagó el plan con 1 obra
 * extra, con sus 4 obras vacías. Sólo se crea si no existe.
 */
async function createProAccount(): Promise<IUser> {
  const now = new Date();
  const user = await User.create({
    email: OWNER_EMAIL,
    name: 'Demo Pro',
    password: await bcrypt.hash(PASSWORD, 10),
    role: 'user',
    email_verified: true,
    termsVersion: LEGAL_VERSION,
    termsAcceptedAt: now,
  });
  const organization = await createPersonalOrganization(String(user._id), 'Demo Pro');
  const trialStartedAt = new Date(now.getTime() - 40 * DAY);
  await Subscription.create({
    organization: organization._id,
    owner: user._id,
    trialStartedAt,
    trialEndsAt: new Date(trialStartedAt.getTime() + PLAN.trialDays * DAY),
  });

  // Sin tasa no hay pago en bolívares: se usa la vigente o una de demostración.
  const rate =
    (await currentRate(now)) ??
    (await ExchangeRate.create({ source: 'manual', usd: VES_PER_USD, valueDate: caracasDayKey(now), fetchedAt: now, lastSeenAt: now }));
  const paidAt = new Date(now.getTime() - 10 * DAY);
  const totalUsd = PLAN.basePriceUsd + PLAN.extraProjectPriceUsd;
  const amountBs = usdToBolivares(totalUsd, rate.usd);
  await SubscriptionPayment.create({
    organization: organization._id,
    method: 'pago_movil',
    status: 'aprobado',
    periodStart: paidAt,
    periodEnd: addMonths(paidAt, 1),
    lines: [
      { kind: 'base', quantity: 1, unitUsd: PLAN.basePriceUsd, amountUsd: PLAN.basePriceUsd },
      { kind: 'extra', quantity: 1, unitUsd: PLAN.extraProjectPriceUsd, amountUsd: PLAN.extraProjectPriceUsd },
    ],
    totalUsd,
    bcvRate: rate.usd,
    rateValueDate: rate.valueDate,
    amountBs,
    declaredAmountBs: amountBs,
    bank: 'BANESCO',
    reference: '90000001',
    payerId: 'V-11111111',
    paidOn: caracasDayKey(paidAt),
    submittedAt: paidAt,
    reviewedAt: new Date(paidAt.getTime() + 2 * 60 * 60 * 1000),
  });

  for (const [i, name] of ['Baño Los Palos Grandes', 'Cocina Altamira', 'Local Chacao', 'Oficina El Rosal'].entries()) {
    await Project.create({
      organization: organization._id,
      createdBy: user._id,
      name,
      description: 'Obra de demostración.',
      location: 'Caracas',
      estimatedStartDate: caracasDayKey(now),
      estimatedEndDate: caracasDayKey(new Date(now.getTime() + 60 * DAY)),
      currency: 'USD',
      createdAt: new Date(trialStartedAt.getTime() + (i + 1) * 60 * 60 * 1000),
    });
  }
  console.log(`✅ Creé la cuenta ${OWNER_EMAIL} con su suscripción Pro y 4 obras.`);
  return user;
}

async function main() {
  const uri = DATABASE_CONFIG.MONGODB_URI;
  const dbName = new URL(uri).pathname.replace(/^\//, '');
  const isLocal = /(localhost|127\.0\.0\.1|\[::1\])/.test(uri) && SERVER_CONFIG.NODE_ENV !== 'production';
  // Un entorno de demostración alojado (otra base, NODE_ENV=production) sólo se
  // habilita nombrando la base y a condición de que se llame «demo»: así una
  // variable olvidada no apunta el script a la base de producción.
  const isDemoEnv = process.env.SEED_ALLOW_REMOTE_DB === dbName && /demo/i.test(dbName);
  if (!isLocal && !isDemoEnv) {
    console.error(
      '❌ Sólo contra una base local o un entorno demo: este script crea cuentas con una contraseña conocida.\n' +
        '   Para un entorno demo la base tiene que llamarse «demo» y hay que pasar SEED_ALLOW_REMOTE_DB=<nombre>.',
    );
    process.exit(1);
  }
  // Un túnel SSH también es "localhost" y puede llevar a una base remota: hay que
  // confirmar a mano contra qué base se escribe.
  if (!dbName || process.env.SEED_CONFIRM_DB !== dbName) {
    console.error(
      `❌ Va a escribir en la base "${dbName || '(sin nombre)'}". Si es la correcta, confirmalo: SEED_CONFIRM_DB=${dbName || '<nombre>'}`,
    );
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  const owner = (await User.findOne({ email: OWNER_EMAIL })) ?? (await createProAccount());
  const membership = await OrganizationMember.findOne({ user: owner._id, role: 'owner' });
  if (!membership) throw new Error(`${OWNER_EMAIL} no es owner de ninguna Empresa.`);
  const organization = membership.organization as Id;

  const projects = await Project.find({ organization }).sort({ createdAt: 1 });
  if (projects.length < OBRAS.length) {
    throw new Error(`${OWNER_EMAIL} tiene ${projects.length} obras y hacen falta ${OBRAS.length}.`);
  }
  const ownerId = idOf(owner);

  await wipe(organization, projects.map(idOf));

  // Equipo de la Empresa y de las obras.
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const team = new Map<InvitableProjectRole, IUser>();
  for (const person of TEAM) {
    const user = await ensureTeamUser(person, passwordHash);
    team.set(person.role, user);
    if (person.staffRole) {
      await OrganizationMember.findOneAndUpdate(
        { organization, user: user._id },
        { role: 'member', staffRole: person.staffRole, phone: person.phone },
        { upsert: true, new: true },
      );
    }
  }
  const supervisor = team.get('supervisor')!;
  const cogerente = team.get('gerente')!;

  const providers = await Provider.insertMany(
    PROVIDERS.map((provider) => ({
      organization,
      scope: 'organization',
      ...provider,
      email: `${provider.companyName.toLowerCase().replace(/[^a-z]/g, '')}@demo.test`,
      notes: TAG,
    })),
  );
  const crew = await CrewMember.insertMany(
    CREW.map((member) => ({ organization, scope: 'organization', kind: 'persona', ...member, notes: TAG })),
  );
  const providerBySpecialty = (specialty: string) => providers.find((p) => p.specialty === specialty);
  const crewBySpecialty = (specialty: string) => crew.filter((c) => c.specialty === specialty);

  const totals = { activities: 0, materials: 0, movements: 0, payments: 0, expenses: 0, milestones: 0, documents: 0 };
  const projectDocs: IProject[] = [];

  for (const [index, spec] of OBRAS.entries()) {
    const project = projects[index]!;
    const projectId = idOf(project);
    const contract = Math.round(spec.budgetUsd * 1.25);

    await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          description: spec.description,
          location: spec.location,
          size: spec.size,
          currency: 'USD',
          estimatedStartDate: dayKey(spec.startOffset),
          estimatedEndDate: dayKey(spec.endOffset),
          ...spec.visibility,
        },
      },
    );
    const fresh = (await Project.findById(projectId))!;
    projectDocs.push(fresh);

    // Una especialidad propia, para ver el selector con las de la obra.
    if (index === 1) await addCustomSpecialty(fresh, 'Yesería');

    // Equipo de la obra: un usuario por rol. El dueño ya es el gerente.
    await ProjectMembership.insertMany(
      TEAM.map((person) => ({
        project: projectId,
        user: idOf(team.get(person.role)!),
        role: person.role,
        invitedBy: ownerId,
      })),
    );

    // Proveedores y personal de la obra.
    const specialtiesInUse = new Set(spec.activities.map((a) => a.specialty));
    const projectProviders = providers.filter((p) => specialtiesInUse.has(p.specialty!));
    await ProjectProvider.insertMany(projectProviders.map((p) => ({ project: projectId, provider: idOf(p) })));
    const projectCrew = crew.filter((c) => specialtiesInUse.has(c.specialty!) || c.kind === 'equipo');
    await ProjectCrewMember.insertMany(projectCrew.map((c) => ({ project: projectId, crewMember: idOf(c) })));

    // Actividades: la fuente única de Tablero, Cronograma y Jornada.
    const activities: Array<{ doc: IActivity; spec: ActivitySpec }> = [];
    for (const item of spec.activities) {
      const reportedAt = new Date(Date.now() + (item.start + item.days) * DAY);
      const review =
        item.status === 'en_revision'
          ? { reportedBy: idOf(supervisor), reportedAt: new Date(Date.now() - DAY) }
          : item.status === 'completada'
            ? { reportedBy: idOf(supervisor), reportedAt, approvedBy: ownerId, approvedAt: new Date(reportedAt.getTime() + 3_600_000) }
            : item.rejected
              ? { reportedBy: idOf(supervisor), reportedAt: new Date(Date.now() - 2 * DAY), rejectedBy: ownerId, rejectedAt: new Date(Date.now() - DAY), rejectionReason: item.rejected }
              : null;
      const doc = await Activity.create({
        project: projectId,
        name: item.name,
        specialty: item.specialty,
        startDate: dayKey(item.start),
        endDate: dayKey(item.start + item.days - 1),
        responsible: { name: item.responsible },
        status: item.status,
        notes: item.notes,
        review,
        createdBy: ownerId,
      });
      activities.push({ doc, spec: item });
      totals.activities++;
    }
    const activityFor = (specialty: string) => activities.find((a) => a.spec.specialty === specialty)?.doc;

    // Quién hace cada tarea: el proveedor y el personal de su especialidad.
    await ActivityProvider.insertMany(
      activities.flatMap(({ doc, spec: s }) => {
        const provider = providerBySpecialty(s.specialty);
        return provider && s.status !== 'cancelada' ? [{ activity: idOf(doc), provider: idOf(provider) }] : [];
      }),
    );
    await ActivityCrew.insertMany(
      activities.flatMap(({ doc, spec: s }) =>
        crewBySpecialty(s.specialty).slice(0, 2).map((member) => ({ activity: idOf(doc), crewMember: idOf(member) })),
      ),
    );

    // Jornada: asistencia de los últimos días en lo que está en curso.
    const labor = activities
      .filter(({ spec: s }) => s.status === 'en_curso')
      .flatMap(({ doc }) =>
        [-1, -2, -3, -4, -7].map((offset, i) => {
          const present = crewBySpecialty(doc.specialty ?? '').map((c) => c.name);
          const names = present.length > 0 ? present : [CREW[1]!.name];
          return {
            project: projectId,
            activity: idOf(doc),
            date: dayKey(offset),
            expectedCount: names.length + 1,
            presentNames: i % 3 === 2 ? names.slice(0, 1) : names,
            createdBy: ownerId,
          };
        }),
      );
    await LaborRecord.insertMany(labor);

    // Materiales: el estado sigue al de la tarea a la que sirven.
    const quantityFactor = Math.max(0.5, spec.budgetUsd / 15_000);
    const materials = [];
    for (const [i, template] of MATERIALS.entries()) {
      const activity = activityFor(template.specialty);
      if (!activity) continue;
      const taskStatus = spec.activities.find((a) => a.specialty === template.specialty)!.status;
      const status: MaterialStatus =
        taskStatus === 'completada'
          ? 'en_obra'
          : taskStatus === 'en_curso' || taskStatus === 'en_revision'
            ? (['en_obra', 'comprado', 'solicitado'] as const)[i % 3]!
            : taskStatus === 'cancelada'
              ? 'pendiente'
              : (['pendiente', 'solicitado'] as const)[i % 2]!;
      const quantity = Math.max(1, Math.round(template.quantity * quantityFactor));
      const provider = providerBySpecialty(template.specialty);
      materials.push(
        await MaterialItem.create({
          project: projectId,
          activity: idOf(activity),
          name: template.name,
          quantity,
          unit: template.unit,
          status,
          statusChangedBy: status === 'pendiente' ? undefined : idOf(supervisor),
          statusChangedAt: status === 'pendiente' ? undefined : new Date(Date.now() - (i + 2) * DAY),
          estimatedCost: roundMoney(quantity * template.unitCostUsd),
          provider: provider ? idOf(provider) : null,
          supplier: ['Corralón La Candelaria', 'Ferretería Chacao', 'Materiales Altamira'][i % 3],
          createdBy: ownerId,
        }),
      );
      totals.materials++;
    }

    // Inventario: lo que llegó a la obra entra al kardex; después se consume.
    await recordPurchaseEntries(materials);
    const arrived = materials.filter((m) => m.status === 'en_obra');
    const movements = arrived.flatMap((material, i) => {
      const kind = (['consumo', 'consumo', 'merma', 'devolucion'] as const)[i % 4]!;
      const quantity = Math.max(0.5, roundMoney(material.quantity * (kind === 'consumo' ? 0.4 : 0.05)));
      return i % 5 === 4
        ? []
        : [
            {
              project: projectId,
              itemKey: stockItemKey(material.name, material.unit),
              name: material.name,
              unit: material.unit,
              kind,
              quantity,
              activity: material.activity ?? null,
              receiver: kind === 'consumo' ? 'Jesús Marcano' : undefined,
              destination: kind === 'consumo' ? 'Área de trabajo' : undefined,
              reason: kind === 'merma' ? 'Rotura al descargar' : undefined,
              material: idOf(material),
              occurredAt: new Date(Date.now() - (i + 1) * DAY),
              createdBy: idOf(supervisor),
            },
          ];
    });
    await StockMovement.insertMany(movements);
    totals.movements += movements.length + arrived.length;

    // Facturas de compras: un gasto que cubre varios materiales, con comprobante.
    const invoiced = arrived.slice(0, 3);
    if (invoiced.length > 0) {
      const provider = providerBySpecialty('albanileria') ?? providers[0]!;
      await Expense.create({
        project: projectId,
        category: 'material',
        description: `Factura 0000${index + 1}${invoiced.length} — ${invoiced.map((m) => m.name).join(', ')}`,
        amount: roundMoney(invoiced.reduce((sum, m) => sum + (m.estimatedCost ?? 0), 0)),
        currency: 'USD',
        exchangeRate: 1,
        spentOn: dayKey(-12),
        method: 'transferencia_usd',
        provider: idOf(provider),
        materials: invoiced.map(idOf),
        receipt: { key: `demo-pro/${String(projectId)}/factura-${index + 1}.pdf`, fileName: `factura-${index + 1}.pdf`, contentType: 'application/pdf', sizeBytes: 182_400 },
        registeredBy: ownerId,
      });
      totals.expenses++;
    }

    // Presupuesto con sus capítulos.
    const budget = await Budget.create({
      project: projectId,
      version: 1,
      currency: 'USD',
      totalAmount: spec.budgetUsd,
      contingencyAmount: roundMoney(spec.budgetUsd * 0.08),
      importMode: 'manual',
      importedBy: ownerId,
      importedAt: new Date(Date.now() + (spec.startOffset - 5) * DAY),
    });
    await BudgetLine.insertMany(
      BUDGET_CHAPTERS.map((line, i) => {
        const total = roundMoney(spec.budgetUsd * line.weight);
        const quantity = Math.max(1, Math.round(total / 40));
        return {
          budget: idOf(budget),
          project: projectId,
          chapter: line.chapter,
          order: i + 1,
          name: line.name,
          unit: line.unit,
          quantity,
          unitCost: roundMoney(total / quantity),
          total,
        };
      }),
    );

    // Cobros: el cronograma acordado y lo cobrado, con distintas monedas y medios.
    const installments = await PaymentScheduleItem.insertMany(
      [
        { order: 0, concept: 'Anticipo', share: 0.3, dueOn: dayKey(spec.startOffset - 3) },
        { order: 1, concept: 'Avance de obra gris', share: 0.4, dueOn: dayKey(Math.round((spec.startOffset + spec.endOffset) / 2)) },
        { order: 2, concept: 'Entrega final', share: 0.3, dueOn: dayKey(spec.endOffset) },
      ].map(({ share, ...item }) => ({
        project: projectId,
        currency: 'USD',
        exchangeRate: 1,
        amount: Math.round(contract * share),
        ...item,
      })),
    );
    const payments = spec.payments.map((payment) => {
      const installment = installments[payment.installment]!;
      const inVes = payment.currency === 'VES';
      const usd = roundMoney(installment.amount * payment.share);
      return {
        project: projectId,
        scheduleItem: idOf(installment),
        amount: inVes ? roundMoney(usd * VES_PER_USD) : usd,
        currency: payment.currency,
        exchangeRate: inVes ? VES_RATE : 1,
        paidOn: dayKey(Math.min(-1, installment.order === 0 ? spec.startOffset - 2 : -6)),
        method: payment.method,
        reference: `REC-${index + 1}${payment.installment}-${100 + index * 7}`,
        notes: inVes ? `Cobrado en bolívares a ${VES_PER_USD} Bs/USD.` : undefined,
        registeredBy: idOf(owner),
      };
    });
    await Payment.insertMany(payments);
    totals.payments += payments.length;

    // Gastos de todas las categorías, algunos en bolívares y con comprobante.
    const spent = Math.round(spec.budgetUsd * spec.spentShare);
    const labourActivity = activities.find((a) => a.spec.status === 'en_curso')?.doc ?? activities[0]!.doc;
    const expenses = [
      { category: 'nomina' as ExpenseCategory, description: 'Quincena de la cuadrilla', amount: roundMoney(spent * 0.35 * VES_PER_USD), currency: 'VES', exchangeRate: VES_RATE, spentOn: dayKey(-15), method: 'pago_movil' as PaymentMethod, activity: idOf(labourActivity) },
      { category: 'herramienta' as ExpenseCategory, description: 'Alquiler de andamios', amount: roundMoney(spent * 0.1), currency: 'USD', exchangeRate: 1, spentOn: dayKey(-20), method: 'efectivo' as PaymentMethod },
      { category: 'insumo' as ExpenseCategory, description: 'Guantes, cintas, discos de corte', amount: roundMoney(spent * 0.05), currency: 'USD', exchangeRate: 1, spentOn: dayKey(-8), method: 'tarjeta_debito' as PaymentMethod },
      { category: 'material' as ExpenseCategory, description: 'Compra de último momento', amount: roundMoney(spent * 0.2), currency: 'USD', exchangeRate: 1, spentOn: dayKey(-3), method: 'tarjeta_credito' as PaymentMethod, provider: idOf(providers[2]!) },
      { category: 'otro' as ExpenseCategory, description: 'Flete y permisos de descarga', amount: roundMoney(spent * 0.08), currency: 'USD', exchangeRate: 1, spentOn: dayKey(-25), method: 'zelle' as PaymentMethod },
    ].filter(() => spent > 0);
    if (expenses.length > 0) {
      await Expense.insertMany(
        expenses.map((expense, i) => ({
          project: projectId,
          registeredBy: ownerId,
          ...expense,
          receipt:
            i % 2 === 0
              ? { key: `demo-pro/${String(projectId)}/gasto-${i}.jpg`, fileName: `gasto-${i}.jpg`, contentType: 'image/jpeg', sizeBytes: 240_000 }
              : null,
        })),
      );
      totals.expenses += expenses.length;
    }

    // Hitos y eventualidades de todos los tipos.
    await Milestone.insertMany(
      spec.milestones.map((milestone) => ({
        project: projectId,
        reportedBy: ownerId,
        type: milestone.type,
        audience: milestone.audience,
        severity: milestone.severity,
        title: milestone.title,
        description: milestone.description,
        attendees: milestone.attendees ?? [],
        occurredOn: dayKey(milestone.offset),
        activity: milestone.type === 'etapa_concluida' ? idOf(activities[0]!.doc) : null,
      })),
    );
    totals.milestones += spec.milestones.length;

    // Contrataciones de proveedores (lo comprometido).
    await ProviderEngagement.insertMany(
      spec.engagements.map((engagement) => ({
        project: projectId,
        provider: idOf(providers[engagement.provider]!),
        status: engagement.status,
        quotedAmount: engagement.quoted,
        advanceAmount: engagement.advance,
        estimatedStartDate: engagement.status === 'aprobada' ? dayKey(spec.startOffset + 10) : undefined,
        requirements: engagement.requirements ?? [],
        notes: TAG,
        createdBy: ownerId,
      })),
    );

    // Documentación: una de cada categoría, con fechas escalonadas.
    const docs = DOCUMENT_TITLES.slice(0, index === 3 ? 4 : DOCUMENT_TITLES.length);
    await ProjectDocument.insertMany(
      docs.map((doc, i) => {
        const extension = doc.category === 'render' ? 'jpg' : 'pdf';
        return {
          project: projectId,
          ...doc,
          key: `demo-pro/${String(projectId)}/doc-${i}.${extension}`,
          fileName: `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`,
          contentType: extension === 'jpg' ? 'image/jpeg' : 'application/pdf',
          sizeBytes: 600_000 + i * 90_000,
          uploadedBy: idOf(team.get('arquitecto')!),
          createdAt: new Date(Date.now() - (docs.length - i) * 4 * DAY),
        };
      }),
    );
    totals.documents += docs.length;

    // Notificaciones del dueño, algunas sin leer.
    await Notification.insertMany(
      [
        { type: 'actividad_en_revision' as const, subjectName: 'Cielo raso en drywall', path: 'actividades', read: false },
        { type: 'hito' as const, subjectName: spec.milestones[0]!.title, path: 'hitos', read: false },
        { type: 'actividad_completada' as const, subjectName: spec.activities[0]!.name, path: 'actividades', read: true },
      ]
        .slice(0, index === 3 ? 1 : 3)
        .map((notification, i) => ({
          user: ownerId,
          project: projectId,
          type: notification.type,
          subjectName: notification.subjectName,
          link: `/admin/proyectos/${String(projectId)}/${notification.path}`,
          readAt: notification.read ? new Date(Date.now() - DAY) : null,
          createdAt: new Date(Date.now() - (i + 1) * 5 * 3_600_000),
        })),
    );

    console.log(`✅ ${project.name}`);
  }

  // Depósito General: la obra casi terminada manda lo que le sobra y la de la
  // cocina lo trae. Va por los servicios, que son los que cuidan el kardex.
  const [bathroom, kitchen] = projectDocs as [IProject, IProject];
  const surplus = await StockMovement.find({ project: idOf(bathroom), kind: 'compra' }).sort({ occurredAt: 1 });
  const surplusItem = surplus.find((movement) => movement.name.startsWith('Porcelanato')) ?? surplus[0];
  if (surplusItem) {
    await sendToDeposit(
      { project: bathroom, userId: String(ownerId) },
      { itemKey: surplusItem.itemKey, quantity: 2, unitCost: 18, note: 'Sobrante de la obra del baño.' },
    );
    await importFromDeposit(
      { project: kitchen, userId: String(ownerId) },
      { lines: [{ itemKey: surplusItem.itemKey, quantity: 1, currency: 'USD' }] },
    );
  }

  console.log('');
  console.log(`Obras llenadas: ${OBRAS.length} (las mismas 4 de la cuenta, sin sumar ninguna)`);
  console.log(`Actividades: ${totals.activities} · Materiales: ${totals.materials} · Movimientos de inventario: ${totals.movements}`);
  console.log(`Cobros: ${totals.payments} · Gastos: ${totals.expenses} · Hitos: ${totals.milestones} · Documentos: ${totals.documents}`);
  console.log(`Proveedores: ${providers.length} · Personal: ${crew.length} · Usuarios de obra: ${TEAM.length} (otro gerente: ${cogerente.email})`);
  console.log(`\nEntrá con ${OWNER_EMAIL} (o con cualquier usuario del equipo). Contraseña: ${PASSWORD}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ seed-demo-pro:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
