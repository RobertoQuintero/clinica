export interface IProceso {
  id_proceso:        number;
  id_consulta:       number;
  valoracion_piel:   boolean | number;
  patologia_ungueal: boolean | number;
  servicios:         boolean | number;
  productos:         boolean | number;
  fotos_valoracion:  boolean | number;
  fotos_pedicure:    boolean | number;
  pagar:             boolean | number;
}
