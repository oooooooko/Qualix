# Preparing an iOS connection

## 1. Start WDA

Use a Mac with Xcode and its command-line tools to run WebDriverAgent (WDA 7.0.0 or newer) on a simulator or physical device. Qualix connects to an already running WDA.

### Phone settings (physical devices only)

Before connecting a physical device for the first time, complete these steps on the phone:

1. Trust the computer: connect the unlocked phone to your Mac using USB. Accept the trust prompt and enter the phone passcode if requested.
2. Enable Developer Mode (iOS 16 or later): open Settings → Privacy & Security → Developer Mode, turn it on, and restart when prompted. After restarting, unlock the phone, confirm enabling the mode, and enter your passcode if requested. If the setting is missing, initiate pairing with the phone in Xcode's device management, then check Settings again.
3. Enable UI Automation: open Settings → Developer and turn on Enable UI Automation. If the Developer menu is missing, check that you completed the restart and confirmation in the previous step.

Then configure WDA's developer signing in Xcode and start WDA. Keep the phone unlocked during connection and testing.

## 2. Forward physical-device ports

Simulators do not need forwarding. For a USB-connected device, install the forwarding tool:

```sh
brew install libimobiledevice
```

For a single physical device, forward both ports with one command. Keep WDA and the forwarding process running:

```sh
iproxy 8100:8100 9100:9100
```

Port 8100 serves control requests; port 9100 serves MJPEG preview. Qualix falls back to screenshots when the video stream is unavailable.

For multiple devices, specify the device UDID with -u and assign separate local ports to each device, for example:

```sh
iproxy -u YOUR_DEVICE_ID 8200:8100 9200:9100
```

## 3. Verify and connect

On the Qualix host, run:

```sh
curl http://localhost:8100/status
```

A true value.ready means WDA can accept commands. If unreachable, check WDA and forwarding. If preview works but control fails, check Developer Mode, UI Automation and computer trust.

Qualix discovers the default address automatically. A sole online device is selected automatically; open Test Orchestration to preview it. You can also select Connect Default Device. Device and session IDs are not required.

## Multiple devices or custom addresses

Expand Multiple Devices / Custom Connection. Give each device separate local control and video ports, or enter the actual remote WDA URLs. Save and select a device in the preview selector. Existing configurations remain available. Registering the default WDA manually suppresses the duplicate automatic entry.
