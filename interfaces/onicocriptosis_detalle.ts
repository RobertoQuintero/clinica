export interface IOnicocriptosisDetalle {
    id_detalle:     number;
    id_consulta:    number;
    pie:            "izquierdo" | "derecho";
    dedo:           number;       // 1-5
    grado:          1 | 2 | 3;
    lado_medial:    boolean;
    lado_lateral:   boolean;
    dolor:          number;       // 1-10
}
