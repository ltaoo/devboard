// @ts-nocheck

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
