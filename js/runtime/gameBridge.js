/**
 * SweetDream - Game Reactive Bridge
 * 
 * 核心桥接器：利用 StateManager 的订阅机制 (subscribe)，
 * 在运行时状态变更时，自动进行 IndexedDB 持久化与 UI 重绘。
 */

import { stateManager } from "./stateManager.js";
import { eventBus } from "./eventBus.js";
import { databaseManager } from "../database/databaseManager.js";
import { appRenderer } from "./appRenderer.js";

class GameBridge {
    constructor() {
        this.unsubscribe = null;
    }

    /**
     * 绑定监听线
     */
    initialize() {
        // 订阅 stateManager 唯一状态树的变化
        this.unsubscribe = stateManager.subscribe((event, currentState) => {
            console.log(`[GameBridge] 检测到变量更新 [${event.type}]:`, event);

            // 1. 自动执行持久化：保存当前状态快照到 IndexedDB 的各个表空间
            this.autoSaveToDisk(currentState);

            // 2. 自动重绘 UI：当任何数值变化时，自动通知界面重新渲染 ASCII 面板
            this.autoRedrawUI(currentState);
        });

        console.log("[GameBridge] 动态状态订阅通道已连接，运行时变量自动同步已生效。");
    }

    /**
     * 自动存档：将当前内存状态写入本地持久层 IndexedDB
     */
    async autoSaveToDisk(state) {
        try {
            // 将双值、物品等核心状态写入 controllerState
            await databaseManager.put("controllerState", {
                id: "active_controller",
                controllerLevel: state.controllerLevel,
                controllerExperience: state.controllerExperience,
                orgasmValue: state.orgasmValue,
                wakeValue: state.wakeValue,
                currentScene: state.currentScene,
                currentTaskId: state.currentTaskId,
                inventory: state.inventory,
                controllerProfile: state.controllerProfile
            });

            // 将成长线数据写入 progressionState
            await databaseManager.put("progressionState", {
                id: "active_progression",
                corruption: state.currentProgress?.corruption || 10,
                awakening: state.targetAwareness || 0,
                completedTasks: state.completedTasks
            });
        } catch (error) {
            console.error("[GameBridge] 状态自动写入磁盘失败:", error);
        }
    }

    /**
     * 自动绘制：在任何数值产生轻微变动时，实时渲染最干净、对齐的 ASCII 面板
     */
    autoRedrawUI(state) {
        // 动态根据 playerProfile 和当前内存数据渲染出 Target 面板
        const asciiUI = appRenderer.render(state);
        
        // 投递更新信号
        eventBus.emit("ui:app:redraw", asciiUI);
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

export const gameBridge = new GameBridge();
