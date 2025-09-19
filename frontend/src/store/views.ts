import { JSXElement, lazy } from "solid-js";

import { ViewComponent } from "@/store/types";
import { HomeLayout } from "@/pages/home/layout";
import { HomeIndexPage } from "@/pages/home";
import { NotFoundPage } from "@/pages/notfound";
import { ErrorTipView } from "@/pages/error";

import { PageKeys } from "./routes";

export const pages: Omit<Record<PageKeys, ViewComponent>, "root"> = {
  "root.login": lazy(async () => ({ default: (await import("@/pages/login")).LoginPage })),
  "root.register": lazy(async () => ({ default: (await import("@/pages/register")).RegisterPage })),
  // "root.notfound": lazy(async () => ({ default: (await import("@/pages/notfound")).NotFoundPage })),
  "root.error": ErrorTipView,
  "root.notfound": NotFoundPage,
  // "root.home_layout": lazy(async () => ({ default: (await import("@/pages/home/layout")).HomeLayout })),
  "root.home_layout": HomeLayout,
  // "root.home_layout.index": lazy(async () => ({ default: (await import("@/pages/home")).HomeIndexPage })),
  "root.home_layout.index": HomeIndexPage,
  "root.video_preview": lazy(async () => ({
    default: (await import("@/pages/file_preview/video_preview")).VideoFilePreviewView,
  })),
  "root.image_preview": lazy(async () => ({
    default: (await import("@/pages/file_preview/image_preview")).ImageFilePreviewView,
  })),
  "root.pdf_preview": lazy(async () => ({
    default: (await import("@/pages/file_preview/pdf_preview")).PDFFilePreviewView,
  })),
  "root.text_preview": lazy(async () => ({
    default: (await import("@/pages/preview")).PreviewView,
  })),
  "root.settings_layout": lazy(async () => ({
    default: (await import("@/pages/settings/settings_layout")).SettingsView,
  })),
  "root.settings_layout.system": lazy(async () => ({
    default: (await import("@/pages/settings/system")).SystemInfoView,
  })),
};
