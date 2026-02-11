<template>
  <div class="property-panel">
    <div class="panel-header">
      <h3>属性面板</h3>
    </div>

    <div class="panel-content" v-if="feature">
      <div class="property-group">
        <label>区域名称</label>
        <input
          type="text"
          v-model="localName"
          @change="updateName"
          placeholder="输入名称"
        />
      </div>

      <div class="property-group">
        <label>区域ID</label>
        <input type="text" :value="feature.id" disabled />
      </div>

      <div class="property-group">
        <label>填充颜色</label>
        <div class="color-input">
          <input
            type="color"
            v-model="localColor"
            @change="updateColor"
          />
          <span>{{ localColor }}</span>
        </div>
      </div>

      <div class="property-group">
        <label>行政代码</label>
        <input
          type="text"
          v-model="localAdcode"
          @change="updateAdcode"
          placeholder="如：110000"
        />
      </div>

      <div class="property-group">
        <label>节点数量</label>
        <span class="node-count">{{ nodeCount }} 个节点</span>
      </div>

      <div class="property-group">
        <label>显示/隐藏</label>
        <label class="switch">
          <input
            type="checkbox"
            :checked="feature.visible"
            @change="toggleVisible"
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="action-buttons">
        <button class="btn btn-danger" @click="deleteFeature">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          删除区域
        </button>
      </div>
    </div>

    <!-- 标记点属性 -->
    <div class="panel-content" v-else-if="marker">
      <div class="property-group">
        <label>标记名称</label>
        <input
          type="text"
          v-model="markerName"
          @change="updateMarkerName"
          placeholder="输入名称"
        />
      </div>

      <div class="property-group">
        <label>标记颜色</label>
        <div class="color-input">
          <input
            type="color"
            v-model="markerColor"
            @change="updateMarkerColor"
          />
          <span>{{ markerColor }}</span>
        </div>
      </div>

      <div class="property-group">
        <label>经度</label>
        <input type="text" :value="marker.lon?.toFixed(6)" disabled />
      </div>

      <div class="property-group">
        <label>纬度</label>
        <input type="text" :value="marker.lat?.toFixed(6)" disabled />
      </div>

      <div class="action-buttons">
        <button class="btn btn-danger" @click="deleteMarker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          删除标记
        </button>
      </div>
    </div>

    <div class="panel-empty" v-else>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>选择一个区域或标记点查看属性</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  feature: { type: Object, default: null },
  marker: { type: Object, default: null }
})

const emit = defineEmits(['update', 'delete', 'updateMarker', 'deleteMarker'])

const localName = ref('')
const localColor = ref('#4ecdc4')
const localAdcode = ref('')
const markerName = ref('')
const markerColor = ref('#e74c3c')

// 监听 feature 变化
watch(() => props.feature, (newFeature) => {
  if (newFeature) {
    localName.value = newFeature.name || ''
    localColor.value = newFeature.color || '#4ecdc4'
    localAdcode.value = newFeature.properties?.adcode || ''
  }
}, { immediate: true })

// 监听 marker 变化
watch(() => props.marker, (newMarker) => {
  if (newMarker) {
    markerName.value = newMarker.name || ''
    markerColor.value = newMarker.color || '#e74c3c'
  }
}, { immediate: true })

// 计算节点数量
const nodeCount = computed(() => {
  if (!props.feature?.geometry) return 0

  let count = 0
  const geometry = props.feature.geometry

  const countCoords = (coords) => {
    if (coords && coords.lon !== undefined) {
      count++
    } else if (Array.isArray(coords)) {
      coords.forEach(countCoords)
    }
  }

  countCoords(geometry.coordinates)
  return count
})

function updateName() {
  emit('update', { name: localName.value, properties: { name: localName.value } })
}

function updateColor() {
  emit('update', { color: localColor.value })
}

function updateAdcode() {
  emit('update', { properties: { adcode: localAdcode.value } })
}

function toggleVisible() {
  emit('update', { visible: !props.feature.visible })
}

function deleteFeature() {
  if (confirm('确定要删除该区域吗？')) {
    emit('delete')
  }
}

function updateMarkerName() {
  emit('updateMarker', { name: markerName.value })
}

function updateMarkerColor() {
  emit('updateMarker', { color: markerColor.value })
}

function deleteMarker() {
  if (confirm('确定要删除该标记点吗？')) {
    emit('deleteMarker')
  }
}
</script>

<style scoped>
.property-panel {
  width: 280px;
  background: linear-gradient(180deg, #2d3436 0%, #1e272e 100%);
  border-left: 1px solid #3d4852;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #3d4852;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #dfe6e9;
}

.panel-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #636e72;
  padding: 32px;
  text-align: center;
}

.panel-empty svg {
  width: 48px;
  height: 48px;
  stroke-width: 1.5;
  margin-bottom: 16px;
  opacity: 0.5;
}

.panel-empty p {
  margin: 0;
  font-size: 13px;
}

.property-group {
  margin-bottom: 16px;
}

.property-group label {
  display: block;
  font-size: 12px;
  color: #b2bec3;
  margin-bottom: 6px;
}

.property-group input[type="text"] {
  width: 100%;
  padding: 10px 12px;
  background: #1a1a2e;
  border: 1px solid #3d4852;
  border-radius: 8px;
  color: #dfe6e9;
  font-size: 13px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.property-group input[type="text"]:focus {
  outline: none;
  border-color: #74b9ff;
}

.property-group input[type="text"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input input[type="color"] {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: none;
}

.color-input span {
  color: #b2bec3;
  font-size: 13px;
  font-family: 'Consolas', monospace;
}

.node-count {
  color: #74b9ff;
  font-size: 13px;
}

/* Switch toggle */
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #3d4852;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.switch input:checked + .slider {
  background-color: #00b894;
}

.switch input:checked + .slider:before {
  transform: translateX(24px);
}

.action-buttons {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #3d4852;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.btn-danger {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.btn-danger:hover {
  background: rgba(231, 76, 60, 0.3);
}
</style>
