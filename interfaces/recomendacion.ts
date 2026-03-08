export interface IRecomendacion {
    id_recomendacion: number;
    codigo_condicion: string;
    titulo:           string;
    contenido:        string;
    created_at:       Date | string;
    status:           string;
}
