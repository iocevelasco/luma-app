/**
 * Gestión de materiales de una obra (RF-02). Cuelga de `Project`; puede
 * asociarse opcionalmente a una `Activity` de la misma obra.
 */

export type MaterialUnit = 'un' | 'm' | 'm2' | 'm3' | 'kg' | 'l' | 'bolsa' | 'rollo' | 'global';

export type MaterialStatus = 'pendiente' | 'solicitado' | 'comprado' | 'en_obra';

export interface MaterialItem {
  id: string;
  projectId: string;
  activityId?: string | null;
  name: string;
  quantity: number;
  unit: MaterialUnit;
  status: MaterialStatus;
  statusChangedBy?: string;
  statusChangedAt?: string;
  /** La API ya lo resolvió con `isMaterialEditable`: la UI lo lee, no lo deriva. */
  editable: boolean;
  estimatedCost?: number;
  /**
   * El proveedor del directorio, si está vinculado. Excluye a `supplier`:
   * un material tiene uno o el otro, nunca los dos.
   */
  providerId: string | null;
  /** Nombre del proveedor vinculado, resuelto por la API. */
  providerName?: string;
  /** `false` si el proveedor vinculado se dio de baja: se sigue mostrando, no se elige. */
  providerActive?: boolean;
  /** Proveedor escrito a mano: el que no está en el directorio, y los datos viejos. */
  supplier?: string;
  /**
   * Facturas que pagan este material. Sólo viene para quien puede verlas
   * (`material.invoice.read` o `expense.read`); para el resto, ausente.
   */
  invoices?: MaterialInvoiceRef[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialListResponse {
  materials: MaterialItem[];
}

export interface MaterialResponse {
  material: MaterialItem;
}

/** Lo que devuelven las acciones en lote: qué materiales se tocaron. */
export interface MaterialBulkResponse {
  materialIds: string[];
}

/**
 * Lo que Compras necesita de una factura: el archivo, no la plata. El monto
 * vive en el gasto y se ve en Finanzas.
 */
export interface MaterialInvoiceRef {
  /** Id del `Expense`. */
  id: string;
  fileName: string;
  /** URL firmada al vuelo; `null` si el storage no la pudo firmar. */
  url: string | null;
  /** Quien la cargó, o quien tiene `expense.write`. Ya resuelto por la API. */
  canDelete: boolean;
}

export interface MaterialInvoiceResponse {
  invoice: MaterialInvoiceRef & { materialIds: string[] };
}
