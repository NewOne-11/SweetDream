/**
 * SweetDream
 * Event Bus
 * 
 * 极简的事件发布-订阅器，用于模块间解耦通信。
 */

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * 订阅事件
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * 取消订阅
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const filtered = this.listeners.get(event).filter(cb => cb !== callback);
        this.listeners.set(event, filtered);
    }

    /**
     * 广播事件
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventBus] 事件 [${event}] 监听执行出错:`, error);
            }
        });
    }
}

// 导出全局单例
export const eventBus = new EventBus();
