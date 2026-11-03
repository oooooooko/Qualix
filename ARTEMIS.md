# Artemis 使用说明

[简体中文](./ARTEMIS.md) | [English](./ARTEMIS.en.md)

本文档介绍 Qualix 中 Artemis 的启动、模型配置和任务执行。项目环境要求与主程序启动方式见 [README](./README.md)。

## 启动与控制台集成

菜单中的 **Artemis** 在主内容区嵌入独立的 Artemis 控制台，支持切换菜单后保留页面状态。首次连接和“重新连接”都会检查服务；未启动或未允许嵌入时显示操作提示。

1. Artemis 源码独立放在项目根目录的 `artemis-main/`，或通过 `ARTEMIS_PROJECT_DIR` 指定源码绝对路径。`artemis-main/` 源码随主项目的 Git / npm 包分发。本地 `config/artemis.jsonc`、`.env`、依赖环境和运行数据不提交、不打包；首次启动会从公开的 `config/artemis.example.jsonc` 生成本地配置，已有配置不会被覆盖。
2. 安装 `uv`，准备 Python 3.12+、Node.js 22.22.3+（22 LTS）、ADB 和设备；Artemis 前端首次启动时会自动安装依赖并构建。
3. 在项目根目录运行 `npm run dev`，或使用 `npx qualix`，会同时启动主项目与 Artemis；首次会同步 Python 依赖并按需构建 Artemis 前端。启动完成后点击 **Artemis**。API Key、模型和设备在 Artemis 自身的配置中设置，不会自动复用 Midscene 的模型配置。

检测到 Artemis 已运行时会复用该服务；按 Ctrl+C 会停止本次启动的服务，不会停止之前已运行的 Artemis。缺少源码或 Artemis 启动失败时会输出提示，主项目仍可使用。仍可通过 `npm run artemis` 单独启动 Artemis。主项目端口被占用时会明确报错，可通过 `npm run dev -- --port 5174` 指定其他端口，并自动为新启动的 Artemis 配置对应的嵌入来源。

在 Artemis 的“系统设置 → 自定义配置”中点击“编辑 JSONC”，可直接修改并保存当前使用的 `artemis.jsonc`；支持注释和原有排版，保存前校验 JSONC、模型与智能体配置。文件已被其他操作修改时会阻止覆盖，保存失败时保留草稿。“取消编辑”放弃本次修改并重新加载文件。模型配置用于新任务，运行中的任务保持当前设置；API Key 和接口地址仍在 Artemis 的 `.env` 中配置。

修改配置文件或 `.env` 后，点击自定义配置中的“刷新配置”，会重新校验 JSONC 并加载模型密钥和 Base URL，更新“已配置 / 未设置”状态，无需重启服务。刷新只检查本地配置，不调用模型 API 验证密钥；正在编辑草稿时按钮禁用，校验失败时保留当前已加载设置。

专用启动入口仅绑定 `127.0.0.1:8000`，通过 CSP 允许 `localhost` / `127.0.0.1` 的 `5173`、`4173` 端口嵌入，并保留 Artemis 原有的 Host / Origin 校验。原来的 `artemis ui` 默认禁止 iframe；若已启动，需要先停止原服务再执行 `npm run artemis`。终端按 Ctrl+C 停止服务。

可选环境变量：

| 变量 | 用途 |
| --- | --- |
| `ARTEMIS_PROJECT_DIR` | Artemis 源码目录，传给 `npm run dev` 或 `npm run artemis` |
| `ARTEMIS_PORT` | Artemis 服务端口，默认 `8000` |
| `ARTEMIS_EMBED_ORIGINS` | 允许嵌入的完整来源地址，逗号分隔；主项目使用其他端口时需设置，不接受通配符 |
| `ARTEMIS_URL` | 主项目后端连接的 Artemis 地址，默认 `http://127.0.0.1:8000`，传给 `npm run dev` 或 `npm run preview` |
| `ARTEMIS_AUTO_START` | 设置为 `0` 时，`npm run dev` 仅启动主项目；默认自动启动 Artemis |

当前集成面向本机使用。Artemis 与 Midscene/Appium 的任务队列、设备锁和结果各自独立，请不要同时控制同一台设备。

## 首次配置与执行

1. 连接并解锁 Android 设备，开启 USB 调试，在终端运行 `adb devices -l`，确认设备状态为 `device`，并在手机上允许调试授权。
2. 首次启动后，按下方说明配置 `artemis-main/.env` 和 `artemis-main/config/artemis.jsonc`，然后在“系统设置 → 自定义配置”点击“刷新配置”。
3. 点击主项目菜单中的 **Artemis**，在 Artemis 控制台的设备选择入口选择实际连接的设备，再选择 **Flash** 或 **Pro** 执行模式。模式名称与模型名称不同，例如 Pro 模式也可以使用自定义的 MiniMax 模型。
4. 输入自然语言任务并提交。任务应明确目标 App、操作范围和可观察的完成条件，例如：

   > 打开 Android 设置，查看设备型号和 Android 版本，返回查到的信息后结束任务。

5. 在执行视图查看步骤、模型调用、错误与结果；需要中止时使用停止按钮。选择历史任务可以查看对应记录。右上角中英文切换按钮用于切换控制台界面语言，任务描述可以使用中文。

## 配置自定义模型

Artemis 不读取主项目“参数配置”中的 Midscene 模型。其模型名称、节点和备用模型写在 JSONC 中，API Key 与接口地址写在 `.env` 中：

| 你获得的参数 | Artemis 配置位置 | 示例字段 |
| --- | --- | --- |
| API Key | `artemis-main/.env` | `OPENAI_API_KEY` |
| Base URL | `artemis-main/.env` | `OPENAI_BASE_URL` |
| Model Name | `artemis-main/config/artemis.jsonc` | `default.model` 与 `default.fallback.model` |
| 接口类型 | `artemis-main/config/artemis.jsonc` | OpenAI 兼容接口使用 `provider: "openai"` |

首次准备 `.env` 时，从项目根目录执行以下命令；如果文件已存在，直接编辑已有文件：

```sh
cp -n artemis-main/.env.example artemis-main/.env
```

编辑 `.env`，使用模型服务商给出的 OpenAI 兼容接口地址和密钥。地址通常包含 `/v1`，应填写接口基地址，不要填写完整的 `/chat/completions` 请求路径：

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-provider.example/v1
```

通过“编辑 JSONC”修改本地配置，例如：

```jsonc
{
  "default": {
    "provider": "openai",
    "model": "your-model-name",
    "fallback": {
      "provider": "openai",
      "model": "your-fallback-model-name"
    }
  },
  "nodes": {}
}
```

将占位名称替换为服务商提供的实际模型名称。没有其他备用模型时，`fallback` 可以使用同一模型，但不会提供跨模型容错。`nodes` 用于覆盖指定节点的模型；没有覆盖的节点继承 `default`。切换提供方时也要检查原有节点及其 `fallback`，避免仍引用其他提供方的模型。

GLM、DeepSeek、MiniMax 等提供 OpenAI 兼容接口的服务可按此结构配置，但用于屏幕理解的模型还需要支持图片输入与所需的工具调用；接口兼容不代表每个模型型号都能完成设备任务。配置 Gemini 时使用 `provider: "google"`，并在 `.env` 中填写 `GOOGLE_API_KEY` 或 `GEMINI_API_KEY`。

保存 JSONC 后点击“刷新配置”检查本地设置。出现“已配置”表示字段已读取，不代表 API Key、模型权限或多模态能力已通过在线验证。修改 Python 源码后需重启 Artemis；“刷新配置”不会重新加载源码。

## Flash 与 Pro 模式

| 模式 | 执行方式 | 适用任务 | 笔记与计划 |
| --- | --- | --- | --- |
| Flash | 根据当前画面直接决策、操作，流程较简洁 | 打开页面、短流程操作、简单查询 | 当前未提供笔记读写工具，页签可能为空 |
| Pro | 先规划，再执行与校验，任务结束前进行最终检查 | 多步骤任务、需要过程证据或整理结果的测试 | 可生成计划和任务笔记 |

Pro 任务完成设备操作后，仍可能继续回看截图、检查结果、等待步骤摘要和生成录像。计划全部勾选不代表服务已完成收尾，以最终任务状态为准。

## 笔记与计划

“笔记与计划”用于查看当前或历史任务中 AI 保存的记录，页面目前不提供直接编辑操作：

- `task_plan.md`：任务步骤和执行进度，显示待执行、执行中及完成状态。
- 其他笔记：保存采集数据、观察结果或任务总结；有多个文件时点击名称切换查看。

在 Pro 模式的任务描述中明确要求记录，例如：

> 打开设置，查看设备型号和 Android 版本。执行前制定任务计划，将查到的信息保存到 device_info 笔记中，完成后更新计划并返回结果。

笔记按任务保存，用于同一任务内的持续记忆，不会自动成为所有后续任务共享的知识库。

## 执行记录与本地配置

默认执行数据保存在 `artemis-main/traces/`，临时数据保存在 `artemis-main/scratch/`；自定义 `TRACES_PATH` 或运行参数时，以实际配置的输出位置为准。

| 路径 | 内容 | Git / npm 分发 |
| --- | --- | --- |
| `artemis-main/config/artemis.example.jsonc` | 不含密钥的公开默认配置 | 随源码分发 |
| `artemis-main/config/artemis.jsonc` | 本机实际使用的模型与智能体配置 | 已忽略，不提交、不打包 |
| `artemis-main/.env` | 本机模型密钥、Base URL 等设置 | 已忽略，不提交、不打包 |
| `artemis-main/traces/` | 执行数据库、步骤截图、录像、回放数据、任务笔记和计划 | 已忽略，不提交、不打包 |
| `artemis-main/scratch/` | 执行过程临时文件 | 已忽略，不提交、不打包 |

执行记录写入本地不会自动执行 Git 提交或推送，正常 `git add .` 不会包含上述已忽略的文件。这里说明的是 Git/npm 分发范围；执行 AI 任务时，模型调用仍会向所配置的服务商发送任务所需的文本和图片。

## Artemis 常见问题

- **控制台无法连接**：检查启动终端的日志，确认 `uv`、Python、Node.js 和前端构建依赖可用，再运行 `npm run artemis`。若使用其他端口，检查 `ARTEMIS_URL`、`ARTEMIS_PORT` 和嵌入来源是否一致。
- **模型仍显示“未设置”**：确认修改的是当前 `ARTEMIS_PROJECT_DIR` 下的 `.env` 与 `config/artemis.jsonc`，再点击“刷新配置”；主项目的 Midscene 配置不会同步到 Artemis。
- **没有实际设备**：运行 `adb devices -l`，检查 USB 调试授权、设备连接，以及 Artemis 的 `ADB_HOST`、`ADB_PORT`。任务使用 Artemis 中选择的设备。
- **视频工具链提示缺少 scrcpy / ffmpeg**：在“系统设置”的视频工具链检查中查看缺失项目，安装后确认启动 Artemis 的终端能找到工具；终端 PATH 改变后重新启动服务。
- **任务看起来没有结束**：查看最近步骤和日志，区分正在操作、等待模型、错误暂停与 Pro 最终检查。记录任务 ID 可用于定位日志；需要结束当前任务时使用停止按钮。
- **自定义模型输出解析失败**：本项目已为非 Google 模型的 Pydantic 结构化输出接入思考标签清理、JSON 提取和校验，格式错误时要求模型纠正一次；持续错误仍会报告失败。纯文本步骤摘要也会清理思考内容，避免将其计入摘要长度。

上述模型适配修复属于本项目集成源码的修改，并不代表 Artemis 上游已包含相同修复。
