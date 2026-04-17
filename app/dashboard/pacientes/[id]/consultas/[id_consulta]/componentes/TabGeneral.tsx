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
  consulta:        IConsulta          | null;
  paciente:        IPaciente          | null;
  valoracion:      IValoracionPiel    | null;
  patologia:       IPatologiaUngueal  | null;
  onTotalChange?:  (total: number) => void;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function TabGeneral({ consulta, paciente, valoracion, patologia, onTotalChange }: Props) {
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

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setExporting(true);

    // ── inject temporary print styles ──────────────────────────────────────
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      [data-exporting],
      [data-exporting] * {
        color: #000 !important;
        background-color: #fff !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        gap: 0 !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
      }
    `;
    document.head.appendChild(styleEl);
    contentRef.current.setAttribute("data-exporting", "true");

    try {
      const { toCanvas } = await import("html-to-image");
      const { jsPDF }    = await import("jspdf");

      const canvas = await toCanvas(contentRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });

      const imgData        = canvas.toDataURL("image/png");
      const A4_W           = 210; // mm
      const A4_H           = 297; // mm
      const contentH       = (canvas.height * A4_W) / canvas.width;
      const totalPages     = Math.ceil(contentH / A4_H);

      // Pre-load watermark
      let wmDataUrl: string | null = null;
      let wmNatW = 0, wmNatH = 0;
      try {
        const res  = await fetch("/piezen.jpg");
        const blob = await res.blob();
        wmDataUrl  = await new Promise<string>((resolve) => {
          const reader    = new FileReader();
          reader.onload   = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const tmpImg = new Image();
        tmpImg.src   = wmDataUrl;
        await new Promise<void>((resolve) => {
          tmpImg.onload = () => { wmNatW = tmpImg.naturalWidth; wmNatH = tmpImg.naturalHeight; resolve(); };
          tmpImg.onerror = () => resolve();
        });
      } catch { /* si no se puede cargar la marca de agua, continuar sin ella */ }

      const pdf = new jsPDF("p", "mm", "a4");

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        // Contenido
        pdf.addImage(imgData, "PNG", 0, -page * A4_H, A4_W, contentH);

        // Marca de agua centrada con baja opacidad
        if (wmDataUrl) {
          const WM_W = 90;
          const WM_H = wmNatW ? (wmNatH * WM_W) / wmNatW : 45;
          const wmX  = (A4_W - WM_W) / 2;
          const wmY  = (A4_H - WM_H) / 2;
          pdf.setGState(pdf.GState({ opacity: 0.08 }));
          pdf.addImage(wmDataUrl, "JPEG", wmX, wmY, WM_W, WM_H);
          pdf.setGState(pdf.GState({ opacity: 1 }));
        }
      }

      pdf.save("consulta-general.pdf");
    } finally {
      contentRef.current?.removeAttribute("data-exporting");
      styleEl.remove();
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




  const onSendWhatsApp = () => {
    if (!paciente?.whatsapp || loading) return;

    // Strip non-digits; prepend 52 (MX) if not already present
    const digits = paciente.whatsapp.replace(/\D/g, "");
    const phone  = digits.startsWith("52") ? digits : `52${digits}`;

    const lines: string[] = [
      "*RESUMEN DE CONSULTA*",
      "",
      `*Paciente:* ${nombreCompleto}`,
    ];

    if (edad !== null)    lines.push(`*Edad:* ${edad} años`);
    if (sexoLabel)        lines.push(`*Sexo:* ${sexoLabel}`);

    if (consulta?.fecha) {
      const fechaStr = String(consulta.fecha).replace(" ", "T");
      const fechaFmt = new Date(fechaStr).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      });
      lines.push(`*Fecha de consulta:* ${fechaFmt}`);
    }

    if (nombrePodologo) lines.push(`*Podólogo:* ${nombrePodologo}`);
    if (sucursalNombre) {
      lines.push(
        `*Sucursal:* ${sucursalNombre}${sucursalCiudad ? ` — ${sucursalCiudad}` : ""}`,
      );
    }

    if (serviciosUsados.length > 0) {
      lines.push("", "*SERVICIOS*");
      serviciosUsados.forEach((s) => {
        const opcion = s.descripcion_opcion ? ` (${s.descripcion_opcion})` : "";
        lines.push(
          `• ${s.nombre_servicio}${opcion}: $${Number(s.precio_aplicado).toFixed(2)}`,
        );
      });
      lines.push(`_Subtotal servicios: $${totalServicios.toFixed(2)}_`);
    }

    if (productos.length > 0) {
      lines.push("", "*PRODUCTOS*");
      productos.forEach((p) => {
        const sub = (Number(p.precio) * Number(p.cantidad)).toFixed(2);
        lines.push(`• ${p.nombre_producto} ×${p.cantidad}: $${sub}`);
      });
      lines.push(`_Subtotal productos: $${totalProductos.toFixed(2)}_`);
    }

    if (antecedentes) {
      const chips = antChips;
      lines.push("", "*ANTECEDENTES MÉDICOS*");
      if (chips.length > 0) {
        lines.push(chips.map((c) => `• ${c}`).join("\n"));
      }
      if (antecedentes.tipo_sangre)          lines.push(`*Tipo de sangre:* ${antecedentes.tipo_sangre}`);
      if (antecedentes.medicamentos_actuales) lines.push(`*Medicamentos:* ${antecedentes.medicamentos_actuales}`);
      if (antecedentes.otros)                lines.push(`*Otros:* ${antecedentes.otros}`);
      if (chips.length === 0 && !antecedentes.tipo_sangre && !antecedentes.medicamentos_actuales && !antecedentes.otros) {
        lines.push("_Sin antecedentes relevantes._");
      }
    }

    if (valoracion) {
      lines.push("", "*VALORACIÓN DE PIEL*");
      if (valoracionChips.length > 0) {
        lines.push(valoracionChips.map((c) => `• ${c}`).join("\n"));
      } else {
        lines.push("_Sin hallazgos registrados._");
      }
      if (valoracion.observaciones) lines.push(`*Observaciones:* ${valoracion.observaciones}`);
    }

    if (patologia) {
      lines.push("", "*PATOLOGÍA UNGUEAL*");
      if (patChips.length > 0) {
        lines.push(patChips.map((c) => `• ${c}`).join("\n"));
      } else {
        lines.push("_Sin patologías registradas._");
      }
    }

    if (consulta?.diagnostico) {
      lines.push("", `*Diagnóstico:* ${consulta.diagnostico}`);
    }

    lines.push("", `*TOTAL GENERAL: $${totalGeneral.toFixed(2)}*`);

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };

  useEffect(() => { onTotalChange?.(totalGeneral); }, [totalGeneral]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* export / share buttons */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSendWhatsApp}
          disabled={loading || !paciente?.whatsapp}
          title={!paciente?.whatsapp ? "El paciente no tiene WhatsApp registrado" : "Enviar resumen por WhatsApp"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </button>
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={exporting || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {exporting ? "Exportando…" : "Exportar PDF"}
        </button>
      </div>

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
