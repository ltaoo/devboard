import { SlateDescendant, SlateDescendantType } from "../types";

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
