"use client";

import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { useEffect, useRef, useState } from "react";
import {
  ConsultaProductoExtended,
  GeneralTabData,
  ServicioResumen,
  getGeneralTabData,
} from "../actions";

// ─── helpers ──────────────────────────────────────────────────────────────────

const calcEdad = (fechaNacimiento: string | Date): number => {
  const s = String(fechaNacimiento).slice(0, 10) + "T00:00:00";
  const birth = new Date(s);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

function trueBoolLabels<T extends object>(
  obj: T,
  map: Partial<Record<keyof T, string>>,
): string[] {
  return (Object.keys(map) as (keyof T)[])
    .filter((k) => obj[k] === true || (obj[k] as unknown) === 1)
    .map((k) => map[k] as string);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {label}
    </span>
  );
}

// ─── props ────────────────────────────────────────────────────────────────────

interface Props {
  consulta:   IConsulta          | null;
  paciente:   IPaciente          | null;
  valoracion: IValoracionPiel    | null;
  patologia:  IPatologiaUngueal  | null;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function TabGeneral({ consulta, paciente, valoracion, patologia }: Props) {
  const [antecedentes,    setAntecedentes   ] = useState<IAntecedenteMedico | null>(null);
  const [serviciosUsados, setServiciosUsados] = useState<ServicioResumen[]>([]);
  const [productos,       setProductos      ] = useState<ConsultaProductoExtended[]>([]);
  const [nombrePodologo,  setNombrePodologo ] = useState<string | null>(null);
  const [sucursalNombre,  setSucursalNombre ] = useState<string | null>(null);
  const [sucursalCiudad,  setSucursalCiudad ] = useState<string | null>(null);
  const [loading,         setLoading        ] = useState(true);
  const [exporting,       setExporting      ] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!consulta) return;
    setLoading(true);
    getGeneralTabData(
      consulta.id_consulta,
      consulta.id_paciente,
      consulta.id_podologo,
      consulta.id_sucursal,
    ).then((d: GeneralTabData) => {
      setAntecedentes(d.antecedentes);
      setServiciosUsados(d.serviciosUsados);
      setProductos(d.productos);
      setNombrePodologo(d.nombrePodologo);
      setSucursalNombre(d.sucursalNombre);
      setSucursalCiudad(d.sucursalCiudad);
      setLoading(false);
    });
  }, [consulta?.id_consulta]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportImage = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const domtoimage = (await import("dom-to-image-more")).default;
      const canvas = await domtoimage.toCanvas(contentRef.current, { scale: 2 });
      const link = document.createElement("a");
      link.download = `consulta-general.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
    }
  };

  if (!paciente || !consulta) {
    return <p className="text-zinc-400 text-sm">No se encontró información.</p>;
  }

  // ── derived values ──────────────────────────────────────────────────────────

  const nombreCompleto = [paciente.nombre, paciente.apellido_paterno, paciente.apellido_materno]
    .filter(Boolean).join(" ");

  const sexoLabel =
    paciente.sexo === "M" ? "Masculino"
    : paciente.sexo === "F" ? "Femenino"
    : paciente.sexo ?? "—";

  const edad = paciente.fecha_nacimiento ? calcEdad(paciente.fecha_nacimiento) : null;

  const antChips = antecedentes
    ? trueBoolLabels(antecedentes, {
        alergia_anestesia:           "Alergia a anestesia",
        alergia_antibioticos:        "Alergia a antibióticos",
        alergia_sulfas:              "Alergia a sulfas",
        alergia_latex:               "Alergia a látex",
        diabetico:                   "Diabético",
        hipertenso:                  "Hipertenso",
        hipotiroidismo:              "Hipotiroidismo",
        cancer:                      "Cáncer",
        embarazada:                  "Embarazada",
        lactando:                    "Lactando",
        fracturas:                   "Fracturas",
        antecedentes_dermatologicos: "Antecedentes dermatológicos",
      })
    : [];

  const valoracionChips = valoracion
    ? trueBoolLabels(valoracion, {
        edema:           "Edema",
        dermatomicosis:  "Dermatomicosis",
        pie_atleta:      "Pie de atleta",
        bromhidrosis:    "Bromhidrosis",
        hiperdrosis:     "Hiperhidrosis",
        anhidrosis:      "Anhidrosis",
        hiperqueratosis: "Hiperqueratosis",
        helomas:         "Helomas",
        verrugas:        "Verrugas",
      })
    : [];

  const patChips = patologia
    ? trueBoolLabels(patologia, {
        anoniquia:           "Anoniquia",
        microniquia:         "Microniquia",
        onicolisis:          "Onicolisis",
        onicauxis:           "Onicauxis",
        hematoma_subungueal: "Hematoma subungueal",
        onicofosis:          "Onicofosis",
        paquioniquia:        "Paquioniquia",
        onicomicosis:        "Onicomicosis",
      })
    : [];

  const totalServicios = serviciosUsados.reduce((s, sv) => s + Number(sv.precio_aplicado), 0);
  const totalProductos = productos.reduce((s, p) => s + Number(p.precio) * Number(p.cantidad), 0);
  const totalGeneral   = totalServicios + totalProductos;

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* export button */}
      {/* <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExportImage}
          disabled={exporting || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
          {exporting ? "Exportando…" : "Exportar imagen"}
        </button>
      </div> */}

      <div ref={contentRef} className="space-y-4">

      {/* 1. Datos del paciente */}
      <SectionCard title="Datos del paciente">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-zinc-500 font-medium">Nombre</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{nombreCompleto || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">Sucursal preferente</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{paciente.ciudad_preferida || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">Sexo</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{sexoLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">Edad</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {edad !== null ? `${edad} años` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">WhatsApp</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{paciente.whatsapp || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">Contacto de emergencia</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{paciente.contacto_emergencia_nombre || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">WhatsApp emergencia</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{paciente.contacto_emergencia_whatsapp || "—"}</dd>
          </div>
        </dl>
      </SectionCard>

      {/* 2. Antecedentes médicos */}
      <SectionCard title="Antecedentes médicos">
        {loading ? (
          <p className="text-zinc-400 text-sm">Cargando…</p>
        ) : !antecedentes ? (
          <p className="text-zinc-400 text-sm">Sin antecedentes registrados.</p>
        ) : (
          <div className="space-y-2">
            {antChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {antChips.map((c) => <Chip key={c} label={c} />)}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm">Sin antecedentes relevantes.</p>
            )}
            {antecedentes.tipo_sangre ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Tipo de sangre:</span> {antecedentes.tipo_sangre}
              </p>
            ) : null}
            {antecedentes.medicamentos_actuales ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Medicamentos actuales:</span>{" "}
                {antecedentes.medicamentos_actuales}
              </p>
            ) : null}
            {antecedentes.otros ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Otros:</span> {antecedentes.otros}
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* 3. Valoración de piel */}
      <SectionCard title="Valoración de piel">
        {!valoracion ? (
          <p className="text-zinc-400 text-sm">Sin valoración registrada.</p>
        ) : valoracionChips.length === 0 ? (
          <p className="text-zinc-400 text-sm">Sin hallazgos registrados.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {valoracionChips.map((c) => <Chip key={c} label={c} />)}
            </div>
            {valoracion.observaciones ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Observaciones:</span>{" "}
                {valoracion.observaciones}
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* 4. Patología ungueal */}
      <SectionCard title="Patología ungueal">
        {!patologia ? (
          <p className="text-zinc-400 text-sm">Sin patología registrada.</p>
        ) : patChips.length === 0 ? (
          <p className="text-zinc-400 text-sm">Sin patologías registradas.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {patChips.map((c) => <Chip key={c} label={c} />)}
          </div>
        )}
      </SectionCard>

      {/* 5. Servicios */}
      <SectionCard title="Servicios">
        {loading ? (
          <p className="text-zinc-400 text-sm">Cargando…</p>
        ) : serviciosUsados.length === 0 ? (
          <p className="text-zinc-400 text-sm">Sin servicios registrados.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">Servicio</th>
                <th className="pb-2 font-medium">Opción</th>
                <th className="pb-2 font-medium text-right">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {serviciosUsados.map((s) => (
                <tr key={s.id_consulta_servicio}>
                  <td className="py-1.5 text-zinc-800 dark:text-zinc-100">{s.nombre_servicio}</td>
                  <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{s.descripcion_opcion}</td>
                  <td className="py-1.5 text-right text-zinc-800 dark:text-zinc-100">
                    ${Number(s.precio_aplicado).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-2 text-right text-xs font-medium text-zinc-500">
                  Subtotal servicios
                </td>
                <td className="pt-2 text-right text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  ${totalServicios.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </SectionCard>

      {/* 6. Productos utilizados */}
      <SectionCard title="Productos utilizados">
        {loading ? (
          <p className="text-zinc-400 text-sm">Cargando…</p>
        ) : productos.length === 0 ? (
          <p className="text-zinc-400 text-sm">Sin productos registrados.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">Producto</th>
                <th className="pb-2 font-medium text-center">Cant.</th>
                <th className="pb-2 font-medium text-right">Precio unit.</th>
                <th className="pb-2 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {productos.map((p) => (
                <tr key={p.id_consulta_producto}>
                  <td className="py-1.5 text-zinc-800 dark:text-zinc-100">{p.nombre_producto}</td>
                  <td className="py-1.5 text-center text-zinc-600 dark:text-zinc-400">{p.cantidad}</td>
                  <td className="py-1.5 text-right text-zinc-600 dark:text-zinc-400">
                    ${Number(p.precio).toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right text-zinc-800 dark:text-zinc-100">
                    ${(Number(p.precio) * Number(p.cantidad)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-2 text-right text-xs font-medium text-zinc-500">
                  Subtotal productos
                </td>
                <td className="pt-2 text-right text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  ${totalProductos.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </SectionCard>

      {/* 7. Podólogo y sucursal */}
      <SectionCard title="Podólogo y sucursal">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-zinc-500 font-medium">Podólogo</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">{nombrePodologo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-medium">Sucursal</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {sucursalNombre
                ? `${sucursalNombre}${sucursalCiudad ? ` — ${sucursalCiudad}` : ""}`
                : "—"}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {/* 8. Total general */}
      <div className="flex justify-end">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-6 py-3 text-sm space-y-1 min-w-48">
          <div className="flex justify-between gap-8 text-zinc-600 dark:text-zinc-400">
            <span>Servicios</span>
            <span>${totalServicios.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-8 text-zinc-600 dark:text-zinc-400">
            <span>Productos</span>
            <span>${totalProductos.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-8 font-semibold text-zinc-800 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-600 pt-1 mt-1">
            <span>Total general</span>
            <span>${totalGeneral.toFixed(2)}</span>
          </div>
        </div>
      </div>

      </div>{/* end contentRef */}
    </div>
  );
}
