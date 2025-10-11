import { JSX } from "solid-js/jsx-runtime";

import { PageKeysType, build } from "@/domains/route_view/utils";

/**
 * @file 路由配置
 */
const configure = {
  root: {
    title: "ROOT",
    pathname: "/",
    options: {
      require: [],
    },
    children: {
      home_layout: {
        title: "首页布局",
        pathname: "/home",
        children: {
          index: {
            title: "首页",
            pathname: "/home/index",
            options: {
              require: [],
            },
          },
        },
      },
      video_preview: {
        title: "视频",
        pathname: "/video_preview",
      },
      image_preview: {
        title: "视频",
        pathname: "/image_preview",
      },
      pdf_preview: {
        title: "PDF",
        pathname: "/pdf_preview",
      },
      paste_event_preview: {
        title: "详情",
        pathname: "/preview",
      },
      settings_layout: {
        title: "设置",
        pathname: "/settings",
        options: {
          animation: {
            in: "fade-in",
            out: "fade-out",
          },
        },
        children: {
          user_settings: {
            title: "User Settings",
            pathname: "/user_settings",
          },
          category: {
            title: "分类",
            pathname: "/category",
          },
          system: {
            title: "系统信息",
            pathname: "/settings_system",
          },
          synchronization: {
            title: "同步配置",
            pathname: "/settings_synchronization",
          },
        },
      },
      login: {
        title: "登录",
        pathname: "/login",
      },
      register: {
        title: "注册",
        pathname: "/register",
      },
      error: {
        title: "error",
        pathname: "/error",
      },
      notfound: {
        title: "404",
        pathname: "/notfound",
      },
    },
  },
};
export type PageKeys = PageKeysType<typeof configure>;
const result = build<PageKeys>(configure);
export const routes = result.routes;
export const routesWithPathname = result.routesWithPathname;

export function mapPathnameWithPageKey(key: PageKeys) {
  return routes[key].pathname;
}

export type RouteMenu = {
  title: string;
  url?: PageKeys;
  icon?: JSX.Element;
};
