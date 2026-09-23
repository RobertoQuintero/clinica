export interface ICommissionTier {
  id_commission_tier: number;
  min_consultas: number;
  max_consultas: number | null; // null = tramo abierto
  importe: number;
}

/** Payload de alta y edición. En edición viaja también el id. */
export interface ICommissionTierInput {
  min_consultas: number;
  max_consultas: number | null;
  importe: number;
}
