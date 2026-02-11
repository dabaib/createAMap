/**
 * GeoJSON 解析器
 * 负责解析 GeoJSON 数据并转换坐标
 */
export class GeoJsonParser {
  constructor() {
    this.features = []
    this.bounds = null
  }

  /**
   * 解析 GeoJSON 数据
   */
  parse(geojson) {
    if (!geojson || !geojson.features) {
      throw new Error('无效的GeoJSON数据')
    }

    this.features = geojson.features.map((feature, index) => ({
      id: feature.properties?.adcode || feature.properties?.id || `region_${index}`,
      name: feature.properties?.name || `区域 ${index + 1}`,
      properties: { ...feature.properties },
      geometry: this.parseGeometry(feature.geometry),
      visible: true,
      selected: false,
      color: this.generateColor(index)
    }))

    this.bounds = this.calculateBounds()
    return {
      features: this.features,
      bounds: this.bounds
    }
  }

  /**
   * 解析几何数据（支持 Polygon, MultiPolygon, Point, MultiPoint）
   */
  parseGeometry(geometry) {
    if (!geometry) return null

    const type = geometry.type
    let coordinates = []

    if (type === 'Polygon') {
      coordinates = geometry.coordinates.map(ring =>
        ring.map(coord => ({ lon: coord[0], lat: coord[1] }))
      )
    } else if (type === 'MultiPolygon') {
      coordinates = geometry.coordinates.map(polygon =>
        polygon.map(ring =>
          ring.map(coord => ({ lon: coord[0], lat: coord[1] }))
        )
      )
    } else if (type === 'Point') {
      coordinates = { lon: geometry.coordinates[0], lat: geometry.coordinates[1] }
    } else if (type === 'MultiPoint') {
      coordinates = geometry.coordinates.map(coord => ({ lon: coord[0], lat: coord[1] }))
    }

    return { type, coordinates }
  }

  /**
   * 计算边界范围
   */
  calculateBounds() {
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    this.features.forEach(feature => {
      const coords = this.flattenCoordinates(feature.geometry)
      coords.forEach(({ lon, lat }) => {
        minLon = Math.min(minLon, lon)
        maxLon = Math.max(maxLon, lon)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      })
    })

    return { minLon, maxLon, minLat, maxLat }
  }

  /**
   * 展平坐标数组
   */
  flattenCoordinates(geometry) {
    if (!geometry) return []

    const coords = []
    const flatten = (arr) => {
      if (arr && arr.lon !== undefined) {
        coords.push(arr)
      } else if (Array.isArray(arr)) {
        arr.forEach(flatten)
      }
    }
    flatten(geometry.coordinates)
    return coords
  }

  /**
   * 生成区域颜色
   */
  generateColor(index) {
    const colors = [
      '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
      '#dfe6e9', '#74b9ff', '#a29bfe', '#fd79a8',
      '#00b894', '#e17055', '#6c5ce7', '#fdcb6e'
    ]
    return colors[index % colors.length]
  }

  /**
   * 导出为 GeoJSON
   */
  static exportFeaturesToGeoJson(features) {
    return {
      type: 'FeatureCollection',
      features: features.map(feature => ({
        type: 'Feature',
        properties: {
          name: feature.name,
          ...feature.properties
        },
        geometry: GeoJsonParser.geometryToGeoJson(feature.geometry)
      }))
    }
  }

  /**
   * 转换几何数据回 GeoJSON 格式
   */
  static geometryToGeoJson(geometry) {
    if (!geometry) return null

    const convertCoords = (coords) => {
      if (coords && coords.lon !== undefined) {
        return [coords.lon, coords.lat]
      }
      if (Array.isArray(coords)) {
        return coords.map(convertCoords)
      }
      return coords
    }

    return {
      type: geometry.type,
      coordinates: convertCoords(geometry.coordinates)
    }
  }
}
