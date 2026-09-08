"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { getProductDetail, IProductDetail } from "@/app/dashboard/productos/actions";
import ProductViewModal from "@/app/dashboard/productos/componentes/ProductViewModal";

interface Props {
  id_product: number;
}

export default function ProductQuickViewButton({ id_product }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [detail, setDetail]   = useState<IProductDetail | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getProductDetail(id_product);
      if (result.ok) {
        setDetail(result.data);
      } else {
        setError(result.message);
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      setError("Error al cargar el producto");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Ver producto"
        className="p-2 rounded-full hover:bg-[#dce9ff] dark:hover:bg-zinc-700 text-[#44474f] dark:text-zinc-400 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}

      {detail && (
        <ProductViewModal
          product={detail.product}
          categoryName={detail.categoryName}
          supplierName={detail.supplierName}
          unitName={detail.unitName}
          onClose={() => setDetail(null)}
        />
      )}
    </span>
  );
}
