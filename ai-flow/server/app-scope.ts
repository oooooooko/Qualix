// Android permission dialogs may belong to the OS while the selected app is foreground.
const permissionPackages = new Set(['android', 'com.android.permissioncontroller', 'com.google.android.permissioncontroller',
  'com.android.packageinstaller', 'com.google.android.packageinstaller', 'com.lbe.security.miui']);

export function foregroundPackage(activity: string) {
  return activity.match(/(?:^|[\s{])([\w.$]+)\/[\w.$]+(?=[\s}]|$)/)?.[1] || '';
}

export function assertTargetApp(appPackage: string, activity: string, nodePackages: string[] = []) {
  const packages = [...new Set(nodePackages.filter(Boolean))];
  const foreground = foregroundPackage(activity) || (packages.length === 1 ? packages[0] : '');
  if (!foreground) throw new Error(`无法确认当前前台应用，已停止操作。任务目标 App：${appPackage}`);
  if (foreground !== appPackage && !permissionPackages.has(foreground)) {
    throw new Error(`当前前台应用 ${foreground} 已离开所选 App ${appPackage}，已停止任务并保留已执行步骤。请返回所选 App 后继续，不能从桌面猜测其他应用图标。`);
  }
}
