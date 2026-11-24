import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.JWT_SECRET_SEED = "upload-test-secret";
const secret = new TextEncoder().encode(process.env.JWT_SECRET_SEED);
let token: string | undefined;
let active = true;
let databaseFails = false;
let queries = 0;
let uploads: { options: Record<string, unknown>; bytes: number }[] = [];

mock.module("next/headers", { namedExports: { cookies: async () => ({
  get: () => token ? { value: token } : undefined,
}) } });
mock.module("@/database/connection", { defaultExport: { queryParams: async (sql: string, params: Record<string, number>) => {
  queries++;
  assert.match(sql, /status\s*=\s*1/i);
  assert.match(sql, /deleted_at\s+IS\s+NULL/i);
  assert.equal(params.id_user, 2);
  if (databaseFails) throw new Error("database unavailable");
  return active ? [{ id_user: 2 }] : [];
} } });
mock.module("cloudinary", { namedExports: { v2: { uploader: { upload_stream: (
  options: Record<string, unknown>, callback: (error: null, result: { secure_url: string }) => void,
) => ({ end: (buffer: Buffer) => {
  uploads.push({ options, bytes: buffer.length });
  callback(null, { secure_url: `https://example.test/${options.public_id}` });
} }), } } } });

async function main() {
  const { POST } = await import("../app/api/upload/route");
  const validToken = await new SignJWT({ id_user: 2 }).setProtectedHeader({ alg: "HS256" }).sign(secret);
  const expiredToken = await new SignJWT({ id_user: 2 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(1).sign(secret);
  const invalidIdToken = await new SignJWT({ id_user: "2" }).setProtectedHeader({ alg: "HS256" }).sign(secret);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const reset = () => { token = validToken; active = true; databaseFails = false; queries = 0; uploads = []; };
  const request = (path = "", body: Buffer = png, type = "image/png", length?: string) => new Request(`http://localhost/api/upload${path}`, {
    method: "POST", headers: { "content-type": type, ...(length === undefined ? {} : { "content-length": length }) }, body: new Uint8Array(body),
  });

  test("authentication and current user are checked before uploading", async () => {
    for (const invalid of [undefined, "invalid", expiredToken, invalidIdToken]) {
      reset(); token = invalid;
      assert.equal((await POST(request())).status, 401);
      assert.equal(queries, 0); assert.equal(uploads.length, 0);
    }
    reset(); active = false;
    assert.equal((await POST(request())).status, 403);
    assert.equal(uploads.length, 0);
    reset(); databaseFails = true;
    assert.equal((await POST(request())).status, 503);
    assert.equal(uploads.length, 0);
  });

  test("only exact allowed folders are accepted, with a default", async () => {
    reset();
    for (const folder of ["clinica/consultas", "clinica/facturas", "clinica/egresos", "clinica/recetas", "clinica/empleados", "clinica/empleados/documentos", "clinica/empleados/faltas", "clinica/empleados/retardos", "clinica/productos"]) {
      assert.equal((await POST(request(`?folder=${encodeURIComponent(folder)}`))).status, 200);
      assert.equal(uploads.at(-1)?.options.folder, folder);
    }
    assert.equal((await POST(request())).status, 200);
    assert.equal(uploads.at(-1)?.options.folder, "clinica/consultas");
    const count = uploads.length;
    for (const folder of ["", "clinica/productos/otro", "clinica/../productos", "CLINICA/productos"]) {
      assert.equal((await POST(request(`?folder=${encodeURIComponent(folder)}`))).status, 400);
    }
    assert.equal(uploads.length, count);
  });

  test("actual body size is limited regardless of Content-Length", async () => {
    reset();
    const limit = 5 * 1024 * 1024;
    const body = Buffer.alloc(limit + 1); png.copy(body);
    assert.equal((await POST(request("", body.subarray(0, limit)))).status, 200);
    assert.equal(uploads[0].bytes, limit);
    for (const length of [undefined, "1", String(limit)]) {
      assert.equal((await POST(request("", body, "image/png", length))).status, 413);
    }
    assert.equal(uploads.length, 1);
  });

  test("declared type and file signature must be allowed", async () => {
    reset();
    assert.equal((await POST(request("", png, "text/plain"))).status, 415);
    assert.equal((await POST(request("", Buffer.from("not an image")))).status, 415);
    assert.equal((await POST(request("", Buffer.alloc(0)))).status, 400);
    for (const [type, bytes] of [
      ["image/jpeg", [0xff, 0xd8, 0xff, 0x00]], ["image/gif", [0x47, 0x49, 0x46, 0x38]],
      ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
      ["application/pdf", [0x25, 0x50, 0x44, 0x46]],
    ] as const) assert.equal((await POST(request("", Buffer.from(bytes), type))).status, 200);
    assert.equal(uploads.length, 4);
  });

  test("client overwrite and name parameters cannot select an existing public ID", async () => {
    reset();
    const path = "?folder=clinica%2Fproductos&name=existing&overwrite=true";
    const first = await POST(request(path));
    const second = await POST(request(path));
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    assert.notEqual(uploads[0].options.public_id, uploads[1].options.public_id);
    for (const upload of uploads) {
      assert.match(String(upload.options.public_id), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.equal(upload.options.overwrite, false);
    }
    assert.notEqual((await first.json()).data, (await second.json()).data);
  });
}

void main();
