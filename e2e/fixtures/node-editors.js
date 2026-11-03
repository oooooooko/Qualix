import { createApp, h, reactive, nextTick } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import '../../src/style.css';
import FlowStepEditor from '../../src/appium-recorder/components/FlowStepEditor.vue';
import { FLOW_APPEARANCE_THEMES, flowNodeTextColors } from '../../src/appium-recorder/flow-appearance';
import { DEFAULT_AI_OBSERVATION } from '../../src/appium-recorder/ai-recognition';
const selector = { strategy: 'id', value: 'com.example:id/batterItem' };
// Audit every supported node type and the options that reveal additional fields.
const cases = {
    tap: { selector }, input: { selector, value: '示例文本' },
    tapIfExists: { selector }, inputIfExists: { selector, value: '示例文本' },
    clearIfExists: { selector }, backIfExists: { selector }, waitFor: { selector },
    assertExists: { selector, flow: { nodeKind: 'condition' } },
    checkboxState: { selector }, checkedState: { selector }, radioButtonState: { selector },
    aiRecognition: { value: '判断当前画面是否出现播放按钮', aiTimeoutEnabled: true },
    imageCheck: { selector }, textClick: { value: '播放' }, key: { keyCode: 4 },
    waitActivity: { value: 'com.example/.HomeActivity' }, delay: { timeoutMs: 1000 }, clearInput: { selector },
    coordinateTap: { fallback: { strategy: 'bounds', centerX: 100, centerY: 200 } },
    swipe: { swipe: { startX: 10, startY: 20, endX: 100, endY: 200, duration: 500 } }, screenshot: {},
    launchApp: { value: 'com.example' }, stopApp: { value: 'com.example' }, openGallery: {}, endFlow: {},
    loop: { loop: { maxIterations: 3, exitWhen: 'never' } },
    breakLoop: { breakLoopTargetId: 'outer-loop', flow: { parentConditionId: 'outer-loop', parentBranch: 'yes' } },
    continueLoop: { continueLoopTargetId: 'outer-loop', flow: { parentConditionId: 'outer-loop', parentBranch: 'yes' } },
    clearAppData: { value: 'com.example' }, waitDisappear: { selector }, assertText: { selector, value: '播放' },
    longPress: { selector, longPressMode: 'element', timeoutMs: 800 },
    pinch: { pinch: { direction: 'out', centerX: 100, centerY: 200, percent: 0.5 } },
    runScript: { parameters: [{ name: 'account', value: 'demo' }], returns: [{ name: 'result', target: 'status' }] },
    noop: {}, extractVariable: { selector, extractVariable: { name: 'result', attribute: 'text' } },
    randomValue: { randomValue: { name: 'PROMPT', mode: 'text', text: '你好\n今天家里怎么样', withoutReplacement: true } },
    log: { value: '阶段检查完成' }, visualChange: {},
};
const variants = [
    { name: 'random-integer', type: 'randomValue', patch: { randomValue: { name: 'NUMBER', mode: 'integer', min: 0, max: 9999 } } },
    { name: 'random-uuid', type: 'randomValue', patch: { randomValue: { name: 'ID', mode: 'uuid' } } },
    { name: 'longPress-coordinates', type: 'longPress', patch: { longPressMode: 'coordinates', fallback: { strategy: 'bounds', centerX: 100, centerY: 200 } } },
    { name: 'loop-until-exists', type: 'loop', patch: { selector, loop: { maxIterations: 3, exitWhen: 'exists' } } },
    { name: 'ai-observation', type: 'aiRecognition', patch: { aiObservation: { ...DEFAULT_AI_OBSERVATION }, aiBranchEnabled: true, aiTimeoutEnabled: true } },
    { name: 'ai-until-match', type: 'aiRecognition', patch: { aiObservation: { ...DEFAULT_AI_OBSERVATION, mode: 'untilMatch' }, aiTimeoutEnabled: true } },
];
const entries = reactive([
    ...Object.entries(cases).map(([type, patch]) => ({ name: type, step: { id: type, type, label: `节点 ${type}`, ...patch } })),
    ...variants.map(({ name, type, patch }) => ({ name, step: { id: name, type, label: `节点 ${name}`, ...cases[type], ...patch } })),
]);
const dark = new URLSearchParams(location.search).get('theme') === 'dark';
const colors = FLOW_APPEARANCE_THEMES.find(theme => theme.id === (dark ? 'graphite' : 'default')).colors;
const text = flowNodeTextColors(colors.flowNodeColor);
const field = `color-mix(in srgb, ${colors.flowNodeColor} 92%, ${text.text})`;
const outerLoop = { id: 'outer-loop', type: 'loop', label: '外层循环', loop: { maxIterations: 3, exitWhen: 'never' } };
createApp({
    setup: () => () => h('main', {
        style: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 340px)', gap: '24px', padding: '24px', alignItems: 'start',
            background: colors.flowBackgroundColor,
            '--ui-surface': colors.flowNodeColor, '--ui-border': colors.flowNodeBorderColor,
            '--ui-text': text.text, '--ui-text-secondary': text.muted, '--ui-text-muted': text.muted, '--ui-bg-soft': field,
            '--el-fill-color-blank': colors.flowNodeColor, '--el-fill-color-light': field,
            '--el-text-color-primary': text.text, '--el-text-color-regular': text.text,
            '--el-text-color-secondary': text.muted, '--el-text-color-placeholder': text.muted,
            '--el-border-color': colors.flowNodeBorderColor, '--el-border-color-lighter': colors.flowNodeBorderColor,
        },
    }, entries.map(entry => h('section', { 'data-editor': entry.name }, [
        h('h2', { style: { fontSize: '14px', color: text.text, margin: '0 0 12px' } }, entry.name),
        h(FlowStepEditor, {
            class: 'appium-flow-step-editor', step: entry.step, steps: [outerLoop, entry.step], index: 1,
            onUpdate: ({ step }) => { entry.step = step; },
        }),
    ]))),
}).use(ElementPlus).mount('#app');

window.expandNodeEditors = async () => {
  for (const header of document.querySelectorAll('.el-collapse-item__header')) {
    if (header.getAttribute('aria-expanded') !== 'true') {
      header.click();
      await nextTick();
    }
  }
};
window.auditNodeEditorSpacing = () => {
  const issues = [];
  for (const element of document.querySelectorAll('[data-editor]')) {
    const name = element.getAttribute('data-editor');
    const editor = element.querySelector('.appium-flow-editor');
    if (editor.scrollWidth > editor.clientWidth + 1) issues.push(`${name}: horizontal overflow`);
    const stacks = editor.querySelectorAll('.appium-flow-editor__form, .appium-flow-editor__grid, .appium-flow-editor__section, .appium-flow-editor__fallback, .el-collapse-item__content, .ai-recognition-settings__grid');
    for (const stack of stacks) {
      if (!stack.getBoundingClientRect().height) continue;
      const children = Array.from(stack.children).map(child => child.getBoundingClientRect()).filter(rect => rect.height > 0 && rect.width > 0);
      for (let i = 1; i < children.length; i++) {
        const gap = children[i].top - children[i - 1].bottom;
        if (gap < 11 || gap > 16) issues.push(`${name}: ${stack.className} gap ${gap.toFixed(1)}px`);
      }
    }
  }
  return issues;
};
