/**
 * StateManager
 * --------------------------------------------------
 * 游戏运行时状态管理器
 *
 * 职责：
 * 1. 管理当前游戏状态
 * 2. 提供 get / set / patch
 * 3. 自动校验部分变量范围
 * 4. 监听状态变化
 * 5. 提供状态快照
 *
 * 注意：
 * - 不负责读取 JSON 数据库
 * - 不负责 IndexedDB 持久化
 * - 不负责 AI
 * - 不负责 UI
 *
 * 这些功能由其他模块负责。
 */

export class StateManager {

    constructor(initialState = {}) {

        // ==================================================
        // 1. 默认运行时状态
        // ==================================================

        this.defaultState = {

            // ---------- Controller ----------
            controllerLevel: 1,
            controllerExperience: 0,

            // ---------- 双值系统 ----------
            orgasmValue: 0,
            wakeValue: 0,

            // ---------- Target ----------
            targetAwareness: 0,

            // ---------- Scene / Task ----------
            currentScene: null,
            currentTaskId: null,
            currentActionId: null,
            currentItemId: null,

            // ---------- Inventory ----------
            inventory: {},

            // ---------- Effects ----------
            activeEffects: [],

            // ---------- Unlock ----------
            unlockedFeatures: [],
            activePermissions: [],

            // ---------- Task ----------
            completedTasks: [],

            // ---------- Progress ----------
            currentProgress: {},

            // ---------- Climax Tracking ----------
            recentClimaxCount: 0,
            recentClimaxWindowStart: null,
            lastClimaxTime: null,

            // ---------- Time ----------
            dayIndex: 1,
            currentSessionId: null,
            lastControlDate: null,
            consecutiveControlledDays: 0,

            // ---------- Controller Profile ----------
            controllerProfile: {
                generated: false,
                maskPrimary: null,
                maskHidden: null,
                core: null,
                relationship: null,
                switches: [],
                controlStart: null
            },

            // ---------- Runtime Flags ----------
            sessionActive: false,
            controlActive: false,
            currentEnding: null
        };


        // ==================================================
        // 2. 当前状态
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
    // 数值规范化
    // ======================================================

    normalizeValue(key, value) {

        // 高潮值
        if (key === "orgasmValue") {
            return this.clampNumber(value, 0, 100);
        }

        // 苏醒值
        if (key === "wakeValue") {
            return this.clampNumber(value, 0, 100);
        }

        // 目标觉醒度
        if (key === "targetAwareness") {
            return this.clampNumber(value, 0, 100);
        }

        // Controller等级
        if (key === "controllerLevel") {

            return this.clampNumber(
                value,
                1,
                25
            );
        }

        // Controller经验
        if (key === "controllerExperience") {

            return Math.max(
                0,
                Number(value) || 0
            );
        }

        // 普通值
        return this.deepClone(value);
    }


    clampNumber(value, min, max) {

        const number = Number(value);

        if (Number.isNaN(number)) {
            return min;
        }

        return Math.min(
            max,
            Math.max(min, number)
        );
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

        this.state = this.deepClone(
            this.defaultState
        );

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

            currentScene: null,
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

                callback(
                    event,
                    this.snapshot()
                );

            } catch (error) {

                console.error(
                    "[StateManager] Listener Error:",
                    error
                );
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


// ==========================================================
// 创建默认实例
// ==========================================================

export const stateManager = new StateManager();
