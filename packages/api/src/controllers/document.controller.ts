import type { Request, Response } from 'express';
import {
  createProjectDocumentSchema,
  updateProjectDocumentSchema,
  type ProjectDocument as ProjectDocumentDTO,
} from '@luma/shared';
import { ProjectDocument, type IProjectDocument } from '../models/ProjectDocument.js';
import { User } from '../models/User.js';
import type { IProject } from '../models/Project.js';
import {
  deleteObject,
  signObjectUrl,
  StorageNotConfiguredError,
  uploadProjectDocument,
} from '../services/storage.service.js';

/**
 * Formatos aceptados. Los permisos y planos llegan en PDF; los renders, como
 * imagen. Un `.dwg` de AutoCAD no está en la lista: el navegador no lo puede
 * mostrar, así que serviría sólo para descargar, y nadie lo pidió todavía.
 */
const DOCUMENT_MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * Firma la `key` al vuelo y resuelve quién lo subió. La `key` interna nunca
 * sale en la respuesta: es la ruta real en el bucket y no le sirve a nadie
 * del lado del navegador.
 *
 * `uploaderName` se pasa desde afuera para que el listado resuelva todos los
 * nombres en una consulta en vez de una por documento.
 */
async function toDocumentDTO(
  doc: IProjectDocument,
  uploaderName: string,
): Promise<ProjectDocumentDTO> {
  return {
    id: String(doc._id),
    projectId: String(doc.project),
    category: doc.category,
    space: doc.space || undefined,
    title: doc.title,
    notes: doc.notes || undefined,
    fileName: doc.fileName,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    url: await signObjectUrl(doc.key),
    uploadedBy: String(doc.uploadedBy),
    uploadedByName: uploaderName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Nombre de cada persona que subió algo, en una sola consulta. */
async function uploaderNames(docs: IProjectDocument[]): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((doc) => String(doc.uploadedBy)))];
  const users = await User.find({ _id: { $in: ids } }).select('name');

  return new Map(users.map((user) => [String(user._id), user.name]));
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function listProjectDocuments(req: Request, res: Response) {
  try {
    const project = req.project as IProject;

    const docs = await ProjectDocument.find({ project: project._id }).sort({
      category: 1,
      createdAt: -1,
    });

    const names = await uploaderNames(docs);
    const documents = await Promise.all(
      docs.map((doc) => toDocumentDTO(doc, names.get(String(doc.uploadedBy)) ?? '')),
    );

    return res.json({ success: true, data: { documents } });
  } catch (error) {
    console.error('❌ [DOCUMENT] listProjectDocuments:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 * Multipart con un único campo `file` (`upload.single('file')` en la ruta);
 * el resto de la ficha viaja como campos de texto del mismo form.
 */
export async function createProjectDocument(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Falta el archivo' });
  }

  const extension = DOCUMENT_MIME_TO_EXTENSION[file.mimetype];
  if (!extension) {
    return res.status(400).json({
      success: false,
      error: 'Formato no soportado. Subí un PDF o una imagen .jpg, .png o .webp',
    });
  }

  const parsed = createProjectDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
  }

  try {
    const project = req.project as IProject;

    const { key } = await uploadProjectDocument({
      projectId: String(project._id),
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    });

    const doc = await ProjectDocument.create({
      project: project._id,
      ...parsed.data,
      key,
      // `originalname` llega del navegador: se guarda como etiqueta para que
      // la persona reconozca lo que subió, nunca como ruta — el nombre real en
      // el bucket es un uuid.
      fileName: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: req.user.sub,
    });

    const uploader = await User.findById(req.user.sub).select('name');

    return res
      .status(201)
      .json({ success: true, data: { document: await toDocumentDTO(doc, uploader?.name ?? '') } });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return res.status(503).json({
        success: false,
        error: 'La carga de documentación todavía no está configurada en este entorno',
      });
    }
    console.error('❌ [DOCUMENT] createProjectDocument:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 * Edita la ficha, nunca el archivo: "cargar actualización de planos" es un
 * documento nuevo que convive con el viejo, no un reemplazo que borra la
 * versión anterior sin dejar rastro.
 */
export async function updateProjectDocument(req: Request, res: Response) {
  try {
    const parsed = updateProjectDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const doc = await ProjectDocument.findOne({
      _id: req.params.documentId,
      project: project._id,
    });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }

    doc.set(parsed.data);
    await doc.save();

    const uploader = await User.findById(doc.uploadedBy).select('name');

    return res.json({
      success: true,
      data: { document: await toDocumentDTO(doc, uploader?.name ?? '') },
    });
  } catch (error) {
    console.error('❌ [DOCUMENT] updateProjectDocument:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 * Borrado DURO, y el archivo se va del bucket en el mismo paso: sin eso, cada
 * documento borrado deja un objeto huérfano pagándose solo para siempre.
 */
export async function deleteProjectDocument(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const doc = await ProjectDocument.findOne({
      _id: req.params.documentId,
      project: project._id,
    });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }

    await deleteObject(doc.key);
    await ProjectDocument.findByIdAndDelete(doc._id);

    return res.json({ success: true, data: { documentId: String(doc._id) } });
  } catch (error) {
    console.error('❌ [DOCUMENT] deleteProjectDocument:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
