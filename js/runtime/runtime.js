/**
 * SweetDream
 * Game Runtime Engine
 * 
 * 核心逻辑运算引擎。
 * 负责接收行为、读取规则、处理乘数、执行校验、变更状态并驱动剧情。
 */

import { eventBus } from "./eventBus.js";
import { stateManager } from "./stateManager.js";
import { DatabaseManager } from "../database/databaseManager.js";

class GameRuntime {
    constructor() {
        this.db = new DatabaseManager();
        this.activeMedicines = []; // 当前运行中生效的药剂 Buff
    }

    /**
     * 引擎启动，关联事件源
     */
    async initialize() {
        await this.db.initialize();
        
        // 绑定事件：当用户在前台触发动作时
        eventBus.on("action:trigger", async (payload) => {
            await this.handleActionExecute(payload.actionId, payload.options);
        });

        console.log("[GameRuntime] 运行时计算引擎初始化完成，事件总线已接通");
    }

    /**
     * 执行动作决策树
     */
    async handleActionExecute(actionId, options = {}) {
        const player = stateManager.getPlayer();
        const controller = stateManager.getController();

        if (!player || !controller) {
            console.error("[Runtime] 核心状态缺失，无法执行动作。");
            return;
        }

        // 1. 获取动作静态数据
        const action = await this.db.findById("actions", actionId);
        if (!action) {
            console.error(`[Runtime] 动作不存在: ${actionId}`);
            return;
        }

        // 2. 安全规则验证：排斥项过滤 (Rejected Content Protection)
        const isBypassed = controller.activePermissions?.includes("ignore_target_rejections_24h");
        if (action.safety?.blockedByRejectedContent && !isBypassed) {
            const rejectedTags = player.limits?.items || [];
            const actionTags = action.otherVariables?.tags || [];
            
            // 如果动作带有玩家排斥的标签，予以无声拦截并发出弹窗警告
            const conflict = actionTags.some(tag => rejectedTags.includes(tag));
            if (conflict) {
                eventBus.emit("action:blocked", { actionId, reason: "rejected_content" });
                return;
            }
        }

        // 3. 计算高潮度基础值与叠乘
        let baseOrgasm = action.effects?.orgasmValue?.value || 0;
        let orgasmMultiplier = 1.0;

        if (options.targetPartSensitive) orgasmMultiplier *= 1.5; // 命中特异敏感点
        if (options.highGear) orgasmMultiplier *= 2.0;            // 玩具开至最高档
        if (this.isMedicineActive("med_sensitive")) orgasmMultiplier *= 2.0; // 敏感药增效

        const finalOrgasmGain = baseOrgasm * orgasmMultiplier;

        // 4. 计算苏醒度基础值与叠乘
        let baseWake = action.effects?.wakeValue?.value || 0;
        let wakeMultiplier = 1.0;

        if (player.psychology?.shame === "容易羞耻") wakeMultiplier *= 1.4;
        if (options.isPublicScene) wakeMultiplier *= 2.0;
        if (this.isMedicineActive("med_sleep")) wakeMultiplier *= 0.2; // 安眠药降低苏醒增速

        const finalWakeGain = baseWake * wakeMultiplier;

        // 5. 应用状态机推演
        let currentOrgasm = controller.orgasmValue || 0;
        let currentWake = controller.wakeValue || 0;

        let nextOrgasm = Math.min(100, currentOrgasm + finalOrgasmGain);
        let nextWake = Math.min(100, currentWake + finalWakeGain);

        // 6. 存储计算结果
        await stateManager.saveControllerState({
            orgasmValue: nextOrgasm,
            wakeValue: nextWake
        });

        // 广播动作处理结果，用于前端 UI 特效渲染
        eventBus.emit("action:resolved", {
            actionId,
            orgasmAdded: finalOrgasmGain,
            wakeAdded: finalWakeGain,
            currentOrgasm: nextOrgasm,
            currentWake: nextWake
        });

        // 7. 触顶临界判定
        if (nextWake >= 100) {
            await this.processTargetWakeUp();
        } else if (nextOrgasm >= 100) {
            await this.processTargetClimax();
        }
    }

    /**
     * 判断某种药水效果当前是否依然在时效内
     */
    isMedicineActive(medicineId) {
        const med = this.activeMedicines.find(m => m.id === medicineId);
        return med ? med.durationRemaining > 0 : false;
    }

    /**
     * 结算强制高潮：高潮值清零，Controller 经验+100并进行等级判定
     */
    async processTargetClimax() {
        const controller = stateManager.getController();
        const baseRule = await this.db.get("controller"); // 读取静态等级规则表
        
        let currentLevel = controller.controllerLevel || 1;
        let currentXp = controller.controllerExperience || 0;
        
        let newXp = currentXp + 100;
        let newLevel = currentLevel;

        if (newXp >= 100) {
            newLevel = Math.min(baseRule.staticRules?.levelSystem?.hardMaxLevel || 25, currentLevel + 1);
            newXp = newXp - 100;
            eventBus.emit("controller:levelup", { level: newLevel });
        }

        await stateManager.saveControllerState({
            orgasmValue: 0,
            controllerLevel: newLevel,
            controllerExperience: newXp
        });

        eventBus.emit("climax:triggered", { level: newLevel, xp: newXp });
    }

    /**
     * 结算苏醒惊醒：控制中断，数据清零并重置回初始默认场景
     */
    async processTargetWakeUp() {
        await stateManager.saveControllerState({
            orgasmValue: 0,
            wakeValue: 0,
            currentScene: "scene_bedroom"
        });

        eventBus.emit("target:woken", { reason: "wake_value_full" });
    }
}

// 导出全局单例
export const gameRuntime = new GameRuntime();
