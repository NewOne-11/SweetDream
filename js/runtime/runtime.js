/**
 * SweetDream Runtime Engine
 * --------------------------------------------------
 * 负责：
 * 1. 游戏运行时状态调度
 * 2. StateManager 与 EventBus 的连接
 * 3. 游戏循环执行
 * 4. 等级 / 场景 / 任务 / 状态变化事件
 * 5. 数据库查询接口预留
 * 6. AI 输出后的运行时状态同步
 *
 * 注意：
 * Runtime 不保存独立 State。
 * 所有动态变量统一由 StateManager 管理。
 */

import stateManager from "./stateManager.js";
import eventBus from "./eventBus.js";


class Runtime {

    constructor() {

        this.state = stateManager;
        this.events = eventBus;

        // 静态数据库接口
        // 下一阶段 database/ 完成后由 main.js 注入
        this.database = null;

        // AI 服务接口
        // 下一阶段 ai/ 完成后由 main.js 注入
        this.ai = null;

        // UI 接口
        // 下一阶段 ui/ 完成后由 main.js 注入
        this.ui = null;

        this.running = false;
        this.currentAction = null;

        this.session = {
            id: null,
            startedAt: null
        };

        this._bindEvents();
    }


    /* =========================================================
       1. 初始化
    ========================================================= */

    async init() {

        if (this.running) {
            return;
        }

        // 读取持久化状态
        await this._loadState();

        // 验证状态
        this.validateState();

        // 创建 / 恢复 Session
        this._initializeSession();

        this.running = true;

        this.events.emit("runtime:ready", {
            state: this.getState(),
            session: this.session
        });

        return this.getState();
    }


    /* =========================================================
       2. 连接外部模块
    ========================================================= */

    setDatabase(database) {

        this.database = database;

        this.events.emit("database:connected", {
            database
        });

        return this;
    }


    setAI(ai) {

        this.ai = ai;

        this.events.emit("ai:connected", {
            ai
        });

        return this;
    }


    setUI(ui) {

        this.ui = ui;

        this.events.emit("ui:connected", {
            ui
        });

        return this;
    }


    /* =========================================================
       3. StateManager / EventBus 接线
    ========================================================= */

    _bindEvents() {

        /*
         * StateManager → Runtime
         *
         * 不强制要求 StateManager 必须实现 subscribe。
         * 如果实现了，则自动监听。
         */

        if (typeof this.state.subscribe === "function") {

            this.state.subscribe((change) => {

                this.events.emit("state:changed", change);

                this._notifyUI("state:changed", change);
            });
        }


        /*
         * 状态变化
         */

        this.events.on("state:changed", (change) => {

            this._handleStateChange(change);

        });


        /*
         * 等级变化
         */

        this.events.on("level:up", (data) => {

            this._handleLevelUp(data);

        });


        /*
         * 场景变化
         */

        this.events.on("scene:changed", (data) => {

            this._handleSceneChange(data);

        });


        /*
         * 任务变化
         */

        this.events.on("task:started", (data) => {

            this._notifyUI("task:started", data);

        });


        this.events.on("task:completed", (data) => {

            this._notifyUI("task:completed", data);

        });


        /*
         * 高潮结算
         *
         * 这里只负责游戏状态事件，
         * 具体内容由规则数据库决定。
         */

        this.events.on("climax:settled", (data) => {

            this._notifyUI("climax:settled", data);

        });


        /*
         * 目标觉醒度变化
         */

        this.events.on("awareness:changed", (data) => {

            this._notifyUI("awareness:changed", data);

        });
    }


    /* =========================================================
       4. 状态读取
    ========================================================= */

    getState() {

        if (typeof this.state.getState === "function") {
            return this.state.getState();
        }

        if (typeof this.state.getAll === "function") {
            return this.state.getAll();
        }

        if (typeof this.state.get === "function") {
            return this.state.get();
        }

        return {};
    }


    get(key) {

        if (typeof this.state.get === "function") {
            return this.state.get(key);
        }

        return this.getState()?.[key];
    }


    /* =========================================================
       5. 状态写入
    ========================================================= */

    async set(key, value, options = {}) {

        const oldValue = this.get(key);

        if (typeof this.state.set === "function") {

            await this.state.set(key, value, options);

        } else {

            throw new Error(
                "StateManager 缺少 set(key, value) 方法。"
            );
        }


        const newValue = this.get(key);


        /*
         * 如果 StateManager 本身没有自动广播，
         * Runtime 在这里补发事件。
         */

        if (oldValue !== newValue) {

            this.events.emit("state:changed", {
                key,
                oldValue,
                newValue,
                source: options.source || "runtime"
            });
        }


        return newValue;
    }


    async update(values, options = {}) {

        if (typeof this.state.update === "function") {

            await this.state.update(values, options);

        } else {

            for (const [key, value] of Object.entries(values)) {

                await this.set(key, value, options);
            }
        }

        return this.getState();
    }


    /* =========================================================
       6. 状态验证
    ========================================================= */

    validateState() {

        const state = this.getState();

        const numericRanges = {
            orgasmValue: [0, 100],
            wakeValue: [0, 100],
            targetAwareness: [0, 100],
            controllerLevel: [1, 25],
            controllerExperience: [0, Infinity]
        };


        for (const [key, range] of Object.entries(numericRanges)) {

            if (state[key] === undefined || state[key] === null) {
                continue;
            }

            const value = Number(state[key]);

            if (Number.isNaN(value)) {

                throw new Error(
                    `Runtime 状态错误：${key} 不是有效数字。`
                );
            }


            if (value < range[0]) {

                this.state.set(
                    key,
                    range[0],
                    { source: "state_validation" }
                );
            }


            if (
                range[1] !== Infinity &&
                value > range[1]
            ) {

                this.state.set(
                    key,
                    range[1],
                    { source: "state_validation" }
                );
            }
        }


        return true;
    }


    /* =========================================================
       7. 游戏核心循环
    ========================================================= */

    async execute(action = {}) {

        if (!this.running) {

            await this.init();
        }


        this.currentAction = action;


        try {

            this.events.emit("runtime:action:start", {
                action
            });


            /*
             * STEP 1
             * STATE VALIDATION
             */

            this.validateState();


            /*
             * STEP 2
             * LEVEL PERMISSION CHECK
             */

            const permissionResult =
                await this.checkLevelPermission(action);

            if (!permissionResult.allowed) {

                return this._rejectAction(
                    "LEVEL_PERMISSION_DENIED",
                    permissionResult.reason
                );
            }


            /*
             * STEP 3
             * SCENE CHECK
             */

            const sceneResult =
                await this.checkScene(action);

            if (!sceneResult.allowed) {

                return this._rejectAction(
                    "SCENE_RESTRICTED",
                    sceneResult.reason
                );
            }


            /*
             * STEP 4
             * CONTENT FILTER
             */

            const contentResult =
                await this.filterContent(action);

            if (!contentResult.allowed) {

                return this._rejectAction(
                    "CONTENT_FILTERED",
                    contentResult.reason
                );
            }


            /*
             * STEP 5
             * ACTION VALIDATION
             */

            const actionResult =
                await this.validateAction(action);

            if (!actionResult.allowed) {

                return this._rejectAction(
                    "ACTION_INVALID",
                    actionResult.reason
                );
            }


            /*
             * STEP 6
             * DATABASE LOOKUP
             */

            const databaseContext =
                await this.lookupDatabase(action);


            /*
             * STEP 7
             * CALCULATE STATE CHANGES
             */

            const changes =
                await this.calculateStateChanges(
                    action,
                    databaseContext
                );


            /*
             * STEP 8
             * APPLY STATE CHANGES
             */

            await this.applyStateChanges(changes);


            /*
             * STEP 9
             * CLAMP VARIABLES
             */

            await this.clampVariables();


            /*
             * STEP 10
             * CHECK THRESHOLDS
             */

            const thresholdResult =
                await this.checkThresholds();


            /*
             * STEP 11
             * TRIGGER EVENTS
             */

            await this.triggerEvents(
                action,
                changes,
                thresholdResult
            );


            /*
             * STEP 12
             * XP / TASK UPDATE
             */

            await this.updateProgress(
                action,
                databaseContext
            );


            /*
             * STEP 13
             * LEVEL UP
             */

            await this.checkLevelUp();


            /*
             * STEP 14
             * AWARENESS
             */

            await this.checkAwareness();


            /*
             * STEP 15
             * ENDING
             */

            const ending =
                await this.checkEnding();


            /*
             * STEP 16
             * SAVE
             */

            await this.saveState();


            const result = {

                success: true,

                state: this.getState(),

                changes,

                threshold: thresholdResult,

                ending
            };


            this.events.emit(
                "runtime:action:complete",
                result
            );


            return result;


        } catch (error) {

            this.events.emit(
                "runtime:error",
                {
                    error,
                    action
                }
            );


            console.error(
                "[Runtime] Action execution failed:",
                error
            );


            return {

                success: false,

                error: error.message,

                state: this.getState()
            };

        } finally {

            this.currentAction = null;
        }
    }


    /* =========================================================
       8. 等级权限
    ========================================================= */

    async checkLevelPermission(action) {

        const level =
            Number(this.get("controllerLevel") || 1);


        if (
            action.requiredLevel &&
            level < action.requiredLevel
        ) {

            return {

                allowed: false,

                reason:
                    `当前等级 Lv.${level}，需要 Lv.${action.requiredLevel}。`
            };
        }


        /*
         * 以后这里直接查询：
         *
         * controller.json
         *
         * 获取当前等级的 unlock 数据。
         */

        if (
            this.database &&
            typeof this.database.getLevel === "function"
        ) {

            const levelData =
                await this.database.getLevel(level);


            if (levelData) {

                return {

                    allowed: true,

                    levelData
                };
            }
        }


        return {
            allowed: true
        };
    }


    /* =========================================================
       9. 场景检查
    ========================================================= */

    async checkScene(action) {

        const sceneId =
            action.sceneId ||
            this.get("currentScene");


        if (!sceneId) {

            return {
                allowed: true
            };
        }


        if (
            this.database &&
            typeof this.database.getScene === "function"
        ) {

            const scene =
                await this.database.getScene(sceneId);


            if (!scene) {

                return {

                    allowed: false,

                    reason:
                        `找不到场景数据库记录：${sceneId}`
                };
            }


            const level =
                Number(this.get("controllerLevel") || 1);


            if (
                scene.unlockLevel &&
                level < scene.unlockLevel
            ) {

                return {

                    allowed: false,

                    reason:
                        `场景 ${sceneId} 尚未解锁。`
                };
            }
        }


        return {
            allowed: true
        };
    }


    /* =========================================================
       10. 内容过滤
    ========================================================= */

    async filterContent(action) {

        /*
         * 这里只建立接口。
         *
         * 真正的目标偏好 / 排斥项数据库
         * 下一阶段从 controller_masks / profile 等模块读取。
         */

        if (
            this.database &&
            typeof this.database.validateContent === "function"
        ) {

            return await this.database.validateContent(
                action,
                this.getState()
            );
        }


        return {
            allowed: true
        };
    }


    /* =========================================================
       11. Action 验证
    ========================================================= */

    async validateAction(action) {

        if (!action || typeof action !== "object") {

            return {

                allowed: false,

                reason: "Action 必须是对象。"
            };
        }


        return {
            allowed: true
        };
    }


    /* =========================================================
       12. 数据库查询
    ========================================================= */

    async lookupDatabase(action) {

        if (!this.database) {

            return {};
        }


        const context = {};


        /*
         * 根据 action 自动查询不同数据库。
         */

        if (
            action.controllerLevel &&
            typeof this.database.getLevel === "function"
        ) {

            context.level =
                await this.database.getLevel(
                    action.controllerLevel
                );
        }


        if (
            action.sceneId &&
            typeof this.database.getScene === "function"
        ) {

            context.scene =
                await this.database.getScene(
                    action.sceneId
                );
        }


        if (
            action.taskId &&
            typeof this.database.getTask === "function"
        ) {

            context.task =
                await this.database.getTask(
                    action.taskId
                );
        }


        if (
            action.itemId &&
            typeof this.database.getItem === "function"
        ) {

            context.item =
                await this.database.getItem(
                    action.itemId
                );
        }


        return context;
    }


    /* =========================================================
       13. 状态变化计算
    ========================================================= */

    async calculateStateChanges(
        action,
        databaseContext
    ) {

        /*
         * 当前只建立通用状态计算框架。
         *
         * 具体公式以后从 controller.json
         * / actions.json 等数据库读取。
         */

        const changes = {};


        if (action.stateChanges) {

            Object.assign(
                changes,
                action.stateChanges
            );
        }


        return changes;
    }


    /* =========================================================
       14. 应用状态变化
    ========================================================= */

    async applyStateChanges(changes) {

        if (
            !changes ||
            Object.keys(changes).length === 0
        ) {

            return;
        }


        await this.update(
            changes,
            {
                source: "runtime"
            }
        );
    }


    /* =========================================================
       15. 数值钳制
    ========================================================= */

    async clampVariables() {

        const clamp = (value) => {

            const number = Number(value);

            if (Number.isNaN(number)) {
                return 0;
            }

            return Math.max(
                0,
                Math.min(100, number)
            );
        };


        const state = this.getState();


        const clampKeys = [
            "orgasmValue",
            "wakeValue",
            "targetAwareness"
        ];


        for (const key of clampKeys) {

            if (state[key] !== undefined) {

                await this.set(
                    key,
                    clamp(state[key]),
                    {
                        source: "clamp"
                    }
                );
            }
        }
    }


    /* =========================================================
       16. 阈值检查
    ========================================================= */

    async checkThresholds() {

        const orgasmValue =
            Number(this.get("orgasmValue") || 0);

        const wakeValue =
            Number(this.get("wakeValue") || 0);


        const result = {

            climax: false,

            wake: false
        };


        if (wakeValue >= 100) {

            result.wake = true;

            this.events.emit(
                "target:wake",
                {
                    wakeValue
                }
            );
        }


        if (orgasmValue >= 100) {

            result.climax = true;

            this.events.emit(
                "climax:trigger",
                {
                    orgasmValue
                }
            );
        }


        return result;
    }


    /* =========================================================
       17. 即时事件
    ========================================================= */

    async triggerEvents(
        action,
        changes,
        thresholdResult
    ) {

        if (thresholdResult.climax) {

            await this.handleClimaxSettlement(
                action
            );
        }


        if (thresholdResult.wake) {

            await this.endControlSession(
                "target_wake"
            );
        }


        this.events.emit(
            "runtime:state:update",
            {
                action,
                changes
            }
        );
    }


    /* =========================================================
       18. 结算
    ========================================================= */

    async handleClimaxSettlement(action) {

        const currentValue =
            Number(this.get("orgasmValue") || 0);


        const previousCount =
            Number(
                this.get("recentClimaxCount") || 0
            );


        await this.set(
            "orgasmValue",
            0,
            {
                source: "climax_settlement"
            }
        );


        await this.set(
            "recentClimaxCount",
            previousCount + 1,
            {
                source: "climax_settlement"
            }
        );


        await this.set(
            "lastClimaxTime",
            new Date().toISOString(),
            {
                source: "climax_settlement"
            }
        );


        this.events.emit(
            "climax:settled",
            {

                previousValue: currentValue,

                count:
                    previousCount + 1,

                action
            }
        );
    }


    /* =========================================================
       19. 任务 / XP
    ========================================================= */

    async updateProgress(
        action,
        databaseContext
    ) {

        if (!action) {
            return;
        }


        /*
         * 以后这里连接：
         *
         * tasks.json
         * rewards.json
         * progression.json
         */

        if (action.experienceGain) {

            const currentXP =
                Number(
                    this.get(
                        "controllerExperience"
                    ) || 0
                );


            await this.set(
                "controllerExperience",
                currentXP +
                Number(action.experienceGain),
                {
                    source: "progress"
                }
            );
        }
    }


    /* =========================================================
       20. 升级
    ========================================================= */

    async checkLevelUp() {

        let level =
            Number(
                this.get("controllerLevel") || 1
            );

        let xp =
            Number(
                this.get("controllerExperience") || 0
            );


        let leveledUp = false;


        while (
            xp >= 100 &&
            level < 25
        ) {

            xp -= 100;

            const oldLevel = level;

            level += 1;

            leveledUp = true;


            await this.set(
                "controllerLevel",
                level,
                {
                    source: "level_up"
                }
            );


            await this.set(
                "controllerExperience",
                xp,
                {
                    source: "level_up"
                }
            );


            this.events.emit(
                "level:up",
                {
                    oldLevel,
                    newLevel: level
                }
            );
        }


        return leveledUp;
    }


    /* =========================================================
       21. 目标 Awareness
    ========================================================= */

    async checkAwareness() {

        const awareness =
            Number(
                this.get("targetAwareness") || 0
            );


        this.events.emit(
            "awareness:changed",
            {
                value: awareness
            }
        );


        if (awareness >= 100) {

            this.events.emit(
                "awareness:max",
                {
                    value: awareness
                }
            );
        }


        return awareness;
    }


    /* =========================================================
       22. 结局检查
    ========================================================= */

    async checkEnding() {

        const awareness =
            Number(
                this.get("targetAwareness") || 0
            );


        if (awareness >= 100) {

            this.events.emit(
                "ending:trigger",
                {
                    reason: "target_awareness_max"
                }
            );


            return {
                triggered: true,
                reason: "target_awareness_max"
            };
        }


        return {
            triggered: false
        };
    }


    /* =========================================================
       23. Session
    ========================================================= */

    _initializeSession() {

        let sessionId =
            this.get("currentSessionId");


        if (!sessionId) {

            sessionId =
                this._generateSessionId();


            this.set(
                "currentSessionId",
                sessionId,
                {
                    source: "session"
                }
            );
        }


        this.session = {

            id: sessionId,

            startedAt:
                new Date().toISOString()
        };


        this.events.emit(
            "session:started",
            this.session
        );
    }


    async endControlSession(reason = "manual") {

        const sessionId =
            this.get("currentSessionId");


        await this.set(
            "currentSessionId",
            null,
            {
                source: "session_end"
            }
        );


        this.events.emit(
            "session:ended",
            {
                sessionId,
                reason
            }
        );


        this.session = {

            id: null,

            startedAt: null
        };
    }


    _generateSessionId() {

        return (

            "session_" +

            Date.now().toString(36) +

            "_" +

            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }


    /* =========================================================
       24. 存档
    ========================================================= */

    async _loadState() {

        if (
            typeof this.state.load === "function"
        ) {

            await this.state.load();
        }
    }


    async saveState() {

        if (
            typeof this.state.save === "function"
        ) {

            await this.state.save();
        }


        this.events.emit(
            "state:saved",
            {
                state: this.getState()
            }
        );
    }


    /* =========================================================
       25. UI 通知
    ========================================================= */

    _notifyUI(event, data) {

        if (
            this.ui &&
            typeof this.ui.handleEvent === "function"
        ) {

            this.ui.handleEvent(
                event,
                data
            );
        }
    }


    /* =========================================================
       26. State 变化处理
    ========================================================= */

    _handleStateChange(change) {

        /*
         * 这里暂时只负责事件分发。
         *
         * 后面可以根据 key 做专门处理：
         *
         * controllerLevel
         * → database 查询
         * → UI 更新
         *
         * currentScene
         * → scenes.json 查询
         * → UI 更新
         *
         * currentTaskId
         * → tasks.json 查询
         * → UI 更新
         */


        if (!change) {
            return;
        }


        if (
            change.key ===
            "controllerLevel"
        ) {

            this.events.emit(
                "controller:level:changed",
                change
            );
        }


        if (
            change.key ===
            "currentScene"
        ) {

            this.events.emit(
                "controller:scene:changed",
                change
            );
        }


        if (
            change.key ===
            "currentTaskId"
        ) {

            this.events.emit(
                "controller:task:changed",
                change
            );
        }
    }


    /* =========================================================
       27. 等级升级处理
    ========================================================= */

    async _handleLevelUp(data) {

        /*
         * 下一阶段这里会正式连接：
         *
         * controller.json
         *
         * 查询：
         * levels[newLevel]
         *
         * 然后把 unlock 内容交给：
         *
         * databaseRegistry
         * UI
         * AI Context
         */


        if (
            this.database &&
            typeof this.database.getLevel ===
            "function"
        ) {

            const levelData =
                await this.database.getLevel(
                    data.newLevel
                );


            if (levelData) {

                this.events.emit(
                    "controller:unlock",
                    {
                        level:
                            data.newLevel,

                        data:
                            levelData
                    }
                );
            }
        }


        this._notifyUI(
            "level:up",
            data
        );
    }


    /* =========================================================
       28. 场景变化处理
    ========================================================= */

    async _handleSceneChange(data) {

        if (
            this.database &&
            typeof this.database.getScene ===
            "function"
        ) {

            const sceneId =
                data.sceneId ||
                data.newValue;


            const scene =
                await this.database.getScene(
                    sceneId
                );


            this.events.emit(
                "scene:data",
                {
                    sceneId,
                    scene
                }
            );
        }


        this._notifyUI(
            "scene:changed",
            data
        );
    }


    /* =========================================================
       29. 拒绝 Action
    ========================================================= */

    _rejectAction(code, reason) {

        const result = {

            success: false,

            rejected: true,

            code,

            reason,

            state: this.getState()
        };


        this.events.emit(
            "runtime:action:rejected",
            result
        );


        this._notifyUI(
            "runtime:action:rejected",
            result
        );


        return result;
    }


    /* =========================================================
       30. 停止 Runtime
    ========================================================= */

    async shutdown() {

        if (!this.running) {
            return;
        }


        await this.saveState();


        await this.endControlSession(
            "runtime_shutdown"
        );


        this.running = false;


        this.events.emit(
            "runtime:shutdown",
            {
                state: this.getState()
            }
        );
    }
}


/*
 * 单例 Runtime
 *
 * 整个游戏只使用一个 Runtime 实例。
 */

const runtime = new Runtime();


export default runtime;

export { Runtime };
