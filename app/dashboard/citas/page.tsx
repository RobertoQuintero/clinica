"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { useEffect, useState } from "react";
import CitaFila from "./componentes/CitaFila";
import CitaModal from "./componentes/CitaModal";
import { getCitas, getPacientes, getPodologos, saveCita } from "./actions";

const EMPTY: ICita = {
  id_cita:            0,
  id_paciente:        0,
  id_podologo:        0,
  fecha_inicio:       "",
  fecha_fin:          "",
  estado:             "agendada",
  motivo_cancelacion: "",
  created_at:         "",
  deleted_at:         "",
  id_sucursal:        0,
  id_empresa:         0,
};

export default function CitasPage() {
  const { user }                  = useAuth();
  const { selectedId }            = useSucursal();
  const [citas, setCitas]         = useState<ICita[]>([]);
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [podologos, setPodologos] = useState<IUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<ICita>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [filtro, setFiltro]       = useState("");
  const [sortBy, setSortBy]       = useState<"paciente" | "podologo" | "inicio" | "estado" | null>(null);
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");

  type SortKey = "paciente" | "podologo" | "inicio" | "estado";

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  };

  const sortIcon = (key: SortKey) => (
    <span className="ml-1 text-xs">
      {sortBy === key ? (sortDir === "asc" ? "▲" : "▼") : <span className="opacity-30">▲</span>}
    </span>
  );

  const refreshCitas = async () => {
    setLoading(true);
    try {
      const data = await getCitas();
      setCitas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCitas();
    getPacientes().then(setPacientes);
    getPodologos().then(setPodologos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const openNew = () => {
    setForm({ ...EMPTY, id_sucursal: user!.id_sucursal, id_empresa: user!.id_empresa });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (c: ICita) => {
    setForm({ ...c });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await saveCita(form);
      if (!result.ok) throw new Error(result.message ?? "Error al guardar");
      setShowModal(false);
      refreshCitas();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEstado = async (id_cita: number, estado: string) => {
    const cita = citas.find((c) => c.id_cita === id_cita);
    if (!cita) return;
    // Optimistic update
    setCitas((prev) => prev.map((c) => c.id_cita === id_cita ? { ...c, estado } : c));
    try {
      const result = await saveCita({ ...cita, estado });
      if (!result.ok) throw new Error(result.message ?? "Error al actualizar");
    } catch {
      // Revert on failure
      setCitas((prev) => prev.map((c) => c.id_cita === id_cita ? { ...c, estado: cita.estado } : c));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Citas</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nueva cita
        </button>
      </div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar paciente o podólogo…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {([
                  { label: "Paciente", key: "paciente" },
                  { label: "Podólogo", key: "podologo" },
                  { label: "Inicio",   key: "inicio"   },
                  { label: "Fin",      key: null        },
                  { label: "Estado",   key: "estado"   },
                ] as { label: string; key: SortKey | null }[]).map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    className={`px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap select-none${
                      key ? " cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" : ""
                    }`}
                  >
                    {label}{key && sortIcon(key)}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {(() => {
                const q = filtro.trim().toLowerCase();
                const filtered = q
                  ? citas.filter((c) => {
                      const p = pacientes.find((x) => x.id_paciente === c.id_paciente);
                      const u = podologos.find((x) => x.id_user === c.id_podologo);
                      const pacienteStr = p ? `${p.nombre} ${p.apellido_paterno}`.toLowerCase() : "";
                      const podologoStr = u ? u.nombre.toLowerCase() : "";
                      return pacienteStr.includes(q) || podologoStr.includes(q);
                    })
                  : citas;
                if (filtered.length === 0) return (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin registros</td>
                  </tr>
                );
                const sortFn = sortBy
                  ? (a: ICita, b: ICita) => {
                      let va = "", vb = "";
                      if (sortBy === "paciente") {
                        const pa = pacientes.find((x) => x.id_paciente === a.id_paciente);
                        const pb = pacientes.find((x) => x.id_paciente === b.id_paciente);
                        va = pa ? `${pa.nombre} ${pa.apellido_paterno}` : "";
                        vb = pb ? `${pb.nombre} ${pb.apellido_paterno}` : "";
                      } else if (sortBy === "podologo") {
                        const ua = podologos.find((x) => x.id_user === a.id_podologo);
                        const ub = podologos.find((x) => x.id_user === b.id_podologo);
                        va = ua ? ua.nombre : "";
                        vb = ub ? ub.nombre : "";
                      } else if (sortBy === "inicio") {
                        va = String(a.fecha_inicio);
                        vb = String(b.fecha_inicio);
                      } else if (sortBy === "estado") {
                        va = a.estado;
                        vb = b.estado;
                      }
                      const cmp = va.localeCompare(vb, "es");
                      return sortDir === "asc" ? cmp : -cmp;
                    }
                  : (a: ICita, b: ICita) => {
                      const aCan = a.estado.toLowerCase() === "cancelada" ? 1 : 0;
                      const bCan = b.estado.toLowerCase() === "cancelada" ? 1 : 0;
                      if (aCan !== bCan) return aCan - bCan;
                      const tA = new Date(String(a.fecha_inicio).replace(" ", "T")).getTime();
                      const tB = new Date(String(b.fecha_inicio).replace(" ", "T")).getTime();
                      return tB - tA;
                    };
                return [...filtered].sort(sortFn).map((c) => (
                  <CitaFila key={c.id_cita} cita={c} pacientes={pacientes} podologos={podologos} onEdit={openEdit} onChangeEstado={handleChangeEstado} />
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CitaModal
          form={form}
          pacientes={pacientes}
          podologos={podologos}
          saving={saving}
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
