"use client";

import { useState, useTransition } from "react";
import { addConsultaProducto, ConsultaProductoExtended, ProductoCatalogo } from "../actions";

interface Props {
  id_consulta:   number;
  catalogo:      ProductoCatalogo[];
  onAdd:         (p: ConsultaProductoExtended) => void;
}

export default function AddProductoForm({ id_consulta, catalogo, onAdd }: Props) {
  const [open,     setOpen    ] = useState(false);
  const [search,   setSearch  ] = useState("");
  const [selected, setSelected] = useState<ProductoCatalogo | null>(null);
  const [precio,   setPrecio  ] = useState<number>(0);
  const [cantidad, setCantidad] = useState<number>(1);
  const [error,    setError   ] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    const found = catalogo.find((p) => p.nombre.toLowerCase() === val.toLowerCase());
    if (found) {
      setSelected(found);
      setPrecio(found.precio);
    } else {
      setSelected(null);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setError(null);
    setSearch("");
    setSelected(null);
    setPrecio(0);
    setCantidad(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError("Selecciona un producto válido de la lista"); return; }
    if (cantidad < 1) { setError("La cantidad debe ser al menos 1"); return; }
    if (precio < 0)   { setError("El precio no puede ser negativo"); return; }
    setError(null);

    startTransition(async () => {
      const res = await addConsultaProducto(id_consulta, selected.id_producto, precio, cantidad);
      if (!res.ok) { setError(res.data); return; }
      onAdd(res.data);
      handleClose();
    });
  };

  const inputCls = "w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Agregar producto
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nuevo producto</h3>
        <button
          type="button"
          onClick={handleClose}
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          aria-label="Cerrar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Producto</label>
          <input
            list="productos-catalogo-list"
            value={search}
            onChange={handleSearchChange}
            placeholder="Escribe para buscar…"
            className={inputCls}
            required
            autoComplete="off"
          />
          <datalist id="productos-catalogo-list">
            {catalogo.map((p) => (
              <option key={p.id_producto} value={p.nombre} />
            ))}
          </datalist>
          {search && !selected && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Selecciona un producto de la lista
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Precio unitario</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(Number(e.target.value))}
            className={inputCls}
            required
            disabled
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Cantidad</label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className={inputCls}
            required
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="rounded px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !selected}
          className="rounded bg-zinc-800 px-4 py-1.5 text-xs text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
