/**
 * SweetDream
 * AI Engine
 * 
 * 游戏 AI 核心桥接器。
 * 负责收集静态库与动态状态，动态拼装系统提示词（System Prompt），
 * 向大模型发起请求，解析 AI 决策并触发 EventBus 事件。
 */

import { eventBus } from "./eventBus.js";
import { stateManager } from "./stateManager.js";
import { DatabaseManager } from "../database/databaseManager.js";

class AIEngine {
    constructor() {
        this.db = new DatabaseManager();
        this.apiConfig = {
            endpoint: "https://api.openai.com/v1/chat/completions", // 支持替换为 DeepSeek/Claude 等中转 API
            apiKey: "", // 运行时由玩家在前端 Debug 选项中输入，防止在 GitHub 代码中泄露
            model: "gpt-4o-mini" // 推荐使用响应速度快、支持 JSON 返回的轻量模型
        };
    }

    /**
     * 初始化配置
     */
    setApiConfig(apiKey, endpoint = "", model = "") {
        if (apiKey) this.apiConfig.apiKey = apiKey;
        if (endpoint) this.apiConfig.endpoint = endpoint;
        if (model) this.apiConfig.model = model;
    }

    /**
     * 核心方法：构建动态的系统提示词（Context-Aware Prompt）
     * 该提示词会让 AI 极度精准地认知当前游戏规则，确保其生成的内容不越界。
     */
    async buildSystemPrompt() {
        const player = stateManager.getPlayer();
        const controller = stateManager.getController();
        const progression = stateManager.getProgressionState();

        if (!player || !controller) {
            return "你目前是一个文游助手，当前游戏尚未初始化。";
        }

        // 查询当前的物理场景设定
        const scene = await this.db.findById("scenes", controller.currentScene || "scene_bedroom");
        // 获取可执行的 Action 列表
        const allowedActions = await this.db.get("actions");

        // 整理当前角色信息和抗性上限
        const limitsText = player.limits?.items?.join(", ") || "无";
        const triggersText = player.triggers?.join(", ") || "未设定";

        // 将当前状态编译为 AI 能理解的绝对设定
        return `
你现在是网页文字游戏《Sweet Dream》中的操控者（Controller）。请严格遵循以下设定并进行扮演。

【操控者设定】
- 当前外显人格 (Primary Mask): ${controller.primaryMask || "温柔引导"}
- 潜在隐藏人格 (Hidden Mask): ${controller.hiddenMask || "若即若离"}
- 底层核心动机 (Core Motif): ${controller.core || "渴求关注"}
- 操控起始点: ${controller.controlStartingPoint || "未知"}
- 当前操控等级: Lv.${controller.controllerLevel} (经验: ${controller.controllerExperience}/100)

【目标(玩家)身体与心理设定】
- 名字: ${player.name} | 性别: ${player.gender} | 年龄: ${player.age}
- 敏感部位: ${player.areas?.join(", ") || "阴部"}
- 羞耻感倾向: ${player.shame || "中等"} | 身体耐力: ${player.endurance || "中等"}
- 兴奋触发因素: ${triggersText}
- ❌ 绝对排斥项 (绝对禁止生成、禁止触碰的内容): ${limitsText}
- ❌ 关系设定: 你们在现实中的关系是 "${controller.relationship || "青梅竹马"}"，但目标（玩家）初始对此操控完全不知情。

【当前场景与环境安全限制】
- 场景地点: ${scene?.name || "卧室"}
- 环境描述: ${scene?.description || "私密环境"}
- 风险级别 (0-10): 风险值为 ${scene?.risk?.score || 0} (${scene?.risk?.description || "无风险"})
- NPC状态: ${scene?.npc?.enabled ? `有 NPC 存在 (数量: ${scene.npc.count.min}-${scene.npc.count.max})，注意度增长率为 [${scene.npc.attention?.growthRate}]` : "无NPC，环境绝对隐私。"}

【当前运行时数值状态】
- 目标当前高潮值: ${controller.orgasmValue}% (达到 100% 目标将强制高潮)
- 目标当前苏醒值: ${controller.wakeValue}% (达到 100% 目标将惊醒并导致调教当即中断)
- 目标当前沦陷值阶段: ${progression?.corruption || 10}%
- 目标当前觉醒度阶段: ${progression?.awakening || 0}%

【输出格式控制（极其重要）】
你的回复必须包含两个部分，两部分之间使用特定的标签分隔：
1. 【剧情文本】：符合上述人格背景的动作、心理或对话描写。字数控制在 150-250 字内。注意要贴合场景风险度！
2. 【决策命令】：在文本最后，根据玩家的表现和你刚才生成的文案，决定执行哪一个交互动作。
请直接在回复最后输出一个标准的 JSON 指令，格式必须用标签包裹：
<action>
{
    "actionId": "执行的动作ID（例如: hand_interaction 或 sex_toy_activation）",
    "options": {
        "targetPartSensitive": true/false（本次动作是否攻击了其敏感部位，从而应用1.5倍高潮增速）,
        "isPublicScene": true/false（当前场景是否是公共公开环境）,
        "highGear": true/false（是否将道具开启到了高档位，仅在持有对应道具时可用）
    }
}
</action>

可选动作ID参考：
${JSON.stringify(allowedActions.actions.map(a => ({ id: a.id, name: a.name, desc: a.description })))}
        `;
    }

    /**
     * 发送玩家的输入并获取 AI 的解析结果
     * @param {string} userMessage 玩家的回复/当前动作配合
     */
    async generateStoryProgress(userMessage) {
        if (!this.apiConfig.apiKey) {
            eventBus.emit("ai:error", "请先配置 API Key。");
            return "【提示】请先在设置中填写并保存您的 AI API Key。";
        }

        const systemPrompt = await this.buildSystemPrompt();

        try {
            // 向 LLM 发送请求
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

            if (!response.ok) {
                throw new Error(`HTTP 异常: ${response.status}`);
            }

            const resData = await response.json();
            const rawText = resData.choices[0]?.message?.content || "";

            // 解析返回的数据流
            return this.parseResponse(rawText);

        } catch (error) {
            console.error("[AIEngine] LLM 访问失败:", error);
            eventBus.emit("ai:error", error.message);
            return "【连接异常】无法与 AI 节点建立通信，请检查网络设置或 Key 额度。";
        }
    }

    /**
     * 使用正则表达式提取并分离【剧情文本】与【结构化命令】
     */
    parseResponse(rawText) {
        // 利用正则匹配 <action>...</action> 内部包裹的 JSON
        const actionReg = /<action>([\s\S]*?)<\/action>/;
        const match = rawText.match(actionReg);

        let narrativeText = rawText.replace(actionReg, "").trim();
        let parsedAction = null;

        if (match && match[1]) {
            try {
                parsedAction = JSON.parse(match[1].trim());
            } catch (err) {
                console.warn("[AIEngine] 解析决策命令 JSON 失败:", err, match[1]);
            }
        }

        // 如果解析到了有效的决策命令，立刻通过 EventBus 喂给 Runtime 驱动状态机
        if (parsedAction && parsedAction.actionId) {
            console.log("[AIEngine] AI 成功执行决策命令:", parsedAction);
            eventBus.emit("action:trigger", {
                actionId: parsedAction.actionId,
                options: parsedAction.options || {}
            });
        }

        return narrativeText;
    }
}

export const aiEngine = new AIEngine();
