"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IArchivo } from "@/interfaces/archivos";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { IPago } from "@/interfaces/pago";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TabFotos from "./componentes/TabFotos";
import TabGeneral from "./componentes/TabGeneral";
import TabPagar from "./componentes/TabPagar";
import TabPatologia from "./componentes/TabPatologia";
import { ConsultaProductoExtended } from "./componentes/TabProductos";
import TabProductos from "./componentes/TabProductos";
import TabServicios from "./componentes/TabServicios";
import TabValoracion from "./componentes/TabValoracion";
import { fmtDatetime } from "./componentes/helpers";

// ─── types ───────────────────────────────────────────────────────────────────

type Tab = "general" | "valoracion" | "patologia" | "servicios" | "fotos" | "productos" | "pagar";

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

  // ── ui helpers ─────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: "general",   label: "1. General"              },
    { key: "valoracion",label: "2. Valoración de piel"   },
    { key: "patologia", label: "3. Patología ungueal"    },
    { key: "servicios", label: "4. Servicios"            },
    { key: "fotos",     label: "5. Fotos"                },
    { key: "productos", label: "6. Productos"            },
    { key: "pagar",     label: "7. Pagar"                },
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
          {activeTab === "general"    && (
            <TabGeneral consulta={consulta} costoTotal={costoTotal} />
          )}
          {activeTab === "valoracion" && (
            <TabValoracion
              form={valoracionForm}
              onChange={setValoracionForm}
              saving={savingValoracion}
              error={valoracionError}
              onSubmit={handleValoracionSubmit}
            />
          )}
          {activeTab === "patologia"  && (
            <TabPatologia
              form={patologiaForm}
              onChange={setPatologiaForm}
              saving={savingPatologia}
              error={patologiaError}
              onSubmit={handlePatologiaSubmit}
            />
          )}
          {activeTab === "servicios"  && (
            <TabServicios id_consulta={id_consulta} />
          )}
          {activeTab === "fotos"      && (
            <TabFotos
              archivos={archivos}
              onAddArchivo={(a) => setArchivos((prev) => [a, ...prev])}
              paciente={paciente}
              id_paciente={id_paciente}
              id_consulta={id_consulta}
            />
          )}
          {activeTab === "productos"  && (
            <TabProductos productos={productos} />
          )}
          {activeTab === "pagar"      && (
            <TabPagar
              costoTotal={costoTotal}
              totalPagado={totalPagado}
              saldo={saldo}
              pagos={pagos}
              pagoForm={pagoForm}
              onPagoFormChange={setPagoForm}
              saving={savingPago}
              error={pagoError}
              onSubmit={handlePagoSubmit}
            />
          )}
        </>
      )}
    </div>
  );
}
