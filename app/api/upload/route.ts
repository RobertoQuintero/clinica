import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import db from "@/database/connection";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

// Allowed MIME types — anything else is rejected before touching Cloudinary.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FOLDERS = new Set([
  "clinica/consultas",
  "clinica/facturas",
  "clinica/egresos",
  "clinica/recetas",
  "clinica/empleados",
  "clinica/empleados/documentos",
  "clinica/empleados/faltas",
  "clinica/empleados/retardos",
  "clinica/productos",
]);

/**
 * Inspect the first bytes of the buffer to verify the real file format.
 * Returns the detected MIME type or null if not recognised.
 */
function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) return "image/png";

  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return "image/gif";

  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf.length >= 12 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";

  // PDF: %PDF  (25 50 44 46)
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return "application/pdf";

  return null;
}

// The SDK reads CLOUDINARY_URL automatically — no manual config needed.

export const POST = async (req: Request) => {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, data: "No autenticado" }, { status: 401 });
  }

  let idUser: number;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET_SEED!));
    if (typeof payload.id_user !== "number" || !Number.isSafeInteger(payload.id_user) || payload.id_user <= 0) {
      return NextResponse.json({ ok: false, data: "Sesión inválida" }, { status: 401 });
    }
    idUser = payload.id_user;
  } catch {
    return NextResponse.json({ ok: false, data: "Sesión inválida" }, { status: 401 });
  }

  try {
    const users = await db.queryParams(
      `SELECT id_user FROM dbo.users
        WHERE id_user = @id_user AND status = 1 AND deleted_at IS NULL`,
      { id_user: idUser },
    );
    if (users.length === 0) {
      return NextResponse.json({ ok: false, data: "Usuario no autorizado" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, data: "No fue posible validar el usuario" }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") ?? "clinica/consultas";
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ ok: false, data: "Carpeta no permitida" }, { status: 400 });
    }
    const publicId = randomUUID();

    // ── 1. Validate declared Content-Type ──────────────────────────────────
    const declaredType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(declaredType)) {
      return NextResponse.json(
        { ok: false, data: "Tipo de archivo no permitido. Solo se aceptan imágenes y PDF." },
        { status: 415 },
      );
    }

    const chunks: Buffer[] = [];
    let size = 0;
    const reader = req.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_FILE_SIZE) {
            await reader.cancel().catch(() => {});
            return NextResponse.json(
              { ok: false, data: "El archivo supera el tamaño máximo de 5 MiB." },
              { status: 413 },
            );
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
    }
    const buffer = Buffer.concat(chunks, size);
    if (!buffer.length) {
      return NextResponse.json({ ok: false, data: "No se recibió ningún archivo" }, { status: 400 });
    }

    // ── 2. Validate actual bytes (prevents MIME spoofing) ──────────────────
    const detectedType = detectMimeFromBytes(buffer);
    if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
      return NextResponse.json(
        { ok: false, data: "El contenido del archivo no corresponde a una imagen o PDF válidos." },
        { status: 415 },
      );
    }

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, folder, resource_type: "auto", overwrite: false },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Upload falló"));
          else resolve(result as { secure_url: string });
        },
      );
      stream.end(buffer);
    });

    return NextResponse.json({ ok: true, data: result.secure_url });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { ok: false, data: "Error al subir el archivo" },
      { status: 500 },
    );
  }
};
