package service

import (
	"encoding/json"

	"github.com/ltaoo/velo"

	"devboard/internal/biz"
)

func RegisterRoutes(app *velo.Box, biz_app *biz.BizApp) {
	paste_service := NewPasteService(app, biz_app)
	category_service := NewCategoryService(biz_app)
	remark_service := NewRemarkService(biz_app)
	sync_service := NewSynchronizeService(biz_app)
	system_service := NewSystemService(biz_app)
	common_service := NewCommonService(biz_app)
	douyin_service := &DouyinService{Biz: biz_app}
	config_service := &ConfigService{Biz: biz_app}
	file_service := NewFileService(app)

	register_post(app, "/api/paste/list", paste_service.FetchPasteEventList)
	register_post(app, "/api/paste/profile", paste_service.FetchPasteEventProfile)
	register_post(app, "/api/paste/delete", paste_service.DeletePasteEvent)
	register_post(app, "/api/paste/preview", paste_service.PreviewPasteEvent)
	register_post(app, "/api/paste/write", paste_service.Write)
	register_post(app, "/api/paste/download", paste_service.DownloadContentWithPasteEventId)
	register_post(app, "/api/paste/temp-image", paste_service.GetPasteImageAsTempFile)
	register_post(app, "/api/paste/mock", paste_service.MockPasteText)

	register_post(app, "/api/category/create", category_service.CreateCategory)
	register_get(app, "/api/category/tree", category_service.FetchCategoryTree)
	register_get(app, "/api/category/tree-optimized", category_service.GetCategoryTreeOptimized)
	register_get(app, "/api/category/tree-optimized-2", category_service.GetCategoryTreeOptimized2)

	register_post(app, "/api/remark/create", remark_service.CreateRemark)
	register_post(app, "/api/remark/list", remark_service.FetchRemarkList)
	register_post(app, "/api/remark/delete", remark_service.DeleteRemark)

	register_post(app, "/api/common/window", common_service.OpenWindow)
	register_post(app, "/api/common/error", common_service.ShowError)
	register_get(app, "/api/common/quit", common_service.Quit)
	register_post(app, "/api/common/shortcut/register", common_service.RegisterShortcut)
	register_post(app, "/api/common/shortcut/unregister", common_service.UnregisterShortcut)
	register_post(app, "/api/common/apps", common_service.FetchAppList)
	register_post(app, "/api/common/devices", common_service.FetchDeviceList)
	register_post(app, "/api/common/url-meta", common_service.FetchURLMeta)

	register_get(app, "/api/system/state", system_service.FetchApplicationState)
	register_get(app, "/api/system/info", system_service.FetchComputeInfo)
	register_post(app, "/api/system/autostart", system_service.UpdateAutoStart)
	register_get(app, "/api/config/read", config_service.Read)
	register_post(app, "/api/config/write", config_service.WriteConfig)
	register_post(app, "/api/config/update", config_service.UpdateSettingsByPath)

	register_get(app, "/api/sync/dirs", sync_service.FetchDatabaseDirs)
	register_post(app, "/api/sync/ping", sync_service.PingWebDav)
	register_post(app, "/api/sync/upload", sync_service.LocalToRemote)
	register_post(app, "/api/sync/download", sync_service.RemoteToLocal)
	register_post(app, "/api/douyin/download", douyin_service.DownloadDouyinVideo)

	register_get(app, "/api/file/open", file_service.OpenFileDialog)
	register_post(app, "/api/file/save", file_service.SaveFileTo)
	register_post(app, "/api/file/reveal", file_service.OpenFolderAndHighlightFile)
	register_post(app, "/api/file/preview", file_service.OpenPreviewWindow)
	app.Get("/file", func(context *velo.BoxContext) interface{} {
		file_service.ServeHTTP(context.Writer, context.Request)
		return nil
	})
}

func register_get(app *velo.Box, path string, handler func() *Result) {
	app.Get(path, func(_ *velo.BoxContext) interface{} {
		return encode_result(handler())
	})
}

func register_post[body_type any](app *velo.Box, path string, handler func(body_type) *Result) {
	app.Post(path, func(context *velo.BoxContext) interface{} {
		var body body_type
		if err := context.BindJSON(&body); err != nil {
			return encode_result(Error(err))
		}
		return encode_result(handler(body))
	})
}

func encode_result(result *Result) string {
	data, err := json.Marshal(result)
	if err != nil {
		fallback, _ := json.Marshal(Error(err))
		return string(fallback)
	}
	return string(data)
}
