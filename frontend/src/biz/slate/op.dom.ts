import { SlatePoint } from "./point";
import { SlateDescendant, SlateDescendantType, SlateOperation, SlateOperationType } from "./types";
import { isElement, isText } from "./utils/node";
import { deleteTextAtOffset, insertTextAtOffset } from "./utils/text";

export const SlateDOMOperations = {
  insertText($input: Element, op: SlateOperation) {
    if (op.type !== SlateOperationType.InsertText) {
      return;
    }
    const $target = findNodeByPath($input as Element, op.path) as Element | null;
    if (!$target) {
      return;
    }
    console.log("[]vm.onAction - SlateOperationType.InsertText", $target.tagName, op.path, op.text);
    const t = insertTextAtOffset(getNodeText($target), op.text, op.offset);
    if ($target.tagName === "BR") {
      // @todo 这是浏览器的行为吗？将 <span> 变成了 <br>，导致需要手动再处理回来
      const $span = document.createElement("span");
      $span.innerHTML = t;
      $target.parentNode?.replaceChild($span, $target);
    } else {
      $target.innerHTML = t;
    }
  },
  removeText($input: Element, op: SlateOperation) {
    if (op.type !== SlateOperationType.RemoveText) {
      return;
    }
    const $target = findNodeByPath($input as Element, op.path) as Element | null;
    if (!$target) {
      return;
    }
    console.log("[]vm.onAction - SlateOperationType.DeleteText", $target.innerHTML, op.text);
    if (op.ignore || !op.text) {
      return;
    }
    $target.innerHTML = formatText(deleteTextAtOffset(getNodeText($target), op.text, op.offset));
  },
  splitNode($input: Element, op: SlateOperation) {
    if (op.type !== SlateOperationType.SplitNode) {
      return;
    }
    const $node = findNodeByPath($input, op.path);
    if (!$node) {
      return;
    }
    const text = getNodeText($node);
    console.log("[op.dom]splitNode - 1. original text", text);
    const text1 = text.slice(0, op.offset);
    const text2 = text.slice(op.offset);
    console.log("[op.dom]splitNode - 2. split", text1, text2);
    $node.innerHTML = formatText(text1);
    renderNodeThenInsertLine($input, {
      node: { type: SlateDescendantType.Paragraph, children: [{ type: SlateDescendantType.Text, text: text2 }] },
      path: [op.path[0]],
    });
  },
  mergeNode($input: Element, op: SlateOperation) {
    if (op.type !== SlateOperationType.MergeNode) {
      return;
    }
    const $prev = findNodeByPath($input as Element, op.path) as Element | null;
    const $cur = findNodeByPath($input as Element, op.end.path) as Element | null;
    console.log("[op.dom]mergeNode 0. find nodes", $prev, $cur);
    // 输入中文，在合成过程，当前行的内容和下一行就已经被浏览器合并了，而且还是 <span>text1</span>text2 这样
    console.log("[op.dom]mergeNode 0. find nodes", $prev, $cur);
    if (!$prev || !$cur) {
      return;
    }
    const text1 = getNodeText($prev);
    const text2 = getNodeText($cur);
    console.log("[op.dom]mergeNode 1. text1 and text2", text1, text2);
    const text = text1 + text2;
    $prev.innerHTML = formatText(text);
    const $node2 = findNodeByPath($input as Element, [op.end.path[0]]) as Element | null;
    if ($node2) {
      $node2.parentNode?.removeChild($node2);
    }
  },
  insertLines($input: Element, op: SlateOperation) {
    if (op.type !== SlateOperationType.InsertLines) {
      return;
    }
    renderLineNodesThenInsert($input, op);
  },
  removeLines($input: Element, op: SlateOperation) {
    if (op.type !== SlateOperationType.RemoveLines) {
      return;
    }
    //     console.log("[op.dom]removeLines - ", op.path, op.node);
    const $target = findNodeByPath($input as Element, [op.path[0]]);
    if (!$target) {
      return;
    }
    if (!$target.parentNode) {
      return;
    }
    let idx = op.path[0];
    for (let i = 0; i < op.node.length; i += 1) {
      //       console.log("[op.dom]removeLines - ", i, $target.parentNode.childNodes[i]);
      $target.parentNode.childNodes[idx].remove();
      idx += 1;
    }
  },
};

export function renderText(node: SlateDescendant & { key?: number }): Element | null {
  if (node.type === SlateDescendantType.Text) {
    const $text = document.createElement("span");
    $text.setAttribute("data-slate-node", "text");
    if (node.key) {
      $text.setAttribute("data-slate-node-key", String(node.key));
    }
    $text.innerHTML = formatText(node.text);
    return $text;
  }
  return null;
}
export function renderElement(node: SlateDescendant & { key?: number }): Element | null {
  if (node.type === SlateDescendantType.Paragraph) {
    const $node = document.createElement("p");
    $node.setAttribute("data-slate-node", "element");
    if (node.key) {
      $node.setAttribute("data-slate-node-key", String(node.key));
    }
    const $tmp = document.createDocumentFragment();
    for (let i = 0; i < node.children.length; i += 1) {
      const child = node.children[i];
      if (child.type === SlateDescendantType.Text) {
        const $child = renderText(node.children[i]);
        if ($child) {
          $tmp.appendChild($child);
        }
      }
      if (child.type === SlateDescendantType.Paragraph) {
        const $child = renderElement(node.children[i]);
        if ($child) {
          $tmp.appendChild($child);
        }
      }
    }
    $node.appendChild($tmp);
    return $node;
  }
  return null;
}
export function buildInnerHTML(nodes: SlateDescendant[], parents: number[] = [], level = 0) {
  // let lines: Element[] = [];
  const $tmp = document.createDocumentFragment();
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const path = [...parents, i].filter((v) => v !== undefined).join("_");
    if (isText(node)) {
      const $node = renderText(node);
      if ($node) {
        // lines.push($node);
        $tmp.appendChild($node);
      }
    }
    if (isElement(node)) {
      const $node = renderElement(node);
      if ($node) {
        // lines.push($node);
        $tmp.appendChild($node);
      }
    }
  }
  return $tmp;
}

// const TEXT_EMPTY_PLACEHOLDER = "&#8203;";
// const TEXT_EMPTY_PLACEHOLDER = "";
// const TEXT_EMPTY_PLACEHOLDER = "&#x2060;";
const TEXT_EMPTY_PLACEHOLDER = "<br>";
// const TEXT_EMPTY_PLACEHOLDER = "&nbsp;";

export function getNodeText($node: Element) {
  const v = $node.innerHTML;
  return formatInnerHTML(v);
}
export function formatInnerHTML(v: string) {
  if (v === TEXT_EMPTY_PLACEHOLDER) {
    return "";
  }
  return v;
}
export function formatText(v: string) {
  if (v === "") {
    return TEXT_EMPTY_PLACEHOLDER;
  }
  return v;
}

export function renderNodeThenInsertLine($input: Element, op: { node: SlateDescendant; path: number[] }) {
  console.log("[SlateView]renderNodeThenInsertLine - ", op.node, op.path);
  const $node = renderElement(op.node);
  if (!$node) {
    return;
  }
  const idx = op.path[0] + 1;
  if (idx > $input.children.length - 1) {
    $input.appendChild($node);
  } else {
    console.log("[SlateView]renderNodeThenInsertLine - insertBefore", $node, $input.childNodes[idx]);
    $input.insertBefore($node, $input.children[idx]);
  }
}
export function renderLineNodesThenInsert($input: Element, op: { node: SlateDescendant[]; path: number[] }) {
  console.log("[SlateView]renderNodeThenInsertLine - ", op.node, op.path);
  const $tmp = document.createDocumentFragment();
  for (let i = 0; i < op.node.length; i += 1) {
    const $node = renderElement(op.node[i]);
    if ($node) {
      $tmp.appendChild($node);
    }
  }
  const idx = op.path[0] + 1;
  if (idx > $input.children.length - 1) {
    $input.appendChild($tmp);
  } else {
    console.log("[SlateView]renderNodeThenInsertLine - insertBefore", $input.childNodes[idx]);
    $input.insertBefore($tmp, $input.children[idx]);
  }
}

export function findInnerTextNode($node?: any) {
  // console.log('[]findInnerTextNode', $node?.tagName);
  if (!$node) {
    return null;
  }
  while ($node) {
    if ($node.tagName === "SPAN") {
      return $node;
    }
    $node = $node.childNodes[0] as Element;
    if (!$node) {
      return null;
    }
  }
  return null;
}

export function getNodePath(targetNode: Element, rootNode: Element) {
  const path = [];
  let currentNode = targetNode;

  // 从目标节点向上遍历直到根节点
  while (currentNode && currentNode !== rootNode) {
    const parent = currentNode.parentNode;
    if (!parent) break;

    // 获取当前节点在父节点中的索引
    const children = Array.from(parent.children);
    const index = children.indexOf(currentNode);

    if (index !== -1) {
      path.unshift(index); // 添加到路径开头
    }
    // @ts-ignore
    currentNode = parent;
  }

  return path;
}

export function findNodeByPath($elm: Element, path: number[]): Element | null {
  if (path.length === 0) {
    return $elm;
  }
  const $v = $elm.childNodes[path[0]];
  if (!$v) {
    return null;
  }
  return findNodeByPath($v as Element, path.slice(1));
}

export function refreshSelection($editor: Element, start: SlatePoint, end: SlatePoint) {
  //     const { start, end } = vm.ui.$selection.state;
  const $node_start = findNodeByPath($editor as Element, start.path);
  const $node_end = findNodeByPath($editor as Element, end.path);
  if (!$node_start || !$node_end) {
    return;
  }
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.setStart($node_start.childNodes[0], start.offset);
  range.setEnd($node_end.childNodes[0], end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}
