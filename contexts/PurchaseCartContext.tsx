"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { ISuggestedProduct } from "@/interfaces/suggested_product";
import { useSucursal } from "@/contexts/SucursalContext";

/** Línea del carrito de pedido: snapshot del producto + cantidad/precio/proveedor editables. */
export interface IPurchaseCartLine {
  id_product:          number;
  product_name:        string;
  product_code:        string;
  brand:               string;
  id_unit_measurement: number | null;
  id_supplier:         number | null;
  pieces:              number | null;
  split:               boolean;
  quantity:            number;
  unit_price:          number;
  applies_iva:         boolean;
}

const SESSION_STORAGE_KEY = "purchaseCart";

/** Estado del carrito de una sola sucursal (mismos campos que hoy, antes planos en el contexto). */
interface IPurchaseCartState {
  lines:                   IPurchaseCartLine[];
  estimatedDate:           string;
  notes:                   string;
  paymentMethodBySupplier: Record<number, number>;
  shippingCostBySupplier:  Record<number, number>;
}

// Estado interno del provider: un carrito por id_sucursal.
type PurchaseCartBySucursal = Record<number, IPurchaseCartState>;

const EMPTY_CART_STATE: IPurchaseCartState = {
  lines: [],
  estimatedDate: "",
  notes: "",
  paymentMethodBySupplier: {},
  shippingCostBySupplier: {},
};

interface PurchaseCartContextType {
  lines:                   IPurchaseCartLine[];
  estimatedDate:           string;
  notes:                   string;
  /** id_supplier -> idMetodoPago. Un método de pago por proveedor, elegido en la revisión. */
  paymentMethodBySupplier: Record<number, number>;
  /** id_supplier -> gasto de envío de esa orden. Ausente o 0 = sin envío. */
  shippingCostBySupplier: Record<number, number>;
  /** true una vez que se intentó leer el carrito de sessionStorage (evita falsos "carrito vacío" en el primer render). */
  isHydrated:              boolean;
  isProductInCart:         (id_product: number) => boolean;
  toggleProduct:           (product: ISuggestedProduct, checked: boolean) => void;
  setLineQuantity:         (id_product: number, quantity: number) => void;
  setLineUnitPrice:        (id_product: number, unit_price: number) => void;
  setLineSupplier:         (id_product: number, id_supplier: number | null) => void;
  setLineAppliesIva:       (id_product: number, applies_iva: boolean) => void;
  removeLine:              (id_product: number) => void;
  /** Reemplaza todas las líneas de golpe (p. ej. al cargar una plantilla), sin tocar fecha/notas/métodos de pago. */
  replaceLines:            (lines: IPurchaseCartLine[]) => void;
  /** Fusiona líneas en el carrito de la sucursal actual: suma cantidad si el producto ya está, agrega si no. */
  mergeLines:              (lines: IPurchaseCartLine[]) => void;
  setEstimatedDate:        (date: string) => void;
  setNotes:                (notes: string) => void;
  setSupplierPaymentMethod: (id_supplier: number, idMetodoPago: number) => void;
  setSupplierShippingCost: (id_supplier: number, shipping_cost: number) => void;
  clearCart:               () => void;
}

const PurchaseCartContext = createContext<PurchaseCartContextType | null>(null);

export function PurchaseCartProvider({ children }: { children: ReactNode }) {
  const { selectedId } = useSucursal();
  const [cartsBySucursal, setCartsBySucursal] = useState<PurchaseCartBySucursal>({});
  const [isHydrated, setIsHydrated] = useState(false);

  const currentCart = (selectedId != null ? cartsBySucursal[selectedId] : undefined) ?? EMPTY_CART_STATE;

  // Actualiza el carrito de la sucursal actualmente seleccionada, dejando el resto intacto.
  // Si aún no hay sucursal seleccionada, no hay dónde escribir y no hace nada.
  const updateCurrentCart = (updater: (cart: IPurchaseCartState) => IPurchaseCartState) => {
    if (selectedId == null) return;
    setCartsBySucursal((current) => ({
      ...current,
      [selectedId]: updater(current[selectedId] ?? EMPTY_CART_STATE),
    }));
  };

  // Carga los carritos de sessionStorage una sola vez, al montar en el cliente.
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCartsBySucursal(parsed ?? {});
      } catch {
        // sessionStorage corrupto o con un formato viejo: se ignora y arranca vacío
      }
    }
    setIsHydrated(true);
  }, []);

  // Persiste cualquier cambio del carrito, para sobrevivir la navegación entre
  // armado y revisión. No se guarda como orden en BD (ver decisiones del spec).
  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cartsBySucursal));
  }, [cartsBySucursal, isHydrated]);

  const isProductInCart = (id_product: number) =>
    currentCart.lines.some((line) => line.id_product === id_product);

  const toggleProduct = (product: ISuggestedProduct, checked: boolean) => {
    updateCurrentCart((cart) => {
      if (!checked) {
        return { ...cart, lines: cart.lines.filter((line) => line.id_product !== product.id_product) };
      }
      if (cart.lines.some((line) => line.id_product === product.id_product)) {
        return cart;
      }
      const newLine: IPurchaseCartLine = {
        id_product: product.id_product,
        product_name: product.name,
        product_code: product.product_code,
        brand: product.brand,
        id_unit_measurement: product.id_unit_measurement,
        id_supplier: product.id_supplier,
        pieces: product.pieces,
        split: product.split,
        quantity: product.suggested_quantity > 0 ? product.suggested_quantity : 1,
        unit_price: product.price,
        applies_iva: true,
      };
      return { ...cart, lines: [...cart.lines, newLine] };
    });
  };

  const setLineQuantity = (id_product: number, quantity: number) => {
    updateCurrentCart((cart) => ({
      ...cart,
      lines: cart.lines.map((line) =>
        line.id_product === id_product ? { ...line, quantity } : line
      ),
    }));
  };

  const setLineUnitPrice = (id_product: number, unit_price: number) => {
    updateCurrentCart((cart) => ({
      ...cart,
      lines: cart.lines.map((line) =>
        line.id_product === id_product ? { ...line, unit_price } : line
      ),
    }));
  };

  const setLineSupplier = (id_product: number, id_supplier: number | null) => {
    updateCurrentCart((cart) => ({
      ...cart,
      lines: cart.lines.map((line) =>
        line.id_product === id_product ? { ...line, id_supplier } : line
      ),
    }));
  };

  const setLineAppliesIva = (id_product: number, applies_iva: boolean) => {
    updateCurrentCart((cart) => ({
      ...cart,
      lines: cart.lines.map((line) =>
        line.id_product === id_product ? { ...line, applies_iva } : line
      ),
    }));
  };

  const removeLine = (id_product: number) => {
    updateCurrentCart((cart) => ({
      ...cart,
      lines: cart.lines.filter((line) => line.id_product !== id_product),
    }));
  };

  const replaceLines = (newLines: IPurchaseCartLine[]) => {
    updateCurrentCart((cart) => ({ ...cart, lines: newLines }));
  };

  /**
   * Fusiona líneas entrantes (p. ej. de una solicitud confirmada, spec 48) con las
   * ya presentes: si el producto ya está en el carrito, suma la cantidad; si no,
   * agrega la línea completa. Un solo `updateCurrentCart` para todo el lote, y no
   * toca fecha estimada, notas, métodos de pago ni envío.
   */
  const mergeLines = (incomingLines: IPurchaseCartLine[]) => {
    updateCurrentCart((cart) => {
      const lines = [...cart.lines];
      for (const incoming of incomingLines) {
        const existingIndex = lines.findIndex((line) => line.id_product === incoming.id_product);
        if (existingIndex === -1) {
          lines.push(incoming);
        } else {
          lines[existingIndex] = {
            ...lines[existingIndex],
            quantity: lines[existingIndex].quantity + incoming.quantity,
          };
        }
      }
      return { ...cart, lines };
    });
  };

  const setEstimatedDate = (date: string) => {
    updateCurrentCart((cart) => ({ ...cart, estimatedDate: date }));
  };

  const setNotes = (notes: string) => {
    updateCurrentCart((cart) => ({ ...cart, notes }));
  };

  const setSupplierPaymentMethod = (id_supplier: number, idMetodoPago: number) => {
    updateCurrentCart((cart) => ({
      ...cart,
      paymentMethodBySupplier: { ...cart.paymentMethodBySupplier, [id_supplier]: idMetodoPago },
    }));
  };

  const setSupplierShippingCost = (id_supplier: number, shipping_cost: number) => {
    updateCurrentCart((cart) => ({
      ...cart,
      shippingCostBySupplier: { ...cart.shippingCostBySupplier, [id_supplier]: shipping_cost },
    }));
  };

  const clearCart = () => {
    updateCurrentCart(() => EMPTY_CART_STATE);
  };

  return (
    <PurchaseCartContext.Provider
      value={{
        lines: currentCart.lines,
        estimatedDate: currentCart.estimatedDate,
        notes: currentCart.notes,
        paymentMethodBySupplier: currentCart.paymentMethodBySupplier,
        shippingCostBySupplier: currentCart.shippingCostBySupplier,
        isHydrated,
        isProductInCart,
        toggleProduct,
        setLineQuantity,
        setLineUnitPrice,
        setLineSupplier,
        setLineAppliesIva,
        removeLine,
        replaceLines,
        mergeLines,
        setEstimatedDate,
        setNotes,
        setSupplierPaymentMethod,
        setSupplierShippingCost,
        clearCart,
      }}
    >
      {children}
    </PurchaseCartContext.Provider>
  );
}

export const usePurchaseCart = (): PurchaseCartContextType => {
  const ctx = useContext(PurchaseCartContext);
  if (!ctx) {
    throw new Error("usePurchaseCart debe usarse dentro de <PurchaseCartProvider>");
  }
  return ctx;
};
