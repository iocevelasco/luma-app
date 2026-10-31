import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CAMPAIGN_IMAGE_TYPES,
  campaignInputSchema,
} from '@luma/shared';
import { Campaign } from '../models/Campaign.js';
import { User } from '../models/User.js';
import {
  countAudience,
  sendCampaignTo,
  startCampaign,
  toCampaignDTO,
} from '../services/campaign.service.js';
import {
  deleteObject,
  openObject,
  putObject,
  StorageNotConfiguredError,
} from '../services/storage.service.js';
import { badRequest, notFound, serviceUnavailable, unauthenticated } from '../utils/errors.js';
import { isValidUnsubscribe } from '../utils/unsubscribe.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
};

/** El `mimetype` lo declara el cliente: se confirma con los primeros bytes. */
function matchesSignature(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mimetype === 'image/png') return buffer.subarray(0, 4).toString('hex') === '89504e47';
  if (mimetype === 'image/gif') return buffer.subarray(0, 3).toString('ascii') === 'GIF';
  return false;
}

async function findCampaign(id: string) {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw notFound('No encontramos esa campaña.');
  return campaign;
}

/** `GET /api/admin/campaigns` */
export async function listCampaigns(_req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data: campaigns.map(toCampaignDTO) });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/admin/campaigns/audience` — a cuántas cuentas llegaría hoy. */
export async function getCampaignAudience(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, data: { recipients: await countAudience() } });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/campaigns` — multipart: `title`, `body` y `image` (opcional). */
export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();

    const parsed = campaignInputSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const file = req.file;
    let imageKey: string | undefined;
    if (file) {
      const type = file.mimetype as (typeof CAMPAIGN_IMAGE_TYPES)[number];
      if (!CAMPAIGN_IMAGE_TYPES.includes(type) || !matchesSignature(file.buffer, type)) {
        throw badRequest('La imagen tiene que ser JPG, PNG o GIF.');
      }
      try {
        ({ key: imageKey } = await putObject({
          fileName: `campaign-${randomUUID()}${EXTENSIONS[type]}`,
          buffer: file.buffer,
          contentType: type,
        }));
      } catch (error) {
        if (error instanceof StorageNotConfiguredError) {
          throw serviceUnavailable('El almacenamiento de archivos no está configurado.');
        }
        throw error;
      }
    }

    const campaign = await Campaign.create({ ...parsed.data, imageKey, createdBy: req.user.sub });
    return res.status(201).json({ success: true, data: toCampaignDTO(campaign) });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/campaigns/:id/test` — se la manda al propio admin. */
export async function sendCampaignTest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    const campaign = await findCampaign(String(req.params.id));
    const admin = await User.findById(req.user.sub).select('_id email name');
    if (!admin) throw unauthenticated();

    const ok = await sendCampaignTo(campaign, admin);
    return res.json({ success: true, data: { sent: ok, to: admin.email } });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/campaigns/:id/send` — a toda la audiencia. */
export async function sendCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    await findCampaign(String(req.params.id));
    const campaign = await startCampaign(String(req.params.id));
    return res.status(202).json({ success: true, data: toCampaignDTO(campaign) });
  } catch (error) {
    next(error);
  }
}

/** `DELETE /api/admin/campaigns/:id` — sólo borradores: lo enviado queda de registro. */
export async function deleteCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: String(req.params.id), status: 'draft' });
    if (!campaign) throw notFound('No encontramos ese borrador.');
    if (campaign.imageKey) await deleteObject(campaign.imageKey).catch(() => undefined);
    return res.json({ success: true, data: { id: String(campaign._id) } });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/public/campaigns/:id/image` — sin sesión: la abre el cliente de correo. */
export async function getCampaignImage(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await Campaign.findById(String(req.params.id)).select('imageKey').lean();
    const file = campaign?.imageKey ? await openObject(campaign.imageKey) : null;
    if (!file) throw notFound('No encontramos la imagen.');

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (file.contentLength) res.setHeader('Content-Length', String(file.contentLength));
    file.stream.on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
}

const PAGE = (message: string, form = '') => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Comunicados</title></head><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#18181b">
<p style="font-size:17px;line-height:1.5">${message}</p>${form}</body></html>`;

/**
 * `GET /api/public/unsubscribe` muestra la confirmación y `POST` da la baja. La
 * baja va por POST porque los escáneres de correo abren los enlaces: con GET
 * darían de baja a todo el mundo. El POST también atiende el
 * `List-Unsubscribe-Post` de un clic.
 */
export async function unsubscribePage(req: Request, res: Response) {
  const { u, s } = req.query as { u?: string; s?: string };
  if (!u || !s || !isValidUnsubscribe(u, s)) {
    return res.status(400).type('html').send(PAGE('Este enlace no es válido.'));
  }
  const form = `<form method="post" action="${req.originalUrl.replace(/"/g, '&quot;')}">
<button style="margin-top:16px;padding:12px 24px;border:0;border-radius:999px;background:#00d992;color:#101010;font-size:15px;cursor:pointer">Dejar de recibir comunicados</button></form>`;
  return res.type('html').send(PAGE('¿Querés dejar de recibir comunicados?', form));
}

export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { u, s } = req.query as { u?: string; s?: string };
    if (!u || !s || !isValidUnsubscribe(u, s)) {
      return res.status(400).type('html').send(PAGE('Este enlace no es válido.'));
    }
    await User.updateOne({ _id: u }, { marketing_opt_out: true });
    return res.type('html').send(PAGE('Listo. No vas a recibir más comunicados.'));
  } catch (error) {
    next(error);
  }
}
