# 兼容范围

插件基于 DeepSeek Harness Desktop `0.2.0-rc.2` 的公开接口开发。当前 0.3.24 包尚未进行 Desktop 实机加载验收，不承诺兼容未经验证的其他版本。

| 范围 | 当前状态 |
| --- | --- |
| macOS 浏览器预览 | 已验证导入、资料保存、公司省份、询价标记和通用提醒界面 |
| Windows | 文件选择分支经过代码测试，尚未实机验收 |
| Excel | 支持二进制 `.xls` 和 `.xlsx`，只读原文件；无需安装 Microsoft Excel 进行解析 |
| Web Host | 使用公开 `webServer` 服务注册 `/procurement-workbench/api` |
| Web Client | 使用 `main` keyed slot 与 `sidebar.panellist` list slot |

当前没有原 Excel 写回、价格表或渠道管理界面。保留旧资料字段用于兼容，不代表相关功能仍然对用户开放。

供货商、注意事项、公司省份和询价标记保存在可配置目录的 `procurement-workbench.json` 中。不产生自动备份。
