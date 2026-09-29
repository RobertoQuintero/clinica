const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Valor del atributo `accept` de un `<input type="file">` para estos documentos. */
export const DOCUMENT_FILE_ACCEPT = ALLOWED_EXTENSIONS.join(",");

/** Regresa el mensaje de error si el archivo no es PDF, JPG o PNG de máximo 5 MB; `null` si es válido. */
export function validateDocumentFile(file: File): string | null {
  const extension = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Formato no permitido. Solo se aceptan PDF, JPG y PNG.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "El archivo supera el tamaño máximo de 5 MB.";
  }
  return null;
}

/** Sube el archivo a Cloudinary vía /api/upload y regresa su URL. Lanza un `Error` si falla. */
export async function uploadDocumentFile(file: File, folder: string, fileName: string): Promise<string> {
  const response = await fetch(
    `/api/upload?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(fileName)}`,
    { method: "POST", headers: { "Content-Type": file.type }, body: file }
  );
  const uploadResult = await response.json();
  if (!uploadResult.ok) throw new Error(uploadResult.data ?? "Error al subir el archivo");
  return uploadResult.data;
}
