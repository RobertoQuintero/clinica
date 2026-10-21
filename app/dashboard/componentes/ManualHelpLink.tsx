import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { buildManualHref } from "@/lib/manual/links";

interface Props {
  moduleSlug: string;
  topicSlug: string;
  anchor?: string;
  className?: string;
}

/** Ícono "?" junto al título de una pantalla, que abre su página del manual (spec 92). */
export default function ManualHelpLink({ moduleSlug, topicSlug, anchor, className }: Props) {
  return (
    <Link
      href={buildManualHref(moduleSlug, topicSlug, anchor)}
      aria-label="Ver ayuda de esta pantalla"
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#c4c6d0] text-[#747780] transition-colors hover:border-[#0051d5] hover:text-[#0051d5] dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-blue-500 dark:hover:text-blue-400 ${className ?? ""}`}
    >
      <HelpCircle size={14} />
    </Link>
  );
}
