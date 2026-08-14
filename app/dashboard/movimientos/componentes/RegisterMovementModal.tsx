"use client";

import { useEffect, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import {
  getMovementTypes,
  getTransferDestinations,
  registerStockMovement,
  searchProductsForMovement,
  IMovementProductOption,
  IMovementType,
  ITransferDestination,
} from "../actions";
import { useMovementsRefresh } from "./MovementsRefreshContext";

/** Tipos seleccionables manualmente en este modal (nunca 1 "compra", 5 "consulta" ni 6 "venta"). */
const MOVEMENT_SALIDA_POR_TRASPASO = 4;
const SELECTABLE_MOVEMENT_IDS = [2, MOVEMENT_SALIDA_POR_TRASPASO, 7, 8, 9,10];
/** "Traspaso" reemplaza el nombre real del catálogo (4 = "Salida por traspaso") solo
 * en este select: en el listado ambas filas se muestran con su nombre real (ver spec 14). */
const MODAL_LABEL_OVERRIDES: Record<number, string> = {
  [MOVEMENT_SALIDA_POR_TRASPASO]: "Traspaso",
};

const initialFormState = {
  id_movement: "" as number | "",
  id_sucursal_destination: "" as number | "",
  quantity: "",
  notes: "",
};

export default function RegisterMovementModal() {
  const { selectedId } = useSucursal();
  const { triggerRefresh } = useMovementsRefresh();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [movementTypes, setMovementTypes] = useState<IMovementType[]>([]);
  const [destinations, setDestinations] = useState<ITransferDestination[]>([]);

  const [form, setForm] = useState(initialFormState);

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<IMovementProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<IMovementProductOption | null>(null);
  const [searching, setSearching] = useState(false);

  const isTransfer = form.id_movement === MOVEMENT_SALIDA_POR_TRASPASO;
  const quantityNumber = Number(form.quantity) || 0;
  const showNegativeStockWarning =
    selectedProduct !== null &&
    form.id_movement !== "" &&
    form.id_movement !== 7 &&
    quantityNumber > selectedProduct.current_stock;

  useEffect(() => {
    if (!open) return;
    getMovementTypes().then((result) => {
      if (result.ok) setMovementTypes(result.data);
    });
  }, [open]);

  useEffect(() => {
    if (!isTransfer || !selectedId) {
      setDestinations([]);
      return;
    }
    getTransferDestinations(selectedId).then((result) => {
      if (result.ok) setDestinations(result.data);
    });
  }, [isTransfer, selectedId]);

  useEffect(() => {
    if (!open || !selectedId || productSearch.trim().length < 2) {
      setProductResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      searchProductsForMovement(selectedId, productSearch.trim())
        .then((result) => {
          if (result.ok) setProductResults(result.data);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [open, selectedId, productSearch]);

  function resetForm() {
    setForm(initialFormState);
    setProductSearch("");
    setProductResults([]);
    setSelectedProduct(null);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function handleSelectProduct(product: IMovementProductOption) {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setProductResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedProduct) {
      setError("Selecciona un producto");
      return;
    }
    if (form.id_movement === "") {
      setError("Selecciona el tipo de movimiento");
      return;
    }
    if (quantityNumber <= 0) {
      setError("Captura una cantidad mayor a cero");
      return;
    }
    if (isTransfer && form.id_sucursal_destination === "") {
      setError("Selecciona la sucursal destino");
      return;
    }

    setSaving(true);
    const result = await registerStockMovement({
      id_movement: form.id_movement,
      id_product: selectedProduct.id_product,
      quantity: quantityNumber,
      id_sucursal_destination: isTransfer ? (form.id_sucursal_destination as number) : null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);

    if (result.ok) {
      triggerRefresh();
      handleClose();
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
      >
        <Plus size={18} />
        Registrar movimiento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                Registrar movimiento
              </h3>
              <button
                onClick={handleClose}
                className="text-[#747780] dark:text-zinc-500 hover:text-[#0b1c30] dark:hover:text-zinc-200 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {error && (
                <p className="rounded-md bg-[#ffdad6] dark:bg-red-900/30 px-4 py-2 text-sm text-[#ba1a1a] dark:text-red-400">
                  {error}
                </p>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Tipo de movimiento</span>
                <select
                  value={form.id_movement}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      id_movement: e.target.value === "" ? "" : Number(e.target.value),
                      id_sucursal_destination: "",
                    }))
                  }
                  required
                  className="rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5]"
                >
                  <option value="">Seleccionar</option>
                  {movementTypes
                    .filter((movement) => SELECTABLE_MOVEMENT_IDS.includes(movement.id_movement))
                    .map((movement) => (
                      <option key={movement.id_movement} value={movement.id_movement}>
                        {MODAL_LABEL_OVERRIDES[movement.id_movement] ?? movement.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="relative flex flex-col gap-1">
                <span className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Producto</span>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setSelectedProduct(null);
                  }}
                  placeholder="Nombre o código del producto…"
                  required
                  className="rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5]"
                />
                {!selectedProduct && productSearch.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 max-h-48 overflow-y-auto rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg">
                    {searching ? (
                      <p className="px-3 py-2 text-sm text-[#747780] dark:text-zinc-500">Buscando…</p>
                    ) : productResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-[#747780] dark:text-zinc-500">Sin resultados</p>
                    ) : (
                      productResults.map((product) => (
                        <button
                          type="button"
                          key={product.id_product}
                          onClick={() => handleSelectProduct(product)}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-[#eff4ff] dark:hover:bg-zinc-700"
                        >
                          <span className="text-[#0b1c30] dark:text-zinc-100 font-medium">{product.name}</span>
                          <span className="text-xs text-[#747780] dark:text-zinc-500">
                            {product.product_code} · stock actual: {product.current_stock}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#44474f] dark:text-zinc-400">
                  Cantidad{selectedProduct?.unit_code ? ` (${selectedProduct.unit_code})` : ""}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  required
                  className="rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5]"
                />
              </label>

              {showNegativeStockWarning && (
                <p className="flex items-center gap-2 rounded-md bg-[#fff0e6] dark:bg-orange-900/30 px-3 py-2 text-sm text-[#c2410c] dark:text-orange-400">
                  <TriangleAlert size={16} className="shrink-0" />
                  La cantidad supera el stock actual ({selectedProduct?.current_stock}); el stock quedará en
                  negativo, pero puedes continuar.
                </p>
              )}

              {isTransfer && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Sucursal destino</span>
                  <select
                    value={form.id_sucursal_destination}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        id_sucursal_destination: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    required
                    className="rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5]"
                  >
                    <option value="">Seleccionar</option>
                    {destinations.map((destination) => (
                      <option key={destination.id_sucursal} value={destination.id_sucursal}>
                        {destination.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Comentarios</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0051d5] resize-none"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0051d5]/90 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
