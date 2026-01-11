/**
 * @file 首页
 */
import { For, Match, Show, Switch } from "solid-js";
import { Bird, Check, ChevronUp, Copy, Download, Earth, Eye, File, Folder, Link, Trash } from "lucide-solid";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { HTMLCard } from "@/components/html-card";
import { Button, ListView, Popover, ScrollView, Skeleton, Textarea } from "@/components/ui";
import { RelativeTime } from "@/components/relative_time";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { WaterfallView } from "@/components/ui/waterfall/waterfall";
import { buildOptionFromWaterfallCell, WithTagsInput, WithTagsInputModel } from "@/components/with-tags-input";
import {
  DynamicContentWithClick,
  DynamicContentWithClickModel,
  ModelInList,
} from "@/components/dynamic-content/with-click";
import { CodeCard } from "@/components/code-card";
import { CommandToolSelect, CommandToolSelectModel } from "@/components/command-list";

import { isCodeContent } from "@/biz/paste/utils";

import { HomeIndexViewModel } from "./model";

const CopyButtonJSXArr = [
  {
    content: <Copy class="w-4 h-4 text-w-fg-0" />,
  },
  {
    content: <Check class="w-4 h-4 text-green-500" />,
  },
];

export const HomeIndexView = (props: ViewComponentProps) => {
  const [state, vm] = useViewModel(HomeIndexViewModel, [props]);

  return (
    <>
      <div class="relative w-full h-full" style="--custom-contextmenu: refresh; --custom-contextmenu-data: some-data">
        <Show when={!!state().show_refresh_tip}>
          <div class="z-[99] absolute top-4 left-1/2 -translate-x-1/2">
            <div class="py-2 px-4 bg-w-bg-3 rounded-full cursor-pointer" onClick={vm.methods.loadAddedRecords}>
              <div class="text-sm">{state().show_refresh_tip}条新内容</div>
            </div>
          </div>
        </Show>
        <ScrollView
          store={vm.ui.$view}
          class="z-0 relative bg-w-bg-0 scroll--hidden"
          classList={{
            // "w-[375px] mx-auto": props.app.env.pc,
            "w-full": !props.app.env.pc,
          }}
        >
          {/* <div class="p-2">
            <SlateView store={vm.ui.$input_main} />
          </div> */}
          <div class="p-4 pb-0">
            <WithTagsInput store={vm.ui.$input_search} />
          </div>
          <WaterfallView
            class="relative p-4"
            store={vm.ui.$waterfall}
            list={vm.request.paste.list}
            // showFallback={state().paste_event.empty}
            fallback={
              <Show when={state().paste_event.empty}>
                <div class="flex flex-col items-center justify-center pt-12">
                  <Bird class="text-w-fg-2 w-36 h-36" />
                  <div class="mt-2 text-center text-w-fg-1">没有数据</div>
                </div>
              </Show>
            }
            render={(payload, idx) => {
              const v = payload;
              return (
                <div
                  classList={{
                    "paste-event-card group relative p-2 rounded-md outline outline-2 outline-w-fg-3 select-text": true,
                    "bg-w-fg-5": state().highlighted_idx === idx,
                  }}
                  onClick={() => {
                    vm.ui.$list_highlight.methods.handleEnterMenuOption(idx);
                  }}
                >
                  <Show when={state().highlighted_idx === idx}>
                    <div class="absolute left-[-4px] top-1/2 -translate-y-1/2 w-[4px] h-[36px] rounded-md bg-green-500"></div>
                  </Show>
                  <div class="paste-event-card__content">
                    {/* <div class="absolute left-0 top-0">{state().highlighted_idx}</div> */}
                    {/* <div class="absolute left-2 top-2">{v.id}</div> */}
                    <div
                      classList={{
                        "relative max-h-[120px] overflow-hidden rounded-md": true,
                      }}
                    >
                      {/* <div
                    classList={{
                      "absolute left-0 top-0 h-full w-[4px] bg-green-300 hidden": true,
                      "group-hover:block": true,
                    }}
                  ></div> */}
                      {/* <div class="absolute right-0">{idx}</div> */}
                      <Switch fallback={<div class="p-2 text-w-fg-0 break-all">{v.text}</div>}>
                        <Match when={v.type === "file" && v.files}>
                          <div class="w-full p-2 overflow-auto whitespace-nowrap scroll--hidden">
                            <For each={v.files}>
                              {(f) => {
                                return (
                                  <div>
                                    <div
                                      class="inline-flex items-center gap-1 cursor-pointer hover:underline"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        vm.methods.handleClickFile(f);
                                      }}
                                    >
                                      <Switch>
                                        <Match when={f.mime_type === "folder"}>
                                          <Folder class="w-4 h-4 text-w-fg-1" />
                                        </Match>
                                        <Match when={f.mime_type !== "folder"}>
                                          <File class="w-4 h-4 text-w-fg-1" />
                                        </Match>
                                      </Switch>
                                      <div class="text-w-fg-0">{f.name}</div>
                                    </div>
                                  </div>
                                );
                              }}
                            </For>
                          </div>
                        </Match>
                        <Match when={v.types.includes("url") && v.text}>
                          <div class="w-full p-2 overflow-auto whitespace-nowrap scroll--hidden">
                            <div
                              class="flex items-center gap-1 cursor-pointer"
                              onClick={() => {
                                vm.methods.handleClickURL(v.text!);
                              }}
                            >
                              <Link class="w-4 h-4" />
                              <div class="flex-1 w-0 underline">{v.text}</div>
                            </div>
                          </div>
                        </Match>
                        <Match when={v.types.includes("color")}>
                          <div class="flex items-center gap-1 p-2">
                            <div class="w-[16px] h-[16px]" style={{ "background-color": v.text }}></div>
                            <div>{v.text}</div>
                          </div>
                        </Match>
                        <Match when={v.types.includes("time") || v.types.includes("size")}>
                          <div class="flex items-center gap-2 p-2">
                            <div>{v.origin_text}</div>
                            <div class="text-w-fg-1">{v.text}</div>
                          </div>
                        </Match>
                        <Match when={v.type === "html" && v.text}>
                          <HTMLCard html={v.text!} />
                        </Match>
                        <Match when={v.type === "image" && v.image_url}>
                          <AspectRatio class="relative" ratio={6 / 2}>
                            <img class="absolute w-full h-full object-cover" src={v.image_url!} />
                          </AspectRatio>
                        </Match>
                        <Match when={isCodeContent(v.types) && v.text}>
                          <div class="w-full overflow-auto">
                            <CodeCard id={v.id} language={v.language} code={v.text!} />
                          </div>
                        </Match>
                      </Switch>
                    </div>
                    <div class="flex items-center justify-between mt-1">
                      <div class="flex items-center space-x-1 tags">
                        <div class="px-2 bg-w-bg-5 rounded-full">
                          <div class="text-w-fg-0 text-sm" title={v.id}>
                            #{idx + 1}
                          </div>
                        </div>
                        <For each={v.categories}>
                          {(c) => {
                            return (
                              <div class="px-2 bg-w-bg-5 rounded-full">
                                <div class="text-w-fg-0 text-sm">#{c.label}</div>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                      <div class="flex items-center h-[32px]">
                        <Show
                          when={state().highlighted_idx === idx}
                          fallback={
                            <div class="time flex justify-between">
                              <div title={v.updated_at_text}>
                                <RelativeTime class="text-sm text-w-fg-1" time={v.updated_at}></RelativeTime>
                              </div>
                            </div>
                          }
                        >
                          <div class="operations flex justify-between">
                            <div class="flex items-center gap-1">
                              <Show when={v.operations.includes("download")}>
                                <div
                                  class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    vm.methods.handleClickDownloadBtn(v);
                                  }}
                                >
                                  <Download class="w-4 h-4 text-w-fg-0" />
                                </div>
                              </Show>
                              <div
                                class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  vm.methods.handleClickTrashBtn(v);
                                }}
                              >
                                <Trash class="w-4 h-4 text-w-fg-0" />
                              </div>
                              <Show when={vm.ui.$map_copy_btn.methods.get(v.id)}>
                                <div
                                  class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    vm.methods.handleClickCopyBtn(v);
                                  }}
                                >
                                  <DynamicContentWithClick store={vm.ui.$map_copy_btn.methods.get(v.id)!} />
                                </div>
                              </Show>
                              <Show when={["JSON"].includes(v.type)}>
                                <div
                                  class="p-1 rounded-md cursor-pointer hover:bg-w-bg-5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    vm.methods.handleClickFileBtn(v);
                                  }}
                                >
                                  <File class="w-4 h-4 text-w-fg-0" />
                                </div>
                              </Show>
                            </div>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </ScrollView>
        <Show when={!!state().show_back_to_top}>
          <div class="z-[99] absolute bottom-8 right-8">
            <div class="p-2 bg-w-bg-3 rounded-full cursor-pointer" onClick={vm.methods.handleClickUpBtn}>
              <ChevronUp class="w-8 h-8 text-w-fg-0" />
            </div>
          </div>
        </Show>
      </div>
      <CommandToolSelect store={vm.ui.$commands} />
    </>
  );
};
