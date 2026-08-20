/** Fila del catálogo RH.tipos_documento. */
export interface IDocumentType {
  id_tipo_documento: number;
  nombre:            string;
  icono:             string | null;
  obligatorio:       boolean;
  orden:             number;
}

/** Archivo activo ya cargado (status = 1). */
export interface IEmployeeDocument {
  id_empleado_documento: number;
  id_empleado:           number;
  id_tipo_documento:     number | null;
  nombre_personalizado:  string | null;
  url:                   string;
  mime_type:             string | null;
  size_bytes:            number | null;
  nombre_usuario_carga:  string | null;   // resuelto con JOIN a dbo.usuarios
  created_at:            string;          // CONVERT(varchar(19), …, 120)
}

/** Lo que la pantalla renderiza: catálogo + su documento, si existe. */
export interface IEmployeeDocumentSlot {
  tipo:      IDocumentType | null;        // null en documentos libres
  documento: IEmployeeDocument | null;    // null en tipos pendientes
}

/** Entrada del server action que registra un archivo ya subido a Cloudinary. */
export interface EmployeeDocumentInput {
  id_empleado:          number;
  id_tipo_documento:    number | null;
  nombre_personalizado: string | null;
  url:                  string;
  mime_type:            string;
  size_bytes:           number;
}
