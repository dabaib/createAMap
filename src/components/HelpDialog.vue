<template>
  <div class="help-dialog-overlay" @click.self="$emit('close')">
    <div class="help-dialog">
      <div class="help-header">
        <h3>使用手册</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="help-content">
        <section>
          <h4>🌍 基础操作</h4>
          <ul>
            <li><strong>平移地图</strong>：在画布空白处或标签上按住<strong>鼠标左键</strong>拖拽。</li>
            <li><strong>缩放地图</strong>：滚动鼠标滚轮。</li>
            <li><strong>重置视图</strong>：点击工具栏的“重置视图”按钮。</li>
          </ul>
        </section>

        <section>
          <h4>🛠️ 工具栏功能</h4>
          <ul>
            <li><strong>选择工具 (V)</strong>：默认模式，用于选中、查看和拖拽区域。</li>
            <li><strong>编辑工具 (E)</strong>：显示区域节点，允许拖拽节点调整边界。</li>
            <li><strong>绘制工具 (D)</strong>：创建新区域。点击添加节点，双击完成。右键取消。</li>
            <li><strong>标记工具 (M)</strong>：点击地图添加点标记。</li>
            <li><strong>切割工具 (S)</strong>：绘制折线将一个区域分割为两个。</li>
          </ul>
        </section>

        <section>
          <h4>📂 数据管理</h4>
          <ul>
            <li><strong>导入/导出</strong>：支持 GeoJSON 格式文件。</li>
            <li><strong>本地保存</strong>：点击“保存”将当前进度存入浏览器缓存，下次访问点击“加载”恢复。</li>
            <li><strong>撤销/重做</strong>：支持 Ctrl+Z / Ctrl+Y 快捷键。</li>
          </ul>
        </section>

        <section>
          <h4>✂️ 进阶功能：区域切割</h4>
          <p>支持<strong>自定义折线</strong>和<strong>MultiPolygon</strong>切割。</p>
          <ul>
            <li>先选中要切割的区域。</li>
            <li>绘制切割线：必须贯穿区域（从外入，从外出）。</li>
            <li>双击结束绘制并确认切割。</li>
          </ul>
          <div class="image-container">
            <img src="/manual/split_initial_state.png" alt="切割示例" />
          </div>
        </section>

        <section>
          <h4>🏷️ 进阶功能：标签拖拽</h4>
          <p>在<strong>编辑模式</strong>下，可以直接<strong>拖拽区域名称</strong>来调整位置。</p>
          <div class="image-container">
            <img src="/manual/label_drag.webp" alt="标签拖拽演示" />
          </div>
        </section>

        <section>
          <h4>⌨️ 快捷键列表</h4>
          <table class="shortcut-table">
            <tr><td><code>V</code></td><td>选择模式</td></tr>
            <tr><td><code>E</code></td><td>编辑模式</td></tr>
            <tr><td><code>D</code></td><td>绘制模式</td></tr>
            <tr><td><code>S</code></td><td>切割模式</td></tr>
            <tr><td><code>M</code></td><td>标记模式</td></tr>
            <tr><td><code>Ctrl + Z</code></td><td>撤销</td></tr>
            <tr><td><code>Ctrl + Y</code></td><td>重做</td></tr>
            <tr><td><code>Delete</code></td><td>删除选中要素</td></tr>
          </table>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['close'])
</script>

<style scoped>
.help-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.help-dialog {
  background: #2c3e50;
  width: 600px;
  max-width: 90%;
  max-height: 80vh;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.help-header {
  padding: 16px;
  background: #34495e;
  border-bottom: 1px solid #465c71;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.help-header h3 {
  margin: 0;
  color: #ecf0f1;
}

.close-btn {
  background: none;
  border: none;
  color: #bdc3c7;
  font-size: 24px;
  cursor: pointer;
}

.close-btn:hover {
  color: #fff;
}

.help-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  color: #ecf0f1;
}

section {
  margin-bottom: 24px;
}

h4 {
  color: #4ecdc4;
  margin-bottom: 12px;
  border-bottom: 1px solid #465c71;
  padding-bottom: 4px;
}

ul {
  padding-left: 20px;
  margin-bottom: 12px;
}

li {
  margin-bottom: 6px;
}

.image-container {
  margin: 12px 0;
  border: 1px solid #465c71;
  border-radius: 4px;
  overflow: hidden;
}

img {
  width: 100%;
  display: block;
}

code {
  background: #1a252f;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.shortcut-table {
  width: 100%;
  border-collapse: collapse;
}

.shortcut-table td {
  padding: 8px;
  border-bottom: 1px solid #465c71;
  color: #bdc3c7;
}

.shortcut-table tr:last-child td {
  border-bottom: none;
}

.shortcut-table td:first-child {
  width: 120px;
  font-weight: bold;
  color: #74b9ff;
}
</style>
