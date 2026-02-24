<template>
  <div class="toolbar">
    <div class="toolbar-section">
      <div class="toolbar-title">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        地图编辑器
      </div>
    </div>

    <div class="toolbar-section">
      <button
        class="tool-btn"
        :class="{ active: currentTool === 'select' }"
        @click="$emit('toolChange', 'select')"
        title="选择工具 (V)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        </svg>
        选择
      </button>

      <button
        class="tool-btn"
        :class="{ active: currentTool === 'edit' }"
        @click="$emit('toolChange', 'edit')"
        title="编辑节点 (E)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        编辑
      </button>

      <button
        class="tool-btn"
        :class="{ active: currentTool === 'draw' }"
        @click="$emit('toolChange', 'draw')"
        title="绘制区域 (D)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
        绘制
      </button>

      <button
        class="tool-btn"
        :class="{ active: currentTool === 'marker' }"
        @click="$emit('toolChange', 'marker')"
        title="添加标记点 (M)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        标记
      </button>

      <button
        class="tool-btn"
        :class="{ active: currentTool === 'split' }"
        @click="$emit('toolChange', 'split')"
        :disabled="!canSplit"
        title="切割 / 挖洞 (S)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="12" y1="2" x2="12" y2="22"/>
          <path d="M5 5l4-2v4L5 5z"/>
          <path d="M19 19l-4 2v-4l4 2z"/>
        </svg>
        切割
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-section">
      <button
        class="tool-btn"
        @click="$emit('import')"
        title="导入JSON"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        导入
      </button>

      <button
        class="tool-btn"
        @click="$emit('export')"
        :disabled="!hasData"
        title="导出JSON"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        导出
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-section">
      <button
        class="tool-btn"
        @click="$emit('undo')"
        :disabled="!canUndo"
        title="撤销 (Ctrl+Z)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
      </button>

      <button
        class="tool-btn"
        @click="$emit('redo')"
        :disabled="!canRedo"
        title="重做 (Ctrl+Y)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>

      <button
        class="tool-btn"
        @click="$emit('resetView')"
        title="重置视图"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="15 3 21 3 21 9"/>
          <polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-section">
      <button
        class="tool-btn save-btn"
        @click="$emit('saveLocal')"
        title="保存到本地"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        保存
      </button>

      <button
        class="tool-btn"
        @click="$emit('loadLocal')"
        :disabled="!hasSavedData"
        title="加载本地数据"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        加载
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    <div class="toolbar-section">
      <button
        class="tool-btn help-btn"
        @click="$emit('help')"
        title="使用手册"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        帮助
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-section">
      <span class="feature-count">
        {{ featureCount }} 个区域 · {{ markerCount }} 个标记
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  currentTool: { type: String, default: 'select' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  canSplit: { type: Boolean, default: false },
  hasData: { type: Boolean, default: false },
  hasSavedData: { type: Boolean, default: false },
  featureCount: { type: Number, default: 0 },
  markerCount: { type: Number, default: 0 }
})

defineEmits([
  'toolChange',
  'import',
  'export',
  'undo',
  'redo',
  'resetView',
  'saveLocal',
  'saveLocal',
  'loadLocal',
  'help'
])
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, #2d3436 0%, #1e272e 100%);
  border-bottom: 1px solid #3d4852;
  gap: 8px;
  user-select: none;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #74b9ff;
  padding-right: 16px;
}

.toolbar-title .icon {
  width: 24px;
  height: 24px;
  stroke-width: 2;
}

.toolbar-divider {
  width: 1px;
  height: 32px;
  background: #3d4852;
  margin: 0 8px;
}

.toolbar-spacer {
  flex: 1;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #b2bec3;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(116, 185, 255, 0.1);
  color: #74b9ff;
  border-color: rgba(116, 185, 255, 0.3);
}

.tool-btn.active {
  background: rgba(116, 185, 255, 0.2);
  color: #74b9ff;
  border-color: #74b9ff;
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.save-btn:hover:not(:disabled) {
  background: rgba(0, 184, 148, 0.1);
  color: #00b894;
  border-color: rgba(0, 184, 148, 0.3);
}

.feature-count {
  font-size: 13px;
  color: #636e72;
  padding: 0 8px;
}
</style>
