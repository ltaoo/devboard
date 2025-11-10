import { describe, expect, it } from "vitest";

import { SlateNodeOperations } from "../op.node";
import { SlateDescendant, SlateDescendantType, SlateOperation, SlateOperationType } from "../types";
import { children } from "solid-js";

describe("path", () => {
  it("insert text", () => {
    const op: SlateOperation = {
      type: SlateOperationType.InsertText,
      text: "Try it out for yourself",
      original_text: "",
      path: [2, 0],
      offset: 0,
    };
    const nodes: SlateDescendant[] = [
      {
        type: SlateDescendantType.Paragraph,
        children: [
          {
            type: SlateDescendantType.Text,
            text: "1",
          },
        ],
      },
      {
        type: SlateDescendantType.Paragraph,
        children: [
          {
            type: SlateDescendantType.Text,
            text: "2",
          },
        ],
      },
      {
        type: SlateDescendantType.Paragraph,
        children: [
          {
            type: SlateDescendantType.Text,
            text: "!",
          },
        ],
      },
    ];
    const result = SlateNodeOperations.insertText(nodes, op);
    if (result[2].type === SlateDescendantType.Paragraph) {
      const n = result[2].children[0];
      const { type } = n;
      if (type === SlateDescendantType.Text) {
        expect(n.text).toBe("Try it out for yourself!");
      }
    }
  });
});
