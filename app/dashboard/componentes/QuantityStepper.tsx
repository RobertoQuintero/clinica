"use client";

import { Minus, Plus } from "lucide-react";

interface Props {
  value:    number;
  onChange: (value: number) => void;
  min?:     number;
  max?:     number;
  disabled?: boolean;
}

/** Control "− [n] +" compartido entre la revisión de orden y la captura de recepción. */
export default function QuantityStepper({ value, onChange, min = 0, max, disabled = false }: Props) {
  const clamp = (next: number) => {
    let clamped = next;
    if (clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    return clamped;
  };

  return (
    <div className="flex items-center border border-[#c4c6d0] dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 h-9">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="px-2 h-full text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] disabled:opacity-40 disabled:hover:text-[#44474f] transition-colors"
      >
        <Minus size={16} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value.replace(/[^0-9]/g, ""));
          onChange(clamp(Number.isNaN(parsed) ? min : parsed));
        }}
        className="w-14 text-center border-none bg-transparent text-sm text-[#0b1c30] dark:text-zinc-100 focus:ring-0 outline-none p-0 disabled:opacity-40"
      />
      <button
        type="button"
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
        className="px-2 h-full text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] disabled:opacity-40 disabled:hover:text-[#44474f] transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
