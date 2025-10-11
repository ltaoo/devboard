package douyinweb

type DouyinWebVideoProfileResp struct {
	AwemeDetail AwemeDetail `json:"aweme_detail"`
	LogPb       LogPb       `json:"log_pb"`
	StatusCode  int         `json:"status_code"`
}
type LogPb struct {
	ImprId string `json:"impr_id"`
}
type AwemeDetail struct {
	ActivityVideoType               int                        `json:"activity_video_type"`
	Anchors                         interface{}                `json:"anchors"`
	AuthenticationToken             string                     `json:"authentication_token"`
	Author                          Author                     `json:"author"`
	AuthorMaskTag                   int                        `json:"author_mask_tag"`
	AuthorUserId                    int                        `json:"author_user_id"`
	AwemeControl                    AwemeControl               `json:"aweme_control"`
	AwemeId                         string                     `json:"aweme_id"`
	AwemeListenStruct               AwemeListenStruct          `json:"aweme_listen_struct"`
	AwemeType                       int                        `json:"aweme_type"`
	AwemeTypeTags                   string                     `json:"aweme_type_tags"`
	BoostStatus                     int                        `json:"boost_status"`
	CanCacheToLocal                 bool                       `json:"can_cache_to_local"`
	Caption                         string                     `json:"caption"`
	CaptionTemplateId               int                        `json:"caption_template_id"`
	CfAssetsType                    int                        `json:"cf_assets_type"`
	CfRecheckTs                     int                        `json:"cf_recheck_ts"`
	ChallengePosition               interface{}                `json:"challenge_position"`
	ChapterList                     interface{}                `json:"chapter_list"`
	CollectStat                     int                        `json:"collect_stat"`
	CollectionCornerMark            int                        `json:"collection_corner_mark"`
	CommentGid                      int                        `json:"comment_gid"`
	CommentList                     interface{}                `json:"comment_list"`
	CommentPermissionInfo           CommentPermissionInfo      `json:"comment_permission_info"`
	CommerceConfigData              interface{}                `json:"commerce_config_data"`
	ComponentControl                ComponentControl           `json:"component_control"`
	ComponentInfoV2                 string                     `json:"component_info_v2"`
	CoverLabels                     interface{}                `json:"cover_labels"`
	CreateScaleType                 []string                   `json:"create_scale_type"`
	CreateTime                      int                        `json:"create_time"`
	DanmakuControl                  DanmakuControl             `json:"danmaku_control"`
	Desc                            string                     `json:"desc"`
	DisableRelationBar              int                        `json:"disable_relation_bar"`
	DislikeDimensionList            interface{}                `json:"dislike_dimension_list"`
	DislikeDimensionListV2          interface{}                `json:"dislike_dimension_list_v2"`
	DistributeCircle                DistributeCircle           `json:"distribute_circle"`
	DouplusUserType                 int                        `json:"douplus_user_type"`
	DouyinPcVideoExtraSeo           string                     `json:"douyin_pc_video_extra_seo"`
	DuetAggregateInMusicTab         bool                       `json:"duet_aggregate_in_music_tab"`
	Duration                        int                        `json:"duration"`
	EcomCommentAtmosphereType       int                        `json:"ecom_comment_atmosphere_type"`
	EnableCommentStickerRec         bool                       `json:"enable_comment_sticker_rec"`
	EntLogExtra                     EntLogExtra                `json:"ent_log_extra"`
	EntertainmentProductInfo        EntertainmentProductInfo   `json:"entertainment_product_info"`
	EntertainmentVideoPaidWay       EntertainmentVideoPaidWay  `json:"entertainment_video_paid_way"`
	EntertainmentVideoType          int                        `json:"entertainment_video_type"`
	FallCardStruct                  FallCardStruct             `json:"fall_card_struct"`
	FeedCommentConfig               FeedCommentConfig          `json:"feed_comment_config"`
	FlashMobTrends                  int                        `json:"flash_mob_trends"`
	FollowShootClipInfo             FollowShootClipInfo        `json:"follow_shoot_clip_info"`
	FriendRecommendInfo             FriendRecommendInfo        `json:"friend_recommend_info"`
	GalileoPadTextcrop              GalileoPadTextcrop         `json:"galileo_pad_textcrop"`
	GameTagInfo                     GameTagInfo                `json:"game_tag_info"`
	Geofencing                      []interface{}              `json:"geofencing"`
	GeofencingRegions               interface{}                `json:"geofencing_regions"`
	GroupId                         string                     `json:"group_id"`
	GuideSceneInfo                  GuideSceneInfo             `json:"guide_scene_info"`
	HybridLabel                     interface{}                `json:"hybrid_label"`
	ImageAlbumMusicInfo             ImageAlbumMusicInfo        `json:"image_album_music_info"`
	ImageComment                    ImageComment               `json:"image_comment"`
	ImageCropCtrl                   int                        `json:"image_crop_ctrl"`
	ImageInfos                      interface{}                `json:"image_infos"`
	ImageList                       interface{}                `json:"image_list"`
	Images                          interface{}                `json:"images"`
	ImgBitrate                      interface{}                `json:"img_bitrate"`
	ImpressionData                  ImpressionData             `json:"impression_data"`
	IncentiveItemType               int                        `json:"incentive_item_type"`
	InteractionStickers             interface{}                `json:"interaction_stickers"`
	Is24Story                       int                        `json:"is_24_story"`
	Is25Story                       int                        `json:"is_25_story"`
	IsAds                           bool                       `json:"is_ads"`
	IsCollectsSelected              int                        `json:"is_collects_selected"`
	IsDuetSing                      bool                       `json:"is_duet_sing"`
	IsFromAdAuth                    bool                       `json:"is_from_ad_auth"`
	IsImageBeat                     bool                       `json:"is_image_beat"`
	IsLifeItem                      bool                       `json:"is_life_item"`
	IsMomentHistory                 int                        `json:"is_moment_history"`
	IsMomentStory                   int                        `json:"is_moment_story"`
	IsNewTextMode                   int                        `json:"is_new_text_mode"`
	IsSharePost                     bool                       `json:"is_share_post"`
	IsStory                         int                        `json:"is_story"`
	IsTop                           int                        `json:"is_top"`
	IsUseMusic                      bool                       `json:"is_use_music"`
	ItemTitle                       string                     `json:"item_title"`
	ItemWarnNotification            ItemWarnNotification       `json:"item_warn_notification"`
	LabelTopText                    interface{}                `json:"label_top_text"`
	LibfinsertTaskId                string                     `json:"libfinsert_task_id"`
	LongVideo                       interface{}                `json:"long_video"`
	MarkLargelyFollowing            bool                       `json:"mark_largely_following"`
	MediaType                       int                        `json:"media_type"`
	Music                           Music                      `json:"music"`
	NicknamePosition                interface{}                `json:"nickname_position"`
	OriginCommentIds                interface{}                `json:"origin_comment_ids"`
	OriginDuetResourceUri           string                     `json:"origin_duet_resource_uri"`
	OriginTextExtra                 []interface{}              `json:"origin_text_extra"`
	Original                        int                        `json:"original"`
	OriginalImages                  interface{}                `json:"original_images"`
	PackedClips                     interface{}                `json:"packed_clips"`
	PersonalPageBottonDiagnoseStyle int                        `json:"personal_page_botton_diagnose_style"`
	PhotoSearchEntrance             PhotoSearchEntrance        `json:"photo_search_entrance"`
	PlayProgress                    PlayProgress               `json:"play_progress"`
	Position                        interface{}                `json:"position"`
	PreviewTitle                    string                     `json:"preview_title"`
	PreviewVideoStatus              int                        `json:"preview_video_status"`
	ProductGenreInfo                ProductGenreInfo           `json:"product_genre_info"`
	Promotions                      []interface{}              `json:"promotions"`
	PublishPlusAlienation           PublishPlusAlienation      `json:"publish_plus_alienation"`
	Rate                            int                        `json:"rate"`
	Region                          string                     `json:"region"`
	RelationLabels                  interface{}                `json:"relation_labels"`
	RiskInfos                       RiskInfos                  `json:"risk_infos"`
	SelectAnchorExpandedContent     int                        `json:"select_anchor_expanded_content"`
	SeoInfo                         SeoInfo                    `json:"seo_info"`
	SeriesBasicInfo                 SeriesBasicInfo            `json:"series_basic_info"`
	SeriesPaidInfo                  SeriesPaidInfo             `json:"series_paid_info"`
	ShareInfo                       ShareInfo                  `json:"share_info"`
	ShareRecExtra                   string                     `json:"share_rec_extra"`
	ShareUrl                        string                     `json:"share_url"`
	ShootWay                        string                     `json:"shoot_way"`
	ShouldOpenAdReport              bool                       `json:"should_open_ad_report"`
	ShowFollowButton                ShowFollowButton           `json:"show_follow_button"`
	SocialTagList                   interface{}                `json:"social_tag_list"`
	Statistics                      Statistics                 `json:"statistics"`
	Status                          Status                     `json:"status"`
	SuggestWords                    SuggestWords               `json:"suggest_words"`
	TextExtra                       []TextExtra                `json:"text_extra"`
	TrendsEventTrack                string                     `json:"trends_event_track"`
	UniqidPosition                  interface{}                `json:"uniqid_position"`
	UserDigged                      int                        `json:"user_digged"`
	UserRecommendStatus             int                        `json:"user_recommend_status"`
	Video                           Video                      `json:"video"`
	VideoControl                    VideoControl               `json:"video_control"`
	VideoGameDataChannelConfig      VideoGameDataChannelConfig `json:"video_game_data_channel_config"`
	VideoLabels                     interface{}                `json:"video_labels"`
	VideoShareEditStatus            int                        `json:"video_share_edit_status"`
	VideoTag                        []VideoTag                 `json:"video_tag"`
	VideoText                       []interface{}              `json:"video_text"`
	VisualSearchInfo                VisualSearchInfo           `json:"visual_search_info"`
	VtagSearch                      VtagSearch                 `json:"vtag_search"`
	XiguaBaseInfo                   XiguaBaseInfo              `json:"xigua_base_info"`
}
type XiguaBaseInfo struct {
	ItemId           int `json:"item_id"`
	StarAltarOrderId int `json:"star_altar_order_id"`
	StarAltarType    int `json:"star_altar_type"`
	Status           int `json:"status"`
}
type VtagSearch struct {
	DefaultVtagData   string `json:"default_vtag_data"`
	DefaultVtagEnable bool   `json:"default_vtag_enable"`
}
type VisualSearchInfo struct {
	IsEcomImg          bool `json:"is_ecom_img"`
	IsHighAccuracyEcom bool `json:"is_high_accuracy_ecom"`
	IsHighRecallEcom   bool `json:"is_high_recall_ecom"`
	IsShowImgEntrance  bool `json:"is_show_img_entrance"`
}
type VideoTag struct {
	Level   int    `json:"level"`
	TagId   int    `json:"tag_id"`
	TagName string `json:"tag_name"`
}
type VideoGameDataChannelConfig struct {
}
type VideoControl struct {
	AllowDouplus             bool         `json:"allow_douplus"`
	AllowDownload            bool         `json:"allow_download"`
	AllowDuet                bool         `json:"allow_duet"`
	AllowDynamicWallpaper    bool         `json:"allow_dynamic_wallpaper"`
	AllowMusic               bool         `json:"allow_music"`
	AllowReact               bool         `json:"allow_react"`
	AllowRecord              bool         `json:"allow_record"`
	AllowShare               bool         `json:"allow_share"`
	AllowStitch              bool         `json:"allow_stitch"`
	DisableRecordReason      string       `json:"disable_record_reason"`
	DownloadIgnoreVisibility bool         `json:"download_ignore_visibility"`
	DownloadInfo             DownloadInfo `json:"download_info"`
	DraftProgressBar         int          `json:"draft_progress_bar"`
	DuetIgnoreVisibility     bool         `json:"duet_ignore_visibility"`
	DuetInfo                 DuetInfo     `json:"duet_info"`
	PreventDownloadType      int          `json:"prevent_download_type"`
	ShareGrayed              bool         `json:"share_grayed"`
	ShareIgnoreVisibility    bool         `json:"share_ignore_visibility"`
	ShareType                int          `json:"share_type"`
	ShowProgressBar          int          `json:"show_progress_bar"`
	TimerInfo                TimerInfo    `json:"timer_info"`
	TimerStatus              int          `json:"timer_status"`
}
type TimerInfo struct {
}
type DuetInfo struct {
	Level int `json:"level"`
}
type DownloadInfo struct {
	Level int `json:"level"`
}
type Video struct {
	Audio                     Audio                  `json:"audio"`
	BigThumbs                 []interface{}          `json:"big_thumbs"`
	BitRate                   []BitRate              `json:"bit_rate"`
	BitRateAudio              interface{}            `json:"bit_rate_audio"`
	CdnUrlExpired             int                    `json:"cdn_url_expired"`
	Cover                     Cover                  `json:"cover"`
	CoverOriginalScale        CoverOriginalScale     `json:"cover_original_scale"`
	DownloadAddr              DownloadAddr           `json:"download_addr"`
	DownloadSuffixLogoAddr    DownloadSuffixLogoAddr `json:"download_suffix_logo_addr"`
	Duration                  int                    `json:"duration"`
	DynamicCover              DynamicCover           `json:"dynamic_cover"`
	Format                    string                 `json:"format"`
	GaussianCover             GaussianCover          `json:"gaussian_cover"`
	HasDownloadSuffixLogoAddr bool                   `json:"has_download_suffix_logo_addr"`
	HasWatermark              bool                   `json:"has_watermark"`
	Height                    int                    `json:"height"`
	IsH265                    int                    `json:"is_h265"`
	IsSourceHdr               int                    `json:"is_source_HDR"`
	Meta                      string                 `json:"meta"`
	MiscDownloadAddrs         string                 `json:"misc_download_addrs"`
	OriginCover               OriginCover            `json:"origin_cover"`
	PlayAddr                  PlayAddr               `json:"play_addr"`
	PlayAddr265               PlayAddr265            `json:"play_addr_265"`
	PlayAddrH264              PlayAddrH264           `json:"play_addr_h264"`
	Ratio                     string                 `json:"ratio"`
	VideoModel                string                 `json:"video_model"`
	Width                     int                    `json:"width"`
}
type PlayAddrH264 struct {
	DataSize int      `json:"data_size"`
	FileCs   string   `json:"file_cs"`
	FileHash string   `json:"file_hash"`
	Height   int      `json:"height"`
	Uri      string   `json:"uri"`
	UrlKey   string   `json:"url_key"`
	UrlList  []string `json:"url_list"`
	Width    int      `json:"width"`
}
type PlayAddr265 struct {
	DataSize int      `json:"data_size"`
	FileCs   string   `json:"file_cs"`
	FileHash string   `json:"file_hash"`
	Height   int      `json:"height"`
	Uri      string   `json:"uri"`
	UrlKey   string   `json:"url_key"`
	UrlList  []string `json:"url_list"`
	Width    int      `json:"width"`
}

type OriginCover struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type GaussianCover struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type DynamicCover struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type DownloadSuffixLogoAddr struct {
	DataSize int      `json:"data_size"`
	FileCs   string   `json:"file_cs"`
	Height   int      `json:"height"`
	Uri      string   `json:"uri"`
	UrlList  []string `json:"url_list"`
	Width    int      `json:"width"`
}
type DownloadAddr struct {
	DataSize int      `json:"data_size"`
	FileCs   string   `json:"file_cs"`
	Height   int      `json:"height"`
	Uri      string   `json:"uri"`
	UrlList  []string `json:"url_list"`
	Width    int      `json:"width"`
}
type CoverOriginalScale struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type Cover struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type BitRate struct {
	Fps         int      `json:"FPS"`
	HdrBit      string   `json:"HDR_bit"`
	HdrType     string   `json:"HDR_type"`
	BitRate     int      `json:"bit_rate"`
	Format      string   `json:"format"`
	GearName    string   `json:"gear_name"`
	IsBytevc1   int      `json:"is_bytevc1"`
	IsH265      int      `json:"is_h265"`
	PlayAddr    PlayAddr `json:"play_addr"`
	QualityType int      `json:"quality_type"`
	VideoExtra  string   `json:"video_extra"`
}
type PlayAddr struct {
	DataSize int      `json:"data_size"`
	FileCs   string   `json:"file_cs"`
	FileHash string   `json:"file_hash"`
	Height   int      `json:"height"`
	Uri      string   `json:"uri"`
	UrlKey   string   `json:"url_key"`
	UrlList  []string `json:"url_list"`
	Width    int      `json:"width"`
}
type Audio struct {
}
type TextExtra struct {
	CaptionEnd   int    `json:"caption_end"`
	CaptionStart int    `json:"caption_start"`
	End          int    `json:"end"`
	HashtagId    string `json:"hashtag_id"`
	HashtagName  string `json:"hashtag_name"`
	IsCommerce   bool   `json:"is_commerce"`
	Start        int    `json:"start"`
	Type         int    `json:"type"`
}
type SuggestWords struct {
	SuggestWords []InnerSuggestWords `json:"suggest_words"`
}
type InnerSuggestWords struct {
	ExtraInfo string  `json:"extra_info"`
	HintText  string  `json:"hint_text"`
	IconUrl   string  `json:"icon_url"`
	Scene     string  `json:"scene"`
	Words     []Words `json:"words"`
}
type Words struct {
	Info   string `json:"info"`
	Word   string `json:"word"`
	WordId string `json:"word_id"`
}
type Status struct {
	AllowFriendRecommend       bool         `json:"allow_friend_recommend"`
	AllowFriendRecommendGuide  bool         `json:"allow_friend_recommend_guide"`
	AllowSelfRecommendToFriend bool         `json:"allow_self_recommend_to_friend"`
	AllowShare                 bool         `json:"allow_share"`
	AwemeId                    string       `json:"aweme_id"`
	EnableSoftDelete           int          `json:"enable_soft_delete"`
	InReviewing                bool         `json:"in_reviewing"`
	IsDelete                   bool         `json:"is_delete"`
	IsProhibited               bool         `json:"is_prohibited"`
	ListenVideoStatus          int          `json:"listen_video_status"`
	NotAllowSoftDelReason      string       `json:"not_allow_soft_del_reason"`
	PartSee                    int          `json:"part_see"`
	PrivateStatus              int          `json:"private_status"`
	ReviewResult               ReviewResult `json:"review_result"`
}
type ReviewResult struct {
	ReviewStatus int `json:"review_status"`
}
type Statistics struct {
	AdmireCount    int    `json:"admire_count"`
	AwemeId        string `json:"aweme_id"`
	CollectCount   int    `json:"collect_count"`
	CommentCount   int    `json:"comment_count"`
	DiggCount      int    `json:"digg_count"`
	PlayCount      int    `json:"play_count"`
	RecommendCount int    `json:"recommend_count"`
	ShareCount     int    `json:"share_count"`
}
type ShowFollowButton struct {
}

type SeriesPaidInfo struct {
	ItemPrice        int `json:"item_price"`
	SeriesPaidStatus int `json:"series_paid_status"`
}
type SeriesBasicInfo struct {
}
type SeoInfo struct {
}
type RiskInfos struct {
	Content  string `json:"content"`
	RiskSink bool   `json:"risk_sink"`
	Type     int    `json:"type"`
	Vote     bool   `json:"vote"`
	Warn     bool   `json:"warn"`
}
type PublishPlusAlienation struct {
	AlienationType int `json:"alienation_type"`
}
type ProductGenreInfo struct {
	MaterialGenreSubTypeSet []int       `json:"material_genre_sub_type_set"`
	ProductGenreType        int         `json:"product_genre_type"`
	SpecialInfo             SpecialInfo `json:"special_info"`
}
type SpecialInfo struct {
	RecommendGroupName int `json:"recommend_group_name"`
}
type PlayProgress struct {
	LastModifiedTime int `json:"last_modified_time"`
	PlayProgress     int `json:"play_progress"`
}
type PhotoSearchEntrance struct {
	EcomType int `json:"ecom_type"`
}
type Music struct {
	Album                          string        `json:"album"`
	ArtistUserInfos                interface{}   `json:"artist_user_infos"`
	Artists                        []interface{} `json:"artists"`
	AuditionDuration               int           `json:"audition_duration"`
	Author                         string        `json:"author"`
	AuthorDeleted                  bool          `json:"author_deleted"`
	AuthorPosition                 interface{}   `json:"author_position"`
	AuthorStatus                   int           `json:"author_status"`
	AvatarLarge                    AvatarLarge   `json:"avatar_large"`
	AvatarMedium                   AvatarMedium  `json:"avatar_medium"`
	AvatarThumb                    AvatarThumb   `json:"avatar_thumb"`
	BindedChallengeId              int           `json:"binded_challenge_id"`
	CanBackgroundPlay              bool          `json:"can_background_play"`
	CollectStat                    int           `json:"collect_stat"`
	CoverHd                        CoverHd       `json:"cover_hd"`
	CoverLarge                     CoverLarge    `json:"cover_large"`
	CoverMedium                    CoverMedium   `json:"cover_medium"`
	CoverThumb                     CoverThumb    `json:"cover_thumb"`
	DmvAutoShow                    bool          `json:"dmv_auto_show"`
	DspStatus                      int           `json:"dsp_status"`
	Duration                       int           `json:"duration"`
	EndTime                        int           `json:"end_time"`
	ExternalSongInfo               []interface{} `json:"external_song_info"`
	Extra                          string        `json:"extra"`
	Id                             int           `json:"id"`
	IdStr                          string        `json:"id_str"`
	IsAudioUrlWithCookie           bool          `json:"is_audio_url_with_cookie"`
	IsCommerceMusic                bool          `json:"is_commerce_music"`
	IsDelVideo                     bool          `json:"is_del_video"`
	IsMatchedMetadata              bool          `json:"is_matched_metadata"`
	IsOriginal                     bool          `json:"is_original"`
	IsOriginalSound                bool          `json:"is_original_sound"`
	IsPgc                          bool          `json:"is_pgc"`
	IsRestricted                   bool          `json:"is_restricted"`
	IsVideoSelfSee                 bool          `json:"is_video_self_see"`
	LyricShortPosition             interface{}   `json:"lyric_short_position"`
	Mid                            string        `json:"mid"`
	MusicChartRanks                interface{}   `json:"music_chart_ranks"`
	MusicCollectCount              int           `json:"music_collect_count"`
	MusicCoverAtmosphereColorValue string        `json:"music_cover_atmosphere_color_value"`
	MusicStatus                    int           `json:"music_status"`
	MusicianUserInfos              interface{}   `json:"musician_user_infos"`
	MuteShare                      bool          `json:"mute_share"`
	OfflineDesc                    string        `json:"offline_desc"`
	OwnerHandle                    string        `json:"owner_handle"`
	OwnerId                        string        `json:"owner_id"`
	OwnerNickname                  string        `json:"owner_nickname"`
	PgcMusicType                   int           `json:"pgc_music_type"`
	PlayUrl                        PlayUrl       `json:"play_url"`
	Position                       interface{}   `json:"position"`
	PreventDownload                bool          `json:"prevent_download"`
	PreventItemDownloadStatus      int           `json:"prevent_item_download_status"`
	PreviewEndTime                 int           `json:"preview_end_time"`
	PreviewStartTime               int           `json:"preview_start_time"`
	ReasonType                     int           `json:"reason_type"`
	Redirect                       bool          `json:"redirect"`
	SchemaUrl                      string        `json:"schema_url"`
	SearchImpr                     SearchImpr    `json:"search_impr"`
	SecUid                         string        `json:"sec_uid"`
	ShootDuration                  int           `json:"shoot_duration"`
	ShowOriginClip                 bool          `json:"show_origin_clip"`
	SourcePlatform                 int           `json:"source_platform"`
	StartTime                      int           `json:"start_time"`
	Status                         int           `json:"status"`
	TagList                        interface{}   `json:"tag_list"`
	Title                          string        `json:"title"`
	UnshelveCountries              interface{}   `json:"unshelve_countries"`
	UserCount                      int           `json:"user_count"`
	VideoDuration                  int           `json:"video_duration"`
}
type SearchImpr struct {
	EntityId string `json:"entity_id"`
}
type PlayUrl struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlKey  string   `json:"url_key"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type CoverThumb struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type CoverMedium struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type CoverLarge struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type CoverHd struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type AvatarThumb struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}

type AvatarMedium struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type AvatarLarge struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
type ItemWarnNotification struct {
	Content string `json:"content"`
	Show    bool   `json:"show"`
	Type    int    `json:"type"`
}
type ImpressionData struct {
	GroupIdListA   []interface{} `json:"group_id_list_a"`
	GroupIdListB   []interface{} `json:"group_id_list_b"`
	GroupIdListC   []interface{} `json:"group_id_list_c"`
	GroupIdListD   []interface{} `json:"group_id_list_d"`
	SimilarIdListA interface{}   `json:"similar_id_list_a"`
	SimilarIdListB interface{}   `json:"similar_id_list_b"`
}
type ImageComment struct {
}
type ImageAlbumMusicInfo struct {
	BeginTime int `json:"begin_time"`
	EndTime   int `json:"end_time"`
	Volume    int `json:"volume"`
}
type GuideSceneInfo struct {
}
type GameTagInfo struct {
	IsGame bool `json:"is_game"`
}
type GalileoPadTextcrop struct {
	AndroidDHCutRatio []int `json:"android_d_h_cut_ratio"`
	AndroidDVCutRatio []int `json:"android_d_v_cut_ratio"`
	IpadDHCutRatio    []int `json:"ipad_d_h_cut_ratio"`
	IpadDVCutRatio    []int `json:"ipad_d_v_cut_ratio"`
	Version           int   `json:"version"`
}
type FriendRecommendInfo struct {
	DisableFriendRecommendGuideLabel bool `json:"disable_friend_recommend_guide_label"`
	FriendRecommendSource            int  `json:"friend_recommend_source"`
}
type FollowShootClipInfo struct {
	ClipFromUser int `json:"clip_from_user"`
	ClipVideoAll int `json:"clip_video_all"`
}
type FeedCommentConfig struct {
	AuthorAuditStatus int    `json:"author_audit_status"`
	CommonFlags       string `json:"common_flags"`
	InputConfigText   string `json:"input_config_text"`
}
type FallCardStruct struct {
	RecommendReasonV2 string `json:"recommend_reason_v2"`
}
type EntertainmentVideoPaidWay struct {
	EnableUseNewEntData bool          `json:"enable_use_new_ent_data"`
	PaidType            int           `json:"paid_type"`
	PaidWays            []interface{} `json:"paid_ways"`
}
type EntertainmentProductInfo struct {
	MarketInfo MarketInfo `json:"market_info"`
}
type MarketInfo struct {
	LimitFree LimitFree `json:"limit_free"`
}
type LimitFree struct {
	InFree bool `json:"in_free"`
}
type EntLogExtra struct {
	LogExtra string `json:"log_extra"`
}
type DistributeCircle struct {
	CampusBlockInteraction bool `json:"campus_block_interaction"`
	DistributeType         int  `json:"distribute_type"`
	IsCampus               bool `json:"is_campus"`
}
type DanmakuControl struct {
	Activities         []Activities `json:"activities"`
	DanmakuCnt         int          `json:"danmaku_cnt"`
	EnableDanmaku      bool         `json:"enable_danmaku"`
	FirstDanmakuOffset int          `json:"first_danmaku_offset"`
	IsPostDenied       bool         `json:"is_post_denied"`
	LastDanmakuOffset  int          `json:"last_danmaku_offset"`
	PassThroughParams  string       `json:"pass_through_params"`
	PostDeniedReason   string       `json:"post_denied_reason"`
	PostPrivilegeLevel int          `json:"post_privilege_level"`
	SkipDanmaku        bool         `json:"skip_danmaku"`
	SmartModeDecision  int          `json:"smart_mode_decision"`
}
type Activities struct {
	Id   int `json:"id"`
	Type int `json:"type"`
}
type ComponentControl struct {
	DataSourceUrl string `json:"data_source_url"`
}
type CommentPermissionInfo struct {
	CanComment              bool `json:"can_comment"`
	CommentPermissionStatus int  `json:"comment_permission_status"`
	ItemDetailEntry         bool `json:"item_detail_entry"`
	PressEntry              bool `json:"press_entry"`
	ToastGuide              bool `json:"toast_guide"`
}
type AwemeListenStruct struct {
	TraceInfo string `json:"trace_info"`
}
type AwemeControl struct {
	CanComment     bool `json:"can_comment"`
	CanForward     bool `json:"can_forward"`
	CanShare       bool `json:"can_share"`
	CanShowComment bool `json:"can_show_comment"`
}
type Author struct {
	AvatarThumb                            AvatarThumb `json:"avatar_thumb"`
	AwemehtsGreetInfo                      string      `json:"awemehts_greet_info"`
	CfList                                 interface{} `json:"cf_list"`
	CloseFriendType                        int         `json:"close_friend_type"`
	ContactsStatus                         int         `json:"contacts_status"`
	ContrailList                           interface{} `json:"contrail_list"`
	CoverUrl                               []CoverUrl  `json:"cover_url"`
	CreateTime                             int         `json:"create_time"`
	CustomVerify                           string      `json:"custom_verify"`
	DataLabelList                          interface{} `json:"data_label_list"`
	EndorsementInfoList                    interface{} `json:"endorsement_info_list"`
	EnterpriseVerifyReason                 string      `json:"enterprise_verify_reason"`
	FavoritingCount                        int         `json:"favoriting_count"`
	FollowStatus                           int         `json:"follow_status"`
	FollowerCount                          int         `json:"follower_count"`
	FollowerListSecondaryInformationStruct interface{} `json:"follower_list_secondary_information_struct"`
	FollowerStatus                         int         `json:"follower_status"`
	FollowingCount                         int         `json:"following_count"`
	ImRoleIds                              interface{} `json:"im_role_ids"`
	IsAdFake                               bool        `json:"is_ad_fake"`
	IsBlockedV2                            bool        `json:"is_blocked_v2"`
	IsBlockingV2                           bool        `json:"is_blocking_v2"`
	IsCf                                   int         `json:"is_cf"`
	LiveHighValue                          int         `json:"live_high_value"`
	MateAddPermission                      int         `json:"mate_add_permission"`
	MaxFollowerCount                       int         `json:"max_follower_count"`
	Nickname                               string      `json:"nickname"`
	OfflineInfoList                        interface{} `json:"offline_info_list"`
	PersonalTagList                        interface{} `json:"personal_tag_list"`
	PreventDownload                        bool        `json:"prevent_download"`
	RiskNoticeText                         string      `json:"risk_notice_text"`
	SecUid                                 string      `json:"sec_uid"`
	Secret                                 int         `json:"secret"`
	ShareInfo                              ShareInfo   `json:"share_info"`
	ShortId                                string      `json:"short_id"`
	Signature                              string      `json:"signature"`
	SignatureExtra                         interface{} `json:"signature_extra"`
	SpecialFollowStatus                    int         `json:"special_follow_status"`
	SpecialPeopleLabels                    interface{} `json:"special_people_labels"`
	Status                                 int         `json:"status"`
	StoryInteractive                       int         `json:"story_interactive"`
	StoryTtl                               int         `json:"story_ttl"`
	TextExtra                              interface{} `json:"text_extra"`
	TotalFavorited                         int         `json:"total_favorited"`
	Uid                                    string      `json:"uid"`
	UniqueId                               string      `json:"unique_id"`
	UserAge                                int         `json:"user_age"`
	UserCanceled                           bool        `json:"user_canceled"`
	UserPermissions                        interface{} `json:"user_permissions"`
	VerificationType                       int         `json:"verification_type"`
}
type ShareInfo struct {
	ShareDesc        string         `json:"share_desc"`
	ShareDescInfo    string         `json:"share_desc_info"`
	ShareLinkDesc    string         `json:"share_link_desc"`
	ShareQrcodeUrl   ShareQrcodeUrl `json:"share_qrcode_url"`
	ShareTitle       string         `json:"share_title"`
	ShareTitleMyself string         `json:"share_title_myself"`
	ShareTitleOther  string         `json:"share_title_other"`
	ShareUrl         string         `json:"share_url"`
	ShareWeiboDesc   string         `json:"share_weibo_desc"`
}

type ShareQrcodeUrl struct {
	Height  int           `json:"height"`
	Uri     string        `json:"uri"`
	UrlList []interface{} `json:"url_list"`
	Width   int           `json:"width"`
}
type CoverUrl struct {
	Height  int      `json:"height"`
	Uri     string   `json:"uri"`
	UrlList []string `json:"url_list"`
	Width   int      `json:"width"`
}
