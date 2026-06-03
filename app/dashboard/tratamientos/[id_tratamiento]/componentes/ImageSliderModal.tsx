"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Archivo {
  id_archivo: number;
  ruta:       string;
  categoria:  string;
}

interface Props {
  open:       boolean;
  archivos:   Archivo[];
  slideIndex: number;
  onClose:    () => void;
  onSlide:    (index: number) => void;
}

export default function ImageSliderModal({ open, archivos, slideIndex, onClose, onSlide }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !open || archivos.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            {archivos[slideIndex].categoria} — {slideIndex + 1} / {archivos.length}
          </span>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div
          className="flex items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
          style={{ minHeight: 320 }}
        >
          <a href={archivos[slideIndex].ruta} target="_blank" rel="noopener noreferrer">
            <img
              src={archivos[slideIndex].ruta}
              alt={archivos[slideIndex].categoria}
              className="max-h-[60vh] max-w-full rounded-lg object-contain"
            />
          </a>
        </div>

        {archivos.length > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => onSlide((slideIndex - 1 + archivos.length) % archivos.length)}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            >
              ← Anterior
            </button>
            <div className="flex gap-1.5">
              {archivos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSlide(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === slideIndex
                      ? "bg-indigo-600 dark:bg-indigo-400"
                      : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => onSlide((slideIndex + 1) % archivos.length)}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
