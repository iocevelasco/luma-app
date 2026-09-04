import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  formatCurrency,
  hasPermission,
  type AssistantMessage,
  type AssistantSource,
  type ProjectRole,
} from '@luma/shared';
import { ConversationModel } from '../models/Conversation.js';
import { ActivityModel } from '../models/Activity.js';
import { MaterialModel } from '../models/Material.js';
import { AttendanceModel } from '../models/Attendance.js';
import { ContingencyModel } from '../models/Contingency.js';
import { WorkerModel } from '../models/Worker.js';
import { getDashboard } from './dashboard.service.js';
import { ASSISTANT_CONFIG, ASSISTANT_ENABLED } from '../config/app.config.js';
import { HttpError, forbidden } from '../utils/errors.js';
import { toDateKey } from '@luma/shared';

/**
 * Asistente conversacional (RF-06).
 *
 * Reemplaza a la integración con WhatsApp que tiene Pantera. La decisión está
 * escrita en el documento: la API de WhatsApp Business impone aprobación de
 * plantillas, verificación del negocio, costo por conversación y la ventana de
 * 24 horas — dependencia externa que agrega fricción y riesgo de bloqueo sin
 * aportar valor propio.
 *
 * Las restricciones del §RF-06 se implementan acá y no se le piden por favor
 * al modelo:
 *
 *  1. El contexto se arma SÓLO con datos del proyecto. El modelo no tiene
 *     herramientas ni acceso a la base: recibe un snapshot y responde sobre él.
 *  2. El snapshot se recorta por rol. Si quien pregunta no puede ver el
 *     presupuesto completo, los números no entran en el prompt — no alcanza
 *     con pedirle al modelo que no los diga.
 *  3. Cada respuesta viene con enlaces a la pantalla de origen.
 *  4. Nada se ejecuta: las acciones se devuelven como sugerencia y necesitan
 *     confirmación explícita del usuario.
 */

const SYSTEM_PROMPT = `Sos el asistente de Luma, una plataforma de gestión de obras y remodelaciones.

Respondés consultas del equipo de gestión de obra sobre UN proyecto concreto.

Reglas que no podés romper:
- Respondé ÚNICAMENTE con los datos del contexto que se te entrega. No infieras, no completes, no estimes.
- Si un dato no está en el contexto o está desactualizado, decilo de forma explícita: "No tengo ese dato registrado". Nunca lo inventes ni lo aproximes.
- No propongas ni ejecutes cambios de presupuesto o cronograma. Podés sugerir una acción, pero siempre queda a confirmación del usuario.
- Escribí en español rioplatense, directo y breve. Sin viñetas decorativas ni preámbulos.
- Cuando cites un número, decí de dónde sale (actividad, material, capítulo).

Formato: dos o tres oraciones. Si la respuesta es una lista de cosas, listalas sin adornos.`;

interface ProjectSnapshot {
  text: string;
  sources: AssistantSource[];
}

/**
 * Arma el contexto del proyecto recortado por rol.
 *
 * Es la pieza de seguridad del asistente: "toda respuesta respeta la matriz de
 * permisos; el asistente no expone información fuera del alcance del rol que
 * consulta". La forma robusta de garantizarlo es no ponerle el dato adelante.
 */
export async function buildSnapshot(
  projectId: string,
  role: ProjectRole,
): Promise<ProjectSnapshot> {
  const oid = new mongoose.Types.ObjectId(projectId);
  const today = toDateKey();

  const [dashboard, activities, materials, workers, attendance, contingencies] = await Promise.all([
    getDashboard(projectId),
    ActivityModel.find({ project_id: oid }).sort({ planned_start: 1 }).limit(120).lean(),
    MaterialModel.find({ project_id: oid }).sort({ status: 1 }).limit(200).lean(),
    WorkerModel.find({ project_id: oid, active: true }).lean(),
    AttendanceModel.find({ project_id: oid, date: today }).lean(),
    ContingencyModel.find({ project_id: oid }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  const currency = dashboard.budget.currency;
  const money = (n: number) => formatCurrency(n, currency);
  const workerById = new Map(workers.map((w) => [w._id.toString(), w]));
  const activityById = new Map(activities.map((a) => [a._id.toString(), a]));

  const sources: AssistantSource[] = [];
  const lines: string[] = [];

  lines.push(`PROYECTO: ${dashboard.project.name} (estado: ${dashboard.project.status})`);
  lines.push(`AVANCE GENERAL: ${dashboard.progress_pct}%`);
  lines.push(
    `ACTIVIDADES: ${dashboard.activities.done} listas, ${dashboard.activities.in_progress} en proceso, ` +
      `${dashboard.activities.pending} pendientes, ${dashboard.activities.blocked} bloqueadas, ` +
      `${dashboard.activities.late} atrasadas (total ${dashboard.activities.total}).`,
  );
  sources.push({ label: 'Planificación semanal', link: '/planificacion' });

  lines.push('');
  lines.push('ACTIVIDADES DE LA SEMANA:');
  for (const a of dashboard.activities.this_week) {
    lines.push(
      `- ${a.name}${a.area ? ` (${a.area})` : ''} — estado: ${a.status}` +
        `${a.is_late ? ', ATRASADA' : ''}${a.blocking_materials ? `, ${a.blocking_materials} material(es) faltante(s)` : ''}` +
        `${a.blocked_reason ? `, bloqueada por: ${a.blocked_reason}` : ''}`,
    );
  }
  if (dashboard.activities.this_week.length === 0) lines.push('- (sin actividades esta semana)');

  const pendingMaterials = materials.filter((m) => m.status !== 'on_site' && m.status !== 'purchased');
  lines.push('');
  lines.push('MATERIALES PENDIENTES:');
  for (const m of pendingMaterials.slice(0, 60)) {
    const activity = m.activity_id ? activityById.get(m.activity_id.toString()) : null;
    lines.push(
      `- ${m.name}: ${m.quantity} ${m.unit}, estado ${m.status}` +
        `${activity ? `, bloquea "${activity.name}"` : ''}`,
    );
  }
  if (pendingMaterials.length === 0) lines.push('- (no hay materiales pendientes)');
  sources.push({ label: 'Materiales', link: '/materiales' });

  lines.push('');
  lines.push(
    `PERSONAL HOY (${today}): ${dashboard.personnel.present_today} presentes de ` +
      `${dashboard.personnel.expected_today} esperados` +
      `${dashboard.personnel.deficit ? `, déficit de ${dashboard.personnel.deficit}` : ''}.`,
  );
  for (const record of attendance.filter((r) => r.present)) {
    const worker = workerById.get(record.worker_id.toString());
    const activity = record.activity_id ? activityById.get(record.activity_id.toString()) : null;
    if (worker) {
      lines.push(
        `- ${worker.name}${worker.trade ? ` (${worker.trade})` : ''}` +
          `${activity ? ` — trabajando en "${activity.name}"` : ''}`,
      );
    }
  }
  sources.push({ label: 'Personal', link: '/personal' });

  // ── El recorte por rol ─────────────────────────────────────────────────────
  if (hasPermission(role, 'budget.view.full')) {
    const b = dashboard.budget;
    lines.push('');
    lines.push(
      `PRESUPUESTO: línea base ${money(b.baseline)}, ejecutado ${money(b.executed)}, ` +
        `comprometido ${money(b.committed)}, disponible ${money(b.available)}. ` +
        `Margen de maniobra: ${money(b.maneuver_margin)} (${b.maneuver_margin_pct}%). Semáforo: ${b.health}.`,
    );
    lines.push('DESVÍOS POR CAPÍTULO:');
    for (const c of b.by_chapter) {
      lines.push(
        `- ${c.name}: presupuestado ${money(c.baseline)}, ejecutado+comprometido ` +
          `${money(c.executed + c.committed)}, desvío ${c.deviation_pct}% (${c.health}).`,
      );
    }
    lines.push(
      `PREVISIÓN: cierre proyectado ${money(dashboard.forecast.projected_budget_close)} ` +
        `(desvío ${money(dashboard.forecast.projected_budget_deviation)}); ` +
        `retraso proyectado ${dashboard.forecast.projected_delay_days} día(s).`,
    );
    sources.push({ label: 'Presupuesto', link: '/presupuesto' });
  } else {
    lines.push('');
    lines.push('PRESUPUESTO: el rol que consulta no tiene acceso al detalle presupuestal.');
  }

  lines.push('');
  lines.push('IMPREVISTOS:');
  for (const c of contingencies) {
    const showCost = hasPermission(role, 'budget.view.full');
    lines.push(
      `- ${c.code} [${c.status}] ${c.what_happened} — causa: ${c.why_happened}` +
        `${showCost ? `, impacto ${money(c.impact_cost)} y ${c.impact_days} día(s)` : ''}` +
        `${c.urgency === 'blocking' ? ', DETIENE LA OBRA' : ''}`,
    );
  }
  if (contingencies.length === 0) lines.push('- (no hay imprevistos registrados)');
  sources.push({ label: 'Imprevistos', link: '/imprevistos' });

  return { text: lines.join('\n'), sources };
}

/** Consultas del día por proyecto — el tope de costo del §12. */
async function countTodayQueries(projectId: string): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const conversations = await ConversationModel.find({
    project_id: new mongoose.Types.ObjectId(projectId),
    updatedAt: { $gte: since },
  })
    .select({ messages: 1 })
    .lean();

  return conversations.reduce(
    (sum, c) =>
      sum + c.messages.filter((m) => m.role === 'user' && new Date(m.created_at) >= since).length,
    0,
  );
}

export async function ask(params: {
  projectId: string;
  userId: string;
  role: ProjectRole;
  message: string;
  conversationId?: string;
}): Promise<{ conversationId: string; message: AssistantMessage }> {
  if (!hasPermission(params.role, 'assistant.use')) {
    throw forbidden('Tu rol no tiene acceso al asistente', 'FORBIDDEN_ROLE');
  }
  if (!ASSISTANT_ENABLED) {
    throw new HttpError(
      503,
      'El asistente no está configurado en este entorno (falta ANTHROPIC_API_KEY).',
      'ASSISTANT_DISABLED',
    );
  }

  const used = await countTodayQueries(params.projectId);
  if (used >= ASSISTANT_CONFIG.DAILY_LIMIT) {
    throw new HttpError(
      429,
      'Se alcanzó el límite diario de consultas al asistente para este proyecto.',
      'ASSISTANT_LIMIT',
    );
  }

  const conversation = params.conversationId
    ? await ConversationModel.findOne({
        _id: params.conversationId,
        project_id: new mongoose.Types.ObjectId(params.projectId),
        user_id: new mongoose.Types.ObjectId(params.userId),
      })
    : new ConversationModel({
        project_id: new mongoose.Types.ObjectId(params.projectId),
        user_id: new mongoose.Types.ObjectId(params.userId),
        title: params.message.slice(0, 60),
        messages: [],
      });

  if (!conversation) {
    throw new HttpError(404, 'Conversación no encontrada', 'NOT_FOUND');
  }

  const snapshot = await buildSnapshot(params.projectId, params.role);

  conversation.messages.push({
    id: crypto.randomUUID(),
    role: 'user',
    content: params.message,
    sources: [],
    suggested_action: null,
    created_at: new Date(),
  });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ASSISTANT_CONFIG.API_KEY });

  // Las últimas seis vueltas alcanzan para el hilo y acotan el costo por
  // consulta, que §12 marca como riesgo del producto.
  const history = conversation.messages.slice(-12).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }));

  const response = await client.messages.create({
    model: ASSISTANT_CONFIG.MODEL,
    max_tokens: ASSISTANT_CONFIG.MAX_TOKENS,
    system: `${SYSTEM_PROMPT}\n\n=== DATOS DEL PROYECTO ===\n${snapshot.text}`,
    messages: history,
  });

  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim();

  const answer: AssistantMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: text || 'No pude generar una respuesta con los datos del proyecto.',
    // Se adjuntan sólo las fuentes que la respuesta realmente menciona: una
    // lista de seis links en cada respuesta deja de ser verificación y pasa a
    // ser ruido.
    sources: snapshot.sources.filter((s) =>
      text.toLowerCase().includes(s.label.toLowerCase().split(' ')[0]),
    ),
    suggested_action: null,
    created_at: new Date().toISOString(),
  };

  conversation.messages.push({ ...answer, created_at: new Date() });
  await conversation.save();

  return { conversationId: conversation._id.toString(), message: answer };
}

export async function listConversations(projectId: string, userId: string) {
  return ConversationModel.find({
    project_id: new mongoose.Types.ObjectId(projectId),
    user_id: new mongoose.Types.ObjectId(userId),
  })
    .sort({ updatedAt: -1 })
    .limit(30)
    .select({ title: 1, updatedAt: 1 })
    .lean();
}

export async function getConversation(projectId: string, userId: string, id: string) {
  return ConversationModel.findOne({
    _id: id,
    project_id: new mongoose.Types.ObjectId(projectId),
    user_id: new mongoose.Types.ObjectId(userId),
  }).lean();
}
