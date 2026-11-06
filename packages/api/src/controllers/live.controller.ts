import { LIVE_RESOURCES, canReceiveLiveResource } from '@luma/shared';
import { LIVE_CONFIG } from '../config/app.config.js';
import { User } from '../models/User.js';
import { liveHub } from '../services/live-hub.service.js';
import { serviceUnavailable, unauthenticated, wrapAsync } from '../utils/errors.js';

/**
 * `GET /api/projects/:projectId/live` — el stream de avisos de la obra (SSE).
 *
 * La autorización la resolvieron `requireProjectAccess` (la obra existe y la
 * persona está en ella) y `requireCapability('project.read')`: acá sólo se
 * abre el canal. Lo que cada conexión recibe lo decide su lista de capacidades,
 * congelada al abrir; si cambia quién puede qué, el hub corta y reconecta.
 *
 * Qué NO hace, a propósito: no manda datos de negocio —sólo "cambió X"— y no
 * lleva token en la URL: el cliente abre esto con `fetch` y el `Bearer` de
 * siempre.
 */
export const streamProjectLive = wrapAsync(async (req, res) => {
  if (!LIVE_CONFIG.ENABLED) {
    throw serviceUnavailable('Las actualizaciones en vivo están desactivadas por ahora.');
  }

  // `isAuthenticated` sólo verifica la firma del token, que dura días. Una
  // cuenta dada de baja pasaría; esta conexión vive minutos y, al reconectar,
  // vuelve a pasar por acá.
  const user = await User.findById(req.user!.sub).select('enabled account_status');
  if (!user || !user.enabled || user.account_status === 'inactive') {
    throw unauthenticated('Tu cuenta ya no está activa.');
  }

  const capabilities = req.projectCapabilities ?? [];

  // Un rol que no lee nada en vivo (el contador) no tiene qué escuchar: 204 y
  // la SPA no abre ni reintenta. Ahorra una conexión abierta que sólo latiría.
  if (!LIVE_RESOURCES.some((resource) => canReceiveLiveResource(capabilities, resource))) {
    return res.status(204).end();
  }

  if (!liveHub.hasRoom()) {
    throw serviceUnavailable('Hay muchas conexiones en vivo abiertas. Probá de nuevo en un rato.');
  }

  // Los `await` de arriba dejan una ventana en la que el cliente puede haberse
  // ido (un iPhone que reconecta, una pestaña que cambia rápido). Su `close` ya
  // se emitió y no va a volver a salir: registrarlo dejaría una conexión
  // fantasma contando contra los límites hasta que venciera su vida máxima.
  if (res.destroyed || req.destroyed) return;

  // Conexión larga: ni timeout de inactividad del socket, ni Nagle.
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // `no-transform`: ningún intermediario (compresión incluida) lo re-empaqueta.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx y compañía bufferizan por defecto; los avisos tienen que salir ya.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const handle = liveHub.open({
    userId: req.user!.sub,
    projectId: String(req.project!._id),
    capabilities,
    sink: res,
  });

  // Sólo el `close` de la respuesta: es el que dispara cuando el cliente se va o
  // se cae la conexión. El del request no sirve acá: desde Node 16 significa
  // "terminó de llegar el pedido", y soltaría la conexión nada más abrirla.
  res.once('close', handle.release);
});
