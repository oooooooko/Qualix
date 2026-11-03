import { createApp, h, ref, computed, provide } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import '@vue-flow/core/dist/style.css';
import '../../src/style.css';
import FlowCanvas from '../../src/appium-recorder/components/FlowCanvas.vue';
import { flowLayoutDirectionKey } from '../../src/appium-recorder/flow-appearance';
import { labelFlowStep } from '../../src/appium-recorder/flow-labels';

const steps = Array.from({ length: 80 }, (_, index) => ({
  id: `step-${index}`, type: 'delay', label: `等待 ${index + 1}`, timeoutMs: 1000,
}));
const unchanged = () => false;
const options = {
  id: 'expansion-performance', steps, copyMode: false, selectedCopyIndexes: [], canOpenInsertMenu: false,
  startActionGroups: [], mainActionGroups: [{ title: '设备操作', actions: [{ type: 'launchApp', label: '启动 App' }] }], isStartActionDisabled: unchanged,
  isInsertActionDisabled: unchanged, isAppExecutionDisabled: unchanged,
  labelStep: labelFlowStep, isCopySelected: unchanged,
};
window.expansionStats = { updates: 0, measurements: 0 };
const originalBounds = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.classList.contains('vue-flow__node') && this.dataset.id !== 'step:step-0') {
    window.expansionStats.measurements++;
  }
  return originalBounds.call(this);
};
createApp({
  setup() {
    const expanded = ref(null);
    provide(flowLayoutDirectionKey, computed(() => new URLSearchParams(location.search).get('direction')));
    return () => h(FlowCanvas, {
      ...options, expandedStepIndex: expanded.value,
      style: { width: '1100px', height: '720px' },
      onNodeClick: index => { expanded.value = expanded.value === index ? null : index; },
    });
  },
}).mixin({
  updated() {
    if (this.$options.__name === 'FlowNodeCard' && this.$props.nodeId !== 'step:step-0') {
      window.expansionStats.updates++;
    }
  },
}).use(ElementPlus).mount('#app');
