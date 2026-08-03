"use client";

import { IOnicocriptosisDetalle } from "@/interfaces/onicocriptosis_detalle";
import Image from "next/image";
import React, { useState } from "react";

export type OnicocriptosisDedoState = {
  pie:          "izquierdo" | "derecho";
  dedo:         number; // 1-5
  grado:        1 | 2 | 3 | null;
  lado_medial:  boolean;
  lado_lateral: boolean;
};

export interface OnicocriptosisFormState {
  dedos: OnicocriptosisDedoState[]; // siempre 10 entradas (2 pies x 5 dedos)
  dolor: number; // 0 = sin seleccionar, 1-10
}

interface Props {
  detalle:         OnicocriptosisFormState;
  onDetalleChange: (value: OnicocriptosisFormState) => void;
  disabled?:       boolean;
}

const PIES: ("derecho" | "izquierdo")[] = ["derecho", "izquierdo"];

const NOMBRES_DEDO: Record<number, string> = {
  1: "Hallux (gordo)",
  2: "2do dedo",
  3: "3er dedo",
  4: "4to dedo",
  5: "Meñique",
};

// posiciones aproximadas (% del ancho/alto de la imagen) de cada dedo sobre piezen-pain.jpeg
const POSICIONES: Record<"derecho" | "izquierdo", Record<number, { x: number; y: number }>> = {
  derecho: {
    5: { x: 21, y: 53 },
    4: { x: 25, y: 57 },
    3: { x: 30, y: 60 },
    2: { x: 35, y: 62 },
    1: { x: 42, y: 62 },
  },
  izquierdo: {
    1: { x: 59, y: 62 },
    2: { x: 67, y: 62 },
    3: { x: 72, y: 60 },
    4: { x: 77, y: 58 },
    5: { x: 81, y: 53 },
  },
};

const DOLOR_COLORS = [
  "#22c55e", "#4ade80", "#a3e635", "#facc15", "#fb923c",
  "#f97316", "#f97316", "#ef4444", "#dc2626", "#b91c1c",
];

export function buildDedosVacios(): OnicocriptosisDedoState[] {
  const dedos: OnicocriptosisDedoState[] = [];
  for (const pie of PIES) {
    for (let dedo = 1; dedo <= 5; dedo++) {
      dedos.push({ pie, dedo, grado: null, lado_medial: false, lado_lateral: false });
    }
  }
  return dedos;
}

export function formStateToDetalleRows(
  form: OnicocriptosisFormState,
): Omit<IOnicocriptosisDetalle, "id_detalle" | "id_consulta">[] {
  return form.dedos
    .filter((d): d is OnicocriptosisDedoState & { grado: 1 | 2 | 3 } => d.grado !== null)
    .map((d) => ({
      pie:          d.pie,
      dedo:         d.dedo,
      grado:        d.grado,
      lado_medial:  d.lado_medial,
      lado_lateral: d.lado_lateral,
      dolor:        form.dolor,
    }));
}

export function detalleRowsToFormState(rows: IOnicocriptosisDetalle[]): OnicocriptosisFormState {
  const dedos = buildDedosVacios();
  let dolor = 0;
  for (const row of rows) {
    const idx = dedos.findIndex((d) => d.pie === row.pie && d.dedo === row.dedo);
    if (idx !== -1) {
      dedos[idx] = {
        pie:          row.pie,
        dedo:         row.dedo,
        grado:        row.grado,
        lado_medial:  row.lado_medial,
        lado_lateral: row.lado_lateral,
      };
    }
    dolor = row.dolor;
  }
  return { dedos, dolor };
}

export default function OnicocriptosisPies({ detalle, onDetalleChange, disabled }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const updateDedo = (
    pie: "derecho" | "izquierdo",
    dedo: number,
    patch: Partial<OnicocriptosisDedoState>,
  ) => {
    const dedos = detalle.dedos.map((d) =>
      d.pie === pie && d.dedo === dedo ? { ...d, ...patch } : d,
    );
    onDetalleChange({ ...detalle, dedos });
  };

  const toggleGrado = (pie: "izquierdo" | "derecho", dedo: number, grado: 1 | 2 | 3) => {
    if (disabled) return;
    const actual = detalle.dedos.find((d) => d.pie === pie && d.dedo === dedo);
    const nuevoGrado = actual?.grado === grado ? null : grado;
    updateDedo(pie, dedo, {
      grado: nuevoGrado,
      ...(nuevoGrado === null ? { lado_medial: false, lado_lateral: false } : {}),
    });
  };

  const dedosConGrado = detalle.dedos.filter((d) => d.grado);

  return (
    <div className="space-y-4" >
      <div
        className="relative mx-auto w-full max-w-md select-none"
        onClick={() => setActiveKey(null)}
      >
        {/* <div className='food-img'>
          <p className="food-img__p">Pie Izquierdo</p>
          <p className="food-img__p fp-2">Pie Derecho</p>
        </div> */}
        <Image
          src="/pie2.png"
          alt="Pies (izquierdo y derecho)"
          width={412}
          height={392}
          className="h-auto w-full"
          draggable={false}
        />

        {detalle.dedos.map((d) => {
          const key = `${d.pie}-${d.dedo}`;
          const pos = POSICIONES[d.pie][d.dedo];
          const isOpen = activeKey === key;

          return (
            <div
              key={key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title={`${d.pie === "izquierdo" ? "Izq." : "Der."} · ${NOMBRES_DEDO[d.dedo]}`}
                onClick={() => !disabled && setActiveKey(isOpen ? null : key)}
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm transition-colors
                  ${d.grado
                    ? "border-zinc-700 bg-zinc-800 text-white dark:border-zinc-300 dark:bg-zinc-200 dark:text-zinc-900"
                    : "border-zinc-400 bg-white/90 text-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-300"}
                  ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:scale-105"}`}
              >
                {d.grado ?? "·"}
              </button>

              {isOpen && !disabled && (
                <div className="absolute top-7 left-1/2 z-10 w-36 -translate-x-1/2 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="mb-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {d.pie === "izquierdo" ? "Izq." : "Der."} · {NOMBRES_DEDO[d.dedo]}
                  </p>
                  <div className="mb-2 flex gap-1">
                    {([1, 2, 3] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGrado(d.pie, d.dedo, g)}
                        className={`flex-1 rounded border py-1 text-xs font-medium transition-colors
                          ${d.grado === g
                            ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                            : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  {d.grado && (
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={d.lado_medial}
                          onChange={(e) => updateDedo(d.pie, d.dedo, { lado_medial: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        Medial
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={d.lado_lateral}
                          onChange={(e) => updateDedo(d.pie, d.dedo, { lado_lateral: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        Lateral
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {disabled && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dedosConGrado.length === 0 && (
            <p className="col-span-full text-xs text-zinc-500 dark:text-zinc-400">
              Sin dedos con grado registrado.
            </p>
          )}
          {dedosConGrado.map((d) => (
            <div
              key={`${d.pie}-${d.dedo}`}
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              {d.pie === "izquierdo" ? "Izq." : "Der."} {NOMBRES_DEDO[d.dedo]}: Grado {d.grado}
              {(d.lado_medial || d.lado_lateral) && (
                <> · {[d.lado_medial && "medial", d.lado_lateral && "lateral"].filter(Boolean).join("/")}</>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{textAlign: "center"}}>
        <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nivel de dolor general (1-10)
        </p>
        <div className="flex flex-wrap gap-1 justify-center">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const selected = detalle.dolor === n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onDetalleChange({ ...detalle, dolor: n })}
                style={selected ? { backgroundColor: DOLOR_COLORS[n - 1] } : undefined}
                className={`h-8 w-8 rounded border text-xs font-semibold transition-colors
                  ${selected
                    ? "border-transparent text-white"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"}
                  ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
