# Artemis Instructions for Use

[简体中文](./ARTEMIS.md) | [English](./ARTEMIS.en.md)

This document describes the startup, model configuration, and task execution of Artemis in Qualix. For project environment requirements and main program startup methods, see [README](./README.en.md).

## Start integration with console

**Artemis** in the menu embeds an independent Artemis console in the main content area, supporting the retention of page status after switching menus. The service is checked on first connection and "reconnection"; an action prompt is displayed when it is not started or embedding is not allowed.

1. The Artemis source code is placed independently at `artemis-main/` in the project root directory, or the absolute path to the source code is specified via `ARTEMIS_PROJECT_DIR`. The `artemis-main/` source code is distributed with the main project's Git/npm package. Local `config/artemis.jsonc`, `.env`, dependent environment and operating data are not submitted or packaged; the first startup will generate local configuration from the public `config/artemis.example.jsonc`, and the existing configuration will not be overwritten.
2. Install `uv` and prepare Python 3.12+, Node.js 22.22.3+ (22 LTS), ADB and devices; the Artemis front-end will automatically install dependencies and build when it is first started.
3. Running `npm run dev` in the project root directory, or using `npx qualix`, will start the main project and Artemis at the same time; for the first time, Python dependencies will be synchronized and the Artemis front end will be built on demand. Click **Artemis** after startup is complete. API keys, models, and devices are set in Artemis's own configuration and will not automatically reuse Midscene's model configuration.

When it is detected that Artemis is already running, the service will be reused; pressing Ctrl+C will stop the service started this time and will not stop the previously running Artemis. When the source code is missing or Artemis fails to start, a prompt will be output, and the main project can still be used. Artemis can still be launched independently via `npm run artemis`. When the main project port is occupied, an error will be clearly reported. You can specify other ports through `npm run dev -- --port 5174`, and automatically configure the corresponding embedding source for the newly started Artemis.

Click "Edit JSONC" in Artemis's "System Settings → Custom Configuration" to directly modify and save the currently used `artemis.jsonc`; support comments and original layout, and verify JSONC, model and agent configuration before saving. Prevents overwriting if the file has been modified by other operations, and retains the draft if the save fails. "Cancel Edit" discards this modification and reloads the file. The model configuration is used for new tasks, running tasks maintain the current settings; the API Key and interface address are still configured in `.env` in Artemis.

After modifying the configuration file or `.env`, click "Refresh Configuration" in the custom configuration to re-verify JSONC and load the model key and Base URL, updating the "Configured/Not Set" status without restarting the service. Refresh only checks the local configuration and does not call the model API to verify the key; the button is disabled when the draft is being edited, and the currently loaded settings are retained when the verification fails.

The dedicated startup portal is only bound to `127.0.0.1:8000`, allows the `5173` and `4173` ports of `localhost` / `127.0.0.1` to be embedded through CSP, and retains the original Host / Origin verification of Artemis. The original `artemis ui` prohibits iframe by default; if it has been started, you need to stop the original service before executing `npm run artemis`. Press Ctrl+C in the terminal to stop the service.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `ARTEMIS_PROJECT_DIR` | Artemis source code directory, pass to `npm run dev` or `npm run artemis` |
| `ARTEMIS_PORT` | Artemis service port, default `8000` |
| `ARTEMIS_EMBED_ORIGINS` | The complete source address allowed for embedding, separated by commas; needs to be set when the main project uses other ports, wildcards are not accepted |
| `ARTEMIS_URL` | Artemis address of the main project backend connection, default `http://127.0.0.1:8000`, passed to `npm run dev` or `npm run preview` |
| `ARTEMIS_AUTO_START` | When set to `0`, `npm run dev` only starts the main project; Artemis is automatically started by default |

The current integration is for native use. The task queues, device locks and results of Artemis and Midscene/Appium are independent. Please do not control the same device at the same time.

## First time configuration and execution

1. Connect and unlock the Android device, turn on USB debugging, run `adb devices -l` in the terminal, confirm that the device status is `device`, and allow debugging authorization on the phone.
2. After first startup, follow the instructions below to configure `artemis-main/.env` and `artemis-main/config/artemis.jsonc`, then click "Refresh Configuration" in "System Settings → Custom Configuration".
3. Click **Artemis** in the main project menu, select the actually connected device in the device selection entry of the Artemis console, and then select **Flash** or **Pro** execution mode. The mode name is different from the model name, e.g. Pro mode can also use custom MiniMax models.
4. Enter a natural language task and submit it. The task should clearly define the target app, scope of operations, and observable completion conditions, such as:

   > Open Android settings, check the device model and Android version, return the found information and end the task.

5. View steps, model calls, errors, and results in the execution view; use the Stop button when you need to abort. Select a historical task to view the corresponding records. The Chinese and English switch button in the upper right corner is used to switch the console interface language, and task descriptions can be in Chinese.

## Configure custom models

Artemis does not read the Midscene model in the main project "Settings". The model name, node and backup model are written in JSONC, and the API Key and interface address are written in `.env`:

| Parameters you get | Artemis configuration location | Example fields |
| --- | --- | --- |
| API Key | `artemis-main/.env` | `OPENAI_API_KEY` |
| Base URL | `artemis-main/.env` | `OPENAI_BASE_URL` |
| Model Name | `artemis-main/config/artemis.jsonc` | `default.model` and `default.fallback.model` |
| Interface type | `artemis-main/config/artemis.jsonc` | OpenAI compatible interface uses `provider: "openai"` |

When preparing `.env` for the first time, execute the following command from the project root directory; if the file already exists, edit the existing file directly:

```sh
cp -n artemis-main/.env.example artemis-main/.env
```

Edit `.env` and use the OpenAI compatible interface address and key given by the model service provider. The address usually contains `/v1`. The interface base address should be filled in. Do not fill in the complete `/chat/completions` request path:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-provider.example/v1
```

Modify the local configuration through "Edit JSONC", for example:

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

Replace the placeholder name with the actual model name provided by the service provider. `fallback` can use the same model when there is no other alternative model, but will not provide cross-model fault tolerance. `nodes` is used to override the model of the specified node; nodes without override inherit `default`. When switching providers, also check the original node and its `fallback` to avoid still referencing models from other providers.

Services that provide OpenAI-compatible interfaces, such as GLM, DeepSeek, and MiniMax, can be configured according to this structure, but the model used for screen understanding also needs to support image input and required tool calls; interface compatibility does not mean that each model model can complete the device task. Use `provider: "google"` when configuring Gemini, and fill in `GOOGLE_API_KEY` or `GEMINI_API_KEY` in `.env`.

Click "Refresh Configuration" after saving the JSONC to check the local settings. The appearance of "Configured" means that the field has been read, but does not mean that the API Key, model permissions or multi-modal capabilities have passed online verification. Artemis needs to be restarted after modifying the Python source code; "Refresh configuration" will not reload the source code.

## Flash and Pro Mode

| Mode | Execution Method | Applicable Tasks | Notes and Plans |
| --- | --- | --- | --- |
| Flash | Direct decision-making and operation based on the current screen, the process is relatively simple | Open the page, short process operation, simple query | Currently no note reading and writing tools are provided, and the page tab may be empty |
| Pro | Plan first, then execute and verify, and conduct final inspection before the end of the task | Multi-step tasks, tests that require process evidence or collated results | Can generate plans and task notes |

After the Pro task completes the device operation, it is still possible to continue to review screenshots, check results, wait for step summaries, and generate videos. Checking all the plans does not mean that the service has been completed. The final task status shall prevail.

## Notes & Plans

"Notes and Plans" is used to view records saved by AI in current or historical tasks. The page currently does not provide direct editing operations:

- `task_plan.md`: Task steps and execution progress, showing the status of pending execution, execution and completion.
- Other notes: Save collected data, observation results or task summary; when there are multiple files, click the name to switch to view.

Explicitly request documentation in the Pro mode task description, for example:

> Open Settings to view your device model and Android version. Make a task plan before execution, save the found information to the device_info note, update the plan and return the results after completion.

Notes are saved by task and are used for continuous memory within the same task. They will not automatically become a knowledge base shared by all subsequent tasks.

## Execution records and local configuration

The default execution data is saved in `artemis-main/traces/`, and the temporary data is saved in `artemis-main/scratch/`; when customizing `TRACES_PATH` or running parameters, the actual configured output position shall prevail.

| Path | Content | Git/npm distribution |
| --- | --- | --- |
| `artemis-main/config/artemis.example.jsonc` | Public default configuration without key | Distributed with source code |
| `artemis-main/config/artemis.jsonc` | The model and agent configuration actually used by this machine | Ignored, not submitted, not packaged |
| `artemis-main/.env` | Local model key, Base URL and other settings | Ignored, not submitted, not packaged |
| `artemis-main/traces/` | Execution database, step screenshots, videos, playback data, task notes and plans | Ignored, not submitted, not packaged |
| `artemis-main/scratch/` | Temporary file during execution | Ignored, not submitted, not packaged |

Writing execution records locally will not automatically execute Git commit or push, and normal `git add .` will not include the above ignored files. This is the Git/npm distribution scope; when executing an AI task, the model call will still send the text and images required for the task to the configured service provider.

## Artemis FAQ

- **Console cannot be connected**: Check the log of the startup terminal to confirm that `uv`, Python, Node.js and front-end build dependencies are available, and then run `npm run artemis`. If using other ports, check whether `ARTEMIS_URL`, `ARTEMIS_PORT` and embedded sources are consistent.
- **The model still shows "Not Set"**: Confirm that the modifications are `.env` and `config/artemis.jsonc` under the current `ARTEMIS_PROJECT_DIR`, and then click "Refresh Configuration"; the Midscene configuration of the main project will not be synchronized to Artemis.
- **No actual device**: Run `adb devices -l` to check USB debugging authorization, device connection, and `ADB_HOST`, `ADB_PORT` for Artemis. The task uses the device selected in Artemis.
- **The video tool chain prompts that scrcpy / ffmpeg is missing**: Check the video tool chain check of "System Settings" for missing items. After installation, confirm that the terminal that starts Artemis can find the tool; restart the service after changing the terminal PATH.
- **Task doesn't look like it's over**: View recent steps and logs to differentiate between working, waiting for model, paused on error, and Pro final check. Recording the task ID can be used to locate the log; use the Stop button when you need to end the current task.
- **Custom model output parsing failed**: This project has integrated thinking tag cleaning, JSON extraction and verification for the Pydantic structured output of non-Google models. When the format is incorrect, the model is required to be corrected once; persistent errors will still report failures. Text-only step summaries also clean up reflections so they don’t count towards the length of the summary.

The above model adaptation fixes are modifications of the integrated source code of this project, and do not mean that the same fixes have been included in Artemis upstream.
