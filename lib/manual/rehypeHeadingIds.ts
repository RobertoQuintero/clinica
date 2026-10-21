import "server-only";
import type { Nodes, Root } from "hast";
import type { Plugin } from "unified";

const HEADING_TAG_NAMES = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function collectText(node: Nodes): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map(collectText).join("");
  return "";
}

/**
 * "Días económicos" -> "dias-economicos": quita acentos y pasa a minúsculas con guiones.
 * No se usa `rehype-slug`, que deja el acento en el ancla (`#días-económicos`) y la rompe
 * en los enlaces del "?" (`EMPLOYEE_SETUP_ANCHORS`).
 */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function assignHeadingIds(node: Nodes): void {
  if (node.type === "element" && HEADING_TAG_NAMES.has(node.tagName)) {
    node.properties = { ...node.properties, id: slugify(collectText(node)) };
  }
  if ("children" in node) {
    for (const child of node.children) assignHeadingIds(child);
  }
}

const rehypeHeadingIds: Plugin<[], Root> = () => (tree) => {
  assignHeadingIds(tree);
};

export default rehypeHeadingIds;
