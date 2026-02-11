<template>
  <div class="map-canvas-container" ref="containerRef">
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @wheel="onWheel"
      @mousedown="onStageMouseDown"
      @mousemove="onStageMouseMove"
      @mouseup="onStageMouseUp"
      @dblclick="onDoubleClick"
      @contextmenu="onContextMenu"
    >
      <!-- 背景层 -->
      <v-layer>
        <v-rect :config="bgConfig" />
      </v-layer>

      <!-- 网格层 -->
      <v-layer ref="gridLayerRef">
        <v-line
          v-for="line in gridLines"
          :key="line.id"
          :config="line"
        />
      </v-layer>

      <!-- 区域层 -->
      <v-layer ref="featureLayerRef">
        <template v-for="feature in visibleFeatures" :key="feature.id">
          <!-- Polygon -->
          <template v-if="feature.geometry?.type === 'Polygon'">
            <v-line
              v-for="(ring, ri) in feature.geometry.coordinates"
              :key="`${feature.id}-ring-${ri}`"
              :config="getPolygonConfig(feature, ring, ri)"
              @click="(e) => onFeatureClick(e, feature)"
              @mouseenter="() => onFeatureEnter(feature)"
              @mouseleave="onFeatureLeave"
              @dragstart="(e) => onFeatureDragStart(e, feature)"
              @dragmove="(e) => onFeatureDragMove(e, feature)"
              @dragend="(e) => onFeatureDragEnd(e, feature)"
            />
          </template>
          <!-- MultiPolygon -->
          <template v-if="feature.geometry?.type === 'MultiPolygon'">
            <template v-for="(polygon, pi) in feature.geometry.coordinates" :key="`${feature.id}-poly-${pi}`">
              <v-line
                v-for="(ring, ri) in polygon"
                :key="`${feature.id}-poly-${pi}-ring-${ri}`"
                :config="getPolygonConfig(feature, ring, `${pi}-${ri}`)"
                @click="(e) => onFeatureClick(e, feature)"
                @mouseenter="() => onFeatureEnter(feature)"
                @mouseleave="onFeatureLeave"
                @dragstart="(e) => onFeatureDragStart(e, feature)"
                @dragmove="(e) => onFeatureDragMove(e, feature)"
                @dragend="(e) => onFeatureDragEnd(e, feature)"
              />
            </template>
          </template>
          <!-- 标签 -->
          <v-text
            :config="getLabelConfig(feature)"
            @dragend="(e) => onLabelDragEnd(e, feature)"
          />
        </template>
      </v-layer>

      <!-- 编辑节点层 - 始终存在，用 visible 控制显隐 -->
      <v-layer :config="{ visible: showEditNodes }">
        <v-circle
          v-for="node in editNodeList"
          :key="node.key"
          :config="node.circleConfig"
          @dragstart="(e) => onNodeDragStart(e, node)"
          @dragmove="(e) => onNodeDragMove(e, node)"
          @dragend="(e) => onNodeDragEnd(e, node)"
        />
      </v-layer>

      <!-- 标记点层 -->
      <v-layer>
        <template v-for="marker in markers" :key="marker.id">
          <v-circle
            :config="getMarkerConfig(marker)"
            @click="() => $emit('markerClick', marker)"
            @dragend="(e) => onMarkerDragEnd(e, marker)"
          />
          <v-text
            :config="getMarkerLabelConfig(marker)"
          />
        </template>
      </v-layer>

      <!-- 绘制层 -->
      <v-layer>
        <!-- 绘制中的路径 -->
        <v-line
          v-if="drawingPoints.length > 0"
          :config="drawingLineConfig"
        />
        <v-circle
          v-for="(pt, i) in drawingPoints"
          :key="`draw-${i}`"
          :config="getDrawingPointConfig(pt)"
        />
        <!-- 切割线 -->
        <v-line
          v-if="splitPoints.length > 0"
          :config="splitLineConfig"
        />
        <!-- 切割线预览（最后一个点到鼠标位置） -->
        <v-line
          v-if="splitPoints.length > 0 && mouseGeo"
          :config="splitPreviewConfig"
        />
        <v-circle
          v-for="(pt, i) in splitPoints"
          :key="`split-${i}`"
          :config="getSplitPointConfig(pt, i)"
        />
      </v-layer>
    </v-stage>

    <!-- 绘制提示 -->
    <div v-if="currentTool === 'draw'" class="canvas-hint">
      <span>点击添加节点 | 双击完成绘制 | 右键取消</span>
    </div>

    <!-- 切割提示 -->
    <div v-if="currentTool === 'split'" class="canvas-hint split-hint">
      <span v-if="splitPoints.length === 0">先选择要切割的区域，然后点击绘制切割线</span>
      <span v-else>点击添加节点 | 双击完成切割 | 右键取消</span>
    </div>

    <!-- 编辑提示 -->
    <div v-if="currentTool === 'edit' && editingFeature" class="canvas-hint edit-hint">
      <span>拖拽红色圆点编辑节点 | 按 V 回到选择模式</span>
    </div>

    <!-- 标记提示 -->
    <div v-if="currentTool === 'marker'" class="canvas-hint marker-hint">
      <span>点击画布添加标记点 | 按 V 回到选择模式</span>
    </div>

    <!-- 坐标显示 -->
    <div class="coordinate-display" v-if="mouseGeo">
      <span>经度: {{ mouseGeo.lon.toFixed(4) }}</span>
      <span>纬度: {{ mouseGeo.lat.toFixed(4) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { MapEngine } from '../core/MapEngine'

const props = defineProps({
  features: { type: Array, default: () => [] },
  markers: { type: Array, default: () => [] },
  bounds: { type: Object, default: null },
  currentTool: { type: String, default: 'select' },
  editingFeature: { type: Object, default: null },
  drawingPoints: { type: Array, default: () => [] },
  splitPoints: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'featureClick',
  'featureHover',
  'nodeDragEnd',
  'featureDragEnd',
  'addPoint',
  'splitPoint',
  'canvasClick',
  'markerClick',
  'markerClick',
  'markerDrag',
  'labelDragEnd'
])

const containerRef = ref(null)
const stageRef = ref(null)

const stageWidth = ref(800)
const stageHeight = ref(600)
const mouseGeo = ref(null)
const hoveredFeatureId = ref(null)

// 拖拽状态 — 不使用 ref 避免触发响应式更新
let isDraggingNode = false
let dragStartGeo = null

const engine = new MapEngine()

// ======== Stage 配置 ========
const stageConfig = computed(() => ({
  width: stageWidth.value,
  height: stageHeight.value,
  draggable: true
}))

const bgConfig = computed(() => ({
  x: 0, y: 0,
  width: stageWidth.value * 3,
  height: stageHeight.value * 3,
  offsetX: stageWidth.value,
  offsetY: stageHeight.value,
  fill: '#1a1a2e',
  listening: false
}))

// ======== 网格线 ========
const gridLines = computed(() => {
  const lines = []
  const gs = 50
  for (let x = 0; x <= stageWidth.value; x += gs) {
    lines.push({ id: `gv-${x}`, points: [x, 0, x, stageHeight.value], stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1, listening: false })
  }
  for (let y = 0; y <= stageHeight.value; y += gs) {
    lines.push({ id: `gh-${y}`, points: [0, y, stageWidth.value, y], stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1, listening: false })
  }
  return lines
})

// ======== 可见区域 ========
const visibleFeatures = computed(() => props.features.filter(f => f.visible !== false))

// ======== 是否显示编辑节点 ========
const showEditNodes = computed(() => {
  return props.currentTool === 'edit' && props.editingFeature != null
})

// ======== 区域多边形配置 ========
function getPolygonConfig(feature, ring, ringKey) {
  const points = engine.geometryToFlatPoints(ring)
  const isHovered = hoveredFeatureId.value === feature.id
  const isEditing = props.editingFeature?.id === feature.id
  const isSelected = feature.selected

  let fill = feature.color || '#4ecdc4'
  let stroke = '#2c3e50'
  let strokeWidth = 1.5
  let opacity = 0.6

  if (isHovered && !isEditing) {
    fill = '#3498db'
    opacity = 0.7
  }
  if (isSelected || isEditing) {
    fill = feature.color || '#e74c3c'
    stroke = '#ffffff'
    strokeWidth = 2.5
    opacity = 0.75
  }

  // 选中的区域可以拖拽（仅在 select 模式下）
  const canDrag = props.currentTool === 'select' && isSelected

  return {
    points,
    fill,
    stroke,
    strokeWidth,
    opacity,
    closed: true,
    draggable: canDrag,
    perfectDrawEnabled: false,
    hitStrokeWidth: 10
  }
}

// ======== 标签配置 ========
function getLabelConfig(feature) {
  // 校验 center 是否有效
  const isValidCenter = (c) => c && typeof c.lon === 'number' && typeof c.lat === 'number' && !isNaN(c.lon) && !isNaN(c.lat)

  // 优先使用 properties.center
  let center = feature.properties?.center
  
  // 如果 properties.center 无效，或者根本没有，则计算几何中心
  if (!isValidCenter(center)) {
    center = MapEngine.calculateCenter(feature.geometry)
  }
  
  // 如果还是无效，不显示
  if (!isValidCenter(center)) return { visible: false }
  
  const { x, y } = engine.geoToCanvas(center.lon, center.lat)
  const name = feature.name || ''
  
  // 在编辑模式下允许拖拽标签
  // 也可以限制为仅当 feature 被选中时
  const isDraggable = props.currentTool === 'edit'
  
  return {
    x, y,
    text: name,
    fontSize: 13,
    fontFamily: 'Microsoft YaHei, sans-serif',
    fontStyle: 'bold',
    fill: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowBlur: 6,
    offsetX: name.length * 6.5,
    offsetY: 7,
    draggable: isDraggable,
    listening: isDraggable
  }
}

function onLabelDragEnd(e, feature) {
  const pos = e.target.position()
  const geo = engine.canvasToGeo(pos.x, pos.y)
  // 获取相对于文字中心的偏移？
  // Konva text position is top-left usually, but we set offsetX/Y.
  // The position() returns the anchor point (x,y) minus offset?
  // No, position() returns the (x,y) we set.
  // When dragging, (x,y) changes.
  
  emit('labelDragEnd', { feature, lon: geo.lon, lat: geo.lat })
}

// ======== 编辑节点列表 ========
const editNodeList = computed(() => {
  if (!showEditNodes.value) return []
  if (!props.editingFeature?.geometry) return []

  const nodes = []
  const geom = props.editingFeature.geometry

  const processRing = (ring, polygonIndex, ringIndex) => {
    if (!Array.isArray(ring)) return
    for (let i = 0; i < ring.length; i++) {
      const coord = ring[i]
      if (coord == null || coord.lon == null || coord.lat == null) continue
      const pos = engine.geoToCanvas(coord.lon, coord.lat)
      if (isNaN(pos.x) || isNaN(pos.y)) continue
      nodes.push({
        key: `n-${polygonIndex}-${ringIndex}-${i}`,
        coord,
        polygonIndex,
        ringIndex,
        coordIndex: i,
        circleConfig: {
          x: pos.x,
          y: pos.y,
          radius: 7,
          fill: '#e74c3c',
          stroke: '#ffffff',
          strokeWidth: 2.5,
          draggable: true,
          perfectDrawEnabled: false
        }
      })
    }
  }

  try {
    if (geom.type === 'Polygon') {
      geom.coordinates.forEach((ring, ri) => processRing(ring, 0, ri))
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach((polygon, pi) => {
        polygon.forEach((ring, ri) => processRing(ring, pi, ri))
      })
    }
  } catch (err) {
    console.warn('编辑节点计算出错:', err)
  }

  return nodes
})

// ======== 节点拖拽 — 仅在 dragEnd 时提交变更 ========
function onNodeDragStart(e, node) {
  isDraggingNode = true
  // 禁止 stage 拖拽
  const stage = stageRef.value?.getStage()
  if (stage) stage.draggable(false)
  e.cancelBubble = true
}

function onNodeDragMove(e, node) {
  // 不做任何处理，让 Konva 自己管理视觉位置
  e.cancelBubble = true
}

function onNodeDragEnd(e, node) {
  isDraggingNode = false
  // 恢复 stage 拖拽
  const stage = stageRef.value?.getStage()
  if (stage) stage.draggable(true)

  // 获取最终位置并转换为 geo 坐标
  const pos = e.target.position()
  const geo = engine.canvasToGeo(pos.x, pos.y)

  // 提交变更
  emit('nodeDragEnd', {
    coord: node.coord,
    polygonIndex: node.polygonIndex,
    ringIndex: node.ringIndex,
    coordIndex: node.coordIndex,
    lon: geo.lon,
    lat: geo.lat
  })

  e.cancelBubble = true
}

// ======== 区域拖拽 ========
function onFeatureDragStart(e, feature) {
  const pos = e.target.position()
  dragStartGeo = engine.canvasToGeo(pos.x, pos.y)
  // 禁止 stage 拖拽
  const stage = stageRef.value?.getStage()
  if (stage) stage.draggable(false)
}

function onFeatureDragMove(e, feature) {
  // Konva 自动处理视觉移动
}

function onFeatureDragEnd(e, feature) {
  const stage = stageRef.value?.getStage()
  if (stage) stage.draggable(true)

  // 计算位移量（基于 Konva 的 position 变化）
  const endPos = e.target.position()
  // v-line 的 position 默认是 (0,0)，拖拽后变成偏移量
  const deltaX = endPos.x
  const deltaY = endPos.y

  if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

  // 将像素偏移转换为 geo 偏移
  const geoOrigin = engine.canvasToGeo(0, 0)
  const geoDelta = engine.canvasToGeo(deltaX, deltaY)
  const dLon = geoDelta.lon - geoOrigin.lon
  const dLat = geoDelta.lat - geoOrigin.lat

  emit('featureDragEnd', { feature, dLon, dLat })

  // 重置 Konva shape 的 position（因为我们通过修改 geo 坐标来实现移动）
  e.target.position({ x: 0, y: 0 })
}

function onFeatureClick(e, feature) {
  // 阻止冒泡，避免触发 stage 的点击事件，也不传递给下层对象
  e.cancelBubble = true
  
  // 切割/绘制模式下，点击 shape 也应该发出对应事件（不做 featureClick）
  if (props.currentTool === 'split' || props.currentTool === 'draw') {
    // 由 onStageMouseUp 统一处理
    // 但因为阻止了冒泡，onStageMouseUp 可能接收不到事件（onStageMouseUp 是监听 stage 还是 container?）
    // MapCanvas 的 onStageMouseUp 是监听 stage 的 @mouseup。
    // 如果这里阻止冒泡，stage 确实接收不到。
    // 所以在 split/draw 模式下，我们要么不阻止冒泡，要么手动触发emit。
    // 之前的改动是让 onStageMouseUp 处理所有点击。
    // 如果阻止冒泡，我们需要在这里 emit。
    
    // Check previous logic:
    // onStageMouseUp: if (target !== stage) ... 
    // We removed that check. So stage receives it.
    // If we stop propagation here, stage won't receive it?
    // Konva event bubbling: shape -> layer -> stage.
    // Yes, cancelBubble stops it reaching stage.
    
    // So for split/draw, we should NOT cancel bubble, or we should emit here.
    // But we unified logic in onStageMouseUp.
    
    // Let's emit here for split/draw and return.
    // But wait, getGeoFromEvent relies on stage pointer position.
    
    // Better: Only cancel bubble if NOT split/draw.
    return
  }
  emit('featureClick', feature)
}

// ======== 标记点配置 ========
function getMarkerConfig(marker) {
  const { x, y } = engine.geoToCanvas(marker.lon, marker.lat)
  return {
    x, y,
    radius: 9,
    fill: marker.color || '#e74c3c',
    stroke: '#ffffff',
    strokeWidth: 2.5,
    draggable: true,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: 6,
    perfectDrawEnabled: false
  }
}

function getMarkerLabelConfig(marker) {
  const { x, y } = engine.geoToCanvas(marker.lon, marker.lat)
  return {
    x: x + 14, y: y - 10,
    text: marker.name || '',
    fontSize: 12,
    fontFamily: 'Microsoft YaHei, sans-serif',
    fontStyle: 'bold',
    fill: '#ffffff',
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowBlur: 4,
    listening: false
  }
}

function onMarkerDragEnd(e, marker) {
  const pos = e.target.position()
  const geo = engine.canvasToGeo(pos.x, pos.y)
  emit('markerDrag', { marker, lon: geo.lon, lat: geo.lat })
}

// ======== 绘制配置 ========
const drawingLineConfig = computed(() => {
  const pts = []
  props.drawingPoints.forEach(p => {
    const { x, y } = engine.geoToCanvas(p.lon, p.lat)
    pts.push(x, y)
  })
  return {
    points: pts,
    stroke: '#e74c3c',
    strokeWidth: 2,
    dash: [5, 5],
    listening: false
  }
})

function getDrawingPointConfig(pt) {
  const { x, y } = engine.geoToCanvas(pt.lon, pt.lat)
  return { x, y, radius: 6, fill: '#e74c3c', stroke: '#fff', strokeWidth: 2, listening: false }
}

// ======== 切割线配置 ========
const splitLineConfig = computed(() => {
  const pts = []
  props.splitPoints.forEach(p => {
    const { x, y } = engine.geoToCanvas(p.lon, p.lat)
    pts.push(x, y)
  })
  return {
    points: pts,
    stroke: '#f39c12',
    strokeWidth: 3,
    dash: [8, 4],
    listening: false
  }
})

function getSplitPointConfig(pt, index) {
  const { x, y } = engine.geoToCanvas(pt.lon, pt.lat)
  return { x, y, radius: 8, fill: '#f39c12', stroke: '#fff', strokeWidth: 2, listening: false }
}

// 切割预览线（最后一个点 → 鼠标位置）
const splitPreviewConfig = computed(() => {
  if (props.splitPoints.length === 0 || !mouseGeo.value) return { points: [], visible: false }
  const lastPoint = props.splitPoints[props.splitPoints.length - 1]
  const p1 = engine.geoToCanvas(lastPoint.lon, lastPoint.lat)
  const p2 = engine.geoToCanvas(mouseGeo.value.lon, mouseGeo.value.lat)
  return {
    points: [p1.x, p1.y, p2.x, p2.y],
    stroke: '#f39c12',
    strokeWidth: 2,
    dash: [6, 4],
    opacity: 0.7,
    listening: false
  }
})

// ======== Hover ========
function onFeatureEnter(feature) {
  hoveredFeatureId.value = feature.id
  emit('featureHover', feature)
  // 改变鼠标样式
  const stage = stageRef.value?.getStage()
  if (stage) stage.container().style.cursor = 'pointer'
}

function onFeatureLeave() {
  hoveredFeatureId.value = null
  emit('featureHover', null)
  const stage = stageRef.value?.getStage()
  if (stage) stage.container().style.cursor = 'default'
}

// ======== 滚轮缩放 ========
function onWheel(e) {
  e.evt.preventDefault()
  const stage = stageRef.value?.getStage()
  if (!stage) return

  const scaleBy = 1.08
  const oldScale = stage.scaleX()
  const pointer = stage.getPointerPosition()

  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  }

  const direction = e.evt.deltaY > 0 ? -1 : 1
  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
  const clampedScale = Math.max(0.1, Math.min(30, newScale))

  stage.scale({ x: clampedScale, y: clampedScale })

  const newPos = {
    x: pointer.x - mousePointTo.x * clampedScale,
    y: pointer.y - mousePointTo.y * clampedScale,
  }
  stage.position(newPos)
}

// ======== 鼠标事件 ========
function getGeoFromEvent(e) {
  const stage = stageRef.value?.getStage()
  if (!stage || !engine.bounds) return null
  const pointer = stage.getPointerPosition()
  if (!pointer) return null
  const transform = stage.getAbsoluteTransform().copy().invert()
  const pos = transform.point(pointer)
  return engine.canvasToGeo(pos.x, pos.y)
}

function onStageMouseDown(e) {
  if (e.evt.button === 2) return
}

function onStageMouseMove(e) {
  if (isDraggingNode) return
  const geo = getGeoFromEvent(e)
  if (geo) mouseGeo.value = geo
}

function onStageMouseUp(e) {
  if (e.evt.button === 2) return
  if (isDraggingNode) return

  const target = e.target
  const stage = stageRef.value?.getStage()
  const geo = getGeoFromEvent(e)
  if (!geo) return

  // 切割和绘制模式：不管点击在 shape 还是空白处，都发出事件
  if (props.currentTool === 'split') {
    emit('splitPoint', geo)
    return
  }
  if (props.currentTool === 'draw') {
    emit('addPoint', geo)
    return
  }
  if (props.currentTool === 'marker') {
    if (target === stage) {
      emit('canvasClick', { geo })
    }
    return
  }

  // 其他模式：点击空白处
  if (target === stage) {
    if (props.currentTool === 'select') {
      emit('featureClick', null)
    }
  }
}

function onDoubleClick(e) {
  emit('canvasClick', { type: 'dblclick', geo: getGeoFromEvent(e) })
}

function onContextMenu(e) {
  e.evt.preventDefault()
  emit('canvasClick', { type: 'contextmenu', geo: getGeoFromEvent(e) })
}

// ======== 尺寸管理 ========
function handleResize() {
  if (!containerRef.value) return
  stageWidth.value = containerRef.value.clientWidth
  stageHeight.value = containerRef.value.clientHeight
  engine.setCanvasSize(stageWidth.value, stageHeight.value)
  if (props.bounds) {
    engine.setBounds(props.bounds)
  }
}

// ======== 监听数据变化 ========
watch(() => props.bounds, (newBounds) => {
  if (newBounds) {
    engine.setCanvasSize(stageWidth.value, stageHeight.value)
    engine.setBounds(newBounds)
  }
}, { immediate: true })

// ======== 生命周期 ========
onMounted(() => {
  nextTick(() => {
    handleResize()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// ======== 暴露方法 ========
function resetView() {
  const stage = stageRef.value?.getStage()
  if (stage) {
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
  }
  if (props.bounds) {
    engine.setCanvasSize(stageWidth.value, stageHeight.value)
    engine.setBounds(props.bounds)
  }
}

defineExpose({ resetView, engine })
</script>

<style scoped>
.map-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a2e;
  flex: 1;
}

.canvas-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  background: rgba(231, 76, 60, 0.9);
  color: white;
  border-radius: 20px;
  font-size: 13px;
  pointer-events: none;
  animation: pulse 2s infinite;
  z-index: 10;
  white-space: nowrap;
}

.split-hint {
  background: rgba(243, 156, 18, 0.9);
}

.edit-hint {
  background: rgba(116, 185, 255, 0.9);
}

.marker-hint {
  background: rgba(0, 184, 148, 0.9);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.coordinate-display {
  position: absolute;
  bottom: 16px;
  left: 16px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: #74b9ff;
  border-radius: 8px;
  font-size: 12px;
  font-family: 'Consolas', monospace;
  display: flex;
  gap: 16px;
  z-index: 10;
}
</style>
