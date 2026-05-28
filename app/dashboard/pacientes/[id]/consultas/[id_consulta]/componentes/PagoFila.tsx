"use client";

import { IPago } from "@/interfaces/pago";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import React, { useState } from "react";
import { fmtDate } from "./helpers";

interface Props {
  pago:               IPago;
  metodoPagoOptions:  IMetodoPago[];
  canDelete:          boolean;
  onEliminar:         (id_pago: number) => void;
  deletingId:         number | null;
}

export default function PagoFila({ pago, metodoPagoOptions, canDelete, onEliminar, deletingId }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isDeleting = deletingId === pago.id_pago;
  const eliminado  = !pago.status;

  return (
    <>
      <tr className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${eliminado ? "opacity-60" : ""}`}>
        <td className="px-4 py-3 text-zinc-500">{pago.id_pago}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(pago.fecha_pago)}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 capitalize">
          {metodoPagoOptions.find((m) => m.idMetodoPago === pago.idMetodoPago)?.descripcion ?? "—"}
        </td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 font-medium">
          ${Number(pago.monto).toFixed(2)}
        </td>
        <td className="px-4 py-3 text-zinc-500">{pago.referencia || "—"}</td>
        <td className="px-4 py-3">
          {eliminado ? (
            <span className="text-xs text-red-500 dark:text-red-400">
              Eliminado por {pago.nombre_usuario_elimino ?? "—"}
            </span>
          ) : canDelete ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={isDeleting}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "..." : "Eliminar"}
            </button>
          ) : null}
        </td>
      </tr>

      {/* confirm modal */}
      {showConfirm && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
                  ¿Eliminar pago #{pago.id_pago}?
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
                  El registro quedará marcado como eliminado y se mostrará quién lo eliminó. No se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowConfirm(false); onEliminar(pago.id_pago); }}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
