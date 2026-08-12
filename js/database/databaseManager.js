/**
 * SweetDream
 * Database Manager
 *
 * 静态数据库的统一访问层。
 *
 * 其他模块原则上不要直接 fetch JSON，
 * 全部通过 DatabaseManager 获取数据。
 */

import { DatabaseLoader } from "./databaseLoader.js";


export class DatabaseManager {

    constructor() {

        this.loader = new DatabaseLoader();

        this.initialized = false;

        this.loadedDatabases = new Set();
    }


    /**
     * 初始化数据库系统
     *
     * 默认不立即加载全部数据库。
     * 采用按需加载。
     */
    async initialize() {

        this.initialized = true;

        console.log(
            "[DatabaseManager] 数据库系统初始化完成"
        );

        return true;
    }


    /**
     * 获取数据库
     *
     * 示例：
     *
     * const tasks = await database.get("tasks");
     */
    async get(databaseName) {

        this.ensureInitialized();

        const data = await this.loader.load(databaseName);

        this.loadedDatabases.add(databaseName);

        return data;
    }


    /**
     * 获取多个数据库
     */
    async getMany(databaseNames) {

        this.ensureInitialized();

        const data = await this.loader.loadMany(
            databaseNames
        );

        databaseNames.forEach(name => {
            this.loadedDatabases.add(name);
        });

        return data;
    }


    /**
     * 加载全部数据库
     *
     * 游戏启动时如果希望一次性加载，
     * 可以调用这个方法。
     */
    async preloadAll() {

        this.ensureInitialized();

        const data = await this.loader.loadAll();

        Object.keys(data).forEach(name => {
            this.loadedDatabases.add(name);
        });

        console.log(
            "[DatabaseManager] 所有静态数据库加载完成"
        );

        return data;
    }


    /**
     * 根据 ID 查找数据
     *
     * 适用于：
     *
     * tasks
     * items
     * scenes
     * actions
     * rewards
     * penalties
     *
     * 但具体数据结构还没有统一时，
     * 这里做一个兼容性查询。
     */
    async findById(databaseName, id) {

        const database = await this.get(databaseName);

        return this.searchById(database, id);
    }


    /**
     * 通用 ID 搜索
     */
    searchById(data, id) {

        if (!data) {
            return null;
        }


        // 情况1：
        // 数据库本身就是数组
        //
        // [
        //   { id: "task_001" }
        // ]
        if (Array.isArray(data)) {

            return data.find(
                item => item && item.id === id
            ) || null;
        }


        // 情况2：
        // { items: [...] }
        if (Array.isArray(data.items)) {

            return data.items.find(
                item => item && item.id === id
            ) || null;
        }


        // 情况3：
        // { tasks: [...] }
        if (Array.isArray(data.tasks)) {

            return data.tasks.find(
                item => item && item.id === id
            ) || null;
        }


        // 情况4：
        // {
        //   task_001: {...},
        //   task_002: {...}
        // }
        if (
            typeof data === "object" &&
            Object.prototype.hasOwnProperty.call(data, id)
        ) {
            return data[id];
        }


        return null;
    }


    /**
     * 根据条件筛选
     *
     * 示例：
     *
     * database.query("tasks", {
     *     level: 5
     * });
     */
    async query(databaseName, conditions = {}) {

        const database = await this.get(databaseName);

        const collection = this.normalizeCollection(database);

        return collection.filter(item => {

            if (!item || typeof item !== "object") {
                return false;
            }

            return Object.entries(conditions)
                .every(([key, expectedValue]) => {

                    return item[key] === expectedValue;

                });

        });
    }


    /**
     * 将不同形式的数据结构转换为数组
     */
    normalizeCollection(data) {

        if (!data) {
            return [];
        }


        if (Array.isArray(data)) {
            return data;
        }


        if (Array.isArray(data.items)) {
            return data.items;
        }


        if (Array.isArray(data.tasks)) {
            return data.tasks;
        }


        if (Array.isArray(data.scenes)) {
            return data.scenes;
        }


        if (Array.isArray(data.actions)) {
            return data.actions;
        }


        if (typeof data === "object") {

            return Object.entries(data)
                .map(([id, value]) => {

                    if (
                        value &&
                        typeof value === "object" &&
                        !Array.isArray(value)
                    ) {
                        return {
                            id,
                            ...value
                        };
                    }

                    return {
                        id,
                        value
                    };
                });
        }


        return [];
    }


    /**
     * 判断数据库系统是否初始化
     */
    isInitialized() {
        return this.initialized;
    }


    /**
     * 查看已经加载的数据库
     */
    getLoadedDatabases() {
        return [...this.loadedDatabases];
    }


    /**
     * 清除缓存
     */
    clearCache(databaseName = null) {

        this.loader.clear(databaseName);

        if (databaseName) {
            this.loadedDatabases.delete(databaseName);
        } else {
            this.loadedDatabases.clear();
        }
    }


    /**
     * 内部状态检查
     */
    ensureInitialized() {

        if (!this.initialized) {

            throw new Error(
                "[DatabaseManager] 数据库尚未初始化，请先调用 initialize()"
            );
        }
    }
}
