# Qualix 旧命令兼容入口

`android-midscene-automation` 已更名为 **Qualix**。

项目仓库：[oooooooko/Qualix](https://github.com/oooooooko/Qualix)。

这个包每次启动都会通过 npm 检查并运行 `qualix@latest`，保留原命令及其参数：

```sh
npx --yes android-midscene-automation@latest
npx --yes android-midscene-automation@latest --port 5174
```

每次启动时会先提示项目已更名为 Qualix，并建议使用 `npx --yes qualix@latest`，随后检查并启动最新版。提示写入标准错误输出，不影响标准输出和命令退出码。

新用户也可以使用：

```sh
npx --yes qualix@latest
```

从兼容包 `2.0.1` 起，不再固定依赖 Qualix 的某个版本范围。每次启动均联网检查 npm 仓库的 `latest`，包括主版本升级；忽略本地的离线优先设置，已下载且仍为最新版的包可继续复用缓存。检查或下载失败时会报错退出，请恢复网络后重试。

两种入口使用相同的数据目录与环境变量，已有脚本和配置无需迁移。

维护者应先发布可用的 `qualix@latest`，再发布此目录中的兼容包 `2.0.1`。此后只需发布 Qualix 新版并更新其 `latest` 标签，无需为每次 Qualix 升级重新发布兼容包。

首次升级兼容包时，若 npm 仍复用旧版缓存，可运行一次 `npx --yes --prefer-online --prefer-offline=false android-midscene-automation@latest`；之后继续使用原命令即可。
