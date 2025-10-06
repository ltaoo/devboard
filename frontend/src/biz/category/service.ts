import { OpenFileDialog, OpenFolderAndHighlightFile, OpenPreviewWindow, SaveFileTo } from "~/fileservice";
import { GetCategoryTreeOptimized } from "~/categoryservice";

import { request } from "@/biz/requests";
import { BizResponse } from "@/biz/requests/types";

export function fetchCategoryTree() {
  return request.post<
    {
      id: string;
      label: string;
    }[]
  >(GetCategoryTreeOptimized);
}
