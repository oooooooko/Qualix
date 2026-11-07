# 测试编排 AI 识别与参数设置使用说明

[简体中文](./AI识别操作说明.md) | [English](./AI_RECOGNITION.en.md)

本文说明本项目的 **测试编排参数设置**和流程中的“AI 识别”节点，包括模型服务、预设场景、单帧识别、持续观察、截图去重、回放截图、报告总结和流程外观。测试编排的 AI 识别模型与“Midscene 配置”中的模型相互独立。

本文档对应页面“帮助与版本 → 操作说明 → AI 识别”。其他 测试编排节点请查看 [流程节点操作说明](./FLOW_NODES.en.md)。

The scene parameters in this article are the starting point for debugging. Please verify with actual equipment, pages and models before adjusting.

## Appium Settings overview

入口：**参数配置 → 测试编排配置**。页面按用途分为以下模块：

| Module | Configuration items | Saving method |
| --- | --- | --- |
| Model Service | AI Recognition Model | Click "Test and Save" and save after passing the test |
| Model Service | Prompt Word Optimization Model | Click "Test and Save" and save after passing the test |
| AI recognition settings | Continuously observe screenshots to remove duplicates | Automatically save after modification |
| AI recognition settings | AI recognition preset prompt words | Automatically save after adding, editing or deleting |
| Playback and report | Playback screenshot | Automatically save after switch modification |
| Playback and report | Summary of playback report | Automatically save switches, test scenes and prompt words after modification |
| Process editor | Process background color, connection line color | Automatically save after modification |

页面顶部会显示 测试编排配置的自动保存状态。模型连接参数只有测试成功后才会覆盖已保存配置，其他开关、颜色和提示词配置按修改自动保存。

## 1. First select the configuration according to the target

| Your goals | How to identify | Observe mode | Enable branches | Recommended starting configuration |
| --- | --- | --- | --- | --- |
| Determine whether there are advertisements in the current stable picture | Single frame recognition | Not applicable | Enable | Condition based on a screenshot, true / false, follow different processes |
| The time when the opening screen advertisement appears is not fixed, execute the next step as soon as possible after it appears | Continuous observation | End early after detecting a hit | Open when it is necessary to distinguish whether there is an advertisement | The longest is 15000ms, the interval is 1000ms |
| Count whether advertisements have appeared during the observation period, and prioritize reducing the number of requests | Continuous observation | Unified analysis after the observation | Enable | 15000ms, interval 1000ms |
| Extract advertisement title, product name, button text | Single frame recognition, or continuous observation | Select unified analysis when continuous observation | Close | Use single frame for stable picture; use 10000ms / 1000ms for short-term advertising |
| Wait for the video, picture or preview area to be released | Continuous observation | End early after detecting a hit | Recommended to turn on | Up to 20000ms, interval 1000ms |
| Wait for the "Skip" or "Close" button to appear | Continuous observation | End early after detecting a hit | Recommended to turn on | Up to 10000ms, interval 500ms |
| Check the current screen for network anomalies and loading failure prompts | Single frame recognition | Not applicable | Enable | Change to continuous observation when the page is still changing |
| Record page description, only the model answer is required | Single frame recognition | Not applicable | Close | Use open prompt words, and the answer is written to the playback log |
| Determine clear image features such as pure black screen, fixed template, color ratio, etc. | Prioritize the "image condition" node | Set according to the corresponding condition function | According to needs | Such needs usually do not require language model understanding |

The key to selection is: **If you only want to watch now, use a single frame; if you need to wait or capture short events, use continuous observation; if you need to continue as soon as possible after a hit, choose to end early. **

## 2. Configure the AI recognition model

入口：**参数配置 → 测试编排配置 → 模型服务 → AI 识别模型**。

1. Fill in the `Base URL` of the model service.
2. Fill in `API Key`.
3. Fill in the actual callable `Model Name`.
4. Click **Test and Save**.

测试通过才保存当前模型，失败时保留之前的模型配置。只修改输入框不会自动保存模型。截图去重和预设提示词等其他 测试编排配置仍按修改自动保存。

The model needs to support image input; continuous observation also needs to support multiple images in the same request. The current implementation uses a request format compatible with OpenAI Chat Completions.

**"Test and Save" currently verifies text connection requests and cannot replace the image recognition test. ** After successful configuration, "Test AI Recognition" should be executed on the AI node to check whether the real device screenshots can be correctly recognized by the model. Continuous observation should also test multi-image requests individually.

AI recognition reads the actual screenshot of the device and does not rely on the component tree to understand the content. The device preview is just an observation interface and cannot be used to replace the actual screenshots and model call tests with the normal preview display.

## 3. Manage preset test scenarios

入口：**参数配置 → 测试编排配置 → AI 识别设置 → AI 识别预设提示词**。

Each preset contains two parts:

| Field | Purpose | Example |
| --- | --- | --- |
| Test scenario | Name displayed when drop-down selection | Screen-opening ad detection |
| Prompt word content | Actual recognition requirements sent to the model | Does an advertisement appear on the current screen? Upgrade pop-ups and notification pop-ups are not advertisements. |

After filling in, click "Add Prompt Word". The list below displays a fixed three-line height, and you can scroll to view the entire content. Both the default preset and the custom preset can edit the test scene name and prompt word content, or delete them; they will be automatically saved after adding, editing, and deleting.

Built-in scenarios include image output detection, advertising and skip close button detection, advertising content extraction, and abnormal prompt detection. Older text-only presets will retain their contents and add scene names; deleting all presets will not be restored on refresh.

When creating a new AI node or editing "Identification Content/Hit Condition":

1. Open the "Select test scenario" drop-down box.
2. Search or select by scene name.
3. Hover over the scene to view the full prompt word.
4. After selecting, the prompt word is filled in the input box below, and you can continue to modify it.

**Selecting a scene only fills in the prompt words, and will not automatically change the identification method, observation mode, timeout or branch configuration. **

The node saves independent prompt word text. Deleting a preset will not clear existing nodes, and adjusting a preset will not automatically overwrite existing scripts. The maximum length of a scene name is 80 characters, and the maximum length of a prompt word is 4,000 characters; duplicate scene names or duplicate content cannot be added again.

## 4. Create and save AI nodes

1. Select the insertion location in the Appium process.
2. Select **Visual Recognition → AI Recognition**.
3. Select a test scenario, or manually fill in the recognition content.
4. After adding the node, configure the identification method, observation mode and branch.
5. For nodes that need to judge conditions, complete "Verify and Save Questions".
6. Save the script and play it back again.

New AI nodes use single frame recognition by default and do not enable branches. Actively check "Enable Branches" when true/false paths are required, and connect subsequent nodes in both directions.

## 5. Identification method: single frame and continuous observation

### Single frame recognition

When the node is executed, a screenshot of the device is obtained and then handed over to the model for analysis.

Suitable for pages that are already stable, such as checking whether there are pop-ups on the current page, reading the current ad text, and describing the current screen.

It cannot see content that has disappeared before taking the screenshot, nor will it wait for content that appears after taking the screenshot. Therefore, "Launch App → Fixed Delay of 5 Seconds → Single Frame Recognition" may still miss ads that are loaded at the 7th second.

### Continuous observation

Starting from the current AI node, screenshots are taken continuously according to the sampling interval, and then the model is submitted according to the observation mode. It looks at a set of discrete screenshots, not a continuous video.

| Parameters | Meaning | Current scope / Default value |
| --- | --- | --- |
| Observation duration / maximum observation time | Sampling window of this node | 1000~60000ms; default 15000ms |
| Sampling interval | Planned interval between two samplings | 500~10000ms; default 1000ms |
| Number of samples | Number of screenshots allowed for one observation | Maximum 30 frames |

The node will start sampling immediately, so **15000ms, interval 1000ms, usually about 16 pictures are collected instead of a fixed 15 pictures**. The actual number is affected by screenshot speed, processing time and early termination; the number of images submitted for the model is also affected by deduplication.

Configuration verification estimates the number of frames according to the following formula:

```text
Estimated frames = ceil(observation duration / sampling interval) + 1
```

For example:

| Observation duration | Sampling interval | Estimated number of frames | Availability |
| --- | --- | --- | --- |
| 15000ms | 1000ms | 16 | available |
| 10000ms | 500ms | 21 | Available |
| 30000ms | 1000ms | 31 | Exceeded upper limit |
| 30000ms | 2000ms | 16 | available |
| 60000ms | 3000ms | 21 | Available |

The shorter the sampling interval, the easier it is to capture short-term images, but the consumption of screenshots and image analysis may also increase. Ads whose duration is shorter than the sampling interval may still be missed.

Observation starts from the AI node and does not trace back to the previous node. The node should be placed immediately after launching the app or triggering the advertisement; if the advertisement has appeared and disappeared during the execution of the previous node, subsequent observations will still not be able to reshoot.

## 6. How to choose observation mode

### Unified analysis after observation

Execution process: **Sampling → Local deduplication → End of observation → Unify the retained screenshots and submit them to the model → Get the results**.

Suitable for the following needs:

- If you want to know whether advertisements appeared during the observation period, no immediate action is required.
- Need to extract the content of short-lived ads.
- Hope to reduce the number of model requests.
- Need to compare page changes in multiple screenshots.

This mode initiates a multi-image analysis request after the sampling is completed. A request may still contain multiple images, so "the number of requests is small" does not mean "the image input cost must be very low".

Existence condition is understood as "the target clearly appears in any frame during the observation period". For example, if the question is "Are there any advertisements on the current screen?", the continuous observation will determine whether advertisements have been seen during this observation period, rather than just looking at the last picture.

### End early after detecting a hit

Execution process: **Continuously sample and retain keyframes → Submit new keyframe identification one after another → Model confirms hit → Stop observation**.

Only one model recognition request is made at the same time. New keyframes collected during model processing will be queued and analyzed together in the next request, so it is not a fixed "call the model once a second".

| Execution results | Branch enabled | Branch not enabled |
| --- | --- | --- |
| The model confirms the hit | Stop observing and enter the true (yes) branch | Stop observing and execute the next node |
| Sampling ends and all keyframes to be analyzed are missed | Enter the false (no) branch | Execute the next node |
| Model error, unable to determine, return format error | Processing by recognition failure | Processing by recognition failure |

Sampling is stopped after the longest observation time, and it is necessary to wait for the identification of ongoing and remaining keyframes. Therefore:

- Set the maximum observation time to 15 seconds, and the total node time may exceed 15 seconds.
- Early termination occurs when the model returns a hit result, not when the ad appears on the screen.
- Even if branching is not enabled, a yes/no hit condition must be filled in.
- When branching is not enabled, the next node will continue regardless of whether there is a hit; to make "no advertisement detected" go through an abnormal process, branching should be enabled.

Don't use this pattern to require the model to completely describe the entire process, and don't use it to accurately measure when an ad appears or disappears.

## 7. Branch conditions and problem verification

"Branch enabled" is suitable for explicit condition problems; single frame or unified analysis mode without branching is suitable for description and content extraction.

| Prompt word | Suitable for branching/end early | Reason |
| --- | --- | --- |
| Are there advertisements on the current screen? | Yes | Determine whether a specific object exists |
| Is there a visible "skip" button on the current ad page? | Yes | Determine whether the specified button exists |
| Is the video area already showing a normal image instead of a black screen or loading placeholder? | Yes | Determine the status of the specified area |
| Describe the current screen | No | Open description |
| Extract ad title, product name and all button text | No | Content extraction task |
| Are there any ads? If so, please list all advertising content | Not recommended | Mixing condition with open extraction may fail verification |

The built-in "Ad and Skip Close Button Detection" contains multiple checking requirements. When used for information analysis, you can select it directly; when used for branching, it is recommended to change it to a single clear condition, such as:

```text
Does the current screen contain a commercial advertisement?
Update dialogs, system notifications and permission dialogs are not advertisements.
```

If you only want to continue when "ads appear and can be skipped", you should explicitly write:

```text
Does the current screen meet all of these conditions?
1. A commercial advertisement is visible;
2. The advertisement has a visible Skip or Close button.
Update dialogs, notifications and permission dialogs are not advertisements.
```

When opening a branch, switching to early termination mode, or modifying a condition question, the system will call the model verification question type. After clicking "Verify and Save Question", the button is disabled during verification and "Verifying..." is displayed below. This problem modification will not be saved on failure.

**Problem verification does not provide device screenshots. It only checks whether the text is suitable for condition. ** Passing verification does not mean that the advertisement has appeared; "test AI recognition" or playback must be performed to check the current device.

After enabling the branch, you can check "Enable Digging", and then choose whether to enter the left true branch or the right false branch when there is no valid recognition result. The scope of application is included in the question mark description next to the option:

- Disable back-and-forth: The node fails when the model returns no usable results, keeping the old script behavior.
- Enter the true branch: Enter true when the model returns empty content, invalid JSON, `result: null`, or no boolean value is returned.
- Enter the false branch: Enter false when the above-mentioned invalid results occur.

When the model returns `true` or `false` normally, it is always executed according to the actual results, without any back-up. Model request failures, device screenshot failures and network abnormalities will not be swallowed up; model request timeouts will continue to use the node's original "timeout post-processing". The replay log will clearly record "AI did not return valid true/false" and the actual branch entered.

## 8. Configure according to scene

### Scenario A: The loading time of the open-screen advertisement is not fixed

For example, it sometimes appears in 3 seconds and sometimes in 7 seconds. It is easy to capture a splash screen page with a fixed delay.

| Projects | Suggestions |
| --- | --- |
| Node location | Enter AI recognition immediately after starting the App |
| Identification method | Continuous observation |
| Observation mode | End early after detecting a hit |
| Maximum observation time | 15000ms; adjust if there is a longer load in actual measurement |
| Sampling interval | 1000ms |
| Branch | Open |
| Remove duplicates | Use pixelmatch default parameters first |
| true branch | Enter subsequent ad inspection or independent click node |
| false branch | Record "No ads found during observation", end according to test requirements or perform other processes |

Prompt words:

```text
Does the current screen contain a commercial advertisement?
App splash screens, update dialogs, system notifications and permission dialogs are not advertisements.
```

Don't equate "ads haven't appeared yet" with "ads will never appear." False can only mean that the image sampled and analyzed this time did not hit the target.

### Scenario B: Wait for skip button after ad appears

Don't just judge "ad appeared" if the button wasn't shown when the ad appeared. Instead, use the above condition of "advertising and button exist at the same time", or split it into two nodes: "advertising detection → button detection".

It is recommended to continue observation, end early, 10000ms / 500ms, and enable branches. In order to retain the small button changes, you can first reduce the allowed change area of pixelmatch from the default 0.50% to 0.10%, and then verify it with a screenshot.

The AI node only makes conditions and will not automatically click just because the prompt word says "Close Advertising". The next step should be to use independent click nodes. The button may have disappeared when the model returns, and subsequent operations should still consider the actual page state.

### Scenario C: Extraction of advertising content, including interference such as upgrade pop-ups

| Projects | Suggestions |
| --- | --- |
| Recognition method | Single frame is used when the advertisement is stable; continuous observation is used when the advertisement is displayed briefly |
| Observation mode | Unified analysis after observation |
| Observation duration / interval | 10000ms / 1000ms |
| Branch | Close |
| Deduplication | pixelmatch default; reduce deduplication intensity when important small words are missed |

Prompt words:

```text
Inspect commercial advertisements in the screenshot and report:
1. Whether an advertisement was found;
2. The advertisement title and product name;
3. Whether a Skip or Close button is present;
4. Other clearly readable advertisement text.
Update dialogs, system notifications and permission dialogs are not advertisements.
For content you cannot see, write Not found or Unreadable. Do not guess.
```

Answers are written into recognition results and playback logs. The current AI recognition node will not automatically write results such as advertising titles into variables that can be referenced by subsequent nodes.

### Scenario D: Waiting for video, camera preview or picture output

It is recommended to continue observation, end early, 20000ms / 1000ms, and enable branches.

The prompt word should point out the target area to avoid mistaking the navigation bar or background image for "out of the picture":

```text
Does the video preview in the middle of the screen display an actual scene?
Solid black or white frames, loading animations, default covers and offline placeholders do not count as an actual scene.
```

If the goal is just to check the black screen ratio, you can use "image condition" first; if you need to distinguish between covers, placeholder images and real scenes, then use AI recognition.

### Scenario E: Just want to confirm whether advertisements have appeared during the observation period and control model consumption

It is recommended to use continuous observation, unified analysis, 15000ms / 1000ms, enable branching, and pixelmatch default parameters.

In this model, even if the advertisement is adopted earlier, the observation will be completed before analysis. It is suitable for result statistics, not suitable for clicking on ads that are about to disappear immediately.

### Scenario F: Buttons, icons or small text change

Use pixelmatch first to reduce the allowed variation area, such as 0.10%; if necessary, reduce the pixel color tolerance, such as 0.05. If key details are still missing, temporarily switch to "no duplication" for a control test.

These values are a starting point for debugging. Don’t simply increase the allowable area to reduce the number of images: an important button may only take up a small part of the screen.

### Scenario G: Video or animation continues to change, too many images are submitted

First shorten the observation window or increase the sampling interval; if immediate operation is not required, use unified analysis. For minor changes that are not important, try OpenCV (SSIM), starting from the default 0.990.

Video frame content can inherently vary widely, and neither type of deduplication guarantees a significant reduction in the image. Don't adjust the threshold too wide to filter out the ads or buttons that really need to be identified.

## 9. How to adjust screenshot removal

入口：**参数配置 → 测试编排配置 → AI 识别设置 → 持续观察截图去重**。

Deduplication is a global configuration, used for subsequent continuous observation playback and recognition testing, and does not affect single frame recognition. Both algorithms compare images locally without calling the model; the first frame is always retained and then compared with the previous retained screenshot.

| Method | Suitable | Notes |
| --- | --- | --- |
| No deduplication | It is very important to check for missed frames and confirm the content and details of each sample | The picture input consumption is high; it is still impossible to make up for the content that was not captured within the sampling interval |
| pixelmatch (default) | Changes in pages, pop-ups, and buttons on the same device | Compare pixel color and change area. If the parameter is too wide, small changes will be filtered |
| OpenCV (SSIM) | Pays more attention to the overall picture similarity and hopes to ignore some subtle noise | Does not understand semantics such as advertisements and does not automatically align displacements; thumbnails may lose small text differences |

Parameter meaning:

| Parameters | Default value | Impact of increase |
| --- | --- | --- |
| pixelmatch: pixel color tolerance | 0.10 | Small color differences are more easily ignored and usually less retained |
| pixelmatch: allowed variation area | 0.50% | Larger area variations may also be considered duplicates and retained less |
| OpenCV: SSIM similarity threshold | 0.990 | The closer it is to 1, the more stringent it is to detect duplicates and usually retain more |
| OpenCV: Compare the longest side of the image | 512px | Preserve more details when comparing, and also increase the amount of local calculations |

Note that the "allowed change area" of pixelmatch is different from the threshold adjustment direction of SSIM. To preserve the image more conservatively, turn the former down and the latter up.

OpenCV's longest edge parameter only affects local comparison images. Images submitted to the continuous observation model are also compressed uniformly: the longest side does not exceed 1600px and JPEG quality is 85; the observation image data is also subject to an upper limit of approximately 24MB. Small text recognition is also affected by device resolution, image compression, and model capabilities.

## 10. How to set the timeout

The AI node needs to actively check "Enable Timeout" for the setting value to take effect. New nodes are not enabled by default; please check the value when enabling it. The general default value of 3000ms may be too short for some multi-graph requests.

| Time settings | What to control | What not to control |
| --- | --- | --- |
| Observation duration / maximum observation time | Continuous sampling window | Not the upper limit of the total time consumption of the entire node |
| Model request timeout | Waiting time for each model request in continuous observation | The 15-second observation window will not be cut into 3 seconds |
| Single frame timeout | Single frame recognition request process, including the required screenshot waiting | Not equal to the advertising waiting window |

You can first enable 30000ms as the debugging starting point for model request timeout, and then adjust it based on the actual time taken. The backend limits positive timeouts to 1000~300000ms; do not interpret filling in 0 as disabling. To disable, uncheck "Enable timeout".

The total time consumption of unified analysis is roughly composed of "observation sampling + model analysis"; the sampling and identification of the early end mode overlap, but it may still wait for multiple requests.

Not enabling node timeout does not mean that any external connections will wait indefinitely; network, model services, and device screenshots themselves may still report errors. You can manually terminate playback when you need to stop waiting.

When a branch is enabled and a timeout is enabled, you can configure "timeout post-processing": timeouts enter the right (false) branch by default, or you can choose to terminate the flow or enter the left (true) branch. **Entering a branch due to timeout does not mean that the model is judged to be true or false**. The playback log will record the reason for the timeout. Model HTTP errors, incorrect formats, or cannot be determined will not automatically be regarded as "misses".

## 11. Testing and troubleshooting

Click "Test AI Recognition" on the node to view screenshots of condition/answer, time consumption, and actual usage. Continuous observation will also display the number of frames collected, the number of frames submitted, and the deduplication method; the early end mode will display whether there is a hit and the number of model requests.

The test will start recognition immediately, using the screen of the device at this time, and will not automatically execute the previous nodes such as "Start App". To verify the complete screen opening process, the script including the startup operation should be played back.

Check in the following order:

| Phenomenon | Priority Check |
| --- | --- |
| Configuration test passed, but AI recognition error reported | Whether the model supports images and multiple images; check HTTP errors and node test results |
| Problem verification failed | Whether to mix open extraction requirements; first change to a single "whether" condition |
| There are ads, but false | Check if the ads are captured in the screenshot you submitted; then check whether the duplicates are removed and whether the prompt words exclude the target |
| Collect many frames and only submit a small number | Usually deduplication takes effect; check whether key changes are deleted by mistake against the actual submission screen |
| Observe for 15 seconds, execute for more than 15 seconds | Check model elapsed time, remaining keyframes and request-by-request wait |
| Still not gone after hitting true | Check whether the branch is enabled, whether the true path is connected, and whether it has not been verified and saved after editing |
| The model does not return true/false, and the process fails directly | After enabling the branch, configure "When there is no valid identification result" according to the business risk; failure behavior will remain if the bailout is not set |
| The bottom line has been set up, but the branch was not entered when the network error was reported | The bottom line only processes invalid model content; network, model interface, screenshots and timeout errors are still processed according to the failure or timeout settings |
| No hit but the next node is executed | This is normal behavior when branching is not enabled; please enable branching if you need to distinguish results |
| The startup page is photographed every time | The AI node location, observation window and sampling timing may not be appropriate |
| The small button appears but is not detected | Reduce the pixelmatch allowed change area, or increase the SSIM threshold; use or not to deduplicate the control |
| Click failure after early hit | The model recognizes the collected picture, and the target may have disappeared when returning; check subsequent click nodes |

When debugging, first confirm "what was captured", then adjust "how the model understands", and finally optimize the number of pictures and model consumption. Keeping samples such as normal pages, real ads, upgrade pop-ups, and notification pop-ups can help discover the miscondition boundaries of prompt words.

## 12. Screen-opening advertising process that can be directly adopted

```text
Launch the target app
  ↓
AI Recognition: Continuous Observation / End Early on Match
Observe for up to 15000ms; sample every 1000ms
Enable branching; start with the default pixelmatch settings
Start with a 30000ms model timeout; enter the right (false) branch on timeout by default
  ├─ true: Continue to a separate advertisement check or action node
  └─ false: Log No advertisement found during observation and follow the test case
```

Test scene name: **Open screen advertisement detection**.

Hit condition:

```text
Does the current screen contain a commercial advertisement?
App splash screens, update dialogs, system notifications and permission dialogs are not advertisements.
```

If you must click "Skip" immediately in the next step, change the hit condition to "Ads exist simultaneously with visible skip/close buttons", and focus on verifying that small button changes will not be deduplicated.

If the goal is to extract advertising content, you should use unified analysis instead, close the branch, or set up another content extraction node; the second node will retake the screenshot, and there is no guarantee that you will still see the short-lived ads captured by the first node.

## 13. Configure prompt word optimization model

入口：**参数配置 → 测试编排配置 → 模型服务 → 提示词优化模型**。

The prompt word optimization model only needs to support text input and is uniformly used for:

- Supplement and optimize AI recognition prompt words based on brief requirements.
- Optimize playback report prompt words.
- After the playback report summary is turned on, the test report summary is generated based on the log and node configuration.

Fill in `Base URL`, `API Key` and `Model Name` and click "Test and Save". If the test is successful, a pop-up window will prompt and the configuration will be saved; if the test fails, the previously available configuration will be retained. The AI recognition model and the prompt word optimization model have different uses and can be configured as different models.

## 14. Configure playback screenshots and HTML reports

入口：**参数配置 → 测试编排配置 → 回放与报告 → 回放截图**。

This switch is off by default. When enabled, the playback will collect device screenshots before and after the actual execution node and generate a playable single-file HTML report; the condition results, failed nodes and manual termination will also retain the corresponding images. After closing, only Markdown reports, logs and running history will be retained. Nodes that really need images, such as image condition and manual screenshots, will still take screenshots on demand.

Screenshot collection will increase the playback time, and the actual operation interval between nodes may exceed the fixed delay set in the process. Turn it on when the report requires a complete process picture; turn it off when you only care about the execution log or want to reduce time consumption.

## 15. Configuration playback report summary

入口：**参数配置 → 测试编排配置 → 回放与报告 → 回放报告总结**。

After being turned on, the tool uses the "prompt word optimization model" to read the desensitized playback logs and node configurations, and generates a Markdown test report summary. You can select test scenarios, modify report prompt words, add custom test scenarios, or use "optimization prompt words" to supplement the content after entering brief requirements.

In the settings of the playback button, you can select a report template for this playback; if not selected, the default test report will be used. When you need to analyze the drawing speed, you can choose the drawing time analysis template. The report should combine the node start, screenshot collection, identification hit and end time in the log to explain the drawing time.

After turning on summary, the page will verify the prompt word optimization model:

- When the model is available, an AI summary is generated after playback ends.
- When the model is unavailable, "Model unavailable, use default template" is displayed next to the switch, and playback will continue.
- When the summary request fails, times out, or returns empty content, the basic report and original log in the default format are retained and the test results are not changed.

The summary time is not included in the total equipment test time. The content sent to the model does not include screenshots and image templates; if the script configuration and log are too long, the beginning and end will be retained and the middle section will be omitted.

## 16. Configure the appearance of the process editor

打开顶栏右侧的偏好设置，在流程编辑器中调整外观。

The process background color and connection line color can be set separately. Each supports preselected colors, color picker, hex color input and restore to default. The color value supports `#RGB` or `#RRGGBB`. When the input is invalid, the page will display a verification prompt.

The modified appearance is automatically saved and applied to the normal process canvas, magnified view and connected script preview at the same time. This configuration only affects the display of the process editing interface and does not change the script node and playback behavior.
