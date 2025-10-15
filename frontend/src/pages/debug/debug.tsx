import { fakePasteEvent } from "@/biz/paste/service";
import { FieldV2 } from "@/components/fieldv2/field";
import { FieldObjV2 } from "@/components/fieldv2/obj";
import { Button, ScrollView, Textarea } from "@/components/ui";
import { base, Handler } from "@/domains/base";
import { BizError } from "@/domains/error";
import { RequestCore } from "@/domains/request";
import { ButtonCore, InputCore, ScrollViewCore } from "@/domains/ui";
import { ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import { useViewModel } from "@/hooks";
import { ViewComponentProps } from "@/store/types";

function DebugConsoleViewModel(props: ViewComponentProps) {
  const request = {
    paste: {
      fake: new RequestCore(fakePasteEvent, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
  };
  const ui = {
    $view: new ScrollViewCore({}),
    $form: new ObjectFieldCore({
      fields: {
        text: new SingleFieldCore({
          input: new InputCore({ defaultValue: "" }),
        }),
      },
    }),
    $btn_submit: new ButtonCore({
      async onClick() {
        const r = await ui.$form.validate();
        if (r.error) {
          props.app.tip({
            text: [r.error.message],
          });
          return;
        }
        const { text } = r.data;
        request.paste.fake.run({ text });
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

export function DebugConsoleView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(DebugConsoleViewModel, [props]);

  return (
    <ScrollView store={vm.ui.$view} class="p-4">
      <div class="space-y-4">
        <FieldObjV2 store={vm.ui.$form}>
          <FieldV2 store={vm.ui.$form.fields.text}>
            <Textarea store={vm.ui.$form.fields.text.input} />
          </FieldV2>
        </FieldObjV2>
        <div>
          <Button store={vm.ui.$btn_submit}>创建</Button>
        </div>
      </div>
    </ScrollView>
  );
}
