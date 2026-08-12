/**
 * SweetDream
 * Database Loader
 */

import { getDatabaseUrl, getDatabaseNames } from "./databaseConfig.js";

export class DatabaseLoader {
    constructor() {
        this.cache = new Map();
    }

    /**
     * 加载指定数据库
     */
    async load(databaseName, forceReload = false) {
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
                `[DatabaseLoader] 无法访问数据库：${databaseName}\nURL: ${url}\n${error.message}`
            );
        }

        if (!response.ok) {
            throw new Error(`[DatabaseLoader] 数据库加载失败：${databaseName} (HTTP ${response.status})`);
        }

        let data;
        try {
            data = await response.json();
        } catch (error) {
            throw new Error(`[DatabaseLoader] JSON解析失败：${databaseName}\n${error.message}`);
        }

        this.cache.set(databaseName, data);
        return data;
    }

    /**
     * 一次加载多个数据库
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
        // 直接使用文件顶部静态引入的 getDatabaseNames 提升效率
        return this.loadMany(getDatabaseNames());
    }

    has(databaseName) {
        return this.cache.has(databaseName);
    }

    getCached(databaseName) {
        return this.cache.get(databaseName);
    }

    clear(databaseName) {
        if (databaseName) {
            this.cache.delete(databaseName);
            return;
        }
        this.cache.clear();
    }
}
