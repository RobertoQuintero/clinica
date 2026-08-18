"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  disabled?: boolean;
}

export default function CopyButton({
  text,
  label = "Copiar",
  copiedLabel = "¡Copiado!",
  className = "",
  disabled = false,
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [hasCopyError, setHasCopyError] = useState(false);

  async function handleCopyClick() {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopyError(false);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setHasCopyError(true);
      setTimeout(() => setHasCopyError(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopyClick}
      disabled={disabled}
      className={className}
    >
      {hasCopyError ? "Error al copiar" : isCopied ? copiedLabel : label}
    </button>
  );
}
