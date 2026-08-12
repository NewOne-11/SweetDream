/**
 * eventBus.js
 *
 * 游戏运行时事件总线
 *
 * 负责：
 * 1. 注册事件监听
 * 2. 发布事件
 * 3. 删除监听
 * 4. 让 Runtime、AI、UI、Database 等模块解耦
 *
 * 注意：
 * EventBus 不保存游戏状态。
 * EventBus 只负责“传递事件”。
 */

export class EventBus {

    constructor() {
        this.events = new Map();
    }


    /**
     * 注册事件监听
     *
     * @param {string} eventName
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    on(eventName, callback) {

        if (
            typeof eventName !== "string" ||
            !eventName
        ) {
            throw new Error(
                "[EventBus] eventName must be a non-empty string."
            );
        }

        if (
            typeof callback !== "function"
        ) {
            throw new Error(
                "[EventBus] callback must be a function."
            );
        }

        if (
            !this.events.has(eventName)
        ) {
            this.events.set(
                eventName,
                new Set()
            );
        }

        const listeners =
            this.events.get(eventName);

        listeners.add(callback);


        // 返回取消监听函数
        return () => {
            this.off(
                eventName,
                callback
            );
        };
    }


    /**
     * 只监听一次
     */
    once(eventName, callback) {

        const unsubscribe =
            this.on(
                eventName,
                (...args) => {

                    unsubscribe();

                    callback(...args);
                }
            );

        return unsubscribe;
    }


    /**
     * 删除监听
     */
    off(eventName, callback) {

        const listeners =
            this.events.get(eventName);

        if (!listeners) {
            return;
        }

        listeners.delete(callback);

        if (
            listeners.size === 0
        ) {
            this.events.delete(eventName);
        }
    }


    /**
     * 发布事件
     */
    emit(eventName, payload = {}) {

        const listeners =
            this.events.get(eventName);

        if (!listeners) {
            return;
        }

        /*
         * 使用 [...listeners]
         * 防止某个 listener 在执行过程中
         * 修改监听列表导致遍历异常。
         */

        [
            ...listeners
        ].forEach(callback => {

            try {

                callback(payload);

            } catch (error) {

                console.error(
                    `[EventBus] Error in event "${eventName}":`,
                    error
                );
            }
        });
    }


    /**
     * 异步发布事件
     *
     * 当以后某些监听器需要 async 时使用。
     */
    async emitAsync(
        eventName,
        payload = {}
    ) {

        const listeners =
            this.events.get(eventName);

        if (!listeners) {
            return;
        }

        await Promise.all(

            [...listeners].map(
                async callback => {

                    try {

                        await callback(
                            payload
                        );

                    } catch (error) {

                        console.error(
                            `[EventBus] Async error in event "${eventName}":`,
                            error
                        );
                    }
                }
            )
        );
    }


    /**
     * 删除某个事件的全部监听
     */
    clear(eventName) {

        if (eventName) {

            this.events.delete(
                eventName
            );

            return;
        }

        // 不传参数则清空全部
        this.events.clear();
    }


    /**
     * 获取当前监听数量
     */
    listenerCount(eventName) {

        const listeners =
            this.events.get(eventName);

        if (!listeners) {
            return 0;
        }

        return listeners.size;
    }


    /**
     * 查看当前注册的事件名称
     */
    getEventNames() {

        return [
            ...this.events.keys()
        ];
    }
}


/**
 * 创建默认 EventBus
 */
export const eventBus =
    new EventBus();
