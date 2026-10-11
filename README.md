# 个人采购工作台

为 DeepSeek Harness Desktop 0.2.0-rc.2 开发的独立插件。安装后在侧边栏增加「采购工作台」，可导入 Excel、复制纯文本询价、关联供货商和回填价格。

## 安装

1. 从 DeepSeek Harness Desktop 托盘或桌面设置中打开「Open DSH Terminal」。该终端使用当前激活的 profile。
2. 在这个终端执行：

   ```sh
   dsh plugin add '/Users/double/采购/dsh-procurement-workbench-0.1.0.tgz'
   ```

3. 重启 Desktop，在侧边栏打开「采购工作台」。

安装命令按官方 Desktop 用户指南编写。本次没有更改正在使用的 Desktop profile；桌面内真实加载仍需安装后验收。如果桌面使用其他路径或机器，将命令中的路径替换为安装包实际位置。不要在普通终端猜测 Desktop 的 profile。

卸载时，在同一个 Desktop 终端执行 `dsh plugin remove dsh-procurement-workbench`，然后重启。卸载前导出资料备份。

## 使用

1. 在「供货商」中录入品牌、别名、供货商名称及微信或电话。可下载 Excel 模板批量导入。
2. 在「价格表」中导入品牌报价，填写型号、单位、币种、税务口径、运费条件、供货商和有效期。
3. 在「采购明细」导入 `.xlsx`，选择工作表、表头行及列对应关系。至少对应品牌、型号、数量列；单位用于报价匹配。
4. 勾选需要询价的行，编辑右侧纯文本，填写发送对象，选择「复制纯文本并存档」。自行粘贴至微信、电商客服或其他软件。
5. 选择「回填选中行价格」填入唯一有效的匹配报价。已有单价保留，可在表格内手动编辑。
6. 选择「导出整理版」，得到附带供货商联系方式、价格条件和绿色合作标记的新 Excel。

| 场景 | 已实现行为 |
| --- | --- |
| Excel 行复制成图片 | 仅向剪贴板写纯文本，可编辑、搜索、再次复制；不包含内部采购单价和供货商联系方式 |
| 合作品牌 | 品牌及显式别名精确匹配；合作行标绿并列出全部匹配供货商和联系方式 |
| 指定品牌价格 | 按品牌、型号、单位匹配；验证日期、起订量和计价条件；多个有效报价不自动选择 |
| 无合作供货商 | 显示已录入的人工核实渠道及来源，同时提供淘宝、京东、1688 和官网搜索入口 |
| 注意事项 | 可按品牌、品名/型号/备注关键词以及导入、询价、回填、导出场景显示提醒 |

## 资料与限制

- 供货商、价格表、渠道和提醒均支持界面编辑、Excel 模板导入和 JSON 导入/导出。资料导入是替换操作，导入前有确认。
- JSON 示例位于 `templates/`，其中「示例品牌」等均为演示内容，不代表真实供货商或真实报价。渠道模板为空，避免预填未经核实的店铺。
- **渠道搜索尚未自动核实店铺归属，也不会自动从网页提取联系方式。** 没有品牌清单及可靠证据时，不声称某店是直营店。核实后在「渠道」保存网址、类型、来源网址和核实日期。
- 不自动发送微信消息、不登录电商账号、不自动下单。
- 支持 `.xlsx`，暂不读取 `.xls`、`.xlsm` 或图片。旧文件可另存为 `.xlsx`。导入文件上限 20 MB、采购明细上限 10000 行；表头映射最多显示前 100 列。
- 公式单元格读取文件中的缓存结果，不执行或重新计算公式。应先在 Excel 中重新计算并保存。
- 导出的整理版仅保留映射的业务字段及新增的供货商/价格条件，不保留原样式、公式、宏和其他工作表；原文件不会被修改。
- 价格不自动换算币种、包装单位、税费或运费。不同有效报价同时匹配时停止回填，需整理价格表后再操作。注意事项是提示，不阻止操作。
- 数据存在当前页面 origin 的本地存储中，不主动上传。跨浏览器、换地址或换端口时不会自动同步。Desktop 若使用随机端口的 HTTP 页面，应按官方指南设置固定端口，或导出/恢复 JSON 备份；本插件不会擅自改端口。清理应用数据可能丢失本地资料，请定期备份。

## 开发与验证

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run preview
```

预览地址为 `http://127.0.0.1:4173`。`node tests/ui.mjs` 使用本机 Google Chrome 的隔离测试环境验证导入、回填、剪贴板、导出、提醒、历史与窄屏布局。该脚本的 Chrome 路径适用于 macOS，其他系统需要调整。

Host 入口不依赖 Desktop 私有服务；Client 使用公开 `main` keyed slot 和 `sidebar.panellist` list slot。以 `ctx.slots.inject` 跟随 owner 生命周期，不替换官方侧边栏。浏览器包内置 Excel 处理依赖，React 使用宿主实例。发布包无需在安装时构建。

本次验证范围记录在 `VALIDATION.md`。

## 接口依据

- [入门指南](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart)
- [插件打包与安装](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)
- [Web Client Slots](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/slots)
- [Client Modules](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/client-modules)
- [Desktop 用户指南](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/user-guide.md)

实现同时核对了本机 Desktop 0.2.0-rc.2 打包的 layout/sidebar Client 模块；后续版本需重新确认兼容性。
