export interface IValoracionPiel {
    id_valoracion_piel: number;
    id_consulta:        number;
    fecha_valoracion:   Date | string;
    edema:              boolean;
    dermatomicosis:     boolean;
    pie_atleta:         boolean;
    bromhidrosis:       boolean;
    hiperdrosis:        boolean;
    anhidrosis:         boolean;
    hiperqueratosis:    boolean;
    helomas:            boolean;
    verrugas:           boolean;
    observaciones:      string;
    status:             boolean;
    created_at:         Date | string; 
}
