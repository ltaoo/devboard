/* @refresh reload */

import { createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";
import { Edit, LoaderCircle, Plus, Trash } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, Input, Popover, ScrollView } from "@/components/ui";
import { TreeSelect } from "@/components/tree-select/tree-select";
import { TreeEdit } from "@/components/tree-select/tree-edit";

import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { TreeSelectModel } from "@/domains/ui/tree-select/tree-select";
import { TreeNodeEditModel } from "@/domains/ui/tree-select/tree-node-edit";
import { ButtonCore, ScrollViewCore } from "@/domains/ui";
import { RequestCore } from "@/domains/request";
import { fetchCategoryTree } from "@/biz/category/service";

type Node = {
  id: string;
  label: string;
  children?: Node[];
};

function CategorySettingsModel(props: ViewComponentProps) {
  const request = {
    category: {
      tree: new RequestCore(fetchCategoryTree, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $tree: TreeSelectModel<Node>({ nodes: [], value: [], onChange() {} }),
    $edit: TreeNodeEditModel<Node>({
      onCreate(v) {
        // const ok = ui.$tree.methods.appendNodeWithUID(v.uid, {
        //   id: 123,
        //   label: v.value,
        // });
        // if (!ok) {
        //   return;
        // }
        // ui.$edit.ui.$popover.hide();
      },
      onEdit(v) {
        const ok = ui.$tree.methods.setNodeWithUID(v.uid, {
          ...v.node,
          label: v.value,
        });
        if (!ok) {
          return;
        }
        ui.$edit.ui.$popover.hide();
      },
      onDelete(v) {
        const ok = ui.$tree.methods.searchNodeWithUIDThenRemove(v.uid);
        if (!ok) {
          return;
        }
        ui.$edit.ui.$popover.hide();
      },
    }),
    $btn: new ButtonCore({
      onClick() {
        ui.$tree.methods.removeChildNodeWithUID("1-1");
      },
    }),
  };
  let _state = {};
  enum Events {
    StateChange,
    Error,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
    [Events.Error]: BizError;
  };
  const bus = base<TheTypesOfEvents>();

  // ui.$tree.methods.setNodes([
  //   {
  //     id: 1,
  //     label: "前端开发",
  //     children: [
  //       {
  //         id: 2,
  //         label: "JavaScript",
  //       },
  //       {
  //         id: 3,
  //         label: "TypeScript",
  //       },
  //       {
  //         id: 4,
  //         label: "React",
  //         children: [
  //           {
  //             id: 5,
  //             label: "Redux",
  //           },
  //           {
  //             id: 6,
  //             label: "UmuJS",
  //           },
  //           {
  //             id: 7,
  //             label: "Axios",
  //           },
  //         ],
  //       },
  //     ],
  //   },
  //   {
  //     id: 4,
  //     label: "后端开发",
  //     children: [
  //       {
  //         id: 5,
  //         label: "Golang",
  //       },
  //       {
  //         id: 6,
  //         label: "NodeJS",
  //       },
  //     ],
  //   },
  // ]);

  return {
    methods,
    ui,
    state: _state,
    async ready() {
      const r = await request.category.tree.run();
      if (r.error) {
        return;
      }
      // console.log(r.data);
      ui.$tree.methods.setNodes(r.data);
    },
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

export function CategorySettingsView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(CategorySettingsModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="text-2xl text-w-fg-0">标签</div>
      <TreeEdit
        store={vm.ui.$tree}
        renderNode={(v) => {
          return (
            <div class="flex">
              {/* <div>"{v.uid}"</div> */}
              {/* <div class="ml-2">
                {v.level}-{v.idx}
              </div> */}
              <div class="ml-2 w-[80px]">{v.node.label}</div>
              {/* <div class="flex items-center space-x-1 ml-4">
                <Edit
                  class="w-4 h-4 cursor-pointer"
                  onClick={(event) => {
                    const { x, y } = event.currentTarget.getBoundingClientRect();
                    vm.ui.$edit.methods.setPayload(v);
                    vm.ui.$edit.methods.handleEdit({ x, y });
                  }}
                />
                <Plus
                  class="w-4 h-4 cursor-pointer"
                  onClick={(event) => {
                    const { x, y } = event.currentTarget.getBoundingClientRect();
                    vm.ui.$edit.methods.setPayload(v);
                    vm.ui.$edit.methods.handlePlus({ x, y });
                  }}
                />
                <Trash
                  class="w-4 h-4 cursor-pointer"
                  onClick={() => {
                    vm.ui.$edit.methods.setPayload(v);
                    vm.ui.$edit.methods.handleDelete({});
                  }}
                />
              </div> */}
            </div>
          );
        }}
      />
      <Popover store={vm.ui.$edit.ui.$popover}>
        <Input store={vm.ui.$edit.ui.$input} />
        <div class="flex justify-between mt-2">
          <div></div>
          <div class="flex gap-1">
            <Button size="sm" store={vm.ui.$edit.ui.$btn_ok}>
              取消
            </Button>
            <Button size="sm" store={vm.ui.$edit.ui.$btn_ok}>
              确定
            </Button>
          </div>
        </div>
      </Popover>
    </ScrollView>
  );
}
