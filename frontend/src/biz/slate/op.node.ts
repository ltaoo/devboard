import { update_arr_item } from "@/utils";
import { SlatePoint } from "./point";
import { SlateSelectionModel } from "./selection";
import { SlateDescendant, SlateDescendantType, SlateOperation, SlateOperationType } from "./types";
import { deleteTextAtOffset, insertTextAtOffset } from "./utils/text";

export const SlateNodeOperations = {
  insertText(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.InsertText) {
      return nodes;
    }
    const node = findNodeByPath(nodes, op.path);
    if (node && node.type === SlateDescendantType.Text) {
      node.text = insertTextAtOffset(node.text, op.text, op.offset);
    }
    return nodes;
  },
  replaceText(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.ReplaceText) {
      return nodes;
    }
    const node = findNodeByPath(nodes, op.path);
    if (node && node.type === SlateDescendantType.Text) {
      node.text = insertTextAtOffset(op.original_text, op.text, op.offset);
    }
    return nodes;
  },
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
    const p1 = op.path[0] + 1;
    const p2 = op.path[0] + 1;
    console.log("[op.node]before insert created_node", nodes, p1, p2);
    //     if (p1 === nodes.length - 1) {
    //       return [...nodes, created_node];
    //     }
    return [...nodes.slice(0, p1), created_node, ...nodes.slice(p2)];
  },
  mergeNode(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.MergeNode) {
      return nodes;
    }
    const prev_line_last_node = findNodeByPath(nodes, op.path);
    const cur_line_last_node = findNodeByPath(nodes, op.end.path);
    if (
      prev_line_last_node &&
      cur_line_last_node &&
      prev_line_last_node.type === SlateDescendantType.Text &&
      cur_line_last_node.type === SlateDescendantType.Text
    ) {
      prev_line_last_node.text = prev_line_last_node.text + cur_line_last_node.text;
      // nodes = update_arr_item(nodes, op.path[0], {
      //   ...prev_line_last_node,
      //   text: prev_line_last_node.text + cur_line_last_node.text,
      // });
      nodes = SlateSelectionModel.removeLine(nodes, op.end.path[0]);
    }
    return nodes;
  },
  insertLines(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.InsertLines) {
      return nodes;
    }
    return [...nodes.slice(0, op.path[0] + 1), ...op.node, ...nodes.slice(op.path[0] + 1)];
  },
  removeLines(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type !== SlateOperationType.RemoveLines) {
      return nodes;
    }
    return [...nodes.slice(0, op.path[0]), ...nodes.slice(op.path[0] + op.node.length)];
  },
  exec(nodes: SlateDescendant[], op: SlateOperation) {
    if (op.type === SlateOperationType.InsertText) {
      return SlateNodeOperations.insertText(nodes, op);
    }
    if (op.type === SlateOperationType.ReplaceText) {
      return SlateNodeOperations.replaceText(nodes, op);
    }
    if (op.type === SlateOperationType.RemoveText) {
      return SlateNodeOperations.removeText(nodes, op);
    }
    if (op.type === SlateOperationType.InsertLines) {
      return SlateNodeOperations.insertLines(nodes, op);
    }
    if (op.type === SlateOperationType.RemoveLines) {
      return SlateNodeOperations.removeLines(nodes, op);
    }
    if (op.type === SlateOperationType.MergeNode) {
      return SlateNodeOperations.mergeNode(nodes, op);
    }
    if (op.type === SlateOperationType.SplitNode) {
      return SlateNodeOperations.splitNode(nodes, op);
    }
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
