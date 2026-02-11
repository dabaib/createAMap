<template>
  <div class="app">
    <Toolbar
      :currentTool="currentTool"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :canSplit="!!editingFeature"
      :hasData="features.length > 0"
      :hasSavedData="hasSavedData"
      :featureCount="features.length"
      :markerCount="markers.length"
      @toolChange="handleToolChange"
      @import="handleImport"
      @export="handleExport"
      @undo="handleUndo"
      @redo="handleRedo"
      @resetView="resetView"
      @saveLocal="saveToLocal"
      @loadLocal="loadFromLocal"
      @help="showHelp = true"
    />

    <div class="main-content">
      <LayerPanel
        :features="features"
        :markers="markers"
        @select="selectFeature"
        @toggleVisibility="toggleVisibility"
        @addLayer="startDrawing"
        @selectMarker="selectMarker"
        @deleteMarker="deleteMarkerFromPanel"
      />

      <MapCanvas
        ref="mapCanvasRef"
        :features="features"
        :markers="markers"
        :bounds="bounds"
        :currentTool="currentTool"
        :editingFeature="editingFeature"
        :drawingPoints="drawingPoints"
        :splitPoints="splitPoints"
        @featureClick="handleFeatureClick"
        @featureHover="handleFeatureHover"
        @nodeDragEnd="handleNodeDragEnd"
        @featureDragEnd="handleFeatureDragEnd"
        @addPoint="handleAddPoint"
        @splitPoint="handleSplitPoint"
        @canvasClick="handleCanvasClick"
        @markerClick="selectMarker"
        @markerDrag="handleMarkerDrag"
        @labelDragEnd="handleLabelDragEnd"
      />

      <PropertyPanel
        :feature="editingFeature"
        :marker="selectedMarker"
        @update="updateFeature"
        @delete="deleteFeature"
        @updateMarker="updateMarker"
        @deleteMarker="deleteSelectedMarker"
      />
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,.geojson"
      style="display: none"
      @change="onFileSelected"
    />

    <!-- 新区域名称对话框 -->
    <div v-if="showNameDialog" class="dialog-overlay">
      <div class="dialog-box">
        <h3>{{ dialogTitle }}</h3>
        <input
          v-model="newRegionName"
          type="text"
          :placeholder="dialogPlaceholder"
          @keyup.enter="confirmDialog"
          ref="dialogInputRef"
        />
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="cancelDialog">取消</button>
          <button class="btn btn-primary" @click="confirmDialog">确定</button>
        </div>
      </div>
    </div>

    <!-- 帮助手册 -->
    <HelpDialog v-if="showHelp" @close="showHelp = false" />
    

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { GeoJsonParser } from './core/GeoJsonParser'
import { MapEngine } from './core/MapEngine'
import { DataStore } from './core/DataStore'
import Toolbar from './components/Toolbar.vue'
import MapCanvas from './components/MapCanvas.vue'
import LayerPanel from './components/LayerPanel.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import HelpDialog from './components/HelpDialog.vue'

// ======== 状态 ========
const features = ref([])
const markers = ref([])
const bounds = ref(null)
const showHelp = ref(false)
const currentTool = ref('select')
const editingFeature = ref(null)
const selectedMarker = ref(null)
const drawingPoints = ref([])
const splitPoints = ref([])

// 历史记录
const history = ref([])
const historyIndex = ref(-1)
const maxHistory = 50

// 对话框
const showNameDialog = ref(false)
const newRegionName = ref('')
const dialogTitle = ref('新建区域')
const dialogPlaceholder = ref('输入区域名称')
let dialogResolve = null

// Refs
const fileInputRef = ref(null)
const mapCanvasRef = ref(null)
const dialogInputRef = ref(null)

// 本地存储
const dataStore = new DataStore()
const hasSavedData = ref(dataStore.hasSavedData())

// 计算属性
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// ======== 键盘快捷键 ========
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // 自动加载
  if (dataStore.hasSavedData()) {
    loadFromLocal()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  dataStore.destroy()
})

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault()
    handleUndo()
  } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault()
    handleRedo()
  } else if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    saveToLocal()
  } else if (e.key === 'v' || e.key === 'V') {
    handleToolChange('select')
  } else if (e.key === 'e' || e.key === 'E') {
    handleToolChange('edit')
  } else if (e.key === 'd' || e.key === 'D') {
    handleToolChange('draw')
  } else if (e.key === 'm' || e.key === 'M') {
    handleToolChange('marker')
  } else if (e.key === 'Delete') {
    if (editingFeature.value) deleteFeature()
    else if (selectedMarker.value) deleteSelectedMarker()
  } else if (e.key === 'Escape') {
    cancelDrawing()
    cancelSplit()
    handleToolChange('select')
  }
}

// ======== 工具切换 ========
function handleToolChange(tool) {
  if (currentTool.value === 'draw' && tool !== 'draw') {
    cancelDrawing()
  }
  if (currentTool.value === 'split' && tool !== 'split') {
    cancelSplit()
  }
  currentTool.value = tool

  if (tool === 'draw') {
    startDrawing()
  } else if (tool === 'marker') {
    // 标记模式不需要特殊处理
  }
}

// ======== 文件导入/导出 ========
function handleImport() {
  fileInputRef.value?.click()
}

function onFileSelected(e) {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const geojson = JSON.parse(event.target.result)
      const parser = new GeoJsonParser()
      const result = parser.parse(geojson)

      features.value = result.features
      bounds.value = result.bounds
      editingFeature.value = null
      selectedMarker.value = null
      saveState()
      autoSave()
    } catch (err) {
      alert('文件解析失败：' + err.message)
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function handleExport() {
  const geojson = GeoJsonParser.exportFeaturesToGeoJson(features.value)
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'map-export.geojson'
  a.click()
  URL.revokeObjectURL(url)
}

// ======== 历史记录 ========
function saveState() {
  const state = JSON.parse(JSON.stringify({
    features: features.value,
    markers: markers.value
  }))

  // 截断
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  history.value.push(state)
  if (history.value.length > maxHistory) {
    history.value.shift()
  }
  historyIndex.value = history.value.length - 1
}

function handleUndo() {
  if (!canUndo.value) return
  historyIndex.value--
  applyState(history.value[historyIndex.value])
}

function handleRedo() {
  if (!canRedo.value) return
  historyIndex.value++
  applyState(history.value[historyIndex.value])
}

function applyState(state) {
  features.value = JSON.parse(JSON.stringify(state.features))
  markers.value = JSON.parse(JSON.stringify(state.markers || []))
  // 重新绑定 editingFeature
  if (editingFeature.value) {
    editingFeature.value = features.value.find(f => f.id === editingFeature.value.id) || null
  }
  recalcBounds()
  autoSave()
}

// ======== 重算边界 ========
function recalcBounds() {
  const newBounds = MapEngine.calculateBounds(features.value)
  if (newBounds) {
    bounds.value = newBounds
  }
}

// ======== 区域操作 ========
function selectFeature(feature) {
  features.value.forEach(f => f.selected = false)
  if (feature) {
    feature.selected = true
    editingFeature.value = feature
  } else {
    editingFeature.value = null
  }
  selectedMarker.value = null
}

function toggleVisibility(feature) {
  feature.visible = !feature.visible
}

function handleFeatureClick(feature) {
  if (currentTool.value === 'select' || currentTool.value === 'edit') {
    selectFeature(feature)
  }
}

function handleFeatureHover(feature) {
  // hover 效果由 MapCanvas 内部处理
}

function updateFeature(updates) {
  if (!editingFeature.value) return

  Object.keys(updates).forEach(key => {
    if (key === 'properties') {
      editingFeature.value.properties = {
        ...editingFeature.value.properties,
        ...updates.properties
      }
    } else {
      editingFeature.value[key] = updates[key]
    }
  })

  saveState()
  autoSave()
}

function deleteFeature() {
  if (!editingFeature.value) return
  const index = features.value.indexOf(editingFeature.value)
  if (index > -1) {
    features.value.splice(index, 1)
    editingFeature.value = null
    saveState()
    recalcBounds()
    autoSave()
  }
}

// ======== 节点拖拽 ========
function handleNodeDragEnd({ coord, lon, lat }) {
  // 直接修改原始坐标对象
  coord.lon = lon
  coord.lat = lat
  saveState()
  recalcBounds()
  autoSave()
}

// ======== 区域拖拽 ========
function handleFeatureDragEnd({ feature, dLon, dLat }) {
  // 递归移动所有坐标点
  const moveCoords = (coords) => {
    if (coords && coords.lon !== undefined) {
      coords.lon += dLon
      coords.lat += dLat
    } else if (Array.isArray(coords)) {
      coords.forEach(moveCoords)
    }
  }
  moveCoords(feature.geometry.coordinates)
  saveState()
  recalcBounds()
  autoSave()
}

// ======== 标签拖拽 ========
function handleLabelDragEnd({ feature, lon, lat }) {
  if (!feature.properties) feature.properties = {}
  // 必须创建新对象以触发响应式更新 (如果 feature 是 reactive 的，直接赋值可能也行，但稳妥起见)
  feature.properties = {
    ...feature.properties,
    center: { lon, lat }
  }
  saveState()
  autoSave()
}

// ======== 绘制区域 ========
function startDrawing() {
  drawingPoints.value = []
  currentTool.value = 'draw'
}

function handleAddPoint(geo) {
  drawingPoints.value = [...drawingPoints.value, { lon: geo.lon, lat: geo.lat }]
}

function handleCanvasClick(data) {
  if (data.type === 'dblclick') {
    if (currentTool.value === 'draw') {
      finishDrawing()
    } else if (currentTool.value === 'split') {
      executeSplit()
    }
    return
  } else if (data.type === 'contextmenu') {
    if (currentTool.value === 'draw') cancelDrawing()
    else if (currentTool.value === 'split') cancelSplit()
  } else if (currentTool.value === 'marker' && data.geo && !data.type) {
    addMarker(data.geo)
  }
}

async function finishDrawing() {
  if (drawingPoints.value.length < 3) {
    alert('至少需要3个点才能创建区域')
    return
  }

  const name = await showDialog('新建区域', '输入区域名称', '新区域')
  if (!name) {
    cancelDrawing()
    return
  }

  const coords = drawingPoints.value.map(p => ({ lon: p.lon, lat: p.lat }))
  // 闭合
  coords.push({ ...coords[0] })

  const newFeature = {
    id: `custom_${Date.now()}`,
    name: name,
    properties: { name: name },
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    visible: true,
    selected: false,
    color: generateColor()
  }

  features.value.push(newFeature)
  drawingPoints.value = []
  currentTool.value = 'select'
  saveState()
  recalcBounds()
  autoSave()
}

function cancelDrawing() {
  drawingPoints.value = []
  if (currentTool.value === 'draw') {
    currentTool.value = 'select'
  }
}

// ======== 切割 ========
function handleSplitPoint(geo) {
  splitPoints.value = [...splitPoints.value, { lon: geo.lon, lat: geo.lat }]
  // 不再自动执行，等待双击完成
}

async function executeSplit() {
  if (!editingFeature.value || splitPoints.value.length < 2) {
    cancelSplit()
    return
  }

  const feature = editingFeature.value
  const geom = feature.geometry
  const cutLine = splitPoints.value

  let splitResult = null
  let splitIndex = -1 // 仅用于 MultiPolygon，记录被切割的子多边形索引

  // 尝试切割
  if (geom.type === 'Polygon') {
    // Polygon: coordinates = [ring0, ring1...]
    const outerRing = geom.coordinates[0]
    const res = MapEngine.splitPolygon(outerRing, cutLine)
    if (res) {
      splitResult = res
    }
  } else if (geom.type === 'MultiPolygon') {
    // MultiPolygon: coordinates = [polygon0, polygon1...]
    // polygon = [ring0, ring1...]
    for (let i = 0; i < geom.coordinates.length; i++) {
      const polygon = geom.coordinates[i]
      const outerRing = polygon[0]
      const res = MapEngine.splitPolygon(outerRing, cutLine)
      if (res) {
        splitResult = res
        splitIndex = i
        break // 找到一个切割点即停止
      }
    }
  } else {
    alert(`暂不支持 ${geom.type} 类型的切割`)
    cancelSplit()
    return
  }

  if (!splitResult) {
    alert('切割失败：切割线必须穿过某个区域的两条边界，请调整切割线位置后重试')
    splitPoints.value = []
    return
  }

  const [polyA, polyB] = splitResult

  // 弹出对话框让用户命名新区域
  const newName = await showDialog('切割区域', '输入新区域名称', `${feature.name || '区域'}_分割`)

  if (!newName) {
    // 用户取消
    splitPoints.value = []
    return
  }

  // 更新原区域（使用 polyA）
  if (geom.type === 'Polygon') {
    feature.geometry = {
      type: 'Polygon',
      coordinates: [polyA]
    }
  } else if (geom.type === 'MultiPolygon') {
    // 更新 MultiPolygon 中被切割的那一个子多边形
    // 注意：polyA 是一个环的数组 [outerRing]，直接作为 polygon 的 coordinates
    // 实际上 MapEngine.splitPolygon 返回的是闭合的环坐标数组 coordinates
    // 我们的 polyA 结构是 [{lon,lat}, ...]，即一个 ring
    // 但 MapEngine.splitPolygon 返回的是 [polyA, polyB]，其中 polyA 是 ring
    // 而 Polygon 的 coordinates 是 [ring, hole1, hole2...]
    // 所以这里需要把 polyA 包装成 [polyA]
    geom.coordinates[splitIndex] = [polyA]
    // 触发更新
    feature.geometry = { ...geom }
  }

  // 创建新区域（使用 polyB）
  // 新区域统一作为 Polygon 类型
  const newFeature = {
    id: `split_${Date.now()}`,
    name: newName,
    properties: {
      ...(feature.properties || {}),
      name: newName
    },
    geometry: {
      type: 'Polygon',
      coordinates: [polyB] // polyB 是 ring，需要包一层
    },
    visible: true,
    selected: false,
    color: generateColor()
  }

  features.value.push(newFeature)

  // 清理
  splitPoints.value = []
  currentTool.value = 'select'
  editingFeature.value = null
  features.value.forEach(f => f.selected = false)

  saveState()
  recalcBounds()
  autoSave()
}

function cancelSplit() {
  splitPoints.value = []
  if (currentTool.value === 'split') {
    currentTool.value = 'select'
  }
}

// ======== 标记点 ========
async function addMarker(geo) {
  const name = await showDialog('新建标记点', '输入标记名称', '标记点')
  if (!name) return

  const marker = {
    id: `marker_${Date.now()}`,
    name: name,
    lon: geo.lon,
    lat: geo.lat,
    color: '#e74c3c',
    selected: false
  }

  markers.value.push(marker)
  saveState()
  autoSave()
}

function selectMarker(marker) {
  markers.value.forEach(m => m.selected = false)
  features.value.forEach(f => f.selected = false)
  editingFeature.value = null

  if (marker) {
    marker.selected = true
    selectedMarker.value = marker
  } else {
    selectedMarker.value = null
  }
}

function updateMarker(updates) {
  if (!selectedMarker.value) return
  Object.assign(selectedMarker.value, updates)
  saveState()
  autoSave()
}

function deleteSelectedMarker() {
  if (!selectedMarker.value) return
  const index = markers.value.indexOf(selectedMarker.value)
  if (index > -1) {
    markers.value.splice(index, 1)
    selectedMarker.value = null
    saveState()
    autoSave()
  }
}

function deleteMarkerFromPanel(marker) {
  const index = markers.value.indexOf(marker)
  if (index > -1) {
    markers.value.splice(index, 1)
    if (selectedMarker.value === marker) {
      selectedMarker.value = null
    }
    saveState()
    autoSave()
  }
}

function handleMarkerDrag({ marker, lon, lat }) {
  marker.lon = lon
  marker.lat = lat
  saveState()
  autoSave()
}

// ======== 本地存储 ========
function saveToLocal() {
  const success = dataStore.save({
    features: features.value,
    markers: markers.value
  })
  hasSavedData.value = dataStore.hasSavedData()
  if (success) {
    // 简单提示
    console.log('数据已保存到本地存储')
  }
}

function loadFromLocal() {
  const data = dataStore.load()
  if (!data) return

  features.value = data.features || []
  markers.value = data.markers || []
  recalcBounds()
  saveState()
}

function autoSave() {
  dataStore.debounceSave({
    features: features.value,
    markers: markers.value
  })
  hasSavedData.value = true
}

// ======== 对话框 ========
function showDialog(title, placeholder, defaultValue = '') {
  return new Promise((resolve) => {
    dialogTitle.value = title
    dialogPlaceholder.value = placeholder
    newRegionName.value = defaultValue
    showNameDialog.value = true
    dialogResolve = resolve
    nextTick(() => {
      dialogInputRef.value?.focus()
    })
  })
}

function confirmDialog() {
  const name = newRegionName.value.trim() || '未命名'
  showNameDialog.value = false
  if (dialogResolve) {
    dialogResolve(name)
    dialogResolve = null
  }
}

function cancelDialog() {
  showNameDialog.value = false
  if (dialogResolve) {
    dialogResolve(null)
    dialogResolve = null
  }
}

// ======== 重置视图 ========
function resetView() {
  mapCanvasRef.value?.resetView()
}

// ======== 工具函数 ========
function generateColor() {
  const colors = [
    '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
    '#74b9ff', '#a29bfe', '#fd79a8', '#00b894',
    '#e17055', '#6c5ce7', '#fdcb6e', '#55efc4'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
</script>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog-box {
  background: linear-gradient(135deg, #2d3436 0%, #1e272e 100%);
  border: 1px solid #3d4852;
  border-radius: 16px;
  padding: 28px;
  min-width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog-box h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #dfe6e9;
}

.dialog-box input {
  width: 100%;
  padding: 12px 16px;
  background: #1a1a2e;
  border: 1px solid #3d4852;
  border-radius: 10px;
  color: #dfe6e9;
  font-size: 14px;
  margin-bottom: 20px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.dialog-box input:focus {
  outline: none;
  border-color: #74b9ff;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(9, 132, 227, 0.4);
}

.btn-secondary {
  background: rgba(99, 110, 114, 0.3);
  color: #b2bec3;
}

.btn-secondary:hover {
  background: rgba(99, 110, 114, 0.5);
}
</style>
