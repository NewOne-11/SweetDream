/**
 * StateManager
 * --------------------------------------------------
 * 游戏运行时状态管理器 (中间变量储存结构)
 *
 * 职责：
 * 1. 管理当前游戏状态
 * 2. 提供 get / set / patch
 * 3. 自动校验部分变量范围（已增强路径归一化拦截）
 * 4. 监听状态变化
 * 5. 提供状态快照
 */

export class StateManager {

    constructor(initialState = {}) {

        // ==================================================
        // 1. 默认运行时状态（已补全与 9 项静态配置库对应的运行期动态变量）
        // ==================================================

        this.defaultState = {

            // ---------- 1. 目标(被操控者)个人信息面板 (player_schema.json) ----------
            playerProfile: {
                id: "main_player",
                name: "未命名",
                age: 22,
                gender: "女",
                rolePreference: "被支配方(Sub/M)",
                shame: "中等",
                areas: [],
                triggers: [],
                limits: { items: [], custom: "" }
            },

            // ---------- 2. 操控者属性与等级 (controller.json / controller_masks.json) ----------
            controllerLevel: 1,
            controllerExperience: 0,
            controllerProfile: {
                generated: false,
                maskPrimary: "温柔引导",
                maskHidden: "若即若离",
                core: "渴求关注",
                relationship: "青梅竹马",
                switches: [],
                controlStart: "当天操控"
            },

            // ---------- 3. 双值博弈系统 (动态状态) ----------
            orgasmValue: 0, // 高潮值 (0-100)
            wakeValue: 0,   // 苏醒值 (0-100)

            // ---------- 4. 剧情与成长控制变量 (progression.json) ----------
            targetAwareness: 0, // 觉醒度 (0-100)
            corruption: 10,     // 沦陷值 (0-100)
            storyStage: "confusion", // 剧情发展阶段

            // ---------- 5. 动态场景与动作记录 (scenes.json / actions.json) ----------
            currentScene: "scene_bedroom",
            currentActionId: null,
            currentItemId: null,

            // ---------- 6. 动态任务队列 (tasks.json) ----------
            currentTaskId: null,
            activeTasks: ["init_001", "init_004"], // 当前被派发的每日任务 ID 列表
            completedTasks: [],                    // 历史已完成任务 ID 列表

            // ---------- 7. 动态私信历史栈 ----------
            privateMessages: [], // 保存与操控者之间的私信聊天记录

            // ---------- 8. 动态背包与道具 (items.json / rewards.json) ----------
            inventory: {
                "eq_toy_tiaodan": 1,
                "ticket_skip_task": 1
            },

            // ---------- 9. 状态惩罚与药水 Buff (penalties.json) ----------
            activeEffects: [], // 正在生效的药剂 Buff (如 "med_sensitive")
            unlockedFeatures: [],
            activePermissions: [],

            // ---------- 极值状态统计与追踪 ----------
            recentClimaxCount: 0,
            recentClimaxWindowStart: null,
            lastClimaxTime: null,

            // ---------- 时间与周期机制 ----------
            dayIndex: 1,
            currentSessionId: null,
            lastControlDate: null,
            consecutiveControlledDays: 0,

            // ---------- 运行状态标志 ----------
            sessionActive: false,
            controlActive: false,
            currentEnding: null
        };


        // ==================================================
        // 2. 当前状态合并
        // ==================================================

        this.state = this.deepMerge(
            this.deepClone(this.defaultState),
            initialState
        );


        // ==================================================
        // 3. 监听器
        // ==================================================

        this.listeners = new Set();


        // ==================================================
        // 4. 状态版本
        // ==================================================

        this.version = 1;
    }


    // ======================================================
    // 基础工具
    // ======================================================

    deepClone(value) {
        if (value === undefined || value === null) {
            return value;
        }
        return JSON.parse(JSON.stringify(value));
    }


    deepMerge(target, source) {
        if (!source || typeof source !== "object") {
            return target;
        }

        for (const key of Object.keys(source)) {
            const sourceValue = source[key];
            if (
                sourceValue &&
                typeof sourceValue === "object" &&
                !Array.isArray(sourceValue)
            ) {
                if (
                    !target[key] ||
                    typeof target[key] !== "object" ||
                    Array.isArray(target[key])
                ) {
                    target[key] = {};
                }
                this.deepMerge(target[key], sourceValue);
            } else {
                target[key] = this.deepClone(sourceValue);
            }
        }
        return target;
    }


    // ======================================================
    // 读取
    // ======================================================

    get(key) {
        if (!key) {
            return this.deepClone(this.state);
        }
        return this.getByPath(this.state, key);
    }


    getByPath(object, path) {
        const keys = path.split(".");
        let current = object;

        for (const key of keys) {
            if (
                current === undefined ||
                current === null ||
                !(key in current)
            ) {
                return undefined;
            }
            current = current[key];
        }
        return this.deepClone(current);
    }


    // ======================================================
    // 修改单个变量
    // ======================================================

    set(key, value, options = {}) {
        if (!key) {
            throw new Error("[StateManager] set() 缺少变量名称");
        }

        const oldValue = this.get(key);

        const normalizedValue = this.normalizeValue(
            key,
            value
        );

        this.setByPath(
            this.state,
            key,
            normalizedValue
        );

        this.version++;

        const change = {
            type: "set",
            key,
            oldValue,
            newValue: this.deepClone(normalizedValue),
            version: this.version,
            source: options.source || "system",
            timestamp: Date.now()
        };

        this.emit(change);

        return this.deepClone(normalizedValue);
    }


    setByPath(object, path, value) {
        const keys = path.split(".");
        let current = object;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (
                !current[key] ||
                typeof current[key] !== "object"
            ) {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }


    // ======================================================
    // 批量修改
    // ======================================================

    patch(updates, options = {}) {
        if (!updates || typeof updates !== "object") {
            throw new Error("[StateManager] patch() 参数必须是对象");
        }

        const changes = [];

        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this.get(key);

            const normalizedValue = this.normalizeValue(
                key,
                value
            );

            this.setByPath(
                this.state,
                key,
                normalizedValue
            );

            changes.push({
                key,
                oldValue,
                newValue: this.deepClone(normalizedValue)
            });
        }

        this.version++;

        const event = {
            type: "patch",
            changes,
            version: this.version,
            source: options.source || "system",
            timestamp: Date.now()
        };

        this.emit(event);

        return this.snapshot();
    }


    // ======================================================
    // 数值修改
    // ======================================================

    increment(key, amount = 1, options = {}) {
        const current = Number(this.get(key) ?? 0);

        if (Number.isNaN(current)) {
            throw new Error(
                `[StateManager] ${key} 不是可增加的数值变量`
            );
        }

        return this.set(
            key,
            current + amount,
            options
        );
    }


    decrement(key, amount = 1, options = {}) {
        return this.increment(
            key,
            -amount,
            options
        );
    }


    // ======================================================
    // 数值规范化拦截（优化：增加支持多层路径下的属性匹配）
    // ======================================================

    normalizeValue(key, value) {
        // 智能获取路径中的最后一级变量名，例如 "controllerProfile.orgasmValue" -> "orgasmValue"
        const baseKey = key.split('.').pop();

        // 高潮值
        if (baseKey === "orgasmValue") {
            return this.clampNumber(value, 0, 100);
        }

        // 苏醒值
        if (baseKey === "wakeValue") {
            return this.clampNumber(value, 0, 100);
        }

        // 目标觉醒度
        if (baseKey === "targetAwareness") {
            return this.clampNumber(value, 0, 100);
        }

        // 沦陷值 (若有)
        if (baseKey === "corruption") {
            return this.clampNumber(value, 0, 100);
        }

        // Controller等级
        if (baseKey === "controllerLevel") {
            return this.clampNumber(value, 1, 25);
        }

        // Controller经验
        if (baseKey === "controllerExperience") {
            return Math.max(0, Number(value) || 0);
        }

        return this.deepClone(value);
    }


    clampNumber(value, min, max) {
        const number = Number(value);
        if (Number.isNaN(number)) {
            return min;
        }
        return Math.min(max, Math.max(min, number));
    }


    // ======================================================
    // 快照
    // ======================================================

    snapshot() {
        return this.deepClone(this.state);
    }


    // ======================================================
    // 恢复状态
    // ======================================================

    restore(state, options = {}) {
        if (!state || typeof state !== "object") {
            throw new Error(
                "[StateManager] restore() 参数必须是对象"
            );
        }

        const oldState = this.snapshot();

        this.state = this.deepMerge(
            this.deepClone(this.defaultState),
            state
        );

        this.version++;

        this.emit({
            type: "restore",
            oldState,
            newState: this.snapshot(),
            version: this.version,
            source: options.source || "system",
            timestamp: Date.now()
        });

        return this.snapshot();
    }


    // ======================================================
    // 重置
    // ======================================================

    reset(options = {}) {
        this.state = this.deepClone(this.defaultState);
        this.version++;

        this.emit({
            type: "reset",
            state: this.snapshot(),
            version: this.version,
            source: options.source || "system",
            timestamp: Date.now()
        });

        return this.snapshot();
    }


    // ======================================================
    // 重置单场临时变量
    // ======================================================

    resetSession(options = {}) {
        this.patch({
            orgasmValue: 0,
            wakeValue: 0,
            currentScene: "scene_bedroom",
            currentTaskId: null,
            currentActionId: null,
            currentItemId: null,
            currentSessionId: null,
            sessionActive: false,
            controlActive: false,
            activeEffects: []
        }, {
            source: options.source || "session_reset"
        });
    }


    // ======================================================
    // 监听
    // ======================================================

    subscribe(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "[StateManager] subscribe() 需要传入函数"
            );
        }

        this.listeners.add(callback);

        return () => {
            this.listeners.delete(callback);
        };
    }


    emit(event) {
        for (const callback of this.listeners) {
            try {
                callback(event, this.snapshot());
            } catch (error) {
                console.error("[StateManager] Listener Error:", error);
            }
        }
    }


    // ======================================================
    // 状态检查
    // ======================================================

    has(key) {
        return this.get(key) !== undefined;
    }


    // ======================================================
    // 导出存档数据
    // ======================================================

    serialize() {
        return {
            version: this.version,
            state: this.snapshot(),
            savedAt: Date.now()
        };
    }


    // ======================================================
    // 获取当前版本
    // ======================================================

    getVersion() {
        return this.version;
    }
}

// 导出默认实例单例
export const stateManager = new StateManager();
