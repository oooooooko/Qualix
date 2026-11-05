import { execFile } from "node:child_process";
import { createPhone, shellQuote } from "../../ai-flow/server/device";
import { getAdbCommand } from "../../server/android-sdk";
import { appPath } from "../../server/paths";
export type VisualScreen = {
  imageBase64: string;
  width: number;
  height: number;
  activity: string;
};
export type VisualPhone = {
  observe: () => Promise<VisualScreen>;
  launch: (app: string) => Promise<void>;
  tap: (x: number, y: number, duration?: number) => Promise<void>;
  input: (text: string) => Promise<void>;
  swipe: (points: [number, number, number, number]) => Promise<void>;
  key: (code: number) => Promise<void>;
  wait: (ms: number) => Promise<void>;
  checkApp?: () => Promise<void>;
};
export function createVisualPhone(
  deviceId: string,
  signal: AbortSignal,
  appPackage?: string,
): VisualPhone {
  const adb = getAdbCommand(),
    controls = createPhone(deviceId, signal, appPackage);
  let helperReady = false;
  const exec = (args: string[]) =>
    new Promise<string>((resolve, reject) =>
      execFile(
        adb,
        ["-s", deviceId, ...args],
        {
          signal,
          timeout: 20000,
          encoding: "utf8",
          maxBuffer: 24 * 1024 * 1024,
        },
        (error, stdout, stderr) =>
          error
            ? reject(
                new Error(
                  signal.aborted ? "任务已停止" : stderr || error.message,
                ),
              )
            : resolve(stdout),
      ),
    );
  const shell = (...args: Array<string | number>) =>
    exec(["shell", args.map((value) => shellQuote(String(value))).join(" ")]);
  return {
    launch: controls.launch,
    key: controls.key,
    wait: controls.wait,
    checkApp: controls.checkApp,
    async observe() {
      const [imageBase64, activity] = await Promise.all([
        controls.capture!(signal),
        shell("dumpsys", "activity", "activities"),
      ]);
      const bytes = Buffer.from(imageBase64, "base64");
      if (
        bytes.length < 24 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new Error("设备未返回有效截图");
      return {
        imageBase64,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        activity:
          activity
            .split(/\r?\n/)
            .find((line) => /ResumedActivity/.test(line))
            ?.match(/\s([\w.$]+\/[\w.$]+)(?=[\s}]|$)/)?.[1] || "",
      };
    },
    async tap(x, y, duration) {
      await controls.checkApp?.();
      if (duration) await shell("input", "swipe", x, y, x, y, duration);
      else await shell("input", "tap", x, y);
    },
    async input(text) {
      if (!helperReady) {
        await exec([
          "push",
          appPath("assets", "yadb", "yadb"),
          "/data/local/tmp/qualix-yadb",
        ]);
        helperReady = true;
      }
      const command = [
        "app_process",
        "-Djava.class.path=/data/local/tmp/qualix-yadb",
        "/data/local/tmp",
        "com.ysbing.yadb.Main",
      ];
      await controls.checkApp?.();
      await shell(...command, "-keyboardClear");
      await controls.checkApp?.();
      if (text) await shell(...command, "-keyboard", text);
    },
    async swipe(points) {
      await controls.swipe(points, 450);
    },
  };
}
