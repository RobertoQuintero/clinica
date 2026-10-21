import "server-only";
import type { Blockquote, Nodes, Paragraph, Root, Text } from "mdast";
import type { Plugin } from "unified";

const CALLOUT_MARKER = /^\[!(NOTE|TIP|WARNING)\]\n?/;

interface CalloutMarker {
  type: "note" | "tip" | "warning";
  textNode: Text;
}

function asCalloutMarker(blockquote: Blockquote): CalloutMarker | null {
  const [firstChild] = blockquote.children;
  if (!firstChild || firstChild.type !== "paragraph") return null;

  const [firstGrandchild] = (firstChild as Paragraph).children;
  if (!firstGrandchild || firstGrandchild.type !== "text") return null;

  const match = CALLOUT_MARKER.exec(firstGrandchild.value);
  if (!match) return null;

  return { type: match[1].toLowerCase() as CalloutMarker["type"], textNode: firstGrandchild };
}

function transformCallouts(node: Nodes): void {
  if (node.type === "blockquote") {
    const marker = asCalloutMarker(node);
    if (marker) {
      marker.textNode.value = marker.textNode.value.replace(CALLOUT_MARKER, "");

      const firstParagraph = node.children[0] as Paragraph;
      if (marker.textNode.value === "" && firstParagraph.children.length === 1) {
        node.children = node.children.slice(1);
      }

      node.data = {
        ...node.data,
        hName: "div",
        hProperties: { ...node.data?.hProperties, "data-callout-type": marker.type },
      };
    }
  }

  if ("children" in node) {
    for (const child of node.children) transformCallouts(child);
  }
}

/**
 * Cajas de aviso con la sintaxis de GitHub: un blockquote cuya primera línea es
 * `[!NOTE]`, `[!TIP]` o `[!WARNING]`. Marca el blockquote con `hName: "div"` y
 * `data-callout-type` (que `remark-rehype`, ya interno de `react-markdown`, respeta) para
 * que `ManualMarkdown` lo reemplace por la caja correspondiente. `hName: "div"` (en vez de
 * una etiqueta propia) porque `Components` de `react-markdown` solo acepta claves de
 * `JSX.IntrinsicElements`.
 */
const remarkCallouts: Plugin<[], Root> = () => (tree) => {
  transformCallouts(tree);
};

export default remarkCallouts;
