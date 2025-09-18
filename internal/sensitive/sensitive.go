package sensitive

import (
	"strings"
)

// SensitiveWords contains a list of sensitive words that should be filtered
var SensitiveWords = []string{
	// 色情暴力相关
	"色情", "暴力", "porn", "sex", "fuck", "shit",
	"bitch", "dick", "cock", "pussy", "ass", "asshole", "bastard", "whore",
	"slut", "nigger", "faggot", "cunt", "motherfucker", "dickhead", "prick",
	"twat", "wank", "wanker", "wanking", "wanky",

	// 管理员相关
	"管理员", "助手", "小助手", "超级管理员", "超管", "admin", "administrator",
	"系统管理员", "网站管理员", "论坛管理员", "版主", "站长", "网管",
	"超级版主", "总版主", "副版主", "区版主", "分版主",
	"moderator", "superadmin", "sysadmin", "webmaster", "forumadmin",

	// 官方相关
	"官方", "官方客服", "官方人员", "官方代表", "官方认证", "官方账号",
	"官方团队", "官方运营", "官方支持", "官方服务", "官方渠道",
	"official", "official account", "official support", "official service",

	// 客服相关
	"客服", "在线客服", "客服人员", "客服代表", "客服专员", "客服经理",
	"客服主管", "客服总监", "客服团队", "客服中心", "客服热线",
	"customer service", "support", "helpdesk", "service desk",

	// 运营相关
	"运营", "运营人员", "运营专员", "运营经理", "运营总监", "运营团队",
	"运营主管", "运营负责人", "运营中心", "运营部",
	"operator", "operation", "operations", "operation team",

	// 其他可能冒充的身份
	"警察", "公安", "网警", "网安", "网络安全", "网络安全员",
	"police", "security", "security officer", "security team",
	"security admin", "security administrator",
}

// ContainsSensitiveWord checks if the given text contains any sensitive words
func ContainsSensitiveWord(text string) bool {
	text = strings.ToLower(text)
	for _, word := range SensitiveWords {
		if strings.Contains(text, strings.ToLower(word)) {
			return true
		}
	}
	return false
}
