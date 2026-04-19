import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// The SDK reads CLOUDINARY_URL automatically — no manual config needed.

export const POST = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("name") ?? "archivo";
    // Strip extension to use as public_id; Cloudinary adds the extension itself.
    const publicId = `clinica/consultas/${fileName.replace(/\.[^.]+$/, "")}`;

    const buffer = Buffer.from(await req.arrayBuffer());
    if (!buffer.length) {
      return NextResponse.json({ ok: false, data: "No se recibió ningún archivo" }, { status: 400 });
    }

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: "auto", overwrite: false },
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
