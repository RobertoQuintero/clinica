"use client";

import { IArchivo } from "@/interfaces/archivos";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { IPago } from "@/interfaces/pago";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { getConsultaData, savePago, savePatologia, saveValoracion } from "./actions";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TabFotos from "./componentes/TabFotos";
import TabGeneral from "./componentes/TabGeneral";
import TabPagar from "./componentes/TabPagar";
import TabPatologia from "./componentes/TabPatologia";
import TabProductos from "./componentes/TabProductos";
import TabServicios from "./componentes/TabServicios";
import TabValoracion from "./componentes/TabValoracion";
import { fmtDatetime } from "./componentes/helpers";

// ─── types ───────────────────────────────────────────────────────────────────

type Tab = "general" | "valoracion" | "patologia" | "servicios" | "fotos_valoracion" | "productos" | "fotos_pedicure" | "pagar";

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ConsultaPage() {
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
      const data = await getConsultaData(id_consulta, id_paciente);
      if (data.consulta)   setConsulta(data.consulta);
      if (data.paciente)   setPaciente(data.paciente);
      if (data.valoracion) { setValoracion(data.valoracion); setValoracionForm(data.valoracion); }
      if (data.patologia)  { setPatologia(data.patologia);  setPatologiaForm(data.patologia);  }
      setArchivos(data.archivos);
      setPagos(data.pagos);
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
      const result = await saveValoracion({
        ...valoracionForm,
        created_at: valoracionForm.created_at || buildDate(new Date()),
      });
      if (!result.ok) throw new Error(result.data);
      setValoracion(result.data);
      setValoracionForm(result.data);
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
      const result = await savePatologia(patologiaForm);
      if (!result.ok) throw new Error(result.data);
      setPatologia(result.data);
      setPatologiaForm(result.data);
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
      const result = await savePago(pagoForm);
      if (!result.ok) throw new Error(result.data);
      setPagos((prev) => [result.data, ...prev]);
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
    { key: "general",         label: "1. General"              },
    { key: "valoracion",      label: "2. Valoración de piel"   },
    { key: "patologia",       label: "3. Patología ungueal"    },
    { key: "servicios",       label: "4. Servicios"            },
    { key: "fotos_valoracion",label: "5. Fotos Valoración"     },
    { key: "productos",       label: "6. Productos"            },
    { key: "fotos_pedicure",  label: "7. Fotos Pedicure"       },
    { key: "pagar",           label: "8. Pagar"                },
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
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          {activeTab === "fotos_valoracion" && (
            <TabFotos
              archivos={archivos}
              onAddArchivo={(a) => setArchivos((prev) => [a, ...prev])}
              paciente={paciente}
              id_paciente={id_paciente}
              id_consulta={id_consulta}
              categoria="VALORACION"
            />
          )}
          {activeTab === "productos"  && (
            <TabProductos id_consulta={id_consulta} />
          )}
          {activeTab === "fotos_pedicure" && (
            <TabFotos
              archivos={archivos}
              onAddArchivo={(a) => setArchivos((prev) => [a, ...prev])}
              paciente={paciente}
              id_paciente={id_paciente}
              id_consulta={id_consulta}
              categoria="PEDICURE"
            />
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
