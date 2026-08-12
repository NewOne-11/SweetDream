/**
 * SweetDream
 * State Manager
 * 
 * 负责游戏动态运行时状态（玩家存档、Controller状态、剧情线）的本地持久化。
 */

import { eventBus } from "./eventBus.js";

export class StateManager {
    constructor() {
        this.db = null;
        this.dbName = "SweetDream_RuntimeState";
        this.dbVersion = 1;
        
        // 内存中的状态缓存，避免高频 I/O 带来的卡顿
        this.state = {
            playerProfile: null,     // 玩家角色信息
            controllerState: null,   // 操控者当前状态 (orgasmValue, wakeValue, level等)
            progressionState: null   // 成长与剧情阶段状态 (corruption, awakening)
        };
    }

    /**
     * 初始化运行时数据库并加载数据
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 创建运行时状态表
                if (!db.objectStoreNames.contains("playerProfile")) {
                    db.createObjectStore("playerProfile", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("controllerState")) {
                    db.createObjectStore("controllerState", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("progressionState")) {
                    db.createObjectStore("progressionState", { keyPath: "id" });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                try {
                    // 尝试加载现有存档入内存
                    await this.loadAllStatesFromDisk();
                    console.log("[StateManager] 动态运行时状态加载成功");
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 将磁盘数据读入内存缓存
     */
    async loadAllStatesFromDisk() {
        this.state.playerProfile = await this._getDiskData("playerProfile", "main_player") || null;
        this.state.controllerState = await this._getDiskData("controllerState", "active_controller") || null;
        this.state.progressionState = await this._getDiskData("progressionState", "active_progression") || null;
    }

    /**
     * 更新并保存玩家设定
     */
    async savePlayerProfile(profile) {
        const data = { id: "main_player", ...profile };
        await this._writeDiskData("playerProfile", data);
        this.state.playerProfile = data;
        eventBus.emit("state:player:changed", data);
    }

    /**
     * 更新并保存操控者实时状态
     */
    async saveControllerState(stateUpdates) {
        const updated = { 
            id: "active_controller", 
            ...(this.state.controllerState || {}), 
            ...stateUpdates 
        };
        await this._writeDiskData("controllerState", updated);
        this.state.controllerState = updated;
        eventBus.emit("state:controller:changed", updated);
    }

    /**
     * 更新并保存成长线与剧情进度
     */
    async saveProgressionState(stateUpdates) {
        const updated = { 
            id: "active_progression", 
            ...(this.state.progressionState || {}), 
            ...stateUpdates 
        };
        await this._writeDiskData("progressionState", updated);
        this.state.progressionState = updated;
        eventBus.emit("state:progression:changed", updated);
    }

    // 内存获取捷径
    getPlayer() { return this.state.playerProfile; }
    getController() { return this.state.controllerState; }
    getProgression() { return this.state.progressionState; }

    /* ---------------- 内部 IndexedDB 原生读写封装 ---------------- */
    _getDiskData(storeName, id) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, "readonly");
                const store = transaction.objectStore(storeName);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    }

    _writeDiskData(storeName, data) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, "readwrite");
                const store = transaction.objectStore(storeName);
                const request = store.put(data);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    }
}

// 导出全局单例
export const stateManager = new StateManager();
