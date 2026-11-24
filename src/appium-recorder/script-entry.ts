export function androidActivityName(value: string) {
  const activity = value.trim();
  return activity.slice(activity.indexOf('/') + 1);
}

export function androidActivityComponent(appPackage: string, value: string) {
  const activity = androidActivityName(value);
  return activity ? `${appPackage.trim()}/${activity}` : '';
}
