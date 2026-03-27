import { NextResponse } from "next/server";

export const POST = async (req: Request) => {
  try {
    const storageUrl = process.env.STORAGE_URL;
    if (!storageUrl) {
      return NextResponse.json({ ok: false, data: "STORAGE_URL no configurada" }, { status: 500 });
    }

    const formData = await req.formData();

    const res = await fetch(storageUrl, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.log({ error });
    return NextResponse.json(
      { ok: false, data: "Error al subir el archivo" },
      { status: 500 }
    );
  }
};
