<script setup lang="ts">
import {
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import type { InputInstance } from "element-plus";
import { Top } from "@element-plus/icons-vue";
import { t } from "../../src/i18n";
import type { TaskConversation } from "./workspace-context";
import ModelRoundHistory from "./ModelRoundHistory.vue";
const props = defineProps<{
  state: TaskConversation;
  active: boolean;
  modelConfigured: boolean;
  deviceSelected: boolean;
  conversationKey: string;
  submit: (text: string) => Promise<boolean>;
}>();
const emit = defineEmits<{
  stop: [];
  configure: [];
  create: [];
}>();
const text = ref("");
const submitting = ref(false);
const messageInput = useTemplateRef<InputInstance>("messageInput");
const composer = useTemplateRef<HTMLElement>("composer");
const sendShortcut = "Enter";
async function resizeInput() {
  if (!props.active) return;
  await nextTick();
  messageInput.value?.resizeTextarea();
}
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  let previousWidth = 0;
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry && entry.contentRect.width !== previousWidth) {
      previousWidth = entry.contentRect.width;
      void resizeInput();
    }
  });
  if (composer.value) resizeObserver.observe(composer.value);
});
onScopeDispose(() => resizeObserver?.disconnect());
watch(
  () => props.active,
  (active) => {
    if (active) void resizeInput();
  },
);
const transcript = useTemplateRef<HTMLElement>("transcript");
watch(
  () => props.conversationKey,
  () => {
    text.value = "";
    void resizeInput();
  },
);
watch(
  () => [props.state.messages, props.state.progress],
  async () => {
    await nextTick();
    transcript.value?.scrollTo({
      top: transcript.value.scrollHeight,
      behavior: "smooth",
    });
  },
);
async function send() {
  if (
    !props.active ||
    submitting.value ||
    !props.state.canSend ||
    !text.value.trim()
  ) return;
  const value = text.value;
  const key = props.conversationKey;
  submitting.value = true;
  try {
    if (await props.submit(value.trim()) && text.value === value && props.conversationKey === key) text.value = "";
  } finally {
    submitting.value = false;
  }
}
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229 || event.shiftKey) return;
  event.preventDefault();
  void send();
}
</script>
<template>
  <section class="ai-chat" :aria-label="t('任务对话')">
    <header class="ai-chat__heading">
      <strong>{{ t("任务对话") }}</strong
      ><span>{{ state.mode === "flash" ? "Flash" : "Pro" }}</span>
    </header>
    <div ref="transcript" class="ai-chat__messages" aria-live="polite">
      <div v-if="!state.messages.length" class="ai-chat__empty">
        <h3>{{ t("从一个目标开始") }}</h3>
        <p>
          {{
            t(
              "在新建中选择任务类型、App 和执行模式，发送后自动进入对应工作区。",
            )
          }}
        </p>
        <el-button
          type="primary"
          plain
          :disabled="state.busy"
          @click="emit('create')"
          >{{ t("新建任务") }}</el-button
        >
      </div>
      <article
        v-for="message in state.messages"
        :key="message.id"
        class="ai-chat__message"
        :class="`ai-chat__message--${message.role}`"
      >
        <span v-if="message.role === 'assistant'">{{ t("AI 助手") }}</span>
        <p>{{ message.content }}</p>
        <ModelRoundHistory
          v-if="message.modelRounds?.length"
          :rounds="message.modelRounds"
        />
      </article>
      <div
        v-if="state.busy && state.progress"
        class="ai-chat__progress"
        role="status"
      >
        <span class="ai-chat__pulse" />{{
          state.replaying ? t("正在运行脚本…") : state.progress
        }}
      </div>
      <el-alert
        v-if="state.videoWarning"
        :title="state.videoWarning"
        type="warning"
        :closable="false"
      />
    </div>
    <form ref="composer" class="ai-chat__composer" @submit.prevent="send">
      <el-alert
        v-if="!modelConfigured"
        :title="t('请先配置 AI 模型')"
        type="warning"
        :closable="false"
        ><el-button link type="primary" @click="emit('configure')">{{
          t("前往配置")
        }}</el-button></el-alert
      >
      <el-alert
        v-if="state.error"
        :title="state.error"
        type="error"
        :closable="false"
      />
      <el-input
        ref="messageInput"
        v-model="text"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 5 }"
        :maxlength="4000"
        resize="none"
        :disabled="!state.appPackage || !active"
        :aria-label="t('任务需求')"
        :placeholder="t('补充目标或调整要求…')"
        @keydown.enter="handleEnter"
      />
      <div class="ai-chat__send-row">
        <span>{{
          !deviceSelected
            ? t("请先选择设备")
            : !state.appPackage
              ? t("请先新建任务")
              : t("快捷键发送：{0}", { 0: sendShortcut })
        }}</span
        ><div class="ai-chat__actions"><el-button
          v-if="state.generating || state.replaying"
          type="danger"
          plain
          class="ai-chat__submit ai-chat__submit--stop"
          circle
          :aria-label="t('停止')"
          :title="t('停止')"
          :loading="state.stopping"
          @click="emit('stop')"
          ><span
            v-if="!state.stopping"
            class="ai-chat__stop-icon"
            aria-hidden="true"
          ></span></el-button
        ><el-button
          native-type="submit"
          type="primary"
          class="ai-chat__submit"
          circle
          :aria-label="t('发送')"
          :title="t('快捷键发送：{0}', { 0: sendShortcut })"
          :icon="Top"
          :loading="submitting"
          :disabled="!state.canSend || !text.trim() || !active"
        /></div>
      </div>
    </form>
  </section>
</template>
<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: #fff;
  border: 0;
  border-left: 1px solid #e2e8f0;
  border-radius: 0;
  overflow: hidden;
}
.ai-chat__heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 22px;
  border-bottom: 1px solid #edf1f5;
}
.ai-chat__heading strong {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.ai-chat__heading span {
  font-size: 10px;
  color: #8090a3;
  padding: 3px 7px;
  border-radius: 8px;
  background: #f2f5f9;
}
.ai-chat__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 22px 14px;
}
.ai-chat__empty {
  max-width: 470px;
  margin: 10vh auto;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.8;
}
.ai-chat__empty h3 {
  color: #334155;
  font-size: 20px;
  margin: 0 0 12px;
  font-weight: 600;
}
.ai-chat__message {
  margin: 0 0 24px;
}
.ai-chat__message > span {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}
.ai-chat__message p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.9;
  color: #334155;
}
.ai-chat__message--user {
  margin-left: clamp(24px, 8%, 90px);
}
.ai-chat__message--user p {
  background: #f0f6ff;
  padding: 12px 16px;
  border-radius: 16px 16px 4px 16px;
}
.ai-chat__composer {
  display: grid;
  gap: 8px;
  flex: none;
  position: relative;
  margin: 10px 14px 16px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafd;
  box-shadow: 0 4px 16px #1e293b05;
  overflow: hidden;
}
.ai-chat__composer:focus-within {
  border-color: #9bbdec;
  background: #fff;
  box-shadow: 0 0 0 3px #3b82f60a;
}
.ai-chat__composer :deep(.el-textarea__inner),
.ai-chat__composer :deep(.el-textarea__inner:hover),
.ai-chat__composer :deep(.el-textarea__inner:focus) {
  box-shadow: none;
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 3px 0;
  font-size: 13px;
  line-height: 22px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
.ai-chat__send-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ai-chat__send-row > span {
  color: #a1adbd;
  font-size: 10px;
  line-height: 1.5;
}
.ai-chat__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-chat__actions .el-button + .el-button {
  margin-left: 0;
}
.ai-chat__send-row .ai-chat__submit {
  flex: none;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  font-size: 17px;
  box-shadow: none;
  --el-button-disabled-bg-color: #edf1f6;
  --el-button-disabled-border-color: transparent;
  --el-button-disabled-text-color: #abb6c5;
}
.ai-chat__stop-icon {
  width: 10px;
  height: 10px;
  background: currentColor;
  border-radius: 2px;
}

.ai-chat__progress {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: #347bea;
  font-size: 12px;
  line-height: 1.8;
}
.ai-chat__pulse {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1s infinite alternate;
}
@keyframes pulse {
  to {
    opacity: 0.3;
  }
}
</style>
