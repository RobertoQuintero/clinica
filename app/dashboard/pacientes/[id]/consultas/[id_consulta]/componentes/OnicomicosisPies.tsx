"use client";

import { IOnicomicosisDetalle } from "@/interfaces/onicomicosis_detalle";
import Image from "next/image";
import React from "react";

export type OnicomicosisDedoState = {
  pie:      "izquierdo" | "derecho";
  dedo:     number; // 1-5
  marcado:  boolean;
};

export interface OnicomicosisFormState {
  dedos: OnicomicosisDedoState[]; // siempre 10 entradas (2 pies x 5 dedos)
}

interface Props {
  detalle:         OnicomicosisFormState;
  onDetalleChange: (value: OnicomicosisFormState) => void;
  disabled?:       boolean;
}

const PIES: ("derecho" | "izquierdo")[] = ["derecho" ,"izquierdo"];

const NOMBRES_DEDO: Record<number, string> = {
  1: "Hallux (gordo)",
  2: "2do dedo",
  3: "3er dedo",
  4: "4to dedo",
  5: "Meñique",
};

// posiciones aproximadas (% del ancho/alto de la imagen) de cada dedo sobre pie-zen-onico.jpeg
const POSICIONES: Record<"derecho" | "izquierdo", Record<number, { x: number; y: number }>> = {
  derecho: {
    5: { x: 21, y: 69 },
    4: { x: 25, y: 77 },
    3: { x: 30, y: 83 },
    2: { x: 35, y: 86 },
    1: { x: 42, y: 86 },
  },
  izquierdo: {
    1: { x: 59, y: 86 },
    2: { x: 67, y: 86 },
    3: { x: 72, y: 83 },
    4: { x: 76, y: 76 },
    5: { x: 80, y: 69 },
  },
};

export function buildDedosVacios(): OnicomicosisDedoState[] {
  const dedos: OnicomicosisDedoState[] = [];
  for (const pie of PIES) {
    for (let dedo = 1; dedo <= 5; dedo++) {
      dedos.push({ pie, dedo, marcado: false });
    }
  }
  return dedos;
}

export function formStateToDetalleRows(
  form: OnicomicosisFormState,
): Omit<IOnicomicosisDetalle, "id_detalle" | "id_consulta">[] {
  return form.dedos
    .filter((d) => d.marcado)
    .map((d) => ({ pie: d.pie, dedo: d.dedo }));
}

export function detalleRowsToFormState(rows: IOnicomicosisDetalle[]): OnicomicosisFormState {
  const dedos = buildDedosVacios();
  for (const row of rows) {
    const idx = dedos.findIndex((d) => d.pie === row.pie && d.dedo === row.dedo);
    if (idx !== -1) {
      dedos[idx] = { pie: row.pie, dedo: row.dedo, marcado: true };
    }
  }
  return { dedos };
}

export default function OnicomicosisPies({ detalle, onDetalleChange, disabled }: Props) {
  const toggleDedo = (pie: "derecho" | "izquierdo", dedo: number) => {
    if (disabled) return;
    const dedos = detalle.dedos.map((d) =>
      d.pie === pie && d.dedo === dedo ? { ...d, marcado: !d.marcado } : d,
    );
    onDetalleChange({ ...detalle, dedos });
  };

  const dedosMarcados = detalle.dedos.filter((d) => d.marcado);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-md select-none">
        {/* <div className='food-img' style={{padding:'7rem 0 0 0',gap:'6rem'}}>
          <p className="food-img__p">Pie Izquierdo</p>
          <p className="food-img__p ">Pie Derecho</p>
        </div> */}
        <Image
          src="/pie1.png"
          alt="Pies (izquierdo y derecho)"
          width={365}
          height={277}
          className="h-auto w-full"
          draggable={false}
        />

        {detalle.dedos.map((d) => {
          const key = `${d.pie}-${d.dedo}`;
          const pos = POSICIONES[d.pie][d.dedo];

          return (
            <div
              key={key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <button
                type="button"
                title={`${d.pie === "izquierdo" ? "Izq." : "Der."} · ${NOMBRES_DEDO[d.dedo]}`}
                onClick={() => toggleDedo(d.pie, d.dedo)}
                disabled={disabled}
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm transition-colors
                  ${d.marcado
                    ? "border-zinc-700 bg-zinc-800 text-white dark:border-zinc-300 dark:bg-zinc-200 dark:text-zinc-900"
                    : "border-zinc-400 bg-white/90 text-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-300"}
                  ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:scale-105"}`}
              >
                {d.marcado ? "✓" : "·"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dedosMarcados.length === 0 && (
          <p className="col-span-full text-center text-xs text-zinc-500 dark:text-zinc-400">
            Sin dedos marcados.
          </p>
        )}
        {dedosMarcados.map((d) => (
          <div
            key={`${d.pie}-${d.dedo}`}
            className="rounded-md border border-zinc-200 px-2 py-1 text-center text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {d.pie === "izquierdo" ? "Izq." : "Der."} {NOMBRES_DEDO[d.dedo]}
          </div>
        ))}
      </div>
    </div>
  );
}
