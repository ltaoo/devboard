import { For, Show } from "solid-js";
import { Award, Bird, ChevronDown, ChevronLeft, ChevronRight, Gem, Moon, MoreHorizontal, Pen, Sun } from "lucide-solid";
import dayjs from "dayjs";

import { ViewComponentProps } from "@/store/types";
import { useViewModel } from "@/hooks";
import { Button, DropdownMenu, Input, ScrollView } from "@/components/ui";

import { base, Handler } from "@/domains/base";
import {
  ButtonCore,
  DialogCore,
  DropdownMenuCore,
  InputCore,
  MenuItemCore,
  ScrollViewCore,
  SelectCore,
} from "@/domains/ui";
import { ListCore } from "@/domains/list";
import { RequestCore } from "@/domains/request";
import {
  createAccount,
  fetch_user_profile,
  fetch_user_profile_process,
  update_user_profile,
} from "@/biz/user/services";
import { fetchGiftCardProfile, usingGiftCard } from "@/biz/subscription/services";
import { Result } from "@/domains/result";
import { SubscriptionStatus } from "@/biz/subscription/constants";
import { SelectViewModel } from "@/biz/select_base";
import { CalendarCore } from "@/domains/ui/calendar";
import { ObjectFieldCore, SingleFieldCore } from "@/domains/ui/formv2";
import { UserAccountForm } from "@/biz/user/account_form";
import { Select } from "@/components/ui/select";

function HomeMineViewModel(props: ViewComponentProps) {
  const request = {
    mine: {
      profile: new RequestCore(fetch_user_profile, { process: fetch_user_profile_process, client: props.client }),
      update_profile: new RequestCore(update_user_profile, { client: props.client }),
      create_account: new RequestCore(createAccount, { client: props.client }),
    },
    gift_card: {
      profile: new RequestCore(fetchGiftCardProfile, { client: props.client }),
      exchange: new RequestCore(usingGiftCard, { client: props.client }),
    },
  };
  const methods = {
    refresh() {
      bus.emit(Events.StateChange, { ..._state });
    },
    async ready() {
      await methods.refreshWorkoutCalendar();
      await methods.refreshMyProfile();
      return Result.Ok(null);
    },
    gotoWorkoutDayListView() {
      // props.history.push("root.workout_day_list");
    },
    gotoSubscriptionView() {
      // props.history.push("root.subscription");
    },
    showDialogNicknameUpdate() {
      ui.$input_nickname.setValue(_nickname);
      ui.$dialog_nickname_update.show();
    },
    showDialogAvatarURLUpdate() {},
    clearGiftCardProfile() {
      ui.$input_gift_card_code.clear();
      // @ts-ignore
      request.gift_card.profile.modifyResponse(() => {
        return null;
      });
    },
    async refreshWorkoutCalendar() {
      const first_day = ui.$calendar.state.weeks[0].dates[0];
      const last_week = ui.$calendar.state.weeks[ui.$calendar.state.weeks.length - 1];
      const last_day = last_week.dates[last_week.dates.length - 1];
    },
    async refreshMyProfile() {
      const r = await request.mine.profile.run();
      if (r.error) {
        return;
      }
      const { nickname, avatar_url, subscription, no_account } = r.data;
      _nickname = nickname;
      _avatar_url = avatar_url;
      if (subscription && subscription.status === SubscriptionStatus.Active) {
        _subscription = {
          name: subscription.name,
          expired_at: subscription.expired_at_text,
        };
      }
      if (no_account) {
        ui.$dialog_account_create.show();
      }
      methods.refresh();
    },
    changeTheme() {
      const t = (() => {
        if (props.app.theme === "dark") {
          return "light";
        }
        return "dark";
      })();
      props.app.setTheme(t);
      _theme = props.app.theme;
      methods.refresh();
    },
    async createAccount() {
      const r = await ui.$form_account.validate();
      if (r.error) {
        return Result.Err(r.error);
      }
      const r2 = await request.mine.create_account.run(r.data);
      if (r2.error) {
        return Result.Err(r2.error);
      }
      props.app.$user.updateToken(r2.data);
      return Result.Ok(r2.data);
    },
    async handleClickDate(date: { yyyy: string }) {},
    async handleClickPrevMonthReport() {
      const v = ui.$select_month.value;
      const today = dayjs("2025/06/01");
    },
  };
  const today = dayjs();
  const ui = {
    $view: new ScrollViewCore({
      async onPullToRefresh() {
        await methods.ready();
        ui.$view.finishPullToRefresh();
      },
    }),
    $select_month: new SelectCore({
      defaultValue: today.month(),
      options: Array.from({ length: today.month() + 1 }, (_, i) => ({
        label: `${i + 1}月`,
        value: i,
      })),
      onChange(v) {
        if (v === null) {
          return;
        }
        const vv = dayjs().set("month", v);
        // const [start, end] = [vv.startOf("month").startOf("date"), vv.endOf("month").endOf("date")];
        ui.$calendar.selectDay(vv.toDate());
        methods.refreshWorkoutCalendar();
      },
    }),
    $calendar: CalendarCore({
      today: today.toDate(),
    }),
    $menu: new DropdownMenuCore({
      items: [
        // new MenuItemCore({
        //   label: "修改昵称",
        //   onClick() {
        //     ui.$menu.hide();
        //     methods.showDialogNicknameUpdate();
        //   },
        // }),
        // new MenuItemCore({
        //   label: "修改头像",
        //   onClick() {
        //     ui.$menu.hide();
        //     methods.showDialogAvatarURLUpdate();
        //   },
        // }),
        new MenuItemCore({
          label: "复制 UID",
          onClick() {
            const v = request.mine.profile.response;
            if (!v) {
              props.app.tip({
                text: ["异常操作"],
              });
              return;
            }
            props.app.copy(v.uid);
            props.app.tip({
              text: ["复制成功"],
            });
            ui.$menu.hide();
          },
        }),
        new MenuItemCore({
          label: "兑换礼品码",
          onClick() {
            ui.$menu.hide();
            ui.$dialog_gift_card.show();
          },
        }),
        new MenuItemCore({
          label: "设置",
          onClick() {
            ui.$menu.hide();
            // props.history.push("root.settings");
          },
        }),
      ],
    }),
    $dialog_account_create: new DialogCore(),
    $form_account: UserAccountForm().ui.$form,
    $btn_account_create: new ButtonCore({
      async onClick() {
        ui.$btn_account_create.setLoading(true);
        const r = await methods.createAccount();
        ui.$btn_account_create.setLoading(false);
        if (r.error) {
          props.app.tip({
            text: r.error.messages,
          });
          return;
        }
        props.app.tip({
          text: ["操作成功"],
        });
        ui.$dialog_account_create.hide();
      },
    }),
    $dialog_nickname_update: new DialogCore(),
    $input_nickname: new InputCore({
      defaultValue: "",
      onMounted() {
        ui.$input_nickname.focus();
      },
    }),
    $btn_nickname_submit: new ButtonCore({
      async onClick() {
        const v = ui.$input_nickname.value;
        if (!v) {
          props.app.tip({
            text: ["请输入昵称"],
          });
          return;
        }
        ui.$btn_nickname_submit.setLoading(true);
        const r = await request.mine.update_profile.run({ nickname: v });
        ui.$btn_nickname_submit.setLoading(false);
        if (r.error) {
          props.app.tip({
            text: [r.error.message],
          });
          return;
        }
        _nickname = v;
        props.app.tip({
          text: ["修改成功"],
        });
        methods.refresh();
        ui.$dialog_nickname_update.hide();
      },
    }),
    $select_avatar: SelectViewModel({
      defaultValue: [],
      list: [],
      multiple: false,
    }),
    $dialog_avatar_update: new DialogCore(),
    $input_avatar: new InputCore({
      defaultValue: "",
      onMounted() {
        ui.$input_nickname.focus();
      },
    }),
    $btn_avatar_submit: new ButtonCore({
      async onClick() {},
    }),
    $dialog_gift_card: new DialogCore({}),
    $input_gift_card_code: new InputCore({
      defaultValue: "",
      onMounted() {
        ui.$input_gift_card_code.focus();
      },
    }),
    $btn_gift_card_profile: new ButtonCore({
      async onClick() {
        const v = ui.$input_gift_card_code.value;
        if (!v) {
          props.app.tip({
            text: ["请输入礼品码"],
          });
          return;
        }
        ui.$btn_gift_card_profile.setLoading(true);
        const r = await request.gift_card.profile.run({ code: v });
        ui.$btn_gift_card_profile.setLoading(false);
        if (r.error) {
          props.app.tip({
            text: [r.error.message],
          });
          return;
        }
        // ui.$dialog_gift_card.hide();
        // methods.refreshMyProfile();
      },
    }),
    $btn_gift_card_confirm: new ButtonCore({
      async onClick() {
        const v = ui.$input_gift_card_code.value;
        if (!v) {
          props.app.tip({
            text: ["请输入礼品码"],
          });
          return;
        }
        ui.$btn_gift_card_confirm.setLoading(true);
        const r = await request.gift_card.exchange.run({ code: v });
        ui.$btn_gift_card_confirm.setLoading(false);
        if (r.error) {
          props.app.tip({
            text: [r.error.message],
          });
          return;
        }
        props.app.tip({
          text: ["兑换成功"],
        });
        ui.$dialog_gift_card.hide();
        methods.clearGiftCardProfile();
        methods.refreshMyProfile();
      },
    }),
    $dialog_calendar_workout_days: new DialogCore({}),
  };
  let _theme = props.app.theme;
  let _nickname = "...";
  let _avatar_url = "";
  let _subscription: { name: string; expired_at: string | null } | null = null;
  let _state = {
    get nickname() {
      return _nickname;
    },
    get avatar_url() {
      return _avatar_url;
    },
    get subscription() {
      return _subscription;
    },
    get calendar() {
      return {
        weeks: ui.$calendar.state.weeks.map((w) => {
          return {
            dates: w.dates.map((d) => {
              return {
                ...d,
              };
            }),
          };
        }),
      };
    },
    get gift_card() {
      return request.gift_card.profile.response;
    },
    get avatars() {
      return ui.$select_avatar.state.list;
    },
    get theme() {
      return _theme;
    },
  };
  enum Events {
    StateChange,
  }
  type TheTypesOfEvents = {
    [Events.StateChange]: typeof _state;
  };
  const bus = base<TheTypesOfEvents>();
  request.gift_card.profile.onStateChange(() => methods.refresh());
  // ui.$calendar.onStateChange(() => methods.refresh());
  ui.$dialog_nickname_update.onShow(() => {
    ui.$input_nickname.focus();
  });
  ui.$calendar.onChange(() => methods.refresh());
  ui.$select_avatar.onStateChange(() => methods.refresh());

  return {
    methods,
    ui,
    state: _state,
    async ready() {
      methods.ready();
    },
    destroy() {
      bus.destroy();
    },
    onStateChange(handler: Handler<TheTypesOfEvents[Events.StateChange]>) {
      return bus.on(Events.StateChange, handler);
    },
  };
}

export function HomeMineView(props: ViewComponentProps) {
  const [state, vm] = useViewModel(HomeMineViewModel, [props]);

  return (
    <>
      <ScrollView store={vm.ui.$view} class="scroll--hidden bg-w-bg-0"></ScrollView>
      <DropdownMenu store={vm.ui.$menu} />
    </>
  );
}
