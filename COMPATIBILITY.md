# 当前兼容范围（0.3.4）

采购表只读，支持 .xls 和 .xlsx，单价以文本显示，空值显示“—”。已移除原文件写回及 WPS/Excel 自动化写入，不需要安装 Microsoft Excel 来读取采购表。

Windows 使用原生文件选择框；macOS 使用系统文件选择器。文件解析和只读界面已在 macOS 测试，Windows 文件选择分支经过代码测试，尚未实机验收。

供货商、价格表、渠道和注意事项仍保存于可配置目录中的 procurement-workbench.json。不产生自动备份。
