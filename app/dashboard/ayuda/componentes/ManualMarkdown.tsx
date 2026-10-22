import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Camera, Info, Lightbulb } from "lucide-react";
import { MANUAL_CALLOUT_LABELS } from "@/lib/manual/modules";
import rehypeHeadingIds from "@/lib/manual/rehypeHeadingIds";
import remarkCallouts from "@/lib/manual/remarkCallouts";
import { buildManualHref } from "@/lib/manual/links";
import type { IManualCapture } from "@/lib/manual/captures";

type CalloutType = "note" | "tip" | "warning";

const CALLOUT_STYLES: Record<CalloutType, { icon: typeof Info; label: string; box: string; icon_: string }> = {
  note: {
    icon: Info,
    label: MANUAL_CALLOUT_LABELS.NOTE,
    box: "border-[#0051d5] bg-[#0051d5]/5 dark:bg-blue-500/10",
    icon_: "text-[#0051d5] dark:text-blue-400",
  },
  tip: {
    icon: Lightbulb,
    label: MANUAL_CALLOUT_LABELS.TIP,
    box: "border-[#009c6b] bg-[#009c6b]/5 dark:bg-emerald-500/10",
    icon_: "text-[#009c6b] dark:text-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    label: MANUAL_CALLOUT_LABELS.WARNING,
    box: "border-amber-500 bg-amber-50 dark:bg-amber-500/10",
    icon_: "text-amber-600 dark:text-amber-400",
  },
};

function isCalloutType(value: unknown): value is CalloutType {
  return value === "note" || value === "tip" || value === "warning";
}

/** "captura:" es el único esquema propio: pasa intacto; todo lo demás sigue la sanitización normal de react-markdown. */
function manualUrlTransform(url: string): string {
  return url.startsWith("captura:") ? url : defaultUrlTransform(url);
}

function ManualLink({ href, moduleSlug, children }: { href?: string; moduleSlug: string; children?: ReactNode }) {
  const linkClasses = "text-[#0051d5] hover:underline dark:text-blue-400";
  if (!href) return <>{children}</>;
  if (href.startsWith("#") || href.startsWith("/")) {
    return href.startsWith("#") ? (
      <a href={href} className={linkClasses}>{children}</a>
    ) : (
      <Link href={href} className={linkClasses}>{children}</Link>
    );
  }
  // Enlace relativo a otra página del manual: "./periodos" o "./preparar-empleado#horario".
  const [pageSlug, anchor] = href.replace(/^\.\//, "").split("#");
  return (
    <Link href={buildManualHref(moduleSlug, pageSlug, anchor)} className={linkClasses}>
      {children}
    </Link>
  );
}

function createManualComponents(moduleSlug: string, captures: Record<string, IManualCapture | null>): Components {
  return {
    div: ({ node, children, ...rest }) => {
      const calloutType = node?.properties?.["data-callout-type"];
      if (!isCalloutType(calloutType)) return <div {...rest}>{children}</div>;

      const style = CALLOUT_STYLES[calloutType];
      const Icon = style.icon;
      return (
        <div className={`my-4 flex gap-3 rounded-lg border-l-4 px-4 py-3 ${style.box}`} role="note">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon_}`} aria-hidden="true" />
          <div className="text-sm leading-relaxed text-[#0b1c30] dark:text-zinc-100 [&_p]:m-0 [&_p+p]:mt-2">
            <p className="mb-1 font-semibold">{style.label}</p>
            {children}
          </div>
        </div>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-[#c4c6d0] pl-4 text-[#44474f] italic dark:border-zinc-700 dark:text-zinc-400">
        {children}
      </blockquote>
    ),
    // Un párrafo cuyo único hijo es una imagen de captura: sin <p>, porque el <figure> que
    // devuelve `img` no es contenido de frase y no puede anidarse dentro de un <p> (hydration error).
    p: ({ node, children }) => {
      const meaningfulChildren = (node?.children ?? []).filter(
        (child) => !(child.type === "text" && child.value.trim() === ""),
      );
      const onlyChild = meaningfulChildren.length === 1 ? meaningfulChildren[0] : null;
      if (onlyChild && onlyChild.type === "element" && onlyChild.tagName === "img") {
        return <>{children}</>;
      }
      return <p>{children}</p>;
    },
    img: ({ src, alt }) => {
      const captureName = typeof src === "string" ? src.replace(/^captura:/, "") : "";
      const capture = captures[captureName];

      if (capture) {
        return (
          <figure className="my-6 flex flex-col items-center gap-2">
            <a
              href={capture.src}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl border border-[#c4c6d0] shadow-sm dark:border-zinc-700"
            >
              <Image
                src={capture.src}
                width={capture.width}
                height={capture.height}
                alt={alt ?? ""}
                sizes="(min-width: 1024px) 48rem, 100vw"
                className="h-auto w-full"
              />
            </a>
            {alt ? (
              <figcaption className="text-center text-xs text-[#44474f] dark:text-zinc-400">{alt}</figcaption>
            ) : null}
          </figure>
        );
      }

      if (process.env.NODE_ENV !== "development") return null;
      return (
        <span className="my-4 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[#c4c6d0] bg-[#eff4ff]/40 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800/40">
          <Camera className="h-6 w-6 text-[#747780] dark:text-zinc-500" aria-hidden="true" />
          <span className="text-xs font-semibold text-[#44474f] dark:text-zinc-400">Captura pendiente</span>
          {alt ? <span className="text-xs text-[#747780] dark:text-zinc-500">{alt}</span> : null}
          {captureName ? <code className="text-[11px] text-[#747780] dark:text-zinc-500">{captureName}</code> : null}
        </span>
      );
    },
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-[#c4c6d0] dark:border-zinc-700">
        <table className="w-full min-w-[480px] text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-[#eff4ff] dark:bg-zinc-800">{children}</thead>,
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#44474f] dark:text-zinc-400">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-t border-[#c4c6d0] px-3 py-2 align-top dark:border-zinc-700">{children}</td>
    ),
    a: ({ href, children }) => (
      <ManualLink href={href} moduleSlug={moduleSlug}>
        {children}
      </ManualLink>
    ),
  };
}

interface Props {
  body: string;
  moduleSlug: string;
  /** Capturas ya resueltas por el Server Component de la página; `null` = sin captura en el manifiesto. */
  captures?: Record<string, IManualCapture | null>;
}

/** Renderer de Markdown del manual, en el servidor y sin JavaScript extra en el navegador. */
export default function ManualMarkdown({ body, moduleSlug, captures = {} }: Props) {
  return (
    <div
      className="max-w-none text-[15px] leading-relaxed text-[#0b1c30] dark:text-zinc-200
        [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#0b1c30] [&_h2]:dark:text-zinc-50
        [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
        [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1
        [&_strong]:font-semibold
        [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:dark:bg-zinc-800"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCallouts]}
        rehypePlugins={[rehypeHeadingIds]}
        urlTransform={manualUrlTransform}
        components={createManualComponents(moduleSlug, captures)}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
