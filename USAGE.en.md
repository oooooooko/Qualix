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

## Flowchart node

The recording steps are shown as flowchart nodes.

Node type:

- Operations: Perform click, input, slide, return and other actions.
- Condition: Take the "yes/no" branch according to the page status.
- Validation: Verify that the page meets expectations.

Click on the node to expand the editing panel and support modifications:

- Node name
- Remarks, such as "Login button" and "Account input box"
- Node type
- timeout
- Enter text
- Is it optional?
- selector and parent context selector
- Determine the specified text and matching method of the node

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

## Operating Instructions

### Current operation category

- Component operations: record click, record input, extract variables, clear input, long press, click if present, input if present, clear if present.
- Device operations: click coordinates, system return, Home button, recent tasks, power button, slide, pinch to zoom, start APP, stop APP, start photo album, clear APP data.
- Condition and waiting: Condition of existence, condition of check, text click, AI recognition, image condition, waiting to appear, waiting to disappear, waiting for Activity.
- Detect picture changes: Add "Start" and "End" to the three-level menu respectively, and compare the pictures before and after the specified area.
- Loops: Add bounded loops, enter next loop, and exit loop. Entering the next loop will skip the remaining nodes of this round; exiting the loop will execute the process after the end of the target loop.
- Process control: connect scripts, terminate processes, output logs and add delays.

The "Assert Existence" and "Assert Text" in the old script can still be played back, but the new process uses the condition and wait operations in the current menu uniformly.

### Extract variables

Read the text or attributes of the selected component and save it as a script variable. Subsequent input, condition, positioning and log nodes can be referenced using `{{NAME}}`.

### Stop APP

Stops the App process of the specified package name without uninstalling the app or clearing login information and local data. The target package name can be modified in the node.

### Start photo album

Open the system album or common album application available on the device. It is only responsible for entering the album and does not automatically select photos or videos.

### Clear APP data

Clearing target application data and restoring the original state will delete login information and local settings. This operation can only be placed at the beginning of the process, and you should confirm that the test data can be reset before use.

### Determine the check

Read the true checked status of the native Checkbox, RadioButton or Switch, and enter the corresponding branch according to checked or unchecked. Ordinary picture controls should use image condition instead.

### text click

Search the native component precisely or fuzzyly according to the specified text. If it matches, click and enter the success branch. If there is no match, it will enter another branch. It does not recognize text in pictures or self-drawn screens.

### AI recognition

Send device screenshots to the vision model to perform single-frame recognition, continuous observation, or early termination after detecting a hit. By default, execution continues in sequence; after branching is enabled, different paths are entered based on the recognition results.

### Image condition

Use local OpenCV to determine the template, picture check status, black screen, area color or multi-frame changes without calling the model. Fixed icons and stable visual characteristics are suitable for this operation.

### Detect screen changes

Add "Start" and "End" respectively from the third level menu. The start node saves the baseline screenshot of the specified area, the end node compares it with the corresponding baseline and records the change results in logs and reports.

### loop

The loop body is repeatedly executed within the maximum number of executions. It can be run a fixed number of times, or it can exit early according to the appearance or disappearance of elements. The maximum number of times is used to prevent the script from looping infinitely.

### Enter the next cycle

Skip the remaining nodes of the current round and enter the next round of the specified current or outer loop. The execution loop ends the path after reaching the maximum number of times.

### exit loop

Immediately ends the specified current or outer loop, and then executes the process after the end of the loop.

### Terminate process

Actively end the entire playback, and subsequent node and connection scripts will no longer be executed. The system will still save this log and report.

### Output log

Output custom content and log keywords, support `{{NAME}}`. Ideal for marking test phases, recording readings, or providing retrieval identifiers for reports.

### Record clicks

Purpose: Click on a component.

How to operate:

1. Select components such as buttons, icons, list items, etc. in the device preview or component tree.
2. Click "Add action."
3. Select "Record Click".

Example:

```text
Tap the Login button
Tap Add Device
Tap the Profile tab
```

Applicable scenarios:

- Click the button.
- Click on the list item.
- Click on the page entry.

Note:

- Prefer using component selector.
- If Appium cannot find a component, it will use bounds coordinates to find out.

### Record input

Purpose: Enter text into the input box.

How to operate:

1. Select the input box component.
2. Click "Add action."
3. Select Record Input.
4. Enter text in the pop-up window.

Example:

```text
Enter test@example.com in the Account field
Enter 123456 in the Password field
```

Applicable scenarios:

- Account input.
- Password input.
- Enter in the search box.
- Form field input.

Note:

- If the underlying ID of the account box and password box are the same, the recorder will automatically save the parent context selector; during playback, it will first find the parent, and then the child input box.
- After recording, you can expand the node to modify the input content.

### Clear input text

Purpose: Clear the existing content of the input box.

How to operate:

1. Select the input box component.
2. Click "Add action."
3. Select "Clear input".

Example:

```text
Clear the Search field
Enter Camera in the Search field
```

Applicable scenarios:

- Search box repeated testing.
- The input box already has content by default.
- Clear form fields before modifying them.

### Click on coordinates

Purpose: Click according to the center coordinates of the current component, without relying on the selector.

How to operate:

1. Select target area.
2. Click "Add action."
3. Select "Click coordinates".

Example:

```text
Tap coordinates 540,1680
```

Applicable scenarios:

- The self-drawn area is not recognized by the component tree.
- The selector is unstable, but the coordinates of the button are stable.

Note:

- Sensitive to changes in resolution, horizontal and vertical screens, and layout.
- When you can click with components, it is not recommended to give priority to clicking with coordinates.

### Long press

Purpose: Long press a component or coordinate.

How to operate:

1. Select the target component.
2. Click "Add action."
3. Select "Long press".

Example:

```text
Long press the device card
```

Applicable scenarios:

- Long press to open the menu.
- Long press to delete a list item.
- Long press to enter edit mode.

The default long press time is `800ms`, and the node can be expanded to modify the timeout.

### Press Back

Purpose: Implement Android return key.

How to operate:

1. Click "Add action."
2. Select "Back Key".

Example:

```text
Tap Device Details
Press Back
Assert that the device list exists
```

Applicable scenarios:

- Return to the list page from the details page.
- Close the page.
- Close the system pop-up window or soft keyboard.

### Press Home

Purpose: Execute Android Home button.

How to operate:

1. Click "Add action."
2. Select "Home Button".

Example:

```text
Press Home
Launch the app
```

Applicable scenarios:

- Verify that the app resumes from the background.
- Return to the desktop and restart the app.

### Open Recent Apps

Purpose: Open Android recent tasks page.

How to operate:

1. Click "Add action."
2. Select Recent Tasks.

Example:

```text
Open Recent Apps
Press Home
```

Applicable scenarios:

- Verify multitasking switching.
- Verify app background status.

### Press Power

Purpose: Send Android power key.

How to operate:

1. Click "Add action."
2. Select "Power Key".

Example:

```text
Press Power
Wait 1000ms
Press Power
```

Applicable scenarios:

- Lock screen/light screen related tests.

Note:

- Lock screen behavior may vary between devices.
- When automating playback, please confirm that the device will not be unable to continue operation due to lock screen.

### Slide

Purpose: Perform up, down, left and right sliding.

How to operate:

1. Click "Add action."
2. Select "Swipe".
3. Input direction: `Up`, `Down`, `Left`, `Right`.

Example:

```text
Swipe down
Assert that the next page content exists
```

Applicable scenarios:

- The list scrolls.
- Pages turn.
- Carousel switching.

### Pinch to zoom

Purpose: Perform two-finger zoom in or out.

How to operate:

1. Click "Add action."
2. Select Pinch to Zoom.
3. Input direction: `Zoom In` or `Zoom Out`.

Example:

```text
Pinch to zoom in
Pinch to zoom out
```

Applicable scenarios:

- Map zoom.
- Image preview zoom.
- Video screen zoom.

### Launch the app

Purpose: Launch the currently selected default app.

How to operate:

1. First select the default App parameters.
2. Click "Insert Operation" under the "Start" node of the recording step.
3. Select "Launch App" and this action will be inserted as the first step in the process.

Example:

```text
Launch the app
Wait for Activity com.example.MainActivity
```

Applicable scenarios:

- The first step of the script starts the target App.
- Return to the target app from the desktop or other apps.

"Start APP" can only be added from the start node, and there can only be one start node per script. After adding, "Start App" in the menu will be automatically grayed out and will be available again after deleting the node. At startup, the application will be opened through ADB using the package name saved in the current default App parameters.

When recording, you can click the Execute button on the startup node to immediately start the App and refresh the current Activity. Before playback, it will first check whether the target App is already in the foreground: if it has been started, the "Start APP" node will be skipped and the current page will be retained; when entering a child script through "Connection Script", the startup node in the child script will also be skipped.

### add delay

Purpose: Wait for a fixed time.

How to operate:

1. Click "Add action."
2. Select "Add Delay".
3. Enter the number of milliseconds.

You can also click "Insert Delay" after the process node.

Example:

```text
Tap the Login button
Wait 1000ms
Assert that a home page element exists
```

Applicable scenarios:

- Wait for the animation to end.
- Wait briefly for the network request to complete.
- Wait for the system pop-up window to appear.

Note:

- Prioritize using states such as "Wait for Activity" and "Assert Exist" to wait.
- The more fixed delays there are, the slower the script will be.

### Condition exists

Purpose: Determine whether a certain component or specified text appears, and take different branches based on the results. It can be used for pop-up windows, but also for common page components such as buttons, list items, and prompt copy.

How to operate:

1. Choose a stable element on the target component, such as a title, button, list item, or tooltip copy.
2. Click "Add action."
3. Select "Determine existence".
4. Click the condition node and fill in the "specified text" as needed.
5. Select "Fuzzy match (contains)" or "Exact match (exact match)."
6. Click "Insert Action" under the "Yes" or "No" branch to add branch steps respectively.
7. If two branches want to perform the same operation later, you can copy the common node to the corresponding branch, or split the common process into a "connection script" for reuse.

Example:

```text
Check whether the Confirm button exists
  Yes -> Tap the Confirm button
  No -> No action
```

Branch description:

- When the specified text is not configured, only whether the target component exists is judged.
- After configuring the specified text, both the component and its child node texts are checked.
- Fuzzy matching ignores line breaks and consecutive whitespace differences as long as the normalized text contains the target content.
- An exact match requires that the complete text returned by Appium exactly matches the specified text.
- A branch can contain multiple consecutive steps, or additional scripts can be connected at the end of the branch.

Applicable scenarios:

- First launch confirmation popup.
- Permission description pop-up window.
- Active pop-ups.
- A boot popup that only appears once.

### Determine pop-up windows with different contents in the same component

Purpose: There are two pop-up windows on the same page that reuse the same component, but have different titles or texts. The pop-up window type needs to be distinguished according to the copy.

How to operate:

1. Select a node that covers the popup text; if the text is in a child node, you can also select its stable parent container.
2. Click "Add action."
3. Select "Determine existence".
4. Expand the node and enter the unique copy of the pop-up window in "Specify text".
5. Choose fuzzy matching or exact matching as needed.
6. In the "Yes" branch, add the confirmation, cancellation or closing steps corresponding to the pop-up window; in the "No" branch, continue to the next condition or do not add an operation.

Example:

```text
Check for the text Delete this device?
  Yes -> Tap Confirm
  No -> Check for the text Sign out?
        Yes -> Tap Confirm
        No -> No action
```

Applicable scenarios:

- The two pop-up windows `resource-id`, button id, and class are the same.
- The same pop-up component displays different business copywriting.
- Different branches need to be executed based on the pop-up window content.

Note:

- When the pop-up window does not necessarily appear, first use "Judge Existence" to form a branch. Do not use "Assert Text" directly, otherwise the playback will fail if the pop-up window does not appear.
- Don't just judge whether the "OK" button exists, as this will identify both pop-up windows as the same type of pop-up window.
- Prioritize the pop-up window title, body text, and key reminder copy as condition targets.
- The selector in the node details will display the current activity, making it easy to confirm which page the positioning belongs to.

### Click if it exists

Purpose: Click when the element appears, skip when it does not appear.

How to operate:

1. Select the buttons that may appear, such as permission confirmation, agreement agreement, and activity close.
2. Click "Add action."
3. Select "Click if present".

Example:

```text
Tap Agree if present
Close the promotion dialog if present
```

Applicable scenarios:

- One-time pop-up window.
- Occasionally active pop-ups appear.
- First start protocol confirmation.

### Enter if it exists

Purpose: Enter text when the input box appears, skip it when it does not appear.

How to operate:

1. Select the input box that may appear.
2. Click "Add action."
3. Select "Enter if present".
4. Enter text in the centered popup window.

Example:

```text
Enter Camera in the Search field if present
```

After recording, you can expand the node to modify the input content.

### Clear if present

Purpose: Clear the input box when it appears, and skip it when it does not appear.

Example:

```text
Clear the Search field if present
Enter Camera in the Search field if present
```

### Return if exists

Purpose: Execute the return key when a certain blocking element or page appears, and skip it when it does not appear.

Example:

```text
Go back if the permission explanation page is present
Go back if the onboarding page is present
```

Applicable scenarios:

- Temporary boot page.
- Occasional intermediate pages.
- The closed occlusion page can be returned through the system.

### waiting to appear

Purpose: Wait for the page to load to a certain target state.

How to operate:

1. Choose stable elements for your target page.
2. Click "Add action."
3. Select Wait for Appearance.

Example:

```text
Tap the Login button
Wait for the home page device list
```

Applicable scenarios:

- Wait for the target element to appear after the page jumps.
- When a single Activity App cannot determine the page through Activity.

### assert existence

Purpose: Verify that a certain component must exist on the page.

How to operate:

1. Select the target component.
2. Click "Add action."
3. Select "Assert exists".

Example:

```text
Assert that the home page device list exists
Assert that the login failure message exists
```

Applicable scenarios:

- Verify that the login is successful.
- The verification page jumps successfully.
- Verify button or list exists.

Note:

- A failed assertion indicates a test failure.
- Not recommended for dispensable pop-ups.

### assertion text

Purpose: Verify whether the component text contains the specified content.

How to operate:

1. Select the component with text.
2. Click "Add action."
3. Select Assert Text.
4. Enter the text to be verified.

Example:

```text
Assert that the login failure message says Incorrect password
Assert that the page title is Devices
```

Applicable scenarios:

- Verification error message.
- Verify title.
- Check list copy.

### Wait for element to disappear

Purpose: Wait for a component to disappear from the page.

How to operate:

1. Choose a loading, popup, or mask component.
2. Click "Add action."
3. Select "Wait for element to disappear".

Example:

```text
Tap the Login button
Wait for loading to disappear
Assert that the home page device list exists
```

Applicable scenarios:

- Wait for loading to finish.
- Wait for the pop-up window to close.
- Wait for the mask to disappear.

### Waiting Activity

Purpose: Wait for Android's current Activity to switch to the specified value.

How to operate:

1. Click "Add action."
2. Select Wait for Activity.
3. Enter the target activity.

Example:

```text
Tap the Login button
Wait for Activity com.example.MainActivity
```

Applicable scenarios:

- Click the button to enter a new page.
- After launching the app, wait for the homepage activity.

Note:

- Some apps use a single activity architecture and the activity will not change. In this case, you should use "assert existence" to determine the page elements.

### connection script

Purpose: Connect a saved script to the current script and continue execution.

How to operate:

1. Save the connected script first, such as "Home Page Script".
2. Open the current script, such as "Login Script".
3. Click "Insert Operation" under the main process node or condition branch.
4. Select "Connect script" and then select the target script.
5. Save the current script.

Verification rules:

- Both the main process and the condition branch can select other saved scripts of the same App, and the entry Activity is not required to be consistent with the insertion point.
- When the target script has been bound to the entry activity, the playback will wait for the phone to enter the activity; if the page does not actually jump, it will time out and fail.
- When the target script is not bound to the entry Activity, it is executed directly from the current screen. The connection script will not automatically switch to the mobile page, and operations such as clicking and returning must be completed in the previous steps.
- The target script must belong to the current App and cannot be connected to the current script itself.
- When scripts are connected to each other to form a loop, playback will terminate and prompt for loop connections.

Example:

```text
Login script:
  Enter the account
  Enter the password
  Tap Login
  Run script: Home script

Home script:
  Launch the app
  Assert that a home page element exists
  Tap the device list
  Assert that device details exist
```

Applicable scenarios:

- The tester has no idea what the page will be after clicking.
- The login process and home page process were recorded by different people.
- Reuse common front-end processes.

Playback behavior:

- Appium sessions are not recreated.
- The "Launch App" node in the child script is automatically skipped and the App will not be restarted.
- Continue executing the target script in the current page state.
- When played back alone, the child script will still execute its own "Start App" node normally.
- If the scripts are connected to each other to form a loop, it will terminate and prompt for a loop connection.

### Playback report summary

在“参数配置 → 测试编排配置 → 回放报告总结”中配置，默认关闭，与截图报告独立。

1. Fill in the Base URL, API Key, and Model Name in the "Prompt Word Optimization Model" above, and click "Test and Save". This text model is used both to optimize prompt words and to generate playback report summaries.
2. Turn on "Replay Report Summary". Switch and report prompt words are automatically saved after modification.
3. Select the report template in the settings of the playback button; if not selected, the default test report is used. The default format includes test overview (script name, start and end time, results, total duration), execution configuration and node parameters, use case description table, failure details and summary. You can also choose chart time analysis or customized templates.
4. After the playback is completed, the desensitization log, main script and connection script configuration are sent to the summary model. The generated Markdown uses the original playback report path and is saved in the configured report output directory (default `output`); the completion log will display the report path.

After turning on the report summary, the tool will verify the prompt word optimization model before playback. When the model is unavailable, the prompt "Model unavailable, use default template" will be displayed next to the switch, and playback will still continue and a basic report will be generated. The summary is generated after the device operation is completed, and the page will display the generation progress. The summary time is not included in the total test time. When closed, the original basic report will continue to be generated and the summary model will not be called; when the request fails, times out, or returns empty content, the basic report and original log will be retained, and the failure reason will be output, without changing the test results. Model requests wait up to 60 seconds.

Reports do not send screenshots and image templates to the model. In order to control the input size, the script configuration retains a maximum of about 50,000 characters, and the log retains a maximum of about 100,000 characters; when the limit is exceeded, the beginning and end are retained and the middle section is omitted, and the generated report will also indicate that the information is incomplete. The cause analysis of the model is an auxiliary condition and should be verified with the original logs.

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
