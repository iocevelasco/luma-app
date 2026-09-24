import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import type { ChatMessage } from '@luma/shared';
import mongoose from 'mongoose';
import { ANTHROPIC_CONFIG } from '../config/app.config.js';
import { Activity } from '../models/Activity.js';
import { Budget } from '../models/Budget.js';
import { BudgetLine } from '../models/BudgetLine.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { Project } from '../models/Project.js';

const client = new Anthropic({ apiKey: ANTHROPIC_CONFIG.API_KEY });

const SYSTEM_PROMPT =
  'Sos un consultor que ayuda a quien dirige una obra de construcción a tomar decisiones. ' +
  'Sólo ves los datos de UNA obra puntual a través de tus herramientas — nunca inventes ' +
  'datos ni compares con otras obras. Respondé en español, de forma directa y accionable. ' +
  'Si una pregunta no se puede responder con las herramientas disponibles, decilo en vez de adivinar.';

/**
 * El `projectId` queda cerrado en el closure de cada tool, nunca es un
 * parámetro que el modelo pueda elegir — la autorización ya se resolvió en
 * `requireProjectAccess`/`requireProjectOwner` antes de llegar acá, y no hay
 * forma de que una pregunta del chat la esquive.
 */
const emptySchema = { type: 'object', properties: {}, additionalProperties: false } as const;

function buildTools(projectId: mongoose.Types.ObjectId) {
  return [
    betaTool({
      name: 'resumen_obra',
      description:
        'Devuelve el resumen general de la obra: datos básicos y estado del presupuesto ' +
        '(total, contingencia, monto comprometido en ítems de presupuesto).',
      inputSchema: emptySchema,
      run: async () => {
        const project = await Project.findById(projectId);
        if (!project) return JSON.stringify({ error: 'La obra no existe.' });

        const budget = await Budget.findOne({ project: projectId }).sort({ version: -1 });
        const lines = budget ? await BudgetLine.find({ budget: budget._id }) : [];
        const comprometido = lines.reduce((sum, line) => sum + line.total, 0);

        return JSON.stringify({
          nombre: project.name,
          ubicacion: project.location,
          tipoPresupuesto: project.budgetType,
          fechaInicioEstimada: project.estimatedStartDate,
          fechaFinEstimada: project.estimatedEndDate,
          moneda: project.currency,
          presupuesto: budget
            ? {
                total: budget.totalAmount,
                contingencia: budget.contingencyAmount,
                comprometidoEnLineas: comprometido,
                porcentajeComprometido:
                  budget.totalAmount > 0 ? comprometido / budget.totalAmount : null,
              }
            : null,
        });
      },
    }),
    betaTool({
      name: 'estado_cronograma',
      description:
        'Devuelve el estado del cronograma: cantidad de actividades por estado y el detalle ' +
        'de las que están atrasadas (fecha de fin ya pasó y no están completadas ni canceladas).',
      inputSchema: emptySchema,
      run: async () => {
        const activities = await Activity.find({ project: projectId });
        const today = new Date().toISOString().slice(0, 10);
        const atrasadas = activities.filter(
          (activity) =>
            activity.endDate < today && !['completada', 'cancelada'].includes(activity.status),
        );

        return JSON.stringify({
          total: activities.length,
          porEstado: {
            pendiente: activities.filter((a) => a.status === 'pendiente').length,
            en_curso: activities.filter((a) => a.status === 'en_curso').length,
            completada: activities.filter((a) => a.status === 'completada').length,
            cancelada: activities.filter((a) => a.status === 'cancelada').length,
          },
          atrasadas: atrasadas.map((activity) => ({
            nombre: activity.name,
            area: activity.area,
            fechaFin: activity.endDate,
            responsable: activity.responsible.name,
          })),
        });
      },
    }),
    betaTool({
      name: 'asistencia_mano_de_obra',
      description: 'Devuelve la tasa de asistencia de mano de obra en los últimos N días.',
      inputSchema: {
        type: 'object',
        properties: {
          dias: {
            type: 'integer',
            minimum: 1,
            maximum: 30,
            description: 'Cantidad de días hacia atrás a considerar. Default 7.',
          },
        },
        additionalProperties: false,
      } as const,
      run: async ({ dias }) => {
        const desde = new Date(Date.now() - (dias ?? 7) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const registros = await LaborRecord.find({ project: projectId, date: { $gte: desde } });
        const esperado = registros.reduce((sum, record) => sum + record.expectedCount, 0);
        const presente = registros.reduce((sum, record) => sum + record.presentNames.length, 0);

        return JSON.stringify({
          partesDiarios: registros.length,
          tasaAsistencia: esperado > 0 ? presente / esperado : null,
        });
      },
    }),
  ];
}

export async function askProjectAdvisor(
  projectId: mongoose.Types.ObjectId,
  message: string,
  history: ChatMessage[],
): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user' as const, content: message },
  ];

  const finalMessage = await client.beta.messages.toolRunner({
    model: ANTHROPIC_CONFIG.MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    tools: buildTools(projectId),
    messages,
  });

  const textBlock = finalMessage.content.find(
    (block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text',
  );
  return textBlock?.text ?? 'No pude generar una respuesta.';
}
