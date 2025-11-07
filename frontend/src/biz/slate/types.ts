import { MutableRecord2 } from "@/types";
import { SlatePoint } from "./point";

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
  InsertText = "insert_text",
  RemoveText = "remove_text",
  InsertLines = "insert_line",
  RemoveLines = "remove_lines",
  MergeNode = "merge_node",
  SplitNode = "split_node",
  SetSelection = "set_selection",
}
export type SlateOperationInsertText = {
  /** 插入的文本 */
  text: string;
  // node: SlateDescendant;
  path: number[];
  offset: number;
};
export type SlateOperationRemoveText = {
  /** 删除的文本 */
  text: string;
  ignore?: boolean;
  // node: SlateDescendant;
  path: number[];
  offset: number;
};
export type SlateOperationInsertLines = {
  /** 插入的位置，取第一个元素，就是 line index */
  path: number[];
  node: SlateDescendant[];
  // text: string;
};
export type SlateOperationRemoveLines = {
  /** 插入的位置，取第一个元素，就是 line index */
  path: number[];
  node: SlateDescendant[];
  // text: string;
};
export type SlateOperationMergeNode = {
  point1: SlatePoint;
  point2: SlatePoint;
};
export type SlateOperationSplitNode = {
  path: number[];
  offset: number;
  node: SlateDescendant;
};
/** 设置选区/光标位置 */
export type SlateOperationSetSelection = {
  start: SlatePoint;
  end: SlatePoint;
};
export type SlateOperation = MutableRecord2<{
  [SlateOperationType.InsertText]: SlateOperationInsertText;
  [SlateOperationType.RemoveText]: SlateOperationRemoveText;
  [SlateOperationType.InsertLines]: SlateOperationInsertLines;
  [SlateOperationType.RemoveLines]: SlateOperationRemoveLines;
  [SlateOperationType.MergeNode]: SlateOperationMergeNode;
  [SlateOperationType.SplitNode]: SlateOperationSplitNode;
  [SlateOperationType.SetSelection]: SlateOperationSetSelection;
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
