<script setup lang="ts">
import { computed } from 'vue';
import androidLogo from '../../assets/appium-actions/android.svg';
import iosLogo from '../../assets/appium-actions/ios.svg';
import type { AppiumRecordedScript } from '../types';

const props = defineProps<{ platform?: AppiumRecordedScript['platform'] }>();
const iconStyle = computed(() => ({
  maskImage: `url("${props.platform === 'ios' ? iosLogo : androidLogo}")`,
  maskSize: props.platform === 'ios' ? '12px 12px' : 'contain',
}));
</script>

<template>
  <i
    class="script-platform-icon"
    :class="{ 'script-platform-icon--android': platform !== 'ios' }"
    role="img"
    :aria-label="platform === 'ios' ? 'iOS' : 'Android'"
    :title="platform === 'ios' ? 'iOS' : 'Android'"
    :style="iconStyle"
  />
</template>

<style scoped>
.script-platform-icon {
  display: inline-block;
  vertical-align: middle;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--el-text-color-primary);
  background-color: currentColor;
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
}
.script-platform-icon--android { color: #34a853; }
</style>
