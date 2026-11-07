# Process node operation instructions

[简体中文](./流程节点操作说明.md) | [English](./FLOW_NODES.en.md)

本文档对应页面“帮助与版本 → 操作说明 → 测试编排”，说明当前流程菜单中的节点用途、配置方法和执行结果。AI 识别的模型配置、持续观察、截图去重和场景示例请查看 [AI识别操作说明](./AI_RECOGNITION.en.md)。

## 1. General operations

1. Select the target device and default app, load an existing script or create a new script.
2. For operations that require positioning a component, first select the target component in the device preview or App component tree.
3. Click the "+" in the process to select the operation category and specific operations. A "+" within a branch will add the node to that branch.
4. Fill in the parameters as required in the pop-up window. After adding, click the node card to expand the configuration; some operations open a dedicated pop-up window through the edit icon on the node.
5. Check the process connection and save the script before performing playback. Node names and comments can be used to describe business purposes, and names do not replace actual targeting criteria.

### Positioning and coordinates

Supports Resource ID, Accessibility ID, XPath, and UiAutomator positioning, and some components use parent context or positioning chains to limit the scope. Prioritize the use of stable and unique native positioning and avoid using dynamic text or list positions as permanent identifiers.

The coordinates are based on the device screenshot coordinate system, not the browser window coordinates. After changing the resolution, screen orientation or page layout, the coordinates and detection area should be reconfirmed.

### variable reference

Set global variables or script-private variables in "Preset Variables". Use `{{NAME}}` in input, positioning, condition, log and other fields that support text configuration, such as `{{account}}`. Undefined variables will report an error.

Sensitive variables are desensitized in logs and reports, and sensitive values are cleared when exporting; sensitive operations have restrictions on screenshots and screen recordings. For detailed description, see [Test Variables and child script Parameters](./VARIABLES.en.md).

### Timeouts, branches and failures

- The default timeout for regular waiting and condition is 3000ms; for existing nodes, the actual saved value shall prevail. 1000ms equals 1 second.
- The "timeout post-processing" of the branch node can choose to terminate the process or enter the specified side branch, which enters the right branch by default. Normal condition results and timeout are not the same thing.
- AI recognition only uses the configured time after checking "Enable Timeout". It waits for the model to complete by default and can still be terminated manually. Network errors or model service errors will not be covered by infinite waiting.
- The duration of delay, long press, and sliding indicates the duration of the operation; image condition also has an independent observation duration. These parameters cannot be understood as search element timeout.
- "If it exists..." If the component is not found, it can be skipped. However, if the device is disconnected, the request is incorrect, or the operation fails after being found, it is not the same as "not found".

### Logs and reports

回放文本日志记录时间、节点编号、执行结果及错误。参数配置 → 测试编排配置中的“截图与 HTML 报告”默认关闭，开启后才采集报告截图并生成 HTML，截图会增加耗时。AI、图像判断、画面变化等操作需要的截图不依赖此开关。

## 2. Component operation

### 1. Record clicks

**Function:** Reposition the target component and click during playback.

**Operation:** Select the component and select "Record Click" in "Component Operation"; check the node's Selector and parent positioning range.

**Results and Notes:** Click Success to continue. Fails if the component does not exist or is not clickable. Suitable for native components such as buttons and list items, and should not be mixed with "click coordinates".

### 2. Record input

**Function:** Write the specified content to the target input component.

**Operation:** Select the input box, select "Record Input", fill in the text or `{{NAME}}`; the text can be modified in the node.

**Results and Notes:** Continue after successful entry. When you need to overwrite old content, it is recommended to add "clear input" first. Do not assume that all input boxes will be automatically cleared.

### 3. Extract variables

**Function:** Read component text or attributes and save them to the currently running script variables.

**Operation:** Select the component, fill in the variable name, and select attributes such as `text`, `content-desc`, `checked`, `selected`, `enabled`, `resource-id`, `class`; mark as sensitive variables if necessary. Subsequent references are via `{{NAME}}`.

**Results and Notes:** Fails if the component is not found or the property does not exist. The extraction results are saved as text, which only affects runtime variables and does not write back to the default variable file.

### 4. Clear input

**Function:** Clear the contents of the specified input component.

**Operation:** Select the input box, add "Clear Input", and confirm that the positioning is correct.

**Results and Notes:** Continue after success; fail when component does not exist or does not support clearing. Unlike "clear if present", this operation does not automatically skip missing components.

### 5. Click on the coordinates

**Function:** Click the specified X, Y position on the device screen without relying on native component positioning.

**Operation:** After adding the node, check or modify "Coordinate X" and "Coordinate Y" to confirm that the point position falls within the target control.

**Results and Notes:** The success of the command only means that the click was executed, but does not mean that the business operation will definitely take effect. Suitable for controls that are fixed but difficult to position and require recalibration after resolution or layout changes.

### 6. Long press

**Function:** Press and hold the element or coordinate for a period of time and then release it. By default, the element will be positioned.

**Operation:** After selecting the target, add "long press", set the long press mode and "long press time ms"; set X, Y when using coordinate mode.

**Results and Notes:** Continue when finished. Insufficient duration may trigger ordinary clicks, and excessive duration may trigger other behaviors. The actual interaction of the target application should prevail.

### 7. Check the box

**Function:** Read the true `checked` status of native Checkbox, RadioButton, Switch and other checkable components.

**Operation:** Add nodes after selecting the target component. The system checks whether the component supports check condition and adds subsequent operations on both sides of true and false.

**Results and Notes:** true means checked, false means unchecked; missing components, unreadable status or timeout will be handled separately. The selected state simulated by ordinary ImageView using pictures is not applicable, and the picture state mode of "image condition" can be used.

### 8. Text click

**Function:** Match the specified text in the native component tree of the current page and click.

**Operation:** Enter the target text, such as "Audio Settings"; select exact matching (exactly consistent) or fuzzy matching (inclusive), and configure waiting time and timeout processing.

**Results and Notes:** Provides "matched text" and "not matched text" branches. If the text is found and the click fails, an error will still be reported. Text in pictures, videos or self-drawn pictures cannot be recognized; for repeated text, try to use clearer conditions to avoid mistakes.

## 3. Equipment operation

### 9. System returns

**Function:** Send Android return key.

**Action:** Add a "System Return" at the target location.

**Results and Notes:** The specific effects of returning to the previous page, closing the pop-up window or hiding the keyboard are determined by the current interface, and there is no guarantee that you will return to the same page every time.

### 10. Home button

**Function:** Return to the device desktop.

**Operation:** Add a "Home button" and add "Start App" after it when you need to return to the application.

**Results and Notes:** Apps are usually still in the background and Home does not mean killing the app or clearing data.

### 11. Recent tasks

**Function:** Open Android recent tasks interface.

**Operation:** Add "Recent Task"; if you need to further operate the task card, click or slide the node.

**Results and Notes:** Specified applications will not be automatically switched or closed, and the layout of the task interface varies from system to system.

### 12. Power button

**Function:** Send device power key operation.

**Operation:** Add a "power button" to organize subsequent processes based on the current status of the device.

**Results and Notes:** The screen may turn off or wake up, and automatic unlocking is not guaranteed; you may not be able to continue operating the application after locking the screen.

### 13. Slide

**Function:** Slide from the specified starting point to the end point.

**Operation:** Configure the starting point X, Y, end point X, Y and "duration ms".

**Results and Notes:** Continue after the gesture ends. The starting point needs to be located in the actual sliding area. The distance and duration will affect the scrolling or page turning effect.

### 14. Pinch to zoom

**Function:** Perform a two-finger zoom in or out gesture.

**Action:** Configure the zoom direction, center X, Y and zoom ratio. The center point should be located in the content area that supports zooming.

**Results and Notes:** The application must support this gesture; successful command does not mean that the screen must be zoomed.

### 15. Clear App Cache

**Function:** The actual execution is to clear application data and cache, and reset the target application state.

**Operation:** Only allowed to be added at the beginning of the process, check the target App package name before running.

**Results and Notes:** **Not just deleting the cache. May clear login information, app settings, and local data. ** Should only be used with test applications that allow resets. The follow-up usually requires restarting the app, dealing with permissions, and logging in.

### 16. Launch the app

**Function:** Start the application with the specified package name, supporting use in the middle of the process and in branches.

**Operation:** Add a node and confirm the "Target APP package name"; the target can be modified in the node.

**Results and Notes:** The application must be installed and have a bootable entry. Launching does not guarantee resetting the process or returning to the home page. If you need to restart, you can add "Kill APP" first.

### 17. Kill APP

**Function:** Stop the application process of the specified package name.

**Operation:** Add a node, check the default filled-in package name or modify the "Target APP package name".

**Results and Notes:** No uninstalling of apps and no clearing of data. When you need to use it again, add "Start App" later.

### 18. Launch photo album

**Function:** Try to open the photo album application available on the device; stop the target photo album process before starting it.

**Action:** Add "Launch Album". If you need to select media after entering, please perform corresponding operations.

**Results and Notes:** Only responsible for opening, not automatically selecting photos or videos. The application entrance and permissions of different systems may be different, and there is no guarantee that all devices will have available photo albums.

## 4. Wait for assertion

### 19. Add delay

**Function:** Pause for a specified length of time and then continue.

**Operation:** Enter the number of milliseconds, for example, `5000` means wait for 5 seconds; it can be modified after adding.

**Results and Notes:** The delay does not check whether the page is loaded. The total interval between adjacent operations in the log may also include time-consuming screenshots, device commands, etc. When you need to wait for a clear component, use "Wait to Appear" first.

### 20. Condition of existence

**Function:** Determine whether the target component exists, and check text matching conditions at the same time.

**Operation:** Select the component and add it, check the positioning; fill in the "specified text (optional)" if necessary, select precise or fuzzy matching, and add operations on both sides of "Yes" and "No".

**Results and Notes:** Take the branch according to the condition result, wait for timeout and execute "post-timeout processing". It does not mean judging that the button is clickable, nor does it mean reading the check status.

### 21. Image condition

**Function:** Use local OpenCV to compare specified areas without calling large models. One node can complete the condition and provide true/false branches, without adding in pairs.

**Operation:** Select the detection mode, then select the current element or select the area in the device preview; collect or upload PNG templates according to the mode, set parameters, and save the nodes.

| Detection mode | Configuration and usage |
| --- | --- |
| Template matching | Collect target templates, set matching strictness and "match to template/not match to template" expectations, and determine whether the fixed icon meets expectations. |
| Image status condition | Collect selected and unselected templates respectively, configure matching strictness and minimum score difference, and use them for single-selection status of image simulation. true means selected, false means unselected; it cannot be determined if there is insufficient evidence. |
| Black screen detection | Set the tolerance and proportion of dark pixels to determine whether the area reaches black screen conditions. |
| Regional color condition | Fill in the `#RRGGBB` target color, configure the color tolerance and pixel ratio. |
| Multi-frame change detection | Set the observation duration, sampling interval, pixel tolerance, change ratio and change expectation, and compare images during the observation period. |

**Parameter Description:** The higher the matching strictness, the stricter the template matching requirements; 100% may not match due to extremely subtle pixel differences. The observation duration, sampling interval and number of consecutive frames must be reasonable to each other. The specific settable fields vary with the mode.

**Results and Notes:** true means that the configuration is expected, and does not always mean "image found". For example, when "template not matched" is expected, not found is true. The observation timeout is handled as a timeout and does not necessarily directly enter the false branch. If the template is larger than the detection area, the size changes, or the scores of the two templates cannot be distinguished, it will prompt that the determination cannot be made.

Templates are not scaled automatically. The detection region must remain large enough to contain the template; enlarge it or capture a new template. Use image matching for fixed icons, colors and pixel changes, rather than business meaning or arbitrary text recognition. A static image alone cannot prove that a button is enabled or a video has frozen.

### 22. AI recognition

**Function:** Send device screenshots and questions to the configured visual model, supporting sequential answers and branch conditions.

**Operation:**

1. 在“参数配置 → 测试编排配置 → AI 识别模型”填写并保存 Base URL、API Key、Model Name，使用支持图片输入的模型。
2. Add AI Recognition and enter a question. New nodes use sequential mode by default; for example, ask what the current screen contains. The answer is logged before the next node runs.
3. To make a decision, enable branching in the node settings. The question is immediately validated by the model without uploading a device screenshot.
4. After the verification is passed, a true/false branch is generated; for non-condition questions, "Unable to enter the branch" will be prompted and unchecked. Recommended question: "Is the device list currently displayed?"
5. After editing a question in branch mode, select Validate and Save Question. Failed validation leaves the previous question unchanged. Remove existing child branches before disabling branch mode.
6. After enabling branching, optionally enable fallback and select the left true branch or right false branch. The help icon explains its scope. Fallback applies only when the model returns no valid content or no expected true/false result; valid Boolean results still determine the actual branch.
7. Optionally enable a timeout and configure its duration and handling. Timeouts are disabled by default, so the node waits for the model and can still be stopped manually.
8. Use Test AI Recognition on the node to inspect an answer or decision for the current screen without running the entire script.

**Results and Notes:** Sequential mode records the answer before continuing; branching mode must get an explicit boolean value. When the bottom line is not configured, no valid results will cause the node to fail; enter the specified branch only after configuring it. Doubi only handles model empty content, invalid JSON, `result: null`, or missing Boolean values, and does not handle model request failures, network exceptions, device screenshot failures, and node timeouts. The model text, basis for condition, directions and errors will all be written to the log. Older versions of AI nodes retain their original branches.

AI may misjudge; passing the problem verification does not mean that it will be able to judge at runtime. Device screenshots will be sent to the configured model service, which may incur fees. Please confirm that the service is trustworthy and pay attention to privacy in the screen. Remote devices do not currently support single-node AI testing.

### 23. Click if it exists

**Function:** Click when the component is found, skip if not found.

**Operation:** Select possible components, add nodes, configure positioning and waiting time.

**Results and Notes:** The left and right branches are not generated, and the sequence continues after clicking or skipping; suitable for occasional pop-ups. If the component is found but fails to click, an error will still be reported.

### 24. Enter if it exists

**Function:** Enter text when the input box is found, otherwise skip it.

**Operation:** Select the input box, fill in the input content or variable reference, and configure the waiting time.

**Results and Notes:** Enter or skip to continue without generating a branch. When you need to overwrite the old value, you can use "clear if it exists".

### 25. Clear if present

**Function:** Clear the content when the input box is found, otherwise skip it.

**Operation:** Select the input component and add it, check the positioning and waiting time.

**Results and Notes:** If you continue after clearing or skipping, an error will still be reported if the actual clearing fails.

### 26. Return if exists

**Function:** The execution system returns when the specified component appears, otherwise it skips.

**Operation:** Select a component that can represent a certain pop-up window or page, and then add nodes.

**Results and Notes:** What is executed is system return, not clicking on the selected component; suitable for closing optional pop-up windows or pages.

### 27. Waiting to appear

**Function:** Wait for the target component to appear.

**Operation:** Select the target, check the positioning, and set the timeout.

**Results and Notes:** Continue after occurrence, fail if timeout does not occur. The component is not automatically clicked.

### 28. Wait for element to disappear

**Function:** Wait until the target component no longer exists.

**Operation:** Select target components such as loading prompts and masks, and configure the waiting time.

**Results and Notes:** Continue after disappearing; if it no longer exists at the beginning, you can pass it directly; if the timeout still exists, it will fail. Device communication errors cannot be dismissed as disappearing.

### 29. Wait for Activity

**Function:** Wait for the device to switch to the specified Android Activity.

**Operation:** Refer to the Activity displayed below the component tree and fill in the "Target Activity" and timeout.

**Results and Notes:** Continue after matching, fail with timeout. An Activity may host multiple pages and check the components in the page if necessary.

### 30. Detect the start node of screen change

**Function:** Record the baseline screenshot of the specified component or area for comparison with the corresponding end node.

**Operation:** Add a start node before the operation to be observed, select the current element or manually select the area, and set the change threshold, pixel tolerance and detection mark.

**Results and Notes:** The start node does not block waiting for screen changes; it is compared only when the matching end node is reached. If the end node is not added or the running path does not pass through the end node, no comparison will be made.

### 31. Detect the end node of screen change

**Function:** Compare the target area at the end of interception with the baseline recorded at the specified start node.

**Operation:** Add the end node after the actual operation, and select the start node that can still be matched on the same reachable path. Multiple sets of detections can explicitly select the corresponding relationship, and are not required to end in the order in which they started last.

**Results and Notes:** The test that starts before the condition can end in its different branches; the test that only starts in the yes branch cannot end in the sibling no branch. The same path cannot end the same set of detections repeatedly. If the change does not meet the expected result, the result will be recorded and continued without being used as the left and right branch nodes.

For example: start node → click button → wait for appearance or delay → end node. This function compares two screenshots, does not continuously poll, and does not determine whether the changed business content is correct.

## 5. Process control

### 32. Empty node

**Function:** Does not perform device operations, only serves as a placeholder node.

**Action:** Added in "Process Control", the name can be modified to indicate the process location.

**Results and Notes:** Continue immediately; an empty node is not a delay and should not be relied upon to wait for the screen to refresh.

### 33. Termination process

**Function:** End the entire current playback normally, and subsequent nodes will not be executed.

**Operation:** Add to the path that meets the end condition.

**Results and Notes:** Unlike execution failure; execution in the connection script will also end the entire playback, not just return to the caller. Use "Exit Loop" when you just want to end the loop.

### 34. Bounded loop

**Function:** Repeat the loop body and enter the "end of loop" path after reaching the upper limit of times or meeting the exit conditions.

**Operation:** Select a fixed number of times, exit when the element appears, or exit when the element disappears; set the number of executions or the maximum number of executions. In conditional mode, you also need to select a positioning method and fill in the positioning content. Put repeated operations into the "loop body" and subsequent operations into the "loop end".

**Results and Notes:** The range of times is 1–10000. The current implementation must set the maximum number of times and does not provide a maximum duration mode. The conditions are checked before the start of each round. If it is met for the first time, the loop body will not be executed; when the upper limit of times is reached, it will exit normally. Log marking rounds.

### 35. Exit the loop

**Function:** Exit the specified current loop or outer loop early.

**Operation:** Add in the loop body and select the target from "Exit Target Loop". The default is the innermost level; often used with condition branches.

**Results and Notes:** When A contains B, exit B and continue the end path of B; when exiting A, end B and A at the same time, and directly execute the end path of A. You cannot exit a loop that does not contain the current position, nor can you exit a caller loop from a child script.

### 36. Continue with the next cycle

**Function:** End this round of execution, skip the operations after the current node in the loop body, and directly enter the next round of the specified loop.

**Operation:** Select "Loop → Continue to next loop" in the loop body, and then select the current loop or the outer loop containing the current position. Often placed in the condition branch, for example, when no picture is produced in this round, return to the list page and enter the next round.

**Results and Notes:** When the current loop is selected, only the remaining nodes of the current loop will be skipped; when the outer loop is selected, the current execution of the inner loop will be ended and the next round of the outer loop will be entered. After the target loop reaches the maximum number of times, a new round is not started, but the "end of loop" path of the loop is executed. You cannot select a loop that does not contain the current position, nor can you control the caller loop from a child script.

### 37. Output log

**Function:** Output specified keywords and content to facilitate searching for execution stages and variable values.

**Operation:** Fill in the log content and modify the default keyword `stageLog` as needed. For example, keyword `login`, content `Current account: {{account}}`.

**Results and Notes:** The text log displays content similar to `login:Current account: ...` with execution time and node information; the log content is also displayed when HTML reporting is enabled. Sensitive variables become desensitized. This node does not perform device operations.

### 38. Connection script

**Function:** Execute the existing child script, and return to the current script to continue after normal completion.

**Operation:** Select the target script and set the incoming parameter and return value mapping as required. The incoming value can refer to the current variable; the return mapping fills in "child script variable name → current script variable name".

**Results and Notes:** The child script has independent variable scope and does not automatically inherit the private variables of the parent script; parameters need to be passed explicitly. If the specified return value does not exist, it will fail. The return mapping will not be executed when the child script actively terminates the entire process. The connection script may skip the application initialization node at its entry to avoid repeated initialization. For details, please refer to the "skip" description in the running log.

When exporting a script containing connection relationships, the connection scripts are recursively collected into ZIP; when there is no connection, a single JSON is exported. When playback screen recording is enabled, the connection script can associate individual video clips.

### 39. Time management

**Function:** Start timing, record any stage, or end timing for the specified timer, associated by the system-generated timer ID. This node does not query the device or determine waiting conditions.

**Operation:** Select the operation in "Process Control → Timing". Fill in the timer name for the start node, and the system automatically generates a read-only timer ID; for the point and end nodes, select the specific start node through the "Associate timer" drop-down, and the options display the name, attached script, node serial number, and ID. The name is for display only, renaming does not change the association. The stage name in the log directly uses the node name, without setting the time point name separately. For example: Start "Login Time" → Click to log in → Wait for the homepage to appear → Select the start timer at the end node. When you need to count the intermediate stage, add "recording time point" after the corresponding waiting node.

**Results and Notes:** The `TIMER:` log contains `timerId` (system-generated association ID), `name` (timer name), `run` (how many times the timer started in this playback), `point` (time point), `at` (UTC ISO time), `elapsedMs` (number of milliseconds since the start), `intervalMs` (number of milliseconds since the last tick). The basic report retains the node output; when the AI report summary is turned on, the summary content depends on the prompt words, and the complete summary is still retained in the original log. No additional business-specific statistical tables are generated. Take start → first text → completion as an example. The `elapsedMs` of the first text is the waiting time for the first word, the completed `intervalMs` is the time spent in the output phase, and the completed `elapsedMs` is the total time spent, including the observation delay of waiting and node execution.

The main script and the connection script in the same playback are associated with timers through IDs; timers with the same name but different IDs do not affect each other and are reinitialized for each playback. An error will be reported when the process has not started or ended. When the loop executes the same start node again, the timer of the ID will be reset, and `run` will be automatically increased; if it has not yet ended, the output of `restarted: true` will be restarted. Generate new IDs when copying a node group or script that contains the start node, and update the associations copied together; batch imports also update cross-script associations synchronously. Copy the point or end node individually to retain the original ID, and reselect it when you need to use another timer. Abnormal abort does not automatically make up the completion time, and the missing business stages should be clearly stated in the log.

## 6. Old script compatible nodes

The following types may still appear in old scripts, but are not separate new entries in the current main action menu.

| Node | Functions and usage |
| --- | --- |
| Assert existence | Verify that the component exists, otherwise it will fail. The new process uses "condition presence" to organize result paths. |
| Assertion text | Verify whether the component text meets expectations, otherwise it will fail. The new process can use the "presence" text condition. |
| Checkbox status, RadioButton status | Read the check status of the corresponding native component and provide true/false branches. The new process uniformly uses "condition check". |
| Screenshot | Save device screenshots during execution, independent of the report screenshot switch; sensitive runs do not save screenshot files. The screenshot is stored at `.midscene-app/screenshots` in the application data root directory. |
| Old version screen change node | Keep historical configuration compatible. The new process recommends using named paired start/end nodes and should not directly copy the old single-node configuration. |

## 7. Process tools that are not execution nodes

- **Start:** Indicates the process entry, add the first operation through the "+" below, and is not a substitute for "Start App".
- **Merge branches:** Connect subsequent public operations of branches to a common path, supporting two-way selection; the merge button can be switched to cancel the merge. It changes the connection relationship and does not perform device operations.
- **Copy, paste, batch copy, batch delete:** Edit the process structure without executing the nodes. The deletion condition node will be deleted together with its sub-branch. Check the scope before operation.
- **Search and Positioning:** Find nodes by name, operation type, positioning content or log keywords, locate and highlight them without changing the layout.
- **Restore location, process overview:** Adjust the canvas display without changing the execution order.

## 8. Common combinations

| Goals | Sample Process |
| --- | --- |
| Log in | Start the App → Wait for it to appear → Clear the input → Record the entered account number → Record the entered password → Record the click → Determine the existence. |
| Handle occasional pop-up windows | Start the App → click the close button if it exists → follow the process. |
| View AI description | AI recognizes "what is in the current screen" and does not enable branch → next node; view the answer in the log. |
| AI condition page | AI identifies "whether to display the device list", enable the branch and verify → true to continue, false to output logs or terminate the process; when fault tolerance is required, configure again without valid results. |
| Verify changes after clicking | Start detecting screen changes → click → wait to appear → corresponding end node. |
| Image radio selection status | For image condition, select "Picture status condition" and configure two templates → true if selected, false if not selected. |
| Multiple rounds of stability testing | Bounded loops → Switch pages within the loop body and check → Return to the initial page when the current round fails and "continue to the next loop" → "Exit the loop" when the number of times is reached or success → Summary log after the end of the loop. |

The above example only shows the node combination method. The actual positioning, timeout, branch and expected results must be combined with the target application configuration.
