import { MutableRecord2 } from "@/types";

export type SlateNode = {};
export enum SlateDescendantType {
  Text = "text",
  Paragraph = "paragraph",
}
export type SlateParagraph = { children: SlateDescendant[] };
export type SlateText = { text: string };
export type SlateDescendant = MutableRecord2<{
  [SlateDescendantType.Text]: SlateText;
  [SlateDescendantType.Paragraph]: SlateParagraph;
}>;

export enum SlateOperationType {
  InsertText,
  DeleteText,
  InsertLine,
}
export type SlateOperationInsertText = {
  /** 操作后的文本 */
  wholeText: string;
  node: SlateDescendant;
  /** 操作位置 */
  offset: number;
  /** 操作节点路径 */
  path: number[];
};
export type SlateOperationDeleteText = {
  /** 操作后的文本 */
  wholeText: string;
  node: SlateDescendant;
  /** 操作位置 */
  offset: number;
  /** 操作节点路径 */
  path: number[];
};
export type SlateOperationInsertLine = {
  /** 插入的位置 */
  idx: number;
  node: SlateDescendant;
};
export type SlateOperation = MutableRecord2<{
  [SlateOperationType.InsertText]: SlateOperationInsertText;
  [SlateOperationType.DeleteText]: SlateOperationDeleteText;
  [SlateOperationType.InsertLine]: SlateOperationInsertLine;
}>;

type ExtendableTypes =
  | "Editor"
  | "Element"
  | "Text"
  | "Selection"
  | "Range"
  | "Point"
  | "Operation"
  | "InsertNodeOperation"
  | "InsertTextOperation"
  | "MergeNodeOperation"
  | "MoveNodeOperation"
  | "RemoveNodeOperation"
  | "RemoveTextOperation"
  | "SetNodeOperation"
  | "SetSelectionOperation"
  | "SplitNodeOperation";

export interface CustomTypes {
  [key: string]: unknown;
}

export type ExtendedType<K extends ExtendableTypes, B> = unknown extends CustomTypes[K] ? B : CustomTypes[K];

export type LeafEdge = "start" | "end";

export type MaximizeMode = RangeMode | "all";

export type MoveUnit = "offset" | "character" | "word" | "line";

export type RangeDirection = TextDirection | "outward" | "inward";

export type RangeMode = "highest" | "lowest";

export type SelectionEdge = "anchor" | "focus" | "start" | "end";

export type SelectionMode = "all" | "highest" | "lowest";

export type TextDirection = "forward" | "backward";

export type TextUnit = "character" | "word" | "line" | "block";

export type TextUnitAdjustment = TextUnit | "offset";
