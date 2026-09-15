# Excel 工作区页签

在 Harness 左侧“新会话”下方新增“Excel 表格”入口。进入后，中央页面递归列出当前会话工作目录中的 `.xlsx`、`.xls`、`.xlsm`、`.xlsb` 文件。切换工作区或会话后列表随之更新；外部程序新建文件后可点击“刷新”。Excel 的临时锁文件（`~$` 开头）不会显示。

侧边栏展开、且 Excel 是唯一附加面板时，“新会话”和“Excel 表格”并列显示；当前页面以选中底色和底边标记突出。侧边栏折叠或出现其他面板时恢复原有布局。由于官方尚未开放“新会话”按钮所在行的布局 Slot，这一并列样式依赖当前侧边栏的 DOM 结构；升级 Harness 后需要检查它是否仍然适用。

文件读取与页面注册使用 Harness 已公开的 `sidebar.panellist`、`main` Slot 和 `workspaceFiles.list` 只读 Remote。目录读取受 Harness 原有权限和单目录条目上限约束；若某目录读取失败或结果被截断，页面会提示列表可能不完整。官方侧边栏没有在“新会话”按钮内部插入控件的 Slot，因此入口使用最靠近该位置的全局面板席位。

## 本机启用方式

当前 DSH Desktop 已通过 `~/.dsh/profiles/desktop/cordis.patch.yml` 加入本地插件入口。重启 DSH Desktop 并刷新页面后，点击左侧“Excel 表格”即可使用。Desktop 的 `desktop` profile 由 Electron 应用托管，不能用普通 `dsh --profile desktop` 命令管理。

在普通 Web profile 中，可从包含本插件的目录安装本地 bundle：

```bash
dsh plugin --profile web add /absolute/path/to/dsh-excel-workspace-tab
```

## 验证

```bash
npm test
```

新建或选中一个有工作区的会话，点击左侧“Excel 表格”。空目录会显示空状态；放入 Excel 文件后点“刷新”，文件名和相对路径应出现在列表中。
