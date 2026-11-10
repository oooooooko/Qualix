import { PlatformValidationError } from '../appium-recorder/platform';
import type { AppiumRecordedStep } from '../appium-recorder/types';

export const iosUnsupportedActions = new Set(['clearAppData', 'waitActivity', 'backIfExists', 'openGallery', 'checkboxState', 'checkedState', 'radioButtonState', 'keyBack', 'keyRecent', 'keyPower']);

export function assertIosSteps(steps: AppiumRecordedStep[]) {
  for (const step of steps) {
    if (iosUnsupportedActions.has(step.type) || step.type === 'key' && ![3, 24, 25].includes(step.keyCode || 0)) {
      throw new PlatformValidationError(`iOS 不支持节点「${step.label}」（${step.type}），请替换为 iOS 可用操作`);
    }
    for (const selector of [step.selector, step.contextSelector, ...(step.selectorChain || [])]) {
      if (selector?.strategy === 'androidUiAutomator') throw new PlatformValidationError(`iOS 不支持 Android UiAutomator 定位：${step.label}`);
    }
  }
}
