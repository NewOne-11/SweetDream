/**
 * SweetDream
 * Database Manager
 */

import { DatabaseLoader } from "./databaseLoader.js";

export class DatabaseManager {
    constructor() {
        this.loader = new DatabaseLoader();
        this.initialized = false;
        this.loadedDatabases = new Set();
    }

    async initialize() {
        this.initialized = true;
        console.log("[DatabaseManager] 静态数据库系统就绪");
        return true;
    }

    async get(databaseName) {
        this.ensureInitialized();
        const data = await this.loader.load(databaseName);
        this.loadedDatabases.add(databaseName);
        return data;
    }

    async getMany(databaseNames) {
        this.ensureInitialized();
        const data = await this.loader.loadMany(databaseNames);
        databaseNames.forEach(name => this.loadedDatabases.add(name));
        return data;
    }

    async preloadAll() {
        this.ensureInitialized();
        const data = await this.loader.loadAll();
        Object.keys(data).forEach(name => this.loadedDatabases.add(name));
        console.log("[DatabaseManager] 静态全库预缓存完成");
        return data;
    }

    /**
     * 增强版跨库 ID 查找方法
     */
    async findById(databaseName, id) {
        const database = await this.get(databaseName);
        return this.searchById(database, id, databaseName);
    }

    /**
     * 核心改进：深度解析特定数据库的嵌套数据结构
     */
    searchById(data, id, databaseName = "") {
        if (!data) return null;

        // 如果已经是扁平数组，直接检索
        if (Array.isArray(data)) {
            return data.find(item => item && item.id === id) || null;
        }

        // 针对不同静态库结构的定制化深度匹配
        switch (databaseName) {
            case "tasks":
                // 1. 检索 initialPool 数组
                if (data.initialPool?.tasks) {
                    const task = data.initialPool.tasks.find(t => t.id === id);
                    if (task) return task;
                }
                // 2. 检索 starPools 的各个子级
                if (data.starPools) {
                    for (const starKey in data.starPools) {
                        const tasks = data.starPools[starKey]?.tasks;
                        if (Array.isArray(tasks)) {
                            const task = tasks.find(t => t.id === id);
                            if (task) return task;
                        }
                    }
                }
                break;

            case "items":
                // items 结构为 { items: { equipment: [], clothing: [] } }
                if (data.items && typeof data.items === "object") {
                    for (const categoryKey in data.items) {
                        const items = data.items[categoryKey];
                        if (Array.isArray(items)) {
                            const item = items.find(i => i.id === id);
                            if (item) return item;
                        }
                    }
                }
                break;

            case "scenes":
                // scenes 结构为 { scenes: [ ... ] }
                if (Array.isArray(data.scenes)) {
                    return data.scenes.find(s => s.id === id) || null;
                }
                break;

            case "actions":
                // actions 结构为 { actions: [ ... ] }
                if (Array.isArray(data.actions)) {
                    return data.actions.find(a => a.id === id) || null;
                }
                break;

            case "rewards":
            case "penalties":
                // 奖励和惩罚结构存在于 pools.[star_x].rewards/penalties 中
                if (data.pools) {
                    for (const poolKey in data.pools) {
                        const list = data.pools[poolKey]?.rewards || data.pools[poolKey]?.penalties;
                        if (Array.isArray(list)) {
                            const found = list.find(x => x.id === id);
                            if (found) return found;
                        }
                    }
                }
                break;
        }

        // 兜底通用搜索机制
        if (Array.isArray(data.items)) return data.items.find(i => i?.id === id) || null;
        if (Array.isArray(data.tasks)) return data.tasks.find(t => t?.id === id) || null;

        if (typeof data === "object" && Object.prototype.hasOwnProperty.call(data, id)) {
            return data[id];
        }

        return null;
    }

    /**
     * 统一条件筛选方法
     */
    async query(databaseName, conditions = {}) {
        const database = await this.get(databaseName);
        const collection = this.normalizeCollection(database, databaseName);

        return collection.filter(item => {
            if (!item || typeof item !== "object") return false;
            return Object.entries(conditions).every(([key, expectedValue]) => {
                return item[key] === expectedValue;
            });
        });
    }

    /**
     * 核心改进：针对多层级复杂数据展开为扁平数组，供查询校验器（Query）使用
     */
    normalizeCollection(data, databaseName = "") {
        if (!data) return [];
        if (Array.isArray(data)) return data;

        const results = [];

        // 依据数据特性执行扁平合并
        if (databaseName === "items" && data.items) {
            Object.values(data.items).forEach(categoryList => {
                if (Array.isArray(categoryList)) results.push(...categoryList);
            });
            return results;
        }

        if (databaseName === "tasks") {
            if (data.initialPool?.tasks) results.push(...data.initialPool.tasks);
            if (data.starPools) {
                Object.values(data.starPools).forEach(pool => {
                    if (Array.isArray(pool?.tasks)) results.push(...pool.tasks);
                });
            }
            return results;
        }

        if (databaseName === "scenes" && Array.isArray(data.scenes)) {
            return data.scenes;
        }

        if (databaseName === "actions" && Array.isArray(data.actions)) {
            return data.actions;
        }

        if ((databaseName === "rewards" || databaseName === "penalties") && data.pools) {
            Object.values(data.pools).forEach(pool => {
                const list = pool?.rewards || pool?.penalties;
                if (Array.isArray(list)) results.push(...list);
            });
            return results;
        }

        // 兜底降级处理
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.tasks)) return data.tasks;

        if (typeof data === "object") {
            return Object.entries(data).map(([id, value]) => {
                if (value && typeof value === "object" && !Array.isArray(value)) {
                    return { id, ...value };
                }
                return { id, value };
            });
        }

        return [];
    }

    isInitialized() {
        return this.initialized;
    }

    getLoadedDatabases() {
        return [...this.loadedDatabases];
    }

    clearCache(databaseName = null) {
        this.loader.clear(databaseName);
        if (databaseName) {
            this.loadedDatabases.delete(databaseName);
        } else {
            this.loadedDatabases.clear();
        }
    }

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error("[DatabaseManager] 数据库尚未初始化，请先调用 initialize()");
        }
    }
}
