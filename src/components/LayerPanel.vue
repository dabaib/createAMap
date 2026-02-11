<template>
  <div class="layer-panel">
    <div class="panel-header">
      <h3>图层列表</h3>
      <button class="add-btn" @click="$emit('addLayer')" title="新建图层">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- 区域图层 -->
    <div class="layer-section-header" v-if="features.length > 0">
      <span>区域</span>
      <span class="count">{{ features.length }}</span>
    </div>
    <div class="layer-list">
      <div
        v-for="feature in features"
        :key="feature.id"
        class="layer-item"
        :class="{
          selected: feature.selected,
          hidden: !feature.visible
        }"
        @click="$emit('select', feature)"
      >
        <div
          class="layer-color"
          :style="{ backgroundColor: feature.color }"
        ></div>

        <span class="layer-name">{{ feature.name }}</span>

        <button
          class="visibility-btn"
          @click.stop="$emit('toggleVisibility', feature)"
          :title="feature.visible ? '隐藏' : '显示'"
        >
          <svg v-if="feature.visible" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 标记点图层 -->
    <div class="layer-section-header" v-if="markers.length > 0">
      <span>标记点</span>
      <span class="count">{{ markers.length }}</span>
    </div>
    <div class="layer-list" v-if="markers.length > 0">
      <div
        v-for="marker in markers"
        :key="marker.id"
        class="layer-item marker-item"
        :class="{ selected: marker.selected }"
        @click="$emit('selectMarker', marker)"
      >
        <div class="layer-color marker-dot" :style="{ backgroundColor: marker.color || '#e74c3c' }"></div>
        <span class="layer-name">{{ marker.name }}</span>
        <button class="delete-btn" @click.stop="$emit('deleteMarker', marker)" title="删除标记">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="features.length === 0 && markers.length === 0" class="empty-list">
      <p>暂无图层</p>
      <p class="hint">导入JSON或绘制新区域</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  features: { type: Array, default: () => [] },
  markers: { type: Array, default: () => [] }
})

defineEmits(['select', 'toggleVisibility', 'addLayer', 'selectMarker', 'deleteMarker'])
</script>

<style scoped>
.layer-panel {
  width: 240px;
  background: linear-gradient(180deg, #2d3436 0%, #1e272e 100%);
  border-right: 1px solid #3d4852;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #3d4852;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #dfe6e9;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(0, 184, 148, 0.2);
  border: 1px solid rgba(0, 184, 148, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn svg {
  width: 16px;
  height: 16px;
  stroke: #00b894;
  stroke-width: 2;
}

.add-btn:hover {
  background: rgba(0, 184, 148, 0.3);
}

.layer-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 4px;
  font-size: 11px;
  color: #636e72;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.layer-section-header .count {
  background: rgba(116, 185, 255, 0.2);
  color: #74b9ff;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}

.layer-list {
  padding: 4px 8px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.layer-item:hover {
  background: rgba(116, 185, 255, 0.1);
}

.layer-item.selected {
  background: rgba(116, 185, 255, 0.2);
  border-color: #74b9ff;
}

.layer-item.hidden {
  opacity: 0.5;
}

.layer-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.marker-dot {
  border-radius: 50%;
  width: 12px;
  height: 12px;
}

.layer-name {
  flex: 1;
  font-size: 13px;
  color: #dfe6e9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.visibility-btn,
.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.visibility-btn:hover,
.delete-btn:hover {
  opacity: 1;
}

.visibility-btn svg,
.delete-btn svg {
  width: 16px;
  height: 16px;
  stroke: #b2bec3;
  stroke-width: 2;
}

.delete-btn svg {
  stroke: #e74c3c;
}

.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}

.empty-list p {
  margin: 0;
  color: #636e72;
  font-size: 13px;
}

.empty-list .hint {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.7;
}
</style>
