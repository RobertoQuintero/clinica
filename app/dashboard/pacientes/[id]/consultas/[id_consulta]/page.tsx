"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IArchivo } from "@/interfaces/archivos";
import { IConsulta } from "@/interfaces/consulta";
import { IConsultaProducto } from "@/interfaces/consulta_producto";
import { IPaciente } from "@/interfaces/paciente";
import { IPago } from "@/interfaces/pago";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { addZeroToday, buildDate, toDateTimeLocal } from "@/utils/date_helpper";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtDatetime = (val: Date | string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

const fmtDate = (val: Date | string) => {
  if (!val) return "—";
  const s = String(val).replace(" ", "T");
  return new Date(s.includes("T") ? s : s + "T00:00:00")
    .toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
};

// ─── types ───────────────────────────────────────────────────────────────────

type Tab = "general" | "valoracion" | "patologia" | "fotos" | "productos" | "pagar";

interface ConsultaProductoExtended extends IConsultaProducto {
  nombre_producto?: string;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ConsultaPage() {
  const { user }     = useAuth();
  const router       = useRouter();
  const params       = useParams();
  const id_paciente  = Number(params.id);
  const id_consulta  = Number(params.id_consulta);

  const [activeTab, setActiveTab] = useState<Tab>("general");

  // data
  const [consulta,   setConsulta  ] = useState<IConsulta | null>(null);
  const [paciente,   setPaciente  ] = useState<IPaciente | null>(null);
  const [valoracion, setValoracion] = useState<IValoracionPiel | null>(null);
  const [archivos,   setArchivos  ] = useState<IArchivo[]>([]);
  const [productos,  setProductos ] = useState<ConsultaProductoExtended[]>([]);
  const [pagos,      setPagos     ] = useState<IPago[]>([]);
  const [loading,    setLoading   ] = useState(true);
  const [patologia,  setPatologia ] = useState<IPatologiaUngueal | null>(null);

  // valoracion form
  const VALORACION_DEFAULTS: IValoracionPiel = {
    id_valoracion_piel: 0,
    id_consulta,
    fecha_valoracion:   addZeroToday(new Date()),
    edema:              false,
    dermatomicosis:     false,
    pie_atleta:         false,
    bromhidrosis:       false,
    hiperdrosis:        false,
    anhidrosis:         false,
    hiperqueratosis:    false,
    helomas:            false,
    verrugas:           false,
    observaciones:      "",
    status:             true,
    created_at:         buildDate(new Date()),
  };
  const [valoracionForm,    setValoracionForm   ] = useState<IValoracionPiel>(VALORACION_DEFAULTS);
  const [savingValoracion,  setSavingValoracion ] = useState(false);
  const [valoracionError,   setValoracionError  ] = useState<string | null>(null);

  // patologia form
  const PATOLOGIA_DEFAULTS: IPatologiaUngueal = {
    id_patologia:        0,
    id_consulta,
    anoniquia:           false,
    microniquia:         false,
    onicolisis:          false,
    onicauxis:           false,
    hematoma_subungueal: false,
    onicofosis:          false,
    paquioniquia:        false,
    onicomicosis:        false,
  };
  const [patologiaForm,   setPatologiaForm  ] = useState<IPatologiaUngueal>(PATOLOGIA_DEFAULTS);
  const [savingPatologia, setSavingPatologia] = useState(false);
  const [patologiaError,  setPatologiaError ] = useState<string | null>(null);

  // pago form
  const [pagoForm, setPagoForm] = useState<Omit<IPago, "id_pago" | "created_at" | "id_empresa">>({
    id_consulta,
    monto:       0,
    metodo_pago: "efectivo",
    fecha_pago:  addZeroToday(new Date()),
    referencia:  "",
  });
  const [savingPago, setSavingPago] = useState(false);
  const [pagoError,  setPagoError ] = useState<string | null>(null);

  // upload archivos
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const [uploadingFile,    setUploadingFile   ] = useState(false);
  const [uploadError,      setUploadError     ] = useState<string | null>(null);
  const [categoriaUpload,  setCategoriaUpload ] = useState("");

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cRes, vRes, patRes, aRes, pRes, pgRes, pacRes] = await Promise.all([
        fetch(`/api/consultas?id_consulta=${id_consulta}`),
        fetch(`/api/valoracion_piel?id_consulta=${id_consulta}`),
        fetch(`/api/patologia_ungueal?id_consulta=${id_consulta}`),
        fetch(`/api/archivos?id_consulta=${id_consulta}`),
        fetch(`/api/consulta_productos?id_consulta=${id_consulta}`),
        fetch(`/api/pagos?id_consulta=${id_consulta}`),
        fetch(`/api/pacientes?id_paciente=${id_paciente}`),
      ]);
      const [cData, vData, patData, aData, pData, pgData, pacData] = await Promise.all([
        cRes.json(), vRes.json(), patRes.json(), aRes.json(), pRes.json(), pgRes.json(), pacRes.json(),
      ]);
      if (cData.ok   && cData.data?.length)   setConsulta(cData.data[0]);
      if (pacData.ok && pacData.data?.length) setPaciente(pacData.data[0]);
      if (vData.ok   && vData.data?.length) {
        setValoracion(vData.data[0]);
        setValoracionForm(vData.data[0]);
      }
      if (patData.ok && patData.data?.length) {
        setPatologia(patData.data[0]);
        setPatologiaForm(patData.data[0]);
      }
      if (aData.ok)  setArchivos(aData.data  ?? []);
      if (pData.ok)  setProductos(pData.data ?? []);
      if (pgData.ok) setPagos(pgData.data    ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id_consulta]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── valoracion submit ──────────────────────────────────────────────────────

  const handleValoracionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingValoracion(true);
    setValoracionError(null);
    try {
      const res  = await fetch("/api/valoracion_piel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...valoracionForm,
          created_at: valoracionForm.created_at || buildDate(new Date()),
        } satisfies IValoracionPiel),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setValoracion(data.data);
      setValoracionForm(data.data);
    } catch (err: unknown) {
      setValoracionError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingValoracion(false);
    }
  };

  // ── patologia submit ───────────────────────────────────────────────────────

  const handlePatologiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPatologia(true);
    setPatologiaError(null);
    try {
      const res  = await fetch("/api/patologia_ungueal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patologiaForm satisfies IPatologiaUngueal),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setPatologia(data.data);
      setPatologiaForm(data.data);
    } catch (err: unknown) {
      setPatologiaError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingPatologia(false);
    }
  };

  // ── pago submit ────────────────────────────────────────────────────────────

  const handlePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoForm.monto || pagoForm.monto <= 0) {
      setPagoError("El monto debe ser mayor a 0");
      return;
    }
    setSavingPago(true);
    setPagoError(null);
    try {
      const res  = await fetch("/api/pagos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_pago:    0,
          id_consulta,
          monto:      pagoForm.monto,
          metodo_pago: pagoForm.metodo_pago,
          fecha_pago:  pagoForm.fecha_pago,
          referencia:  pagoForm.referencia,
          created_at:  buildDate(new Date()),
          id_empresa:  user?.id_empresa ?? 0,
        } satisfies IPago),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setPagos((prev) => [data.data, ...prev]);
      setPagoForm({
        id_consulta,
        monto:       0,
        metodo_pago: "efectivo",
        fecha_pago:  addZeroToday(new Date()),
        referencia:  "",
      });
    } catch (err: unknown) {
      setPagoError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingPago(false);
    }
  };

  // ── upload archivo ─────────────────────────────────────────────────────────

  const resizeImage = (file: File, maxWidth = 700, quality = 0.82): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img       = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale   = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas  = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas no disponible")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Error al comprimir imagen"))),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo leer la imagen"));
      };
      img.src = objectUrl;
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setUploadError(null);
    try {
      const isImage    = file.type.startsWith("image/");
      const fileToSend = isImage ? await resizeImage(file) : file;

      const sanitize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase();
      const baseName  = paciente
        ? `${sanitize(paciente.nombre)}_${sanitize(paciente.apellido_paterno)}_consulta${id_consulta}`
        : `paciente${id_paciente}_consulta${id_consulta}`;
      const seq      = archivos.length + 1;
      const ext      = isImage ? ".jpg" : ".pdf";
      const fileName = `${baseName}_${seq}${ext}`;

      const formData = new FormData();
      formData.append("file", fileToSend, fileName);

      const uploadRes  = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error(uploadData.data ?? "Error al subir el archivo");

      const tipo = file.type.startsWith("image/") ? "imagen" : "pdf";

      const archivoRes  = await fetch("/api/archivos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_archivo:  0,
          id_consulta,
          ruta:        String(uploadData.data),
          tipo,
          created_at:  buildDate(new Date()),
          categoria:   categoriaUpload.trim() || tipo,
        } satisfies IArchivo),
      });
      const archivoData = await archivoRes.json();
      if (!archivoData.ok) throw new Error(archivoData.data ?? "Error al registrar el archivo");

      setArchivos((prev) => [archivoData.data, ...prev]);
      setCategoriaUpload("");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── ui helpers ─────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: "general",   label: "1. General"              },
    { key: "valoracion",label: "2. Valoración de piel"   },
    { key: "patologia", label: "3. Patología ungueal"    },
    { key: "fotos",     label: "4. Fotos"                },
    { key: "productos", label: "5. Productos"            },
    { key: "pagar",     label: "6. Pagar"                },
  ];

  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const costoTotal  = Number(consulta?.costo_total ?? 0);
  const saldo       = costoTotal - totalPagado;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/dashboard/pacientes/${id_paciente}/expediente`)}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Expediente
        </button>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Consulta #{id_consulta}
          {consulta?.fecha && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              — {fmtDatetime(consulta.fecha)}
            </span>
          )}
        </h1>
      </div>

      {/* tab nav */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? "border-zinc-800 text-zinc-800 dark:border-zinc-200 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* tab content */}
      {loading ? (
        <p className="text-zinc-400 text-sm">Cargando...</p>
      ) : (
        <>
          {/* ── General ── */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {!consulta ? (
                <p className="text-zinc-400 text-sm">No se encontró la consulta.</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <dt className="text-zinc-500 font-medium">Fecha</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{fmtDatetime(consulta.fecha)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 font-medium">Costo total</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">${costoTotal.toFixed(2)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500 font-medium">Diagnóstico</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">{consulta.diagnostico || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500 font-medium">Tratamiento aplicado</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">{consulta.tratamiento_aplicado || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500 font-medium">Observaciones</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap">{consulta.observaciones || "—"}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          {/* ── Valoración de piel ── */}
          {activeTab === "valoracion" && (
            <form onSubmit={handleValoracionSubmit} className="space-y-6">
              {valoracionError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {valoracionError}
                </p>
              )}

              {/* fecha */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Fecha de valoración
                </label>
                <input
                  type="date"
                  value={String(valoracionForm.fecha_valoracion ?? "").slice(0, 10)}
                  onChange={(e) => setValoracionForm((f) => ({ ...f, fecha_valoracion: e.target.value }))}
                  required
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>

              {/* condiciones */}
              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">Condiciones</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(
                    [
                      ["edema",           "Edema"          ],
                      ["dermatomicosis",  "Dermatomicosis" ],
                      ["pie_atleta",      "Pie de atleta"  ],
                      ["bromhidrosis",    "Bromhidrosis"   ],
                      ["hiperdrosis",     "Hiperhidrosis"  ],
                      ["anhidrosis",      "Anhidrosis"     ],
                      ["hiperqueratosis", "Hiperqueratosis"],
                      ["helomas",         "Helomas"        ],
                      ["verrugas",        "Verrugas"       ],
                    ] as [keyof IValoracionPiel, string][]
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!valoracionForm[key]}
                        onChange={(e) => setValoracionForm((f) => ({ ...f, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* observaciones */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={valoracionForm.observaciones}
                  onChange={(e) => setValoracionForm((f) => ({ ...f, observaciones: e.target.value }))}
                  rows={3}
                  placeholder="Observaciones adicionales..."
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingValoracion}
                  className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500"
                >
                  {savingValoracion
                    ? "Guardando..."
                    : valoracionForm.id_valoracion_piel === 0
                      ? "Registrar valoración"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}

          {/* ── Patología ungueal ── */}
          {activeTab === "patologia" && (
            <form onSubmit={handlePatologiaSubmit} className="space-y-6">
              {patologiaError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {patologiaError}
                </p>
              )}

              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">Patologías</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(
                    [
                      ["anoniquia",           "Anoniquia"          ],
                      ["microniquia",         "Microniquia"        ],
                      ["onicolisis",          "Onicolisis"         ],
                      ["onicauxis",           "Onicauxis"          ],
                      ["hematoma_subungueal", "Hematoma subungueal"],
                      ["onicofosis",          "Onicofosis"         ],
                      ["paquioniquia",        "Paquioniquia"       ],
                      ["onicomicosis",        "Onicomicosis"       ],
                    ] as [keyof IPatologiaUngueal, string][]
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!patologiaForm[key]}
                        onChange={(e) => setPatologiaForm((f) => ({ ...f, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPatologia}
                  className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500"
                >
                  {savingPatologia
                    ? "Guardando..."
                    : patologiaForm.id_patologia === 0
                      ? "Registrar patología"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}

          {/* ── Fotos ── */}
          {activeTab === "fotos" && (
            <div className="space-y-4">

              {/* upload */}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Categoría (opcional)
                  </label>
                  <input
                    type="text"
                    value={categoriaUpload}
                    onChange={(e) => setCategoriaUpload(e.target.value)}
                    placeholder="ej. pie derecho"
                    disabled={uploadingFile}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500 whitespace-nowrap"
                >
                  {uploadingFile ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                      </svg>
                      Subir imagen / PDF
                    </>
                  )}
                </button>
                {uploadError && (
                  <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    {uploadError}
                  </p>
                )}
              </div>

              {archivos.length === 0 ? (
                <p className="text-zinc-400 text-sm">Sin archivos registrados.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                    <thead className="bg-zinc-100 dark:bg-zinc-800">
                      <tr>
                        {["#", "Categoría", "Tipo", "Ruta", "Fecha"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                      {archivos.map((a) => (
                        <tr key={a.id_archivo} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3 text-zinc-500">{a.id_archivo}</td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{a.categoria || "—"}</td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{a.tipo || "—"}</td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">
                            <a href={a.ruta} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                              {a.ruta}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{fmtDatetime(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Productos ── */}
          {activeTab === "productos" && (
            <div className="space-y-4">
              {productos.length === 0 ? (
                <p className="text-zinc-400 text-sm">Sin productos registrados.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                      <thead className="bg-zinc-100 dark:bg-zinc-800">
                        <tr>
                          {["Producto", "Cantidad", "Precio unit.", "Subtotal", "Estatus"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                        {productos.map((p) => (
                          <tr key={p.id_consulta_producto} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre_producto || `#${p.id_producto}`}</td>
                            <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.cantidad}</td>
                            <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">${Number(p.precio).toFixed(2)}</td>
                            <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">${(Number(p.precio) * Number(p.cantidad)).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.status === "activo"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                              }`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Total productos: ${productos.reduce((s, p) => s + Number(p.precio) * Number(p.cantidad), 0).toFixed(2)}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Pagar ── */}
          {activeTab === "pagar" && (
            <div className="space-y-6">
              {/* resumen */}
              <div className="grid grid-cols-3 gap-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-center text-sm">
                <div>
                  <p className="text-zinc-500">Costo total</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">${costoTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Pagado</p>
                  <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">${totalPagado.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Saldo</p>
                  <p className={`mt-1 text-lg font-semibold ${saldo > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    ${saldo.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* pagos registrados */}
              {pagos.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                    <thead className="bg-zinc-100 dark:bg-zinc-800">
                      <tr>
                        {["#", "Fecha", "Método", "Monto", "Referencia"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                      {pagos.map((pg) => (
                        <tr key={pg.id_pago} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3 text-zinc-500">{pg.id_pago}</td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(pg.fecha_pago)}</td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 capitalize">{pg.metodo_pago}</td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 font-medium">${Number(pg.monto).toFixed(2)}</td>
                          <td className="px-4 py-3 text-zinc-500">{pg.referencia || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* nuevo pago */}
              {saldo > 0 && (
                <form onSubmit={handlePagoSubmit} className="space-y-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Registrar pago</h3>

                  {pagoError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      {pagoError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Monto</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={saldo}
                        value={pagoForm.monto || ""}
                        onChange={(e) => setPagoForm((f) => ({ ...f, monto: Number(e.target.value) }))}
                        required
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Método de pago</label>
                      <select
                        value={pagoForm.metodo_pago}
                        onChange={(e) => setPagoForm((f) => ({ ...f, metodo_pago: e.target.value }))}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Fecha de pago</label>
                      <input
                        type="date"
                        value={String(pagoForm.fecha_pago ?? "").slice(0, 10)}
                        onChange={(e) => setPagoForm((f) => ({ ...f, fecha_pago: e.target.value }))}
                        required
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Referencia</label>
                      <input
                        type="text"
                        value={pagoForm.referencia}
                        onChange={(e) => setPagoForm((f) => ({ ...f, referencia: e.target.value }))}
                        placeholder="Opcional"
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPago}
                      className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    >
                      {savingPago ? "Guardando..." : "Registrar pago"}
                    </button>
                  </div>
                </form>
              )}

              {saldo <= 0 && pagos.length > 0 && (
                <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
                  Consulta pagada en su totalidad ✓
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
