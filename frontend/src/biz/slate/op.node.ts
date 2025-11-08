import { SlatePoint } from "./point";
import { SlateSelectionModel } from "./selection";
import { SlateDescendant, SlateDescendantType, SlateOperation, SlateOperationType } from "./types";
import { deleteTextAtOffset } from "./utils/text";

export const SlateNodeOperations = {
  removeText(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.RemoveText) {
      return nodes;
    }
    const node = findNodeByPath(nodes, op.path);
    if (!node || node.type !== SlateDescendantType.Text) {
      return nodes;
    }
    const original_text = node.text;
    //     const range = [op.offset - 1, op.offset] as [number, number];
    //     const deleted_text = original_text.substring(range[0], range[1]);
    //   console.log("[]deleteBackward - before substring", original_text, deleted_text, node.text, range);
    node.text = deleteTextAtOffset(original_text, op.text, op.offset);
    return nodes;
  },
  splitNode(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.SplitNode) {
      return nodes;
    }
    const node = findNodeByPath(nodes, op.path);
    if (!node || node.type !== SlateDescendantType.Text) {
      return nodes;
    }
    const original_text = node.text;
    const text1 = original_text.slice(0, op.offset);
    const text2 = original_text.slice(op.offset);
    node.text = text1;
    const created_node = {
      type: SlateDescendantType.Paragraph,
      children: [
        {
          type: SlateDescendantType.Text,
          text: text2,
        },
      ],
    } as SlateDescendant;
    const result = [...nodes.slice(0, op.path[0] + 1), created_node, ...nodes.slice(op.path[0] + 1)];
    return result;
  },
  mergeNode(nodes: SlateDescendant[], op: SlateOperation) {
//     if (op.type !== SlateOperationType.MergeNode) {
//       return nodes;
//     }
//     const prev_line_last_node = SlateSelectionModel.getLineLastNode(nodes, start.path[0] - 1);
//     const cur_line_last_node = SlateSelectionModel.getLineFirstNode(nodes, start.path[0]);
//     if (
//       prev_line_last_node.node.type === SlateDescendantType.Text &&
//       cur_line_last_node.node.type === SlateDescendantType.Text
//     ) {
//       prev_line_last_node.node.text = prev_line_last_node.node.text + cur_line_last_node.node.text;
//       nodes = SlateSelectionModel.removeLine(nodes, start.path[0]);
//     }
    return nodes;
  },
};

export function findNodeByPath(nodes: SlateDescendant[], path: number[]) {
  let i = 0;
  let n = nodes[path[i]];
  if (!n) {
    return null;
  }
  while (i < path.length - 1) {
    i += 1;
    //     if (n.type === SlateDescendantType.Text) {
    //       return n;
    //     }
    if (n.type === SlateDescendantType.Paragraph) {
      n = n.children[path[i]];
    }
  }
  return n ?? null;
}
