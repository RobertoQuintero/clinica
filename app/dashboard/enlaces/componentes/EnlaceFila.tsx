"use client";

import { IPatologiaUrl } from "@/interfaces/patologia_url";
import { saveEnlace } from "../actions";
import { useState } from "react";

interface Props {
  enlace: IPatologiaUrl;
  onSaved: () => void;
}

export default function EnlaceFila({ enlace: e, onSaved }: Props) {
  const [editing, setEditing]   = useState(false);
  const [url, setUrl]           = useState(e.url ?? "");
  const [status, setStatus]     = useState(e.status);
  const [saving, setSaving]     = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    const res = await saveEnlace({ id_patologia_url: e.id_patologia_url, url, status });
    if (res.ok) {
      setEditing(false);
      onSaved();
    } else {
      setErrorMsg(res.message ?? "Error al guardar");
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setUrl(e.url ?? "");
    setStatus(e.status);
    setEditing(false);
    setErrorMsg(null);
  };

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 font-medium">{e.nombre_patologia}</td>

      <td className="px-4 py-3">
        {editing ? (
          <input
            type="url"
            value={url}
            onChange={(ev) => setUrl(ev.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        ) : (
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400 break-all"
          >
            {e.url || "—"}
          </a>
        )}
      </td>

      <td className="px-4 py-3">
        {editing ? (
          <input
            type="checkbox"
            checked={status}
            onChange={(ev) => setStatus(ev.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 accent-zinc-800"
          />
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              e.status
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
            }`}
          >
            {e.status ? "Activo" : "Inactivo"}
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap">
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            {errorMsg && (
              <span className="text-xs text-red-500 mr-2">{errorMsg}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Editar
          </button>
        )}
      </td>
    </tr>
  );
}
