/**
 * 本地数据存储管理器
 * 使用 localStorage 持久化地图编辑数据
 */
const STORAGE_KEY = 'map-editor-data'

export class DataStore {
    constructor() {
        this._saveTimer = null
        this._debounceMs = 500
    }

    /**
     * 保存数据到 localStorage
     */
    save(data) {
        try {
            const serialized = JSON.stringify({
                version: 1,
                timestamp: Date.now(),
                features: data.features || [],
                markers: data.markers || [],
                viewState: data.viewState || null
            })
            localStorage.setItem(STORAGE_KEY, serialized)
            return true
        } catch (e) {
            console.warn('DataStore: 保存失败', e)
            return false
        }
    }

    /**
     * 延迟保存（防抖）
     */
    debounceSave(data) {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer)
        }
        this._saveTimer = setTimeout(() => {
            this.save(data)
        }, this._debounceMs)
    }

    /**
     * 从 localStorage 加载数据
     */
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return null

            const data = JSON.parse(raw)
            if (data.version !== 1) return null

            return {
                features: data.features || [],
                markers: data.markers || [],
                viewState: data.viewState || null,
                timestamp: data.timestamp
            }
        } catch (e) {
            console.warn('DataStore: 加载失败', e)
            return null
        }
    }

    /**
     * 检查是否有已保存的数据
     */
    hasSavedData() {
        return localStorage.getItem(STORAGE_KEY) !== null
    }

    /**
     * 清除已保存的数据
     */
    clear() {
        localStorage.removeItem(STORAGE_KEY)
    }

    /**
     * 销毁
     */
    destroy() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer)
        }
    }
}
