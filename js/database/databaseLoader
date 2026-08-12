/**
 * SweetDream
 * Database Loader
 *
 * 负责从静态 JSON 文件读取数据库。
 *
 * Loader 本身不负责：
 * - 游戏状态
 * - AI
 * - UI
 * - XP计算
 * - 等级计算
 *
 * 它只负责“把 JSON 读进来”。
 */

import { getDatabaseUrl } from "./databaseConfig.js";


export class DatabaseLoader {

    constructor() {
        this.cache = new Map();
    }


    /**
     * 加载指定数据库
     *
     * @param {string} databaseName
     * @param {boolean} forceReload
     * @returns {Promise<any>}
     */
    async load(databaseName, forceReload = false) {

        // 如果已经加载过，直接使用缓存
        if (!forceReload && this.cache.has(databaseName)) {
            return this.cache.get(databaseName);
        }

        const url = getDatabaseUrl(databaseName);

        let response;

        try {
            response = await fetch(url, {
                method: "GET",
                cache: "no-cache"
            });
        } catch (error) {

            throw new Error(
                `[DatabaseLoader] 无法访问数据库：${databaseName}\n` +
                `URL: ${url}\n` +
                `${error.message}`
            );
        }


        if (!response.ok) {

            throw new Error(
                `[DatabaseLoader] 数据库加载失败：${databaseName}\n` +
                `HTTP ${response.status}`
            );
        }


        let data;

        try {
            data = await response.json();
        } catch (error) {

            throw new Error(
                `[DatabaseLoader] JSON解析失败：${databaseName}\n` +
                `${error.message}`
            );
        }


        // 保存到内存缓存
        this.cache.set(databaseName, data);

        return data;
    }


    /**
     * 一次加载多个数据库
     *
     * @param {string[]} databaseNames
     */
    async loadMany(databaseNames) {

        const results = {};

        await Promise.all(
            databaseNames.map(async (name) => {
                results[name] = await this.load(name);
            })
        );

        return results;
    }


    /**
     * 加载全部数据库
     */
    async loadAll() {

        const { getDatabaseNames } = await import("./databaseConfig.js");

        return this.loadMany(
            getDatabaseNames()
        );
    }


    /**
     * 判断某数据库是否已经加载
     */
    has(databaseName) {
        return this.cache.has(databaseName);
    }


    /**
     * 获取已经加载的数据
     */
    getCached(databaseName) {
        return this.cache.get(databaseName);
    }


    /**
     * 清除指定缓存
     */
    clear(databaseName) {

        if (databaseName) {
            this.cache.delete(databaseName);
            return;
        }

        this.cache.clear();
    }
}
