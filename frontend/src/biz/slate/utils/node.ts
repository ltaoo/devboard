import { SlateDescendant, SlateDescendantType, SlateNode, SlateParagraph, SlateText } from "../types";
import { isObject } from "./is-object";

/**
 * 深度优先搜索 - 适合查找深层节点
 */
export function depthFirstSearch(
  nodes: (SlateDescendant & { key?: number })[],
  targetKey: number
): SlateDescendant | null {
  for (const node of nodes) {
    // 检查当前节点
    if (node.key === targetKey) {
      return node;
    }

    // 如果是段落节点，递归搜索子节点
    if (node.type === SlateDescendantType.Paragraph && node.children) {
      const found = depthFirstSearch(node.children, targetKey);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function isText(value: any): value is SlateText {
  return isObject(value) && typeof value.text === "string";
}
export function isElement(value: any, extra: Partial<{ deep: boolean }> = {}): value is SlateParagraph {
  const { deep = false } = extra;
  if (!isObject(value)) {
    return false;
  }
  // PERF: No need to use the full Editor.isEditor here
  const isEditor = typeof value.apply === "function";
  if (isEditor) {
    return false;
  }
  const isChildrenValid = deep ? isNodeList(value.children) : Array.isArray(value.children);
  return isChildrenValid;
}
export function isNode(value: any, extra: { deep: boolean }): value is SlateNode {
  return isText(value) || isElement(value, extra);
}

export function isNodeList(value: any) {
  return Array.isArray(value) && value.every((v) => isNode(v, { deep: true }));
}
