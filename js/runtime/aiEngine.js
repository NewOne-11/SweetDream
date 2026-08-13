/**
 * js/runtime/aiEngine.js
 */

import { eventBus } from "./eventBus.js";
import { stateManager } from "./stateManager.js";
import { DatabaseManager } from "../database/databaseManager.js";

class AIEngine {
    constructor() {
        this.db = new DatabaseManager();
        this.apiConfig = {
            endpoint: "https://api.openai.com/v1/chat/completions",
            apiKey: "", 
            model: "gpt-4o-mini" 
        };
    }

    setApiConfig(apiKey, endpoint = "", model = "") {
        if (apiKey) this.apiConfig.apiKey = apiKey;
        if (endpoint) this.apiConfig.endpoint = endpoint;
        if (model) this.apiConfig.model = model;
    }

    async buildSystemPrompt() {
        // 核心修正：使用你编写的 stateManager.get("路径") 语法读取变量
        const player = stateManager.get("playerProfile");
        const ctrlProfile = stateManager.get("controllerProfile");
        const state = stateManager.get(); // 获取整棵状态树

        if (!player || !ctrlProfile) return "系统尚未数据连线";

        return `
你现在是《Sweet Dream》中的操控者（Controller）。
【操控者设定】
- 主面具: ${ctrlProfile.maskPrimary}
- 核心: ${ctrlProfile.core}
- 关系: ${ctrlProfile.relationship}
【目标设定】
- 名字: ${player.name} | 性别: ${player.gender}
- 排斥项: ${player.limits?.items?.join(", ") || "无"}
        `;
    }

    async generateStoryProgress(userMessage) {
        if (!this.apiConfig.apiKey) {
            return "【连接提示】请先在“设定书”面板中配置您的 OpenAI/DeepSeek 密钥（API Key）后开始游玩。";
        }

        const systemPrompt = await this.buildSystemPrompt();

        try {
            const response = await fetch(this.apiConfig.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: this.apiConfig.model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const resData = await response.json();
            return resData.choices[0]?.message?.content || "";
        } catch (error) {
            console.error(error);
            return `【连线故障】电波发送失败：${error.message}`;
        }
    }
}

export const aiEngine = new AIEngine();
