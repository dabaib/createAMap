/**
 * 地图引擎
 * 负责 GeoJSON 坐标与 Konva 画布坐标之间的投影转换
 */
export class MapEngine {
  constructor() {
    this.bounds = null
    this.canvasWidth = 800
    this.canvasHeight = 600
    this.padding = 40

    // 投影参数（每次 fitToView 时重新计算）
    this.projScale = 1
    this.projOffsetX = 0
    this.projOffsetY = 0
  }

  /**
   * 设置画布尺寸
   */
  setCanvasSize(width, height) {
    this.canvasWidth = width
    this.canvasHeight = height
  }

  /**
   * 设置边界并计算投影参数
   */
  setBounds(bounds) {
    this.bounds = bounds
    this.fitToView()
  }

  /**
   * 计算边界范围
   */
  static calculateBounds(features) {
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    const processCoord = (coord) => {
      if (coord.lon !== undefined) {
        minLon = Math.min(minLon, coord.lon)
        maxLon = Math.max(maxLon, coord.lon)
        minLat = Math.min(minLat, coord.lat)
        maxLat = Math.max(maxLat, coord.lat)
      } else if (Array.isArray(coord)) {
        coord.forEach(processCoord)
      }
    }

    features.forEach(f => {
      if (f.geometry && f.geometry.coordinates) {
        processCoord(f.geometry.coordinates)
      }
    })

    if (minLon === Infinity) return null

    // 添加一些 padding
    const lonPad = (maxLon - minLon) * 0.05
    const latPad = (maxLat - minLat) * 0.05

    return {
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad,
      minLat: minLat - latPad,
      maxLat: maxLat + latPad
    }
  }

  /**
   * 计算单个几何体的边界
   */
  static getGeometryBounds(geometry) {
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    const processCoord = (coord) => {
      if (coord.lon !== undefined && !isNaN(coord.lon)) {
        minLon = Math.min(minLon, coord.lon)
        maxLon = Math.max(maxLon, coord.lon)
        minLat = Math.min(minLat, coord.lat)
        maxLat = Math.max(maxLat, coord.lat)
      } else if (Array.isArray(coord)) {
        coord.forEach(processCoord)
      }
    }

    if (geometry && geometry.coordinates) {
      processCoord(geometry.coordinates)
    }

    if (minLon === Infinity) return null

    return { minLon, maxLon, minLat, maxLat }
  }

  /**
   * 计算投影参数（适应视图）
   */
  fitToView() {
    if (!this.bounds) return

    const { minLon, maxLon, minLat, maxLat } = this.bounds
    const mapWidth = maxLon - minLon
    const mapHeight = maxLat - minLat

    if (mapWidth === 0 || mapHeight === 0) return

    const availableWidth = this.canvasWidth - this.padding * 2
    const availableHeight = this.canvasHeight - this.padding * 2

    this.projScale = Math.min(availableWidth / mapWidth, availableHeight / mapHeight)

    // 居中
    const scaledWidth = mapWidth * this.projScale
    const scaledHeight = mapHeight * this.projScale
    this.projOffsetX = (this.canvasWidth - scaledWidth) / 2
    this.projOffsetY = (this.canvasHeight - scaledHeight) / 2
  }

  /**
   * 经纬度 → 画布坐标（不含 Stage 变换）
   */
  geoToCanvas(lon, lat) {
    if (!this.bounds) return { x: 0, y: 0 }
    const { minLon, maxLat } = this.bounds
    const x = (lon - minLon) * this.projScale + this.projOffsetX
    const y = (maxLat - lat) * this.projScale + this.projOffsetY
    return { x, y }
  }

  /**
   * 画布坐标 → 经纬度（不含 Stage 变换）
   */
  canvasToGeo(x, y) {
    if (!this.bounds) return { lon: 0, lat: 0 }
    const { minLon, maxLat } = this.bounds
    const lon = (x - this.projOffsetX) / this.projScale + minLon
    const lat = maxLat - (y - this.projOffsetY) / this.projScale
    return { lon, lat }
  }

  /**
   * 将 Stage 鼠标坐标转为 geo 坐标（考虑 Stage 的 scale 和 position）
   */
  stageMouseToGeo(stagePointer, stageAttrs) {
    const { x: sx, y: sy } = stagePointer
    const { x: ox, y: oy, scaleX } = stageAttrs
    // stage 坐标 → 内部画布坐标
    const cx = (sx - ox) / scaleX
    const cy = (sy - oy) / scaleX
    return this.canvasToGeo(cx, cy)
  }

  /**
   * 将 geometry 坐标转换为 Konva 可用的 flat 数组 [x1,y1, x2,y2, ...]
   */
  geometryToFlatPoints(ring) {
    const points = []
    ring.forEach(coord => {
      const { x, y } = this.geoToCanvas(coord.lon, coord.lat)
      points.push(x, y)
    })
    return points
  }

  /**
   * 计算多边形几何中心
   */
  static calculateCenter(geometry) {
    if (!geometry || !geometry.coordinates) return null

    const coords = []
    const flatten = (arr) => {
      if (arr.lon !== undefined) {
        coords.push(arr)
      } else if (Array.isArray(arr)) {
        arr.forEach(flatten)
      }
    }
    flatten(geometry.coordinates)

    if (coords.length === 0) return null

    const sum = coords.reduce((acc, c) => ({
      lon: acc.lon + c.lon,
      lat: acc.lat + c.lat
    }), { lon: 0, lat: 0 })

    const center = {
      lon: sum.lon / coords.length,
      lat: sum.lat / coords.length
    }

    if (isNaN(center.lon) || isNaN(center.lat)) {
      // 如果计算结果无效，回退到边界中心
      const bounds = this.getGeometryBounds(geometry)
      if (bounds) {
        return {
          lon: (bounds.minLon + bounds.maxLon) / 2,
          lat: (bounds.minLat + bounds.maxLat) / 2
        }
      }
      return null
    }

    return center
  }

  /**
   * 线段求交
   * @param {Object} p1 - 线段1起点 {lon, lat}
   * @param {Object} p2 - 线段1终点
   * @param {Object} p3 - 线段2起点
   * @param {Object} p4 - 线段2终点
   * @returns {Object|null} 交点 {lon, lat, t, s} 或 null
   */
  static lineSegmentIntersection(p1, p2, p3, p4) {
    const d1x = p2.lon - p1.lon
    const d1y = p2.lat - p1.lat
    const d2x = p4.lon - p3.lon
    const d2y = p4.lat - p3.lat

    const denom = d1x * d2y - d1y * d2x
    if (Math.abs(denom) < 1e-12) return null // 平行

    const t = ((p3.lon - p1.lon) * d2y - (p3.lat - p1.lat) * d2x) / denom
    const s = ((p3.lon - p1.lon) * d1y - (p3.lat - p1.lat) * d1x) / denom

    if (t < -1e-9 || t > 1 + 1e-9 || s < -1e-9 || s > 1 + 1e-9) return null

    return {
      lon: p1.lon + t * d1x,
      lat: p1.lat + t * d1y,
      t: Math.max(0, Math.min(1, t)),
      s: Math.max(0, Math.min(1, s))
    }
  }

  /**
   * 切割多边形 (支持折线)
   * @param {Array} ring - 多边形外环坐标 [{lon, lat}, ...]（已闭合）
   * @param {Array} cutLine - 切割线点集 [{lon, lat}, ...]
   * @returns {Array|null} [polyA, polyB] 两个新多边形，或 null（切割失败）
   */
  static splitPolygon(ring, cutLine) {
    if (cutLine.length < 2) return null

    // 1. 计算切割折线与多边形的所有交点
    const intersections = []
    const ringLen = ring.length // ring 是闭合的

    // 遍历切割线的每一段
    for (let i = 0; i < cutLine.length - 1; i++) {
      const p1 = cutLine[i]
      const p2 = cutLine[i + 1]

      // 遍历多边形的每一边
      // ring: 0->1, 1->2 ... (n-2)->(n-1). last is same as first.
      for (let j = 0; j < ringLen - 1; j++) {
        const rp1 = ring[j]
        const rp2 = ring[j + 1]

        const hit = this.lineSegmentIntersection(p1, p2, rp1, rp2)
        if (hit) {
          // 避免重复交点
          const isDuplicate = intersections.some(
            existing => Math.abs(existing.lon - hit.lon) < 1e-9 && Math.abs(existing.lat - hit.lat) < 1e-9
          )
          if (!isDuplicate) {
            intersections.push({
              lon: hit.lon,
              lat: hit.lat,
              cutIndex: i, // 切割线段索引
              cutT: hit.t, // 切割线段上的比例
              ringIndex: j, // 多边形边索引
              ringT: hit.s // 多边形边上的比例 (lineSegmentIntersection 返回的 s 是第二条线段的比例，即 ring 边)
            })
          }
        }
      }
    }

    // 2. 排序交点：按切割线路径顺序
    intersections.sort((a, b) => {
      if (a.cutIndex !== b.cutIndex) return a.cutIndex - b.cutIndex
      return a.cutT - b.cutT
    })

    if (intersections.length < 2) {
      // 尝试延长首尾段再试一次？
      // 如果只有两点，尝试延长
      if (cutLine.length === 2 && intersections.length < 2) {
        const [extA, extB] = this.extendLine(cutLine[0], cutLine[1], 100)
        return this.splitPolygon(ring, [extA, extB]) // 递归调用一次
      }
      return null
    }

    // 取前两个交点作为进出点 (简化模型)
    let int1 = intersections[0]
    let int2 = intersections[intersections.length - 1]

    // 如果有多个交点，通常意味着穿过多次。
    // 为了稳健，我们需要找到一对“进-出”点，使得这两点之间的切割线在多边形内部。
    // 简单起见，如果有多于2个交点，我们取距离最远的一对？或者用户意图就是切成两半。
    // 这里我们假设用户画的线是一刀切，取首尾交点。

    // 确保 int1 在 ring 上的位置先于 int2 (或者处理环绕)
    // 但 ring 是闭环，无所谓先后，只需要确定两段弧。

    // 切割线内部点：从 int1 到 int2 之间的 cutLine 部分
    const innerCutLine = []
    innerCutLine.push({ lon: int1.lon, lat: int1.lat })

    // 添加 int1 和 int2 之间的原始切割点
    for (let i = int1.cutIndex; i <= int2.cutIndex; i++) {
      // 如果是当前段的终点（且不是 int2 所在段，或者 int2 在该段之后），加入
      // 逻辑：
      // 如果 i == int1.cutIndex: 此时我们已经在这一段上，不需要添加 cutLine[i]，因为起点已经在前面或者就是 int1
      // 我们需要添加 cutLine[i+1]，前提是 i < int2.cutIndex

      if (i < int2.cutIndex) {
        innerCutLine.push(cutLine[i + 1])
      }
    }
    innerCutLine.push({ lon: int2.lon, lat: int2.lat })

    // 3. 构建 PolyA
    // 路径：Int1 -> Ring顺时针 -> Int2 -> CutLine逆向 -> Int1
    const polyA = []
    polyA.push({ lon: int1.lon, lat: int1.lat })

    // 沿着 Ring 找：需要判断顺时针跨越是否经过 0 点
    // 简单处理：将 Ring 展平或拼接？
    // 方法：
    // 如果 int1.ringIndex <= int2.ringIndex: 
    //    path = ring[int1.idx+1 ... int2.idx]
    // 如果 int1.ringIndex > int2.ringIndex:
    //    path = ring[int1.idx+1 ... end] + ring[1 ... int2.idx] (注意 ring[0] 是闭合点跳过)

    // 修正 RingIndex 排序逻辑，方便截取
    // 实际上我们需要两条路径：Ring上 Int1->Int2 和 Int2->Int1

    const getRingPath = (startInt, endInt) => {
      const path = []
      let currentIdx = startInt.ringIndex
      const endIdx = endInt.ringIndex

      // 无论是哪种情况，先从 startInt 下一个顶点开始加
      let i = currentIdx + 1

      // 循环直到超过 endIdx (考虑绕圈)
      // 考虑到 ringLen-1 是有效边数
      const maxIdx = ringLen - 1

      while (true) {
        // 归一化索引
        const idx = i % maxIdx
        // 如果绕回来了且已经超过目标... 逻辑有点绕
        // 更简单的方法：模拟行走

        // 如果我们还没到达 end所在的边：
        if (currentIdx === endIdx) {
          // 在同一条边上：如果 startT < endT，则中间没有顶点
          // 如果 startT > endT，说明是绕了一圈？不，同一条边根据交点计算逻辑只能是单向
          // 除非 endInt 其实是下一个周期的。
          break
        }

        // 加入顶点 ring[idx]
        // 注意 ring[idx] 是第 idx 边的终点 (即点 idx+1? 不，点 idx 是起点)
        // 边 j 是 ring[j] -> ring[j+1]
        // 所以我们想要的是 ring[j+1] (即当前边的终点)

        // i 是边的索引。我们想要这条边的终点
        // 边 i 的终点是 i+1
        // 比如 边0 (0->1)，终点是 1
        let vIdx = i
        if (vIdx === ringLen - 1) vIdx = 0 // 闭合点处理: 最后一个点和第一个点重合

        // 实际上直接取 ring[i] 即可，如果 i 到达 ringLen-1 则取 ring[0]... wait
        // 正确逻辑：
        // 边 k: P_k -> P_{k+1}
        // 从 StartInt (在边 S) 到 EndInt (在边 E)
        // 我们需要加入 P_{S+1}, P_{S+2} ... P_{E}

        let vertexIdx = i
        if (vertexIdx >= ringLen - 1) vertexIdx = 0 // 绕回

        // 如果这一轮循环的起始边就是目标边，且还没加过顶点?
        // 简单的 while 循环：

        path.push(ring[vertexIdx])

        if ((i % maxIdx) === endIdx) break
        i++
      }
      return path
    }

    // 为了确定 PolyA 应该包含哪一段 Ring，通常取决于 CutLine 的方向。
    // 我们可以生成两个 Candidate，计算面积/方向？
    // 或者直接：
    // Poly1 = Ring(Int1 -> Int2) + CutLine(Int2 -> Int1)
    // Poly2 = Ring(Int2 -> Int1) + CutLine(Int1 -> Int2)

    // 1. Ring Path 1: Int1 -> ... -> Int2
    // 也就是沿多边形边界顺时针
    // 如果 Int1.ringIndex > Int2.ringIndex，说明跨越了起点

    const ringPath1 = []
    {
      let i = int1.ringIndex + 1
      while (true) {
        let idx = i % (ringLen - 1)
        // 边 idx 的终点是 ring[idx+1]
        // 如果 idx == int2.ringIndex，停止，不加入终点（终点由 int2 替代）
        // 不，应该加。
        // 例子：边0上有I1，边2上有I2。我们需要 P1, P2。
        // i=1 (边1), idx=1. ring[2] 是 P2. 
        // 如果 i 到达 int2.ringIndex (边2)，停止。

        if (idx === int2.ringIndex && i > int1.ringIndex) break
        // 注意：如果 int1 和 int2 在同一条边...
        if (int1.ringIndex === int2.ringIndex && int1.ringT < int2.ringT) break

        // 特殊情况：跨越起点
        if (i !== int1.ringIndex + 1 && idx === int2.ringIndex) break

        ringPath1.push(ring[idx]) // 这里的逻辑太绕了

        i++
        // 安全限制
        if (i > int1.ringIndex + ringLen + 5) break
      }
    }

    // 重新实现简单的 Ring 截取
    const getRingPoints = (startIdx, startT, endIdx, endT) => {
      const pts = []
      // 如果是在同一条边且 T 递增
      if (startIdx === endIdx && endT > startT) {
        return []
      }

      let curr = startIdx + 1
      while (true) {
        let idx = curr % (ringLen - 1)
        if (idx === 0 && curr !== 0) {
          // 刚刚绕过末尾
        }

        if (idx === endIdx) break

        // 添加顶点 idx (边 idx-1 的终点? 不，边 idx 的起点)
        // 边 j 是 ring[j] -> ring[j+1]
        // 我们在边 startIdx 之后，所以下一个顶点是 ring[startIdx+1]
        // 也就是 ring[curr] ? 

        // 举例：Poly [0,1,2,3,0]. 边0(0-1), 边1(1-2), 边2(2-3), 边3(3-0).
        // Start在边0. End在边2.
        //curr=1. idx=1. 目标是2. 
        // 加入 ring[1] (P1). 
        // curr=2. idx=2. break.
        // 得到 [P1]. 正确。需要 P1, P2. 漏了 P2. 

        // 修正：应该加入 ring[idx]
        pts.push(ring[idx])
        curr++
      }
      return pts
    }

    // 正确的 Ring 提取逻辑：
    // 从 Int1 沿着 Ring 走到 Int2
    // 1. Int1
    // 2. 边 Int1.idx 的终点 (即 ring[Int1.idx + 1])，直到 边 Int2.idx 的起点 (ring[Int2.idx])
    // 3. Int2

    const extractRingSegment = (rIdx1, rIdx2) => {
      const segment = []
      let i = rIdx1 + 1
      while (true) {
        let idx = i % (ringLen - 1)
        // 如果已经到达 rIdx2 所在的边，停止（不需要加起点了，也不需要加终点，因为终点单独加）
        if (idx === rIdx2 && i > rIdx1) break
        // 如果绕了一圈还没停？ (即 rIdx1 == rIdx2)
        if (rIdx1 === rIdx2 && i > rIdx1 + ringLen) break

        // 对于边 idx，其起点是 ring[idx]
        segment.push(ring[idx])

        // 如果 rIdx2 < rIdx1，我们会经过 0。
        // i 会一直增加。
        if (idx === rIdx2) break // 防御
        i++
      }
      return segment
    }

    // 使用新逻辑 PolyA
    // 1. Int1
    polyA.push({ lon: int1.lon, lat: int1.lat })
    // 2. Ring Segment from Int1 to Int2
    {
      let i = int1.ringIndex + 1
      const maxIter = ringLen * 2
      let iter = 0
      while (iter < maxIter) {
        let idx = i % (ringLen - 1)
        if (idx === int2.ringIndex) break
        polyA.push(ring[idx])
        i++
        iter++
      }
      // 如果跨域了 0，且 int2Index < int1Index，或者是顺时针路径
      // 上面的循环会把中间的顶点都加上。
      // 最后加上 int2 所在边的起点 ring[int2.idx] (如果它不是 int1 所在边的终点)
      if (i > int1.ringIndex + 1 || int2.ringIndex !== int1.ringIndex) {
        polyA.push(ring[int2.ringIndex])
      }
    }
    // 3. Int2
    polyA.push({ lon: int2.lon, lat: int2.lat })
    // 4. CutLine reversed (Int2 -> Int1)
    for (let k = innerCutLine.length - 2; k > 0; k--) {
      polyA.push(innerCutLine[k])
    }
    // 5. Close (Int1 is already at start, but polygon should limit repeat)
    // PolyA push int1 at end?
    // 上面的 innerCutLine 包含了 int1 和 int2.
    // reverse 后：int2(skip), pts..., int1(skip)
    // 最后 polyA 需要闭合吗？ GeoJSON 需要首尾一致。
    polyA.push({ lon: int1.lon, lat: int1.lat })

    // 构建 PolyB
    // 路径：Int2 -> Ring顺时针 -> Int1 -> CutLine顺向 -> Int2
    const polyB = []
    polyB.push({ lon: int2.lon, lat: int2.lat })
    // Ring Segment from Int2 to Int1
    {
      let i = int2.ringIndex + 1
      const maxIter = ringLen * 2
      let iter = 0
      while (iter < maxIter) {
        let idx = i % (ringLen - 1)
        if (idx === int1.ringIndex) break
        polyB.push(ring[idx])
        i++
        iter++
      }
      if (i > int2.ringIndex + 1 || int1.ringIndex !== int2.ringIndex) {
        polyB.push(ring[int1.ringIndex])
      }
    }
    polyB.push({ lon: int1.lon, lat: int1.lat })
    // CutLine forward (Int1 -> Int2)
    // innerCutLine: [Int1, p1, p2, ..., Int2]
    for (let k = 1; k < innerCutLine.length - 1; k++) {
      polyB.push(innerCutLine[k])
    }
    // Close
    polyB.push({ lon: int2.lon, lat: int2.lat })

    // 验证有效性
    if (polyA.length < 4 || polyB.length < 4) return null

    return [polyA, polyB]
  }

  /**
   * 将切割线延长 (仅直线情况使用)
   */
  static extendLine(p1, p2, factor = 100) {
    const dx = p2.lon - p1.lon
    const dy = p2.lat - p1.lat
    return [
      { lon: p1.lon - dx * factor, lat: p1.lat - dy * factor },
      { lon: p2.lon + dx * factor, lat: p2.lat + dy * factor }
    ]
  }

  /**
   * 判断某点是否在多边形内（射线法）
   */
  static pointInPolygon(point, ring) {
    let inside = false
    const n = ring.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[i].lon, yi = ring[i].lat
      const xj = ring[j].lon, yj = ring[j].lat
      if (((yi > point.lat) !== (yj > point.lat)) &&
        (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    return inside
  }
}
