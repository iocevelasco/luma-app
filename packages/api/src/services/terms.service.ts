import type { Request } from 'express';
import { LEGAL_VERSION } from '@luma/shared';

const MAX_USER_AGENT_LENGTH = 300;

/**
 * Los campos que deja una aceptación de los Términos vigentes. Quien llama los
 * mezcla en el `create` o el `updateOne` del usuario: así el hecho (versión,
 * fecha, desde dónde) nace en el mismo write que el alta, sin un paso aparte
 * que pueda quedar a medias.
 *
 * `req.ip` es la IP real porque `trust proxy` está antes que todo en
 * `index.ts`; sin eso, detrás de Traefik sería la del proxy.
 */
export function termsAcceptanceFields(req: Request) {
  return {
    termsVersion: LEGAL_VERSION,
    termsAcceptedAt: new Date(),
    termsAcceptedIp: req.ip,
    termsAcceptedUserAgent: req.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH),
  };
}
