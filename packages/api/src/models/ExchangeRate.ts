import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Una lectura de la tasa oficial del BCV (Bs por dólar).
 *
 * Es un hecho con fecha, y se guarda cada una: la tasa con la que se cotizó
 * un pago queda congelada en ese pago, pero el historial dice de dónde salió
 * y cuándo se leyó. No se edita ni se borra.
 *
 * - `valueDate` es la "Fecha Valor" que publica el BCV: el día para el que
 *   rige esa tasa. El BCV publica a la tarde la del día hábil siguiente.
 * - `flagged`: la lectura saltó demasiado contra la anterior. Se guarda para
 *   que un admin la vea, pero **no se usa** para cobrar.
 * - Una tasa `manual` la carga un admin cuando el BCV no responde.
 */
export type ExchangeRateSource = 'bcv' | 'manual';

export interface IExchangeRate extends Document {
  source: ExchangeRateSource;
  usd: number;
  eur: number | null;
  /** `YYYY-MM-DD`. */
  valueDate: string;
  /** Primera vez que se vio esta tasa. */
  fetchedAt: Date;
  /** Última vez que se confirmó. Es lo que mide si la tasa está vieja. */
  lastSeenAt: Date;
  flagged: boolean;
  flagReason: string | null;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const exchangeRateSchema = new Schema<IExchangeRate>(
  {
    source: { type: String, enum: ['bcv', 'manual'], required: true },
    usd: { type: Number, required: true, min: 0 },
    eur: { type: Number, default: null },
    valueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    fetchedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// La tasa vigente: la más nueva no marcada.
exchangeRateSchema.index({ flagged: 1, valueDate: -1, lastSeenAt: -1 });
// Leer la misma tasa cada hora no crea una fila por hora: se confirma la que ya está.
exchangeRateSchema.index(
  { valueDate: 1, usd: 1 },
  { unique: true, partialFilterExpression: { source: 'bcv' } },
);

export const ExchangeRate: Model<IExchangeRate> =
  (mongoose.models.ExchangeRate as Model<IExchangeRate>) ??
  mongoose.model<IExchangeRate>('ExchangeRate', exchangeRateSchema);

export default ExchangeRate;
