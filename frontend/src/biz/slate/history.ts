import dayjs from "dayjs";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";

import { SlateOperation, SlateOperationType } from "./types";
import { SlateSelectionModel } from "./selection";
import { SlatePoint } from "./point";

type SlateHistoryStack = {
  operations: SlateOperation[];
  selectionBefore: { start: SlatePoint; end: SlatePoint };
};

export function SlateHistoryModel() {
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    mark() {
      _need_new_batch = true;
    },
    push(ops: SlateOperation[], selection: { start: SlatePoint; end: SlatePoint }) {
      //       _stacks.unshift({
      //         ...op,
      //         created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      //       });
      const last_batch = _undo_list.last();
      const last_op = last_batch ? last_batch.operations.last() : null;

      let need_save = true;
      let need_merge_with_last_batch = false;

      if (need_save) {
        if (!last_batch) {
          need_merge_with_last_batch = false;
        } else if (last_batch.operations.length != 0) {
          need_merge_with_last_batch = true;
        }
      }
      if (_need_new_batch) {
        need_merge_with_last_batch = false;
        _need_new_batch = false;
      }
      if (last_batch && need_merge_with_last_batch) {
        last_batch.operations.push(...ops);
      } else {
        const batch = {
          operations: ops,
          selectionBefore: selection,
        };
        _undo_list.push(batch);
      }
      _redo_list = [];
      console.log("[]slate/history - push", _undo_list);
      methods.refresh();
    },
    undo() {
      const last_batch = _undo_list.last();
      console.log("[]slate/history - undo after .last(", last_batch);
      const operations = last_batch ? last_batch.operations.reverse() : [];
      const result: SlateOperation[] = [];
      for (let i = 0; i < operations.length; i += 1) {
        const op = operations[i];
        switch (op.type) {
          case SlateOperationType.InsertText: {
            result.push({
              type: SlateOperationType.RemoveText,
              text: op.text,
              path: op.path,
              offset: op.offset,
            });
            break;
          }
          case SlateOperationType.RemoveText: {
            result.push({
              type: SlateOperationType.InsertText,
              text: op.text,
              path: op.path,
              offset: op.offset,
            });
            break;
          }
        //   case SlateOperationType.SplitNode: {
        //     result.push({
        //       type: SlateOperationType.MergeNode,
        //       path: op.path,
        //       offset: op.offset,
        //     });
        //     break;
        //   }
        //   case SlateOperationType.MergeNode: {
        //     result.push({
        //       type: SlateOperationType.SplitNode,
        //       path: op.path,
        //       offset: op.offset,
        //     });
        //     break;
        //   }
        }
      }
      _undo_list.pop();
      console.log("[]slate/history - undo before return(", result);
      return {
        operations: result,
        selection: last_batch?.selectionBefore ?? null,
      };
    },
  };
  const ui = {};

  let _stacks: (SlateOperation & { created_at: string })[] = [];
  let _undo_list: SlateHistoryStack[] = [];
  let _redo_list: SlateHistoryStack[] = [];
  let _need_new_batch = false;
  let _state = {
    get stacks() {
      return _stacks.map((stack) => {
        return {
          type: stack.type,
          created_at: stack.created_at,
        };
      });
    },
  };
  enum Events {
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  return {
    methods,
    ui,
    state: _state,
    ready() {},
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
    onError(handler: Handler<TheTypesOfEvents[Events.Error]>) {
      return bus.on(Events.Error, handler);
    },
  };
}

export type SlateHistoryModel = ReturnType<typeof SlateHistoryModel>;
