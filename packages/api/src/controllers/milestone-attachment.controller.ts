import type { NextFunction, Request, Response } from 'express';
import { DOCUMENT_MIME_TYPES, MILESTONE_ATTACHMENTS_MAX } from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { Milestone, type IMilestone } from '../models/Milestone.js';
import type { IProject } from '../models/Project.js';
import { User } from '../models/User.js';
import {
  deleteObject,
  StorageNotConfiguredError,
  uploadMilestoneAttachment,
} from '../services/storage.service.js';
import { badRequest, forbidden, notFound, serviceUnavailable } from '../utils/errors.js';
import { toMilestoneDTO } from './milestone.controller.js';

/**
 * Adjuntos de un hito: la foto del vicio oculto, el acta de la reunión, el
 * presupuesto revisado. Valen para todos los tipos.
 *
 * Mismas reglas que editar el hito: el router pide `milestone.report`, y si
 * el hito ya está publicado al cliente hace falta además `milestone.publish`
 * — un supervisor no le cambia la evidencia a algo que el cliente ya recibió.
 *
 * Express 4 no atrapa el `throw` de un handler async: todo va por `next(error)`.
 */

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Envuelve un handler async para que sus `throw` lleguen al `errorHandler`. */
function wrap(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

/**
 * La extensión del nombre en el bucket sale del tipo, nunca del nombre que
 * mandó el navegador. Los tipos son los de `DOCUMENT_MIME_TYPES`.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

async function findEditableMilestone(req: Request): Promise<IMilestone> {
  const project = req.project as IProject;
  const milestone = await Milestone.findOne({ _id: req.params.milestoneId, project: project._id });
  if (!milestone) throw notFound('No encontramos ese hito.');

  if (milestone.audience === 'cliente' && !req.can?.('milestone.publish')) {
    throw forbidden('No podés cambiar los adjuntos de un hito que ya se publicó al cliente.');
  }
  return milestone;
}

async function respondWithMilestone(res: Response, milestone: IMilestone, status = 200) {
  const [reporter, activity] = await Promise.all([
    User.findById(milestone.reportedBy).select('name'),
    milestone.activity ? Activity.findById(milestone.activity).select('name') : null,
  ]);

  return res.status(status).json({
    success: true,
    data: {
      milestone: await toMilestoneDTO(milestone, reporter?.name ?? '', activity?.name),
    },
  });
}

/** Requiere `requireProjectAccess` + `requireCapability('milestone.report')` + multer. */
export const addMilestoneAttachment = wrap(async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest('Falta el archivo.');

  const extension = EXTENSION_BY_MIME[file.mimetype];
  if (!extension || !DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
    throw badRequest(
      'Ese formato no se puede adjuntar. Subí un PDF o una imagen .jpg, .png o .webp.',
    );
  }

  const milestone = await findEditableMilestone(req);

  if (milestone.attachments.length >= MILESTONE_ATTACHMENTS_MAX) {
    throw badRequest(`Un hito admite hasta ${MILESTONE_ATTACHMENTS_MAX} adjuntos.`);
  }

  let key: string;
  try {
    ({ key } = await uploadMilestoneAttachment({
      projectId: String(milestone.project),
      milestoneId: String(milestone._id),
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    }));
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw serviceUnavailable('La carga de archivos todavía no está configurada en este entorno.');
    }
    throw error;
  }

  milestone.attachments.push({
    key,
    // `originalname` llega del navegador: es la etiqueta para que la persona
    // reconozca lo que subió, nunca una ruta. El nombre real es un uuid.
    fileName: file.originalname,
    contentType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy: req.user!.sub,
  });

  try {
    await milestone.save();
  } catch (error) {
    // El archivo ya subió pero el hito no lo registró: sin esto queda en el
    // bucket sin nada que lo referencie, y se paga para siempre.
    await deleteObject(key).catch(() => undefined);
    throw error;
  }

  return respondWithMilestone(res, milestone, 201);
});

/**
 * Requiere `requireProjectAccess` + `requireCapability('milestone.report')`.
 * Borrado duro, como el resto de los archivos: nada referencia a un adjunto.
 */
export const removeMilestoneAttachment = wrap(async (req, res) => {
  const milestone = await findEditableMilestone(req);

  const attachment = milestone.attachments.id(req.params.attachmentId);
  if (!attachment) throw notFound('No encontramos ese adjunto.');

  const { key } = attachment;
  attachment.deleteOne();
  await milestone.save();

  // Después de guardar: si el storage falla, el hito ya no lo muestra y el
  // archivo queda huérfano — mejor que un adjunto roto a la vista.
  await deleteObject(key).catch((error) =>
    console.error('❌ [MILESTONE] borrar adjunto del bucket:', key, error),
  );

  return respondWithMilestone(res, milestone);
});
