export interface IArchivo {
    id_archivo:  number;
    id_consulta: number;
    ruta:        string;
    tipo:        string;
    created_at:  Date | string;
    categoria:   string;
}
