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
  supplier?: string;
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
