/**
 * SweetDream
 * Database Configuration
 *
 * 负责定义所有静态数据库的位置以及数据库名称。
 *
 * 注意：
 * 这里保存的是“静态数据库”的配置，
 * 不保存任何游戏运行时变量。
 */

export const DATABASE_CONFIG = {
    basePath: "/database",

    sources: {
        actions: {
            file: "actions.json",
            description: "动作数据库"
        },

        controller: {
            file: "controller.json",
            description: "操控者系统规则数据库"
        },

        controller_masks: {
            file: "controller_masks.json",
            description: "操控者随机生成数据库"
        },

        items: {
            file: "items.json",
            description: "道具数据库"
        },

        penalties: {
            file: "penalties.json",
            description: "惩罚数据库"
        },

        progression: {
            file: "progression.json",
            description: "成长与等级数据库"
        },

        rewards: {
            file: "rewards.json",
            description: "奖励数据库"
        },

        scenes: {
            file: "scenes.json",
            description: "场景数据库"
        },

        tasks: {
            file: "tasks.json",
            description: "任务数据库"
        }
    }
};


/**
 * 根据数据库名称生成完整 URL
 *
 * 例如：
 * getDatabaseUrl("tasks")
 *
 * => /database/tasks.json
 */
export function getDatabaseUrl(databaseName) {
    const source = DATABASE_CONFIG.sources[databaseName];

    if (!source) {
        throw new Error(
            `[DatabaseConfig] 未找到数据库：${databaseName}`
        );
    }

    return `${DATABASE_CONFIG.basePath}/${source.file}`;
}


/**
 * 获取所有数据库名称
 */
export function getDatabaseNames() {
    return Object.keys(DATABASE_CONFIG.sources);
}
