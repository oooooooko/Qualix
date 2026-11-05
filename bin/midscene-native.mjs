import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createServer } from "node:net";
const require = createRequire(import.meta.url);
const {
  androidPlaygroundPlatform,
  ScrcpyServer,
} = require("@midscene/android-playground");
const { launchPreparedPlaygroundPlatform } = require("@midscene/playground");
const info = require("@midscene/android-playground/package.json");
const scrcpy = new ScrcpyServer({ host: "127.0.0.1" });
const pending = new Map();
let instance,
  closing = false,
  activeLease = "";
function requestLease(type, deviceId, leaseId) {
  if (!process.connected) return Promise.reject(new Error("主服务已断开"));
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("设备锁请求超时"));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    process.send({ type, id, deviceId, leaseId });
  });
}
process.on("message", (message) => {
  if (message?.type !== "lease-result") return;
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error));
  else request.resolve();
});
async function close() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 4000);
  deadline.unref();
  try {
    await instance?.close();
    await scrcpy.close();
  } finally {
    process.exit(0);
  }
}
process.once("SIGTERM", close);
process.once("SIGINT", close);
process.once("disconnect", close);
function availableLoopbackPort() {
  // The SDK's localhost probe can miss an existing IPv4 listener.
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
try {
  const [scrcpyPort, playgroundPort] = await Promise.all([
    availableLoopbackPort(),
    availableLoopbackPort(),
  ]);
  const prepared = await androidPlaygroundPlatform.prepare({
    scrcpyPort,
    staticDir: join(
      dirname(require.resolve("@midscene/android-playground/package.json")),
      "static",
    ),
    scrcpyServer: scrcpy,
  });
  const configure = prepared.launchOptions?.configureServer;
  instance = await launchPreparedPlaygroundPlatform(prepared, {
    port: playgroundPort,
    openBrowser: false,
    verbose: false,
    id: "qualix-native-midscene",
    async configureServer(server) {
      await configure?.(server);
      server.app.use(async (req, res, next) => {
        if (
          req.method !== "POST" ||
          ![
            "/execute",
            "/interact",
            "/recorder/start",
            "/recorder/describe-event",
          ].includes(req.path) ||
          !scrcpy.currentDeviceId
        )
          return next();
        if (activeLease)
          return res
            .status(409)
            .json({ error: "当前设备已有 Midscene 操作执行中" });
        const deviceId = scrcpy.currentDeviceId,
          leaseId = randomUUID();
        activeLease = leaseId;
        try {
          await requestLease("acquire", deviceId, leaseId);
          const end = res.end;
          // Keep ownership if the browser disconnects while the SDK is still executing.
          res.end = function (...args) {
            if (activeLease === leaseId) activeLease = "";
            void requestLease("release", deviceId, leaseId).catch(() => {});
            return end.apply(this, args);
          };
          next();
        } catch (error) {
          activeLease = "";
          void requestLease("release", deviceId, leaseId).catch(() => {});
          res.status(409).json({ error: error.message });
        }
      });
    },
  });
  process.send?.({
    type: "ready",
    version: info.version,
    url: `http://127.0.0.1:${instance.port}`,
  });
} catch (error) {
  process.send?.({
    type: "failed",
    message: error instanceof Error ? error.message : "Midscene 启动失败",
  });
  await close();
}
