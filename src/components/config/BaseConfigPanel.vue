<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue';
import type { AppPreset, ConfigForm } from '../../types';

defineProps<{
  configForm: ConfigForm;
  appPresets: AppPreset[];
  appPresetForm: Pick<AppPreset, 'id' | 'name' | 'packageName'>;
  isSavingModelConfig: boolean;
  isSavingAppPreset: boolean;
}>();

defineEmits<{
  saveModelConfig: [];
  saveAppPreset: [];
  editAppPreset: [app: AppPreset];
  deleteAppPreset: [id: string];
  cancelAppPresetEdit: [];
}>();
</script>

<template>
  <div class="config-grid">
    <el-card shadow="never" class="config-module-card">
      <template #header>
        <div class="panel-header">
          <span>运行配置</span>
          <el-button type="primary" :loading="isSavingModelConfig" @click="$emit('saveModelConfig')">
            保存运行配置
          </el-button>
        </div>
      </template>

      <el-form label-position="top" class="runtime-config-form">
        <el-form-item label="Android SDK 路径">
          <el-input
            v-model="configForm.runtime.androidSdkPath"
            clearable
            placeholder="留空时读取 ANDROID_SDK_ROOT、ANDROID_HOME 或系统默认路径"
          />
        </el-form-item>
        <el-form-item label="回放报告目录">
          <el-input
            v-model="configForm.runtime.reportOutputPath"
            clearable
            placeholder="留空时保存到启动目录下的 output"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="config-module-card">
      <template #header>
        <div class="panel-header">
          <span>预设 App 参数</span>
        </div>
      </template>

      <div class="app-preset-layout">
        <section class="app-preset-panel" aria-label="App 预设编辑">
          <div class="panel-header panel-header--sub">
            <h3>{{ appPresetForm.id ? '编辑 App' : '添加 App' }}</h3>
            <el-tag v-if="appPresetForm.id" size="small" effect="plain">编辑中</el-tag>
          </div>
          <el-form label-position="top" :disabled="isSavingAppPreset" @submit.prevent="$emit('saveAppPreset')">
            <el-form-item label="App 名称">
              <el-input v-model="appPresetForm.name" placeholder="例如：示例 App" />
            </el-form-item>
            <el-form-item label="App 包名">
              <el-input v-model="appPresetForm.packageName" placeholder="例如：com.example.app" />
            </el-form-item>
            <div class="app-preset-actions">
              <el-button v-if="appPresetForm.id" :disabled="isSavingAppPreset" @click="$emit('cancelAppPresetEdit')">取消编辑</el-button>
              <el-button type="primary" native-type="submit" :loading="isSavingAppPreset">{{ appPresetForm.id ? '保存修改' : '添加' }}</el-button>
            </div>
          </el-form>
        </section>

        <section class="app-preset-panel app-preset-collection" aria-label="已保存的 App">
          <div class="panel-header panel-header--sub">
            <h3>已保存的 App</h3>
            <el-tag size="small" type="info" effect="plain">{{ appPresets.length }} 个</el-tag>
          </div>
          <el-table
            :data="appPresets"
            row-key="id"
            :max-height="280"
            :row-class-name="({ row }: { row: AppPreset }) => appPresetForm.id === row.id ? 'app-preset-row--editing' : ''"
            empty-text="暂无预设 App"
            aria-label="App 预设列表"
          >
            <el-table-column prop="name" label="App 名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="packageName" label="App 包名" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="88" align="right">
              <template #default="{ row }">
                <div class="app-preset-row__actions">
                  <el-button text size="small" :icon="Edit" :disabled="isSavingAppPreset" :aria-label="`编辑 ${row.name}`" :title="`编辑 ${row.name}`" @click="$emit('editAppPreset', row)" />
                  <el-button text size="small" :icon="Delete" :disabled="isSavingAppPreset" :aria-label="`删除 ${row.name}`" :title="`删除 ${row.name}`" @click="$emit('deleteAppPreset', row.id)" />
                </div>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.runtime-config-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.runtime-config-form :deep(.el-form-item) { margin-bottom: 0; }
@media (max-width: 1000px) { .runtime-config-form { grid-template-columns: minmax(0, 1fr); } }

.app-preset-layout { display: grid; grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr); gap: 24px; }
.app-preset-panel { min-width: 0; }
.app-preset-panel h3 { margin: 0; color: var(--ui-text); font-size: 14px; font-weight: 600; }
.app-preset-collection { padding-left: 24px; border-left: 1px solid var(--ui-border); }
.app-preset-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.app-preset-actions :deep(.el-button + .el-button) { margin-left: 0; }
.app-preset-row__actions { display: flex; justify-content: flex-end; gap: 4px; }
.app-preset-row__actions :deep(.el-button) { width: 28px; height: 28px; margin: 0; padding: 0; }
.app-preset-collection :deep(.app-preset-row--editing) { --el-table-tr-bg-color: var(--el-color-primary-light-9); }
@media (max-width: 1100px) {
  .app-preset-layout { grid-template-columns: minmax(0, 1fr); }
  .app-preset-collection { padding: 24px 0 0; border-left: 0; border-top: 1px solid var(--ui-border); }
}
</style>
