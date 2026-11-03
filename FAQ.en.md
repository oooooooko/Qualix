# FAQ

[简体中文](./FAQ.md) | [English](./FAQ.en.md)

## What should I do if the script or configuration is missing after updating?

Usually it is not that the data is deleted, but that the old version saves the data to the directory where the startup command is located. The new version of `npx qualix` will use the fixed system user data directory by default and try to automatically migrate old data from the current directory at startup.

Default data directory:

Qualix continues to use the data directory before the name change, so there is no need to migrate existing scripts and configurations.

```text
Windows: %LOCALAPPDATA%\android-midscene-automation
macOS: ~/Library/Application Support/android-midscene-automation
Linux: ~/.local/share/android-midscene-automation
```

If you still cannot see the old data after migration, please search for `.midscene-app/script-cache.sqlite` in the previously started directory, and then copy `.midscene-app` to the fixed data directory above. You can also set `ANDROID_MIDSCENE_DATA_ROOT` to point to the original data directory and continue using it.

## What should I do if the same id is positioned in the wrong input box?

If the account box and password box are both `id/tg_edit`, it may be entered into the first input box only by id playback.

Suggestions:

- Directly select the account box and password box respectively to record the input.
- In the node details, confirm whether the selector displays "Duplicate N" and whether "Recommended positioning" displays parent + child.
- If the recommended positioning is inaccurate, expand the recording step and manually modify the parent context selector.
- Clicking on the coordinates is only used as a last resort.

## What should I do if the page jump is not detected after clicking?

Possible reasons:

- The button is currently disabled.
- The account password is incorrect.
- App uses a single Activity, and the Activity does not change.
- Page jumps depend on the network.

Recommended:

- Use "Wait for Appearance" to determine the core elements of the next page, or add "Wait for Activity" to clarify the target page.
- When activity changes are detected, you can choose to continue recording in the current script; you can also split it into two scripts and then use "Connect Script" to connect them in series.
- Single Activity App should not rely on Activity changes, but should use the core elements of the page to determine whether it has entered the target state.

## Why do I not enter the target page after connecting to the script?

- The connection script list will display other saved scripts of the same App, regardless of the entry activity.
- The connection operation itself will not click on the page or actively jump. The previous click, input or startup of the app must first let the device enter the page required by the target script.
- When the target script is bound to the entry Activity, the playback will wait for the Activity; if it is not bound, it will be executed directly from the current screen.
- It is recommended to add "Wait for Activity" or "Wait for Appearance" before connecting across pages to confirm that the page switching has been completed.

## Why is the playback invalid after clicking the App on the desktop?

Some manufacturers' systems limit the control information on the desktop or launcher page, and Appium may not be able to obtain the stable ID of the desktop icon. At this time, "clicking the App icon" recorded on the desktop may not be played back.

It is recommended to add the "Start App" operation after the start node, and the system will open the target App according to the package name, instead of clicking the icon on the desktop. When you need to reset the login status or cache, you can first add "Clear App Cache" and then add "Start App".

## What should I do if the pop-up window only appears once?

Use "Judge Existence".

```text
Check whether the Confirm button exists
  Yes -> Tap the Confirm button
  No -> No action
```

Do not directly use the pop-up window confirmation button as a normal required click, otherwise the script will fail when the pop-up window does not appear.

## When to use wait activity

Suitable for multiple activity apps.

If the App has a single Activity architecture, it is preferred to use:

```text
Wait for a key page element to appear
```

## When to use optional steps

Optional steps are suitable for non-main process blocking items:

- Permission pop-up window
- Agreement pop-up window
- Active pop-up window
- first boot

It is not recommended to make login buttons, submit buttons, and core assertions optional.

## What to do if UiAutomation not connected appears during playback

Component tree refresh and Appium playback cannot occupy UiAutomation at the same time. The current version pauses automatic component tree refresh during playback and retries after cleaning up residual fetching processes when disconnected.

If it still fails:

1. Confirm that the phone remains unlocked and the USB debugging authorization has not expired.
2. Confirm that Appium and UiAutomator2 Driver have started normally.
3. Stop other tools that are crawling the same device component tree.
4. Reconnect the device and play again.

## What to do if the device preview or component tree is not updated

1. First make sure the device is still displayed in the device drop-down box.
2. Click the device preview refresh button to reacquire the screen.
3. Click "Refresh Component Tree" to re-crawl the page structure.
4. Automatic refresh of the component tree will be paused during playback, and will automatically resume after playback is completed.
