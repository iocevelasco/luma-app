import type { NextFunction, Request, Response } from 'express';
import { manualExchangeRateSchema } from '@luma/shared';
import { ExchangeRate, type IExchangeRate } from '../models/ExchangeRate.js';
import {
  BcvParseError,
  BcvUnavailableError,
  currentRate,
  refreshBcvRate,
  saveManualRate,
} from '../services/bcv.service.js';
import { badRequest, serviceUnavailable, unauthenticated } from '../utils/errors.js';

function toDTO(rate: IExchangeRate) {
  return {
    id: String(rate._id),
    source: rate.source,
    usd: rate.usd,
    eur: rate.eur,
    valueDate: rate.valueDate,
    fetchedAt: rate.fetchedAt.toISOString(),
    lastSeenAt: rate.lastSeenAt.toISOString(),
    flagged: rate.flagged,
    flagReason: rate.flagReason,
  };
}

/**
 * `GET /api/subscription/rate` — la tasa con la que se cotiza hoy un pago en
 * bolívares. Si nunca hubo una, 503: el pago en Bs no se puede ofrecer.
 */
export async function getCurrentRate(_req: Request, res: Response, next: NextFunction) {
  try {
    const rate = await currentRate();
    if (!rate) throw serviceUnavailable('Todavía no tenemos la tasa del BCV. Probá más tarde.');
    return res.json({ success: true, data: { rate } });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/admin/exchange-rates` — las últimas lecturas, marcadas incluidas. */
export async function listExchangeRates(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 200);
    const rates = await ExchangeRate.find().sort({ lastSeenAt: -1 }).limit(limit);
    return res.json({
      success: true,
      data: { current: await currentRate(), rates: rates.map(toDTO) },
    });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/exchange-rates` — tasa a mano, para cuando el BCV no responde. */
export async function createManualExchangeRate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    const parsed = manualExchangeRateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const { rate, plausible } = await saveManualRate(parsed.data, req.user.sub);
    return res.status(201).json({
      success: true,
      data: { rate: toDTO(rate), plausible },
      ...(plausible
        ? {}
        : { message: 'Guardada, pero salta más de un 20% contra la última tasa. Revisala.' }),
    });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/exchange-rates/refresh` — leer el BCV ahora, sin esperar a la tarea. */
export async function refreshExchangeRateNow(_req: Request, res: Response, next: NextFunction) {
  try {
    const outcome = await refreshBcvRate();
    return res.json({ success: true, data: { status: outcome.status, rate: toDTO(outcome.rate) } });
  } catch (error) {
    if (error instanceof BcvUnavailableError || error instanceof BcvParseError) {
      return next(serviceUnavailable(`No pudimos leer la tasa del BCV: ${error.message}`));
    }
    next(error);
  }
}
