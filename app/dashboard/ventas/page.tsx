"use client";

import { IVenta } from "@/interfaces/venta";
import { IProducto } from "@/interfaces/producto";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import { useEffect, useState } from "react";
import { useSucursal } from "@/contexts/SucursalContext";
import { addZeroToday } from "@/utils/date_helpper";
import { getVentas, getMetodosPagos, saveVenta, VentaForm } from "./actions";
import { getProductos } from "@/app/dashboard/productos/actions";
import VentaFila from "./componentes/VentaFila";
import VentaModal from "./componentes/VentaModal";

const EMPTY: VentaForm = {
  id_venta:    0,
  id_producto: 0,
  cantidad:    1,
  idMetodoPago: 0,
  total:       0,
};

export default function VentasPage() {
  const { selectedId } = useSucursal();
  const today = addZeroToday(new Date());

  const [ventas, setVentas]           = useState<IVenta[]>([]);
  const [productos, setProductos]     = useState<IProducto[]>([]);
  const [metodos, setMetodos]         = useState<IMetodoPago[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin]       = useState(today);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState<VentaForm>(EMPTY);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const data = await getVentas(selectedId, fechaInicio, fechaFin);
      setVentas(data);
    } finally {
      setLoading(false);
    }
  };

  // Load catalogues when sucursal changes
  useEffect(() => {
    Promise.all([getProductos(selectedId), getMetodosPagos()]).then(([prods, mets]) => {
      setProductos(prods);
      setMetodos(mets);
    });
  }, [selectedId]);

  // Load ventas when filters change
  useEffect(() => { fetchVentas(); }, [selectedId, fechaInicio, fechaFin]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setForm(EMPTY);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (v: IVenta) => {
    setForm({
      id_venta:    v.id_venta,
      id_producto: v.id_producto,
      cantidad:    v.cantidad,
      idMetodoPago: v.idMetodoPago,
      total:       v.total,
    });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ["cantidad", "total", "idMetodoPago", "id_producto"];
    setForm((prev) => {
      const next: VentaForm = {
        ...prev,
        [name]: numericFields.includes(name) ? Number(value) : value,
      };
      // Auto-calculate total when producto or cantidad changes
      if (name === "id_producto" || name === "cantidad") {
        const prodId = name === "id_producto" ? Number(value) : prev.id_producto;
        const qty    = name === "cantidad"    ? Number(value) : prev.cantidad;
        const prod   = productos.find((p) => p.id_producto === prodId);
        if (prod) next.total = parseFloat((prod.precio * qty).toFixed(2));
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveVenta(form);
      if (!res.ok) throw new Error(res.message ?? "Error al guardar");
      setShowModal(false);
      await fetchVentas();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

  const totalSum = ventas.reduce((acc, v) => acc + v.total, 0);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-50">Ventas</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors"
        >
          + Agregar venta
        </button>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha inicio</span>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha fin</span>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>
        {!loading && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 self-end pb-2">
            {ventas.length} registro{ventas.length !== 1 ? "s" : ""} — Total: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{fmtCurrency(totalSum)}</span>
          </p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              {["Fecha", "Producto", "Cant.", "Método pago", "Total", "Facturado", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                  Cargando…
                </td>
              </tr>
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                  Sin registros en el período seleccionado.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <VentaFila
                  key={v.id_venta}
                  venta={v}
                  onEdit={openEdit}
                  onDeleted={fetchVentas}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <VentaModal
          form={form}
          productos={productos}
          metodosPagos={metodos}
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
