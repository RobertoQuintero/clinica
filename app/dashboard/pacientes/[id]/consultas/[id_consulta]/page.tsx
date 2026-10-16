"use client";

import { IArchivo } from "@/interfaces/archivos";
import { IConsulta } from "@/interfaces/consulta";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import { IPaciente } from "@/interfaces/paciente";
import { IPago } from "@/interfaces/pago";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IProceso } from "@/interfaces/proceso";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { createWebId } from "@/utils/random";
import { getConsultaData, getMetodosPago, savePago, savePatologia, saveOnicocriptosisDetalle, saveOnicomicosisDetalle, saveValoracion, updateCitaEstado, updateConsultaCosto, updateConsultaFechaFin, updateProcesoField, eliminarPago, editarPago, EditarPagoData, updateTratamientoOnicomicosisMessage } from "./actions";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import TabFotos from "./componentes/TabFotos";
import TabGeneral from "./componentes/TabGeneral";
import TabPagar from "./componentes/TabPagar";
import TabPatologia from "./componentes/TabPatologia";
import {
  buildDedosVacios,
  detalleRowsToFormState,
  formStateToDetalleRows,
  OnicocriptosisFormState,
} from "./componentes/OnicocriptosisPies";
import {
  buildDedosVacios as buildDedosVaciosOnicomicosis,
  detalleRowsToFormState as detalleRowsToFormStateOnicomicosis,
  formStateToDetalleRows as formStateToDetalleRowsOnicomicosis,
  OnicomicosisFormState,
} from "./componentes/OnicomicosisPies";
import TabProductos from "./componentes/TabProductos";
import TabServicios from "./componentes/TabServicios";
import TabValoracion from "./componentes/TabValoracion";
import { fmtDatetime } from "./componentes/helpers";

// ─── types ───────────────────────────────────────────────────────────────────

type Tab = "general" | "valoracion" | "patologia" | "servicios" | "fotos_valoracion" | "productos" | "fotos_pedicure" | "pagar";

// Vacíos estables para cuando no hay datos: TabPagar compara la identidad de sus opciones en el render.
const NO_ARCHIVOS: IArchivo[] = [];
const NO_PAGOS: IPago[] = [];
const NO_METODOS_PAGO: IMetodoPago[] = [];

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ConsultaPage() {
  const { user }     = useAuth();
  const router       = useRouter();
  const params       = useParams();
  const id_paciente  = Number(params.id);
  const id_consulta  = Number(params.id_consulta);

  const [activeTab, setActiveTab] = useState<Tab>("general");

  // data: vive en el hook; los cambios locales después de guardar usan mutateConsultaData
  const consultaDataKey = [id_consulta, id_paciente] as const;
  const consultaData = useAsyncData(consultaDataKey, async () => {
    const [data, metodosPago] = await Promise.all([
      getConsultaData(id_consulta, id_paciente),
      getMetodosPago(),
    ]);
    return { ...data, metodosPago };
  });
  const { loading, mutate: mutateConsultaData } = consultaData;
  const consulta:    IConsulta | null         = consultaData.data?.consulta ?? null;
  const paciente:    IPaciente | null         = consultaData.data?.paciente ?? null;
  const valoracion:  IValoracionPiel | null   = consultaData.data?.valoracion ?? null;
  const archivos:    IArchivo[]               = consultaData.data?.archivos ?? NO_ARCHIVOS;
  const pagos:       IPago[]                  = consultaData.data?.pagos ?? NO_PAGOS;
  const patologia:   IPatologiaUngueal | null = consultaData.data?.patologia ?? null;
  const proceso:     IProceso | null          = consultaData.data?.proceso ?? null;
  const metodosPago: IMetodoPago[]            = consultaData.data?.metodosPago ?? NO_METODOS_PAGO;

  const updateProceso = (nextProceso: IProceso) =>
    mutateConsultaData((current) => ({ ...current, proceso: nextProceso }));
  const updateConsultaFechaFinLocally = (fechaFin: string) =>
    mutateConsultaData((current) =>
      current.consulta ? { ...current, consulta: { ...current.consulta, fecha_fin: fechaFin } } : current,
    );

  // valoracion form
  const VALORACION_DEFAULTS: IValoracionPiel = {
    id_valoracion_piel: 0,
    id_consulta,
    fecha_valoracion:   addZeroToday(new Date()),
    edema:              false,
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
    onicomicosis_grado_1: false,
    onicomicosis_grado_2: false,
    onicocriptosis:      false,
  };
  const [patologiaForm,   setPatologiaForm  ] = useState<IPatologiaUngueal>(PATOLOGIA_DEFAULTS);
  const [savingPatologia, setSavingPatologia] = useState(false);
  const [patologiaError,  setPatologiaError ] = useState<string | null>(null);

  // onicocriptosis detalle form (dentro de patologia)
  const [onicocriptosisForm, setOnicocriptosisForm] = useState<OnicocriptosisFormState>({
    dedos: buildDedosVacios(),
    dolor: 0,
  });

  // onicomicosis detalle form (dentro de patologia)
  const [onicomicosisForm, setOnicomicosisForm] = useState<OnicomicosisFormState>({
    dedos: buildDedosVaciosOnicomicosis(),
  });

  // pago form
  const [pagoForm, setPagoForm] = useState<Omit<IPago, "id_pago" | "created_at" | "id_empresa">>({
    id_consulta,
    monto:        0,
    idMetodoPago: 0,
    fecha_pago:   addZeroToday(new Date()),
    referencia:   "",
    webid:        createWebId(20),
    facturado:    false,
    uuid_cfdi:    null,
id_usuario_elimino: null,
    status:       true,
  });
  const [savingPago, setSavingPago] = useState(false);
  const [pagoError,  setPagoError ] = useState<string | null>(null);
  const [deletingPagoId, setDeletingPagoId] = useState<number | null>(null);

  // ── formularios: se llenan en el render cuando llegan los datos de una consulta nueva ──

  const serializedConsultaDataKey = JSON.stringify(consultaDataKey);
  const [formsInitializedForKey, setFormsInitializedForKey] = useState<string | null>(null);
  if (consultaData.data && formsInitializedForKey !== serializedConsultaDataKey) {
    const loadedData = consultaData.data;
    setFormsInitializedForKey(serializedConsultaDataKey);
    if (loadedData.valoracion) setValoracionForm(loadedData.valoracion);
    if (loadedData.patologia)  setPatologiaForm(loadedData.patologia);
    if (loadedData.onicocriptosisDetalle.length > 0) {
      setOnicocriptosisForm(detalleRowsToFormState(loadedData.onicocriptosisDetalle));
    }
    if (loadedData.onicomicosisDetalle.length > 0) {
      setOnicomicosisForm(detalleRowsToFormStateOnicomicosis(loadedData.onicomicosisDetalle));
    }
  }

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
      const savedValoracion = result.data;
      mutateConsultaData((current) => ({ ...current, valoracion: savedValoracion }));
      setValoracionForm(savedValoracion);
      // mark step complete and advance
      const procResult = await updateProcesoField(id_consulta, "valoracion_piel", 1);
      if (procResult.ok) updateProceso(procResult.data);
      setActiveTab("patologia");
    } catch (err: unknown) {
      setValoracionError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingValoracion(false);
    }
  };

  // ── patologia submit ───────────────────────────────────────────────────────

  const handlePatologiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dedosConGrado = onicocriptosisForm.dedos.filter((d) => d.grado !== null);
    if (dedosConGrado.length > 0 && (onicocriptosisForm.dolor < 1 || onicocriptosisForm.dolor > 10)) {
      setPatologiaError("Selecciona un nivel de dolor (1-10) para la valoración de onicocriptosis");
      return;
    }

    const dedosOnicomicosisMarcados = onicomicosisForm.dedos.filter((d) => d.marcado);
    if (
      (patologiaForm.onicomicosis_grado_1 || patologiaForm.onicomicosis_grado_2) &&
      dedosOnicomicosisMarcados.length === 0
    ) {
      setPatologiaError("Selecciona al menos un dedo para la valoración de onicomicosis");
      return;
    }

    setSavingPatologia(true);
    setPatologiaError(null);
    try {
      const result = await savePatologia(patologiaForm);
      if (!result.ok) throw new Error(result.data);
      const savedPatologia = result.data;
      mutateConsultaData((current) => ({ ...current, patologia: savedPatologia }));
      setPatologiaForm(savedPatologia);

      const onicoResult = await saveOnicocriptosisDetalle(
        id_consulta,
        formStateToDetalleRows(onicocriptosisForm),
      );
      if (!onicoResult.ok) throw new Error(onicoResult.data);

      const onicomicosisResult = await saveOnicomicosisDetalle(
        id_consulta,
        formStateToDetalleRowsOnicomicosis(onicomicosisForm),
      );
      if (!onicomicosisResult.ok) throw new Error(onicomicosisResult.data);

      // mark step complete and advance
      const procResult = await updateProcesoField(id_consulta, "patologia_ungueal", 1);
      if (procResult.ok) updateProceso(procResult.data);
      setActiveTab("servicios");
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
    if (!pagoForm.idMetodoPago || pagoForm.idMetodoPago === 0) {
      setPagoError("Selecciona un método de pago de la lista");
      return;
    }
    setSavingPago(true);
    setPagoError(null);
    try {
      await updateConsultaCosto(id_consulta, totalGeneral);
      const fechaFin = buildDate(new Date());
      await updateConsultaFechaFin(id_consulta, fechaFin);
      updateConsultaFechaFinLocally(fechaFin);
      const result = await savePago(pagoForm);
      if (!result.ok) throw new Error(result.data);
      const savedPago = result.data;
      mutateConsultaData((current) => ({ ...current, pagos: [savedPago, ...current.pagos] }));
      if (consulta?.id_cita) {
        await updateCitaEstado(consulta.id_cita, "atendida");
      }
      setPagoForm({
        id_consulta,
        monto:        0,
        idMetodoPago: 0,
        fecha_pago:   addZeroToday(new Date()),
        referencia:   "",
        webid:        createWebId(20),
        facturado:    false,
        uuid_cfdi:    null,
        id_usuario_elimino: null,
        status:       true,
      });
    } catch (err: unknown) {
      setPagoError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingPago(false);
    }
  };

  // ── ui helpers ─────────────────────────────────────────────────────────────

  /** True when proceso is paid and current user is not admin or supervisor */
  const locked = (!!proceso?.pagar && user?.id_role !== 1 && user?.id_role !== 4) || !!consulta?.cancelada;

  /** Returns whether a tab is accessible based on proceso progress */
  const isTabAccessible = (tab: Tab): boolean => {
    if (!proceso) return true; // legacy consultation without proceso → all accessible
    switch (tab) {
      case "general":
      case "valoracion":
        return true;
      case "patologia":
        return !!proceso.valoracion_piel;
      case "servicios":
        return !!proceso.patologia_ungueal;
      case "productos":
        return !!proceso.servicios;
      case "fotos_valoracion":
        return !!proceso.productos;
      case "fotos_pedicure":
        return !!proceso.fotos_valoracion;
      case "pagar":
        return !!proceso.fotos_pedicure;
      default:
        return false;
    }
  };

  const handleContinuar = async (field: "servicios" | "productos" | "fotos_valoracion" | "fotos_pedicure", nextTab: Tab) => {
    const procResult = await updateProcesoField(id_consulta, field, 1);
    if (procResult.ok) updateProceso(procResult.data);
    setActiveTab(nextTab);
  };

  const handleFinalizar = async () => {
    const procResult = await updateProcesoField(id_consulta, "pagar", 1);
    if (procResult.ok) {
      if (consulta?.is_onicomicosis && consulta?.id_tratamiento) {
        await updateTratamientoOnicomicosisMessage(consulta.id_tratamiento);
      }
      // Actualizar fecha_fin con hora actual
      const fechaFin = buildDate(new Date());
      const fechaFinResult = await updateConsultaFechaFin(id_consulta, fechaFin);
      if (fechaFinResult.ok) {
        updateConsultaFechaFinLocally(fechaFin);
      }
      updateProceso(procResult.data);
      setActiveTab("general");
    }
  };

  const handleEliminarPago = async (id_pago: number) => {
    if (!user) return;
    setDeletingPagoId(id_pago);
    try {
      const result = await eliminarPago(id_pago, user.id_user);
      if (result.ok) {
        const deletedPago = result.data;
        mutateConsultaData((current) => ({
          ...current,
          pagos: current.pagos.map((p) => p.id_pago === id_pago ? deletedPago : p),
        }));
      }
    } finally {
      setDeletingPagoId(null);
    }
  };

  const handleEditarPago = async (id_pago: number, data: EditarPagoData) => {
    const result = await editarPago(id_pago, data);
    if (!result.ok) throw new Error(typeof result.data === "string" ? result.data : "Error al editar el pago");
    const editedPago = result.data as IPago;
    mutateConsultaData((current) => ({
      ...current,
      pagos: current.pagos.map((p) => p.id_pago === id_pago ? editedPago : p),
    }));
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "general",         label: "1. General"              },
    { key: "valoracion",      label: "2. Valoración de piel"   },
    { key: "patologia",       label: "3. Patología ungueal"    },
    { key: "servicios",       label: "4. Servicios"            },
    { key: "productos",       label: "5. Productos"            },
    { key: "fotos_valoracion",label: "6. Fotos Valoración"     },
    { key: "fotos_pedicure",  label: "7. Fotos Pedicure"       },
    { key: "pagar",           label: "8. Pagar"                },
  ];

  const totalPagado    = pagos.filter((p) => p.status).reduce((s, p) => s + Number(p.monto), 0);
  const costoTotal     = Number(consulta?.costo_total ?? 0);
  const [totalServicios, setTotalServicios] = useState(costoTotal);
  const [totalProductos, setTotalProductos] = useState(0);
  const totalGeneral   = totalServicios + totalProductos;
  const saldo          = totalGeneral - totalPagado;
  const hasInvoicedPaymentOnFinalizedConsulta =
    !!consulta?.fecha_fin && pagos.some((pago) => pago.status && pago.facturado);

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
              {consulta.fecha_fin && (() => {
                const ms = new Date(String(consulta.fecha_fin).replace(" ", "T")).getTime()
                         - new Date(String(consulta.created_at).replace(" ", "T")).getTime();
                const mins = Math.round(ms / 60000);
                if (mins <= 0) return null;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const dur = h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m} min`;
                return <span className="ml-2 text-zinc-400">({dur})</span>;
              })()}
            </span>
          )}
        </h1>
        <span className="ml-auto text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Total: <span className="font-semibold">${totalGeneral.toFixed(2)}</span>
          {/* {saldo > 0 && (
            <span className="ml-2 text-red-500 dark:text-red-400">
              Saldo: ${saldo.toFixed(2)}
            </span>
          )} */}
          {saldo <= 0 && costoTotal > 0 && (
            <span className="ml-2 text-green-600 dark:text-green-400">Pagado</span>
          )}
        </span>
      </div>

      {hasInvoicedPaymentOnFinalizedConsulta && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          Esta consulta tiene un pago facturado. El costo total no se actualiza al modificar servicios o productos.
        </div>
      )}

      {/* tab nav */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(({ key, label }) => {
            const accessible = isTabAccessible(key);
            return (
              <button
                key={key}
                onClick={() => accessible && setActiveTab(key)}
                disabled={!accessible}
                title={!accessible ? "Completa el paso anterior primero" : undefined}
                className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? "border-zinc-800 text-zinc-800 dark:border-zinc-200 dark:text-zinc-100"
                    : accessible
                      ? "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:hover:text-zinc-300"
                      : "border-transparent text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* tab content */}
      {loading ? (
        <p className="text-zinc-400 text-sm">Cargando...</p>
      ) : (
        <>
          {activeTab === "general"    && (
            <TabGeneral
              consulta={consulta}
              paciente={paciente}
              valoracion={valoracion}
              patologia={patologia}
              onServiciosTotalChange={setTotalServicios}
              onProductosTotalChange={setTotalProductos}
              pagado={!!proceso?.pagar}
            />
          )}
          {activeTab === "valoracion" && (
            <TabValoracion
              form={valoracionForm}
              onChange={setValoracionForm}
              saving={savingValoracion}
              error={valoracionError}
              onSubmit={handleValoracionSubmit}
              locked={locked}
            />
          )}
          {activeTab === "patologia"  && (
            <TabPatologia
              form={patologiaForm}
              onChange={setPatologiaForm}
              saving={savingPatologia}
              error={patologiaError}
              onSubmit={handlePatologiaSubmit}
              locked={locked}
              detalle={onicocriptosisForm}
              onDetalleChange={setOnicocriptosisForm}
              detalleOnicomicosis={onicomicosisForm}
              onDetalleOnicomicosisChange={setOnicomicosisForm}
            />
          )}
          {activeTab === "servicios"  && (
            <TabServicios
              id_consulta={id_consulta}
              locked={locked}
              onContinuar={() => handleContinuar("servicios", "productos")}
              onTotalChange={setTotalServicios}
            />
          )}
          {activeTab === "fotos_valoracion" && (
            <TabFotos
              archivos={archivos}
              onAddArchivo={(a) => mutateConsultaData((current) => ({ ...current, archivos: [a, ...current.archivos] }))}
              paciente={paciente}
              id_paciente={id_paciente}
              id_consulta={id_consulta}
              categoria="VALORACION"
              locked={locked}
              onContinuar={() => handleContinuar("fotos_valoracion", "fotos_pedicure")}
              is_onicomicosis={!!consulta?.is_onicomicosis}
            />
          )}
          {activeTab === "productos"  && (
            <TabProductos
              id_consulta={id_consulta}
              locked={locked}
              onContinuar={() => handleContinuar("productos", "fotos_valoracion")}
              onTotalChange={setTotalProductos}
            />
          )}
          {activeTab === "fotos_pedicure" && (
            <TabFotos
              archivos={archivos}
              onAddArchivo={(a) => mutateConsultaData((current) => ({ ...current, archivos: [a, ...current.archivos] }))}
              paciente={paciente}
              id_paciente={id_paciente}
              id_consulta={id_consulta}
              categoria="PEDICURE"
              locked={locked}
              onContinuar={() => handleContinuar("fotos_pedicure", "pagar")}
              is_onicomicosis={!!consulta?.is_onicomicosis}
            />
          )}
          {activeTab === "pagar"      && (
            <TabPagar
              totalPagado={totalPagado}
              saldo={saldo}
              pagos={pagos}
              pagoForm={pagoForm}
              onPagoFormChange={setPagoForm}
              saving={savingPago}
              error={pagoError}
              onSubmit={handlePagoSubmit}
              locked={locked}
              onFinalizar={handleFinalizar}
              procesoPagado={!!proceso?.pagar}
              metodoPagoOptions={metodosPago}
              canDelete={user?.id_role === 1 || user?.id_role === 4}
              onEliminarPago={handleEliminarPago}
              deletingPagoId={deletingPagoId}
              canEdit={user?.id_role === 1 || user?.id_role === 4}
              onEditarPago={handleEditarPago}
            />
          )}
        </>
      )}
    </div>
  );
}
