/**
 * SweetDream
 * Database Configuration
 */

export const DATABASE_CONFIG = {
    // 匹配你 GitHub 项目中的真实静态文件路径，使用相对路径避免部署在 GitHub Pages 子目录时失效
    basePath: "data/library",

    sources: {
        actions: { file: "actions.json", description: "动作数据库" },
        controller: { file: "controller.json", description: "操控者系统规则数据库" },
        controller_masks: { file: "controller_masks.json", description: "操控者随机生成数据库" },
        items: { file: "items.json", description: "道具数据库" },
        penalties: { file: "penalties.json", description: "惩罚数据库" },
        progression: { file: "progression.json", description: "成长与等级数据库" },
        rewards: { file: "rewards.json", description: "奖励数据库" },
        scenes: { file: "scenes.json", description: "场景数据库" },
        tasks: { file: "tasks.json", description: "任务数据库" }
    }
};

/**
 * 根据数据库名称生成完整 URL
 */
export function getDatabaseUrl(databaseName, customBase = "") {
    const source = DATABASE_CONFIG.sources[databaseName];
    if (!source) {
        throw new Error(`[DatabaseConfig] 未找到数据库：${databaseName}`);
    }
    const base = customBase || DATABASE_CONFIG.basePath;
    return `${base}/${source.file}`;
}

/**
 * 获取所有数据库名称
 */
export function getDatabaseNames() {
    return Object.keys(DATABASE_CONFIG.sources);
}
