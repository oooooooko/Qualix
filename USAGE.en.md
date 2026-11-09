# 测试编排使用说明

[简体中文](./USAGE.md) | [English](./USAGE.en.md)

Manual orchestration records and edits flows. The new AI workspace supports chat generation, Flash / Pro, task queues, notes, plans and video playback. See the [AI guide](./ai-flow/README.md).

## 测试编排使用前准备

### 1. Connect your Android device

```sh
adb devices -l
```

Verify that the device is connected and USB debugging is allowed on the phone.

### 2. Start Appium

```sh
appium
```

If UiAutomator2 Driver is not installed:

```sh
appium driver install uiautomator2
```

### 3. Start the project

```sh
npx --yes qualix@latest
```

Or source code development:

```sh
npm install
npm run dev
```

After opening the page, enter the `Appium` menu.

### 4. Configure the running path (optional)

Enter "Settings > Run Configuration" to set:

- `Android SDK Path`: Fill in the SDK root directory containing `platform-tools/adb`. When left blank, `ANDROID_SDK_ROOT`, `ANDROID_HOME`, the system common SDK directory and ADB in PATH are read in sequence.
- `Replay Report Directory`: Fill in the saving directory of the Markdown playback report. Supports absolute paths; relative paths are based on the directory where the startup command is located. When left blank, `output` in the startup directory is used.

The Android SDK is detected before playback starts. When the detection fails, an Appium session will not be created, and the playback output will directly display the SDK path that needs to be corrected.

## Basic recording process

1. Select a device.
2. Add preset app parameters in "Settings".
3. Return to the `Appium` page and select the default App in the "Nodes and Scripts" area.
4. Wait for the device preview and App component tree to load automatically; click Refresh Component Tree if necessary.
5. Select the target component in the device preview or App component tree.
6. Select the action you want to record in the Start node or Insert Action after any step.
7. Check the process, edit node notes, and configure decision branches in Recording Steps.
8. Enter a name for the script and save it.
9. Select the saved script and click "Playback".

The App package name is required and can only be selected from the "Default App Parameters" added in "Settings" and cannot be entered manually. Operations cannot be recorded when no app is selected.

## Device Preview and Component Tree

### Device preview

- Device preview uses an independent ADB screenshot channel and supports direct taps and swipes.
- After clicking a component in the preview, the component tree will locate and select the corresponding node, and the component border will be displayed by default.
- When live streaming is unavailable, ADB screenshot polling is automatically used to prevent the two screen sources from overwriting each other.
- When the screen stops updating, you can click the refresh button in the device preview toolbar to reacquire the screen.

### App component tree

- The component tree will automatically refresh after entering the page for the first time, switching devices, activity changes, or page structure changes.
- Automatic refresh will try to retain selected nodes that still exist.
- Automatic refresh will be paused during recording operations, playback and manual refresh, and will be automatically resumed after the end.
- The component tree supports horizontal and vertical scrolling; up to three lines are displayed for "Current Activity" below.
- Manually click "Refresh Component Tree" to immediately re-crawl the current page structure.

Note: Appium playback and component tree grabbing both consume Android UiAutomation. The system will execute serially according to the device and automatically retry after cleaning up the remaining processes when the connection is preempted.

## Flow editing

Process Canvas supports the following operations:

- Drag the canvas while holding down an empty area or node.
- Hold down `Ctrl` and roll the mouse wheel to zoom between `50%` and `200%`.
- Click "Enlarge" to open the process overview; you can also click on nodes to edit in the overview.
- Click "Insert Operation" after the node to add an operation in the middle of any step.
- Click the delete button in the upper right corner of the node to remove the node, and the process reference will be automatically corrected.
- After the browser is refreshed, the current function page and Appium workspace tab will be maintained; if there are unsaved modifications, you will be prompted to save before refreshing or closing the page.

### Record across activities

If activity changes are detected after clicking the recording button, the system will prompt you to choose to continue recording or end and save. When you need to save multiple pages in the same script, choose Continue and wait for the new page component tree to refresh before recording subsequent operations; when you want to split by page, end the current script and create a script in a new Activity, and then combine the process through "Connect Script".

For cross-page processes, it is recommended to add a "waiting activity" after the jump operation to clarify the target page and improve playback stability. When loading a historical script, you can view and edit the process even if the current activity of the phone is different from the script entry activity; before playback, you should confirm that the startup node, waiting activity, or pre-operation can bring the device to the correct page.

## Script saving and management

### Save and update

- The new script needs to be filled in with a name and selected as a default app before saving.
- After loading the historical script from the top script drop-down box or "Script List", clicking "Save" again will update the original script and no error will be reported because the name is the same.
- The script data only saves the flow chart `flow_json`, which includes the main process, condition branches, connection relationships, node comments and page checkpoints.
- Saved scripts can still be viewed and edited directly after loading; the current Activity does not affect script editing.

### script list

Switch to the "Script List" tab in the "Recording and Script" area to:

- Load script: Return to "Current Recording" to continue viewing, editing or playback.
- Download script: Export a JSON file containing the complete process.
- Import script: Select the previously exported JSON file; if the name is repeated, a new name will be automatically generated and the existing script will not be overwritten.
- Delete script: Delete the recorded script in the database.

After importing the script, you still need to configure the corresponding default app on the local machine and connect an available Android device.

## Playback output and reporting

### real time log

After clicking "Playback", the log will be appended in real time as the execution process progresses, without waiting for the entire script to end. All processes use the `[节点 N]` number uniformly. Common contents include:

```text
[节点 1] 开始：启动 APP com.example.app
[节点 1] 结果：APP 已在前台，跳过启动 com.example.app
[节点 1] 完成：启动 APP com.example.app
[节点 2] 判断：是
```

By default, each playback starts an Appium service with a separate port. The playback output will completely retain the stdout/stderr of the service, including `Appium`, `AndroidUiautomator2Driver`, `ADB`, request parameters, response content and driver diagnostic information, while retaining the request method, interface path, HTTP status and time consumption recorded by the tool itself. For example:

```text
2026-08-22 13:57:35:756 - [Appium] Welcome to Appium v3.5.0
[AndroidUiautomator2Driver@ec68] Got response with status 200: {...}
[ADB] Running '.../adb -s device-id shell ...'
[Appium] 请求：POST /session
[Appium] 响应：HTTP 200 POST /session（328ms）
```

Full Appium logs may contain input values, device information, and WebDriver request parameters. Please check and clean up sensitive content before sharing `.log` files.

If the external Appium service is explicitly connected through the environment variable `APPIUM_SERVER_URL`, the tool cannot read the stdout/stderr of the terminal where the external process is located, and will only save the WebDriver request, response status, time consumption and error response. When full server logs are required, do not set this environment variable and let the tool automatically start Appium for playback.

By default, "Playback Output" only retains the visual height of the most recent `80` row to avoid stretching the page indefinitely. You can use:

- Copy: Copy the current complete log.
- Expand to view: View the complete log in the pop-up window.
- Clear: Clear the playback output on the page.

An Abort button will appear at the top during playback. After clicking, subsequent nodes will be stopped, the current Appium session will be closed, and reports and logs of this playback will continue to be generated; the execution result will be marked as "Terminated".

### Playback reports, logs and screenshot playback

After each playback ends, regardless of success, failure, or manual termination, a Markdown report, plain text log, and single-file HTML screenshot playback will be generated. The three files use the same datetime and script name:

```text
当前日期时间-脚本名称.md
当前日期时间-脚本名称.log
当前日期时间-脚本名称.html
```

The report is saved to the directory specified in "Settings > Run Configuration"; if not specified, the report is saved by default in the `output` folder in the directory where the startup command is located, for example:

```text
output/2026-08-21_17-13-42-831-登录流程.md
output/2026-08-21_17-13-42-831-登录流程.log
output/2026-08-21_17-13-42-831-登录流程.html
```

The report contains:

- Script, App, Activity, Device, Execution Time and Results.
- Type, selector, context selector, input value, timeout, comments and branch configuration for each node.
- The actual execution status and execution information of each node.
- Full replay log.

The complete playback process shown in the `.log` file save page, as well as the untruncated stdout/stderr of this hosted Appium process. After successful generation, the absolute paths of the report and log will be appended to the real-time playback output; the report location is also saved to the database to facilitate subsequent tracing.

The `.html` file collects device screenshots before and after each actual execution node, and embeds the screenshots directly into the file in Base64 format. After opening you can:

- View the scripts, nodes, stages, results, notes and selectors corresponding to the execution steps and the current screenshot on the left.
- View the actual execution time of the screenshot on the top timeline, and click on the thumbnail or timeline to jump.
- Use "previous frame", "play", "next frame" and the progress bar to control playback; the playback progress is continuously advanced according to the actual playback time, and no longer switches one by one at fixed intervals.
- Expand the complete playback log below the steps on the left; the log is collapsed by default.

Condition branches, failures and manual termination will retain the corresponding last screen. The actual execution nodes in the connection script will also enter the same screenshot timeline. HTML does not rely on external image directories and can be copied and opened independently.

### Playback report summary

在“参数配置 → 测试编排配置 → 回放报告总结”中配置，默认关闭，与截图报告独立。

1. Fill in the Base URL, API Key, and Model Name in the "Prompt Word Optimization Model" above, and click "Test and Save". This text model is used both to optimize prompt words and to generate playback report summaries.
2. Turn on "Replay Report Summary". Switch and report prompt words are automatically saved after modification.
3. Select the report template in the settings of the playback button; if not selected, the default test report is used. The default format includes test overview (script name, start and end time, results, total duration), execution configuration and node parameters, use case description table, failure details and summary. You can also choose chart time analysis or customized templates.
4. After the playback is completed, the desensitization log, main script and connection script configuration are sent to the summary model. The generated Markdown uses the original playback report path and is saved in the configured report output directory (default `output`); the completion log will display the report path.

After turning on the report summary, the tool will verify the prompt word optimization model before playback. When the model is unavailable, the prompt "Model unavailable, use default template" will be displayed next to the switch, and playback will still continue and a basic report will be generated. The summary is generated after the device operation is completed, and the page will display the generation progress. The summary time is not included in the total test time. When closed, the original basic report will continue to be generated and the summary model will not be called; when the request fails, times out, or returns empty content, the basic report and original log will be retained, and the failure reason will be output, without changing the test results. Model requests wait up to 60 seconds.

Reports do not send screenshots and image templates to the model. In order to control the input size, the script configuration retains a maximum of about 50,000 characters, and the log retains a maximum of about 100,000 characters; when the limit is exceeded, the beginning and end are retained and the middle section is omitted, and the generated report will also indicate that the information is incomplete. The cause analysis of the model is an auxiliary condition and should be verified with the original logs.

## Combination example

### Example 1: Connect to the homepage script after successful login

Login script:

```text
Launch the app
Enter the account
Enter the password
Check whether the user agreement dialog exists
  Yes -> Tap Agree -> Tap Login -> Check login success -> Run Home script
  No -> Tap Login -> Check login success -> Run Home script
```

Home script:

```text
Launch the app
Assert that the home page device list exists
Tap Add Device
Assert that the Add Device page title exists
```

Suitable scenarios:

- When recording login, I don’t know which page to jump to after successful login.
- The home page process is expected to be maintained independently.

### Example 2: Login success/failure branch

```text
Enter the account
Enter the password
Tap Login
Check whether the home page device list exists
  Yes -> Assert that the home page device list exists
  No -> Assert the login error message
```

How to operate:

1. Record the input and click to log in first.
2. Select the stable element used to distinguish the login results and add "Condition Existence".
3. Insert home page validation or "connection script" in the "Yes" branch.
4. Insert an error message assertion in the "no" branch.
5. If two branches have the same common steps, use batch copy to copy the common nodes to the corresponding branches.

### Example 3: One-time pop-up window

```text
Launch the app
Check whether the Confirm button exists
  Yes -> Tap Confirm -> Assert that the home page exists
  No -> Assert that the home page exists
```

Suitable scenarios:

- The confirmation pop-up window only appears after the first installation.
- The pop-up window no longer appears for old users.

### Example 4: List scrolling to find elements

```text
Launch the app
Assert that the list page title exists
Swipe up
Wait 500ms
Assert that the target list item exists
```

If the list loads slowly, you can replace the fixed delay with a target element assertion.

### Example 5: Return to the list page from the details page

```text
Tap the device card
Assert that the Device Details title exists
Press Back
Assert that the device list exists
```

Suitable scenarios:

- Verify page return path.
- The list is still visible after verification returns.

## FAQ

Frequently asked questions have been independently organized into [FAQ.md](./FAQ.en.md).

## Recommended recording specifications

- Each script is responsible for only one clear scene.
- Login, home page, and details page can be split into multiple scripts and combined using "connection script".
- After each page jump, add an "Assert Exist" or "Wait Activity".
- Use "Judge Existence" for pop-up windows or other optional components, and don't directly write the necessary points.
- Clicking on the coordinates is only used as a guide.
- Fill in notes such as "Login Button" and "Account Input Box" for key nodes to facilitate viewing of processes and reports.
- After playback fails, first check the failed node, Activity and selector in "Playback Output", and then open the Markdown report in `output` to view the complete configuration.
