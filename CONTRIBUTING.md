# 参与贡献

感谢帮助改进采购助手 · ProcureMate。问题报告请说明插件版本、系统、Harness Desktop 版本、操作步骤、预期结果和实际结果。截图、日志和示例文件请使用脱敏或虚构数据。

## 本地开发

```sh
npm ci
npm run build
npm test
```

开发入口位于 `src/`；`lib/` 和 `preview/` 由构建生成，不应直接编辑。Node.js 最低版本尚未声明，请在提交时注明使用的版本。

预览服务默认读取与 Desktop 相同的资料配置。macOS / Linux 可用以下方式隔离测试资料：

```sh
PROCUREMENT_CONFIG_PATH="$PWD/.dev-data/config/storage.json" PROCUREMENT_DATA_DIR="$PWD/.dev-data/data" npm run preview
```

PowerShell：

```powershell
$env:PROCUREMENT_CONFIG_PATH = "$PWD/.dev-data/config/storage.json"
$env:PROCUREMENT_DATA_DIR = "$PWD/.dev-data/data"
npm run preview
```

打开 `http://127.0.0.1:4173`。修改前端后需重新执行 `npm run build` 并刷新页面。

## 验证变更

运行 `npm test` 验证核心逻辑、Excel 读取、存储及插件契约。界面相关变更还需运行对应测试，例如：

```sh
node tests/destination-ui.mjs
node tests/inquiry-status-ui.mjs
node tests/general-notes-ui.mjs
```

这些测试会启动独立临时目录及预览服务。当前浏览器路径写为 macOS Google Chrome，其他系统需先调整测试中的 `executablePath`。部分早期 UI 脚本保留了已移除功能的断言，不能作为当前版本的验收入口。

验证应覆盖本次修改的实际行为，并说明未验证的平台。浏览器预览通过不代表 Desktop 加载验收通过。

## 提交变更

- 保持原 Excel 只读，以及重新导入开始新一轮询价的行为。
- 新功能同时更新 README；版本变更写入 CHANGELOG。
- 提交说明应包含解决的问题、用户可见变化及验证结果。
- 使用虚构采购需求和供货商信息，不提交真实业务文件、个人联系方式、密钥或本机数据目录。
- 涉及 Harness 接口时使用公开接口，并说明目标版本。

项目采用 [MIT License](LICENSE)。
