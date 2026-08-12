/**
 * runtime.js
 *
 * 游戏运行时核心控制器
 *
 * 职责：
 * 1. 连接 StateManager（动态状态）
 * 2. 连接静态数据库
 * 3. 接收 AI 产生的游戏事件
 * 4. 将事件转换为状态变化
 * 5. 触发数据库查询
 * 6. 通知 UI 更新
 *
 * 注意：
 * runtime 不直接保存游戏状态。
 * 所有动态状态统一交给 StateManager。
 */

export class GameRuntime {

    constructor({
        stateManager,
        database = null,
        aiBridge = null,
        uiBridge = null,
        debug = false
    } = {}) {

        if (!stateManager) {
            throw new Error(
                "[GameRuntime] StateManager is required."
            );
        }

        this.stateManager = stateManager;

        // 静态数据库
        this.database = database;

        // AI 接口
        this.aiBridge = aiBridge;

        // UI 接口
        this.uiBridge = uiBridge;

        this.debug = debug;

        // 当前运行状态
        this.running = false;

        // 当前游戏会话
        this.sessionId = null;

        // 事件监听器
        this.listeners = new Map();

        this.log("GameRuntime initialized.");
    }


    /* =========================================================
       1. 初始化
       ========================================================= */

    async init() {

        this.log("Initializing runtime...");

        // 读取动态状态
        await this.stateManager.load();

        // 创建或恢复 Session
        this.sessionId =
            this.stateManager.get("currentSessionId") ||
            this.createSessionId();

        this.stateManager.set(
            "currentSessionId",
            this.sessionId
        );

        // 启动运行状态
        this.running = true;

        // 通知 UI
        this.emit("runtime:ready", {
            sessionId: this.sessionId,
            state: this.getState()
        });

        this.refreshUI();

        this.log("Runtime ready.");

        return this.getState();
    }


    /* =========================================================
       2. Session
       ========================================================= */

    createSessionId() {

        return (
            "session_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 9)
        );
    }


    /* =========================================================
       3. 获取当前状态
       ========================================================= */

    getState() {

        return this.stateManager.getState();
    }


    /* =========================================================
       4. 修改状态
       ========================================================= */

    setState(key, value) {

        this.stateManager.set(key, value);

        this.emit("state:changed", {
            key,
            value,
            state: this.getState()
        });

        this.refreshUI();
    }


    updateState(updates = {}) {

        Object.entries(updates).forEach(
            ([key, value]) => {
                this.stateManager.set(key, value);
            }
        );

        this.emit("state:updated", {
            updates,
            state: this.getState()
        });

        this.refreshUI();
    }


    /* =========================================================
       5. 数据库查询
       ========================================================= */

    getDatabase(name) {

        if (!this.database) {
            this.log(
                `[Database] Database module not connected: ${name}`
            );

            return null;
        }

        if (typeof this.database.get === "function") {
            return this.database.get(name);
        }

        return this.database[name] || null;
    }


    getControllerData() {

        return this.getDatabase("controller");
    }


    getTaskData() {

        return this.getDatabase("tasks");
    }


    getSceneData() {

        return this.getDatabase("scenes");
    }


    getItemData() {

        return this.getDatabase("items");
    }


    getRewardData() {

        return this.getDatabase("rewards");
    }


    getPenaltyData() {

        return this.getDatabase("penalties");
    }


    getProgressionData() {

        return this.getDatabase("progression");
    }


    getActionData() {

        return this.getDatabase("actions");
    }


    getControllerMaskData() {

        return this.getDatabase("controller_masks");
    }


    /* =========================================================
       6. 根据当前等级读取 Controller 数据
       ========================================================= */

    getCurrentLevelData() {

        const controller = this.getControllerData();

        if (!controller) {
            return null;
        }

        const level =
            this.stateManager.get("controllerLevel") || 1;

        /*
         * 兼容：
         *
         * controller.json
         * {
         *   staticRules: {
         *      levels: [...]
         *   }
         * }
         *
         * 或者：
         *
         * {
         *   levels: [...]
         * }
         */

        const levels =
            controller?.staticRules?.levels ||
            controller?.levels ||
            [];

        return levels.find(
            item => item.level === level
        ) || null;
    }


    /* =========================================================
       7. 根据 ID 查询内容
       ========================================================= */

    findById(databaseName, id) {

        const data = this.getDatabase(databaseName);

        if (!data || !id) {
            return null;
        }

        // 常见格式一：
        // { items: [...] }

        const collection =
            data.items ||
            data.tasks ||
            data.scenes ||
            data.actions ||
            data.rewards ||
            data.penalties ||
            data.records ||
            data;

        if (Array.isArray(collection)) {

            return collection.find(
                item => item.id === id
            ) || null;
        }

        // 常见格式二：
        // { "item_xxx": {...} }

        if (
            typeof collection === "object" &&
            collection[id]
        ) {
            return collection[id];
        }

        return null;
    }


    /* =========================================================
       8. AI 事件入口
       =========================================================
       
       以后 AI 不应该直接修改 IndexedDB。

       AI 输出：

       {
           type: "LEVEL_UP",
           level: 12
       }

       或：

       {
           type: "TASK_GENERATED",
           taskId: "task_xxx"
       }

       统一进入这里。

       runtime 再决定：
       AI → Runtime → StateManager
                     ↓
                  Database
                     ↓
                     UI
    */

    async processAIEvent(event) {

        if (!event || !event.type) {

            console.warn(
                "[GameRuntime] Invalid AI event:",
                event
            );

            return;
        }

        this.log(
            `[AI EVENT] ${event.type}`
        );

        this.emit(
            "ai:event",
            event
        );

        switch (event.type) {

            case "STATE_UPDATE":
                await this.handleStateUpdate(event);
                break;

            case "LEVEL_UP":
                await this.handleLevelUp(event);
                break;

            case "TASK_GENERATED":
                await this.handleTaskGenerated(event);
                break;

            case "TASK_COMPLETED":
                await this.handleTaskCompleted(event);
                break;

            case "SCENE_CHANGED":
                await this.handleSceneChanged(event);
                break;

            case "ITEM_UNLOCKED":
                await this.handleItemUnlocked(event);
                break;

            case "MESSAGE":
                await this.handleMessage(event);
                break;

            default:

                console.warn(
                    `[GameRuntime] Unknown AI event: ${event.type}`
                );
        }

        await this.save();

        this.refreshUI();
    }


    /* =========================================================
       9. AI → 状态修改
       ========================================================= */

    async handleStateUpdate(event) {

        if (!event.updates) {
            return;
        }

        this.updateState(
            event.updates
        );
    }


    /* =========================================================
       10. 升级事件
       ========================================================= */

    async handleLevelUp(event) {

        const newLevel =
            Number(event.level);

        if (!Number.isFinite(newLevel)) {
            return;
        }

        this.setState(
            "controllerLevel",
            newLevel
        );

        // 查找该等级对应的静态数据库内容
        const levelData =
            this.getCurrentLevelData();

        this.emit(
            "level:up",
            {
                level: newLevel,
                data: levelData
            }
        );

        /*
         * 这里非常重要：
         *
         * AI 只需要告诉 Runtime：
         *
         * LEVEL_UP / 12
         *
         * Runtime 自动：
         *
         * controllerLevel = 12
         * ↓
         * controller.json
         * ↓
         * 找到 Lv.12
         * ↓
         * 返回对应 unlock
         * ↓
         * UI 更新
         */

        this.log(
            `Controller level changed to Lv.${newLevel}`
        );
    }


    /* =========================================================
       11. 任务生成
       ========================================================= */

    async handleTaskGenerated(event) {

        const taskId =
            event.taskId;

        if (!taskId) {
            return;
        }

        // 去静态 tasks.json 查任务
        const task =
            this.findById(
                "tasks",
                taskId
            );

        if (!task) {

            console.warn(
                `[GameRuntime] Task not found: ${taskId}`
            );

            return;
        }

        this.setState(
            "currentTaskId",
            taskId
        );

        this.emit(
            "task:generated",
            {
                taskId,
                task
            }
        );

        this.log(
            `Task loaded: ${taskId}`
        );
    }


    /* =========================================================
       12. 任务完成
       ========================================================= */

    async handleTaskCompleted(event) {

        const taskId =
            event.taskId;

        if (!taskId) {
            return;
        }

        const completedTasks =
            this.stateManager.get(
                "completedTasks"
            ) || [];

        if (
            !completedTasks.includes(taskId)
        ) {

            completedTasks.push(taskId);

            this.setState(
                "completedTasks",
                completedTasks
            );
        }

        // 当前任务清空
        if (
            this.stateManager.get(
                "currentTaskId"
            ) === taskId
        ) {

            this.setState(
                "currentTaskId",
                null
            );
        }

        this.emit(
            "task:completed",
            {
                taskId
            }
        );
    }


    /* =========================================================
       13. 场景切换
       ========================================================= */

    async handleSceneChanged(event) {

        const sceneId =
            event.sceneId;

        if (!sceneId) {
            return;
        }

        const scene =
            this.findById(
                "scenes",
                sceneId
            );

        if (!scene) {

            console.warn(
                `[GameRuntime] Scene not found: ${sceneId}`
            );

            return;
        }

        this.setState(
            "currentScene",
            sceneId
        );

        this.emit(
            "scene:changed",
            {
                sceneId,
                scene
            }
        );
    }


    /* =========================================================
       14. 道具解锁
       ========================================================= */

    async handleItemUnlocked(event) {

        const itemId =
            event.itemId;

        if (!itemId) {
            return;
        }

        const item =
            this.findById(
                "items",
                itemId
            );

        if (!item) {
            return;
        }

        const inventory =
            this.stateManager.get(
                "inventory"
            ) || {};

        if (!inventory[itemId]) {

            inventory[itemId] = {
                id: itemId,
                quantity: 1
            };

        } else {

            inventory[itemId].quantity += 1;
        }

        this.setState(
            "inventory",
            inventory
        );

        this.emit(
            "item:unlocked",
            {
                itemId,
                item
            }
        );
    }


    /* =========================================================
       15. AI 普通文本
       ========================================================= */

    async handleMessage(event) {

        this.emit(
            "ai:message",
            {
                content:
                    event.content || ""
            }
        );
    }


    /* =========================================================
       16. 保存
       ========================================================= */

    async save() {

        if (
            typeof this.stateManager.save ===
            "function"
        ) {

            await this.stateManager.save();
        }

        this.emit(
            "state:saved",
            this.getState()
        );
    }


    /* =========================================================
       17. UI 更新
       ========================================================= */

    refreshUI() {

        if (
            !this.uiBridge
        ) {
            return;
        }

        if (
            typeof this.uiBridge.updateState ===
            "function"
        ) {

            this.uiBridge.updateState(
                this.getState()
            );
        }
    }


    /* =========================================================
       18. 事件系统
       ========================================================= */

    on(eventName, callback) {

        if (
            !this.listeners.has(eventName)
        ) {

            this.listeners.set(
                eventName,
                []
            );
        }

        this.listeners
            .get(eventName)
            .push(callback);
    }


    off(eventName, callback) {

        if (
            !this.listeners.has(eventName)
        ) {
            return;
        }

        const callbacks =
            this.listeners.get(
                eventName
            );

        const index =
            callbacks.indexOf(callback);

        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }


    emit(eventName, data) {

        const callbacks =
            this.listeners.get(
                eventName
            ) || [];

        callbacks.forEach(
            callback => {

                try {
                    callback(data);

                } catch (error) {

                    console.error(
                        `[GameRuntime] Event error: ${eventName}`,
                        error
                    );
                }
            }
        );
    }


    /* =========================================================
       19. 停止当前 Runtime
       ========================================================= */

    async stop() {

        this.running = false;

        await this.save();

        this.emit(
            "runtime:stopped",
            {
                sessionId:
                    this.sessionId
            }
        );

        this.log(
            "Runtime stopped."
        );
    }


    /* =========================================================
       20. Debug
       ========================================================= */

    log(...args) {

        if (this.debug) {

            console.log(
                "[GameRuntime]",
                ...args
            );
        }
    }
}


/* =============================================================
   工厂函数
   ============================================================= */

export function createGameRuntime(config) {

    return new GameRuntime(config);
}
