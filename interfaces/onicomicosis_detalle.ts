export interface IOnicomicosisDetalle {
    id_detalle:     number;
    id_consulta:    number;
    pie:            "izquierdo" | "derecho";
    dedo:           number;       // 1-5
}
