/**
 * SweetDream
 * UI Responsive Console Renderer & Controller Generator (Combined)
 * 
 * 极简主界面 + 操控者生成系统 + 数据驱动型自适应 ASCII 弹窗渲染中枢。
 * 路径：js/runtime/uiRenderer.js
 */

import { eventBus } from "./eventBus.js";
import { stateManager } from "./stateManager.js";
import { DatabaseManager } from "../database/databaseManager.js";
import { aiEngine } from "./aiEngine.js";

class UiRenderer {
    constructor() {
        this.db = new DatabaseManager();
        this.terminal = document.getElementById("story-log");
        this.inputElement = document.getElementById("action-input");
        this.currentTime = new Date();
        this.panelWidth = 36; // 内部有效字符宽度
    }

/**
     * 进入游戏终端并启动
     */
    async start() {
        await this.db.initialize();

        // 1. 初始化界面顶部的时间日期
        this.updateTimeDisplay();

        // 2. 绑定事件总线
        eventBus.on("action:resolved", (e) => {
            this.writeSystemLog(`系统检测：受到指令刺激。当前体内高潮值累计达 ${e.currentOrgasm.toFixed(0)}%，苏醒值上升至 ${e.currentWake.toFixed(0)}%`);
        });

        eventBus.on("target:woken", () => {
            this.writeSystemLog("❌ 警报：苏醒值触顶，在惊恐中瞬间从床上惊醒！连线被强行切断。");
        });

        eventBus.on("climax:triggered", () => {
            this.writeSystemLog("⚡ 警告：高潮值触顶，重置高潮值并提升操控等级。");
        });

        // 3. 执行 AI 冷启动初始化：强制让 AI 认知其当前分配好的 Persona，并产出初章叙事
        await this.triggerAiColdStart();
    }

    /**
     * AI 开局神经冷启动
     */
    async triggerAiColdStart() {
        this.writeSystemLog("正在初始化操控者神经突触连线...");
        
        const player = stateManager.getPlayer();
        const ctrl = stateManager.getController();

        // 组装开局引导指令
        const initInstruction = `
[SYSTEM: 角色创建已成功，游戏正式开始。
目标玩家名字是 "${player.name}"。
你被分配到的操控者人格面具为 "主面具: ${ctrl.primaryMask}"，现实中是目标玩家的 "${ctrl.relationship}"。
请根据你被分配到的外显人格，撰写开局第一幕的剧情：描述玩家早上醒来发现手机上多了一个删不掉的名为「Sweet Dream」的粉色图标，引导他们惊慌点开它，并发送第一条带有调逗或命令性质的操控者私信。]
        `;

        // 呼叫 AI 生成
        const firstGreeting = await aiEngine.generateStoryProgress(initInstruction);
        this.writeAIPilot(firstGreeting);
    }

    /* ------------------- 文本记录输出工具 ------------------- */

    writeSystemLog(text) {
        const div = document.createElement("div");
        div.className = "system-log-message";
        div.innerHTML = `&gt;&gt; ${text}`;
        this.terminal.appendChild(div);
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    writePlayerInput(text) {
        const div = document.createElement("div");
        div.className = "player-speech-bubble";
        div.innerHTML = `<span class="spe-lbl">[你]：</span>${text}`;
        this.terminal.appendChild(div);
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    writeAIPilot(text) {
        const div = document.createElement("div");
        div.className = "ai-narrative-bubble";
        div.innerHTML = `<span class="ctrl-lbl">[APP/叙事]：</span>${text}`;
        this.terminal.appendChild(div);
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    /* ------------------- ASCII 字符排版与截断引擎 ------------------- */

    getCharWidth(str) {
        let width = 0;
        for (let i = 0; i < str.length; i++) {
            width += str.charCodeAt(i) > 127 ? 2 : 1;
        }
        return width;
    }

    truncateText(str, maxLength) {
        let width = 0;
        let result = "";
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const charWidth = str.charCodeAt(i) > 127 ? 2 : 1;
            if (width + charWidth > maxLength - 3) {
                result += "...";
                break;
            }
            result += char;
            width += charWidth;
        }
        return result;
    }

    formatLine(leftText, rightText = "") {
        let cleanLeft = leftText;
        let cleanRight = rightText;

        const maxLeftWidth = this.panelWidth - this.getCharWidth(rightText) - 2;
        if (this.getCharWidth(leftText) > maxLeftWidth) {
            cleanLeft = this.truncateText(leftText, maxLeftWidth);
        }

        const leftWidth = this.getCharWidth(cleanLeft);
        const rightWidth = this.getCharWidth(cleanRight);
        const padding = " ".repeat(Math.max(0, this.panelWidth - leftWidth - rightWidth));
        
        return `│  ${cleanLeft}${padding}${cleanRight}  │`;
    }

    buildProgressBar(value, size = 10) {
        const ratio = Math.min(100, Math.max(0, value)) / 100;
        const filled = Math.round(ratio * size);
        const empty = size - filled;
        return "█".repeat(filled) + "░".repeat(empty);
    }

    /* ------------------- 响应式实时数据解析器 ------------------- */

    async buildTargetAppUI(player, ctrl, prog) {
        const lines = [];
        lines.push("┌──────────────────────────────────────┐");
        lines.push(this.formatLine("Sweet Dream (Active)"));
        lines.push("├──────────────────────────────────────┤");
        
        lines.push(this.formatLine(`目标编号：#3811`, `姓名：${player.profile?.identity?.name || "玩家"}`));
        
        const corr = prog.corruption || 10;
        const awak = prog.awakening || 0;
        let cDesc = "理智尚在";
        if (corr > 80) cDesc = "彻底沦陷";
        else if (corr > 60) cDesc = "高度沉溺";
        else if (corr > 40) cDesc = "身体先于理智";
        else if (corr > 20) cDesc = "开始沉溺";
        
        lines.push(this.formatLine(`沦陷状态：${cDesc}`, `沦陷值:${corr}%`));
        lines.push(this.formatLine(`隐藏觉醒：??`, `觉醒值:${awak}%`));
        lines.push("├──────────────────────────────────────┤");

        lines.push(this.formatLine("【当前进行中任务】"));
        
        const activeTasks = ctrl.activeTasks || ["init_001", "init_004"]; 
        for (const taskId of activeTasks) {
            const staticTask = await this.db.findById("tasks", taskId);
            if (staticTask) {
                lines.push(this.formatLine(`☐ ${staticTask.title}`, `★`));
                lines.push(this.formatLine(`  条件:${staticTask.description.substring(0, 15)}...`));
                lines.push(this.formatLine(`  奖励: 沦陷值 +${staticTask.corruption}`));
            }
        }
        lines.push("├──────────────────────────────────────┤");

        const oBar = this.buildProgressBar(ctrl.orgasmValue || 0, 10);
        const wBar = this.buildProgressBar(ctrl.wakeValue || 0, 10);
        lines.push(this.formatLine(`高潮热度: [${oBar}]`, `${(ctrl.orgasmValue || 0).toFixed(0)}%`));
        lines.push(this.formatLine(`生理苏醒: [${wBar}]`, `${(ctrl.wakeValue || 0).toFixed(0)}%`));
        lines.push("├──────────────────────────────────────┤");

        const mask = ctrl.controllerProfile?.maskPrimary || "操控者";
        lines.push(this.formatLine(`【实时私信】`));
        if (ctrl.privateMessages && ctrl.privateMessages.length > 0) {
            const latestMsg = ctrl.privateMessages[ctrl.privateMessages.length - 1];
            lines.push(this.formatLine(`${mask}：${latestMsg}`));
        } else {
            lines.push(this.formatLine(`${mask}：今天第二个任务好好做。`));
        }
        lines.push("├──────────────────────────────────────┤");

        lines.push(this.formatLine(`【我的安全背包】`));
        const invKeys = Object.keys(ctrl.inventory || {});
        if (invKeys.length > 0) {
            for (const itemId of invKeys) {
                const staticItem = await this.db.findById("items", itemId);
                const itemName = staticItem ? staticItem.name : itemId;
                lines.push(this.formatLine(`- ${itemName}`, `数量: ${ctrl.inventory[itemId]}`));
            }
        } else {
            lines.push(this.formatLine("- 暂时没有收获任何道具卡券"));
        }
        lines.push("└──────────────────────────────────────┘");

        return lines.join("\n");
    }

    buildControllerMonitorUI(player, ctrl) {
        const lines = [];
        lines.push("┌──────────────────────────────────────┐");
        lines.push(this.formatLine("Controller Status Monitor"));
        lines.push("├──────────────────────────────────────┤");
        lines.push(this.formatLine(`主显外壳：${ctrl.controllerProfile?.maskPrimary || "温柔引导"}`));
        lines.push(this.formatLine(`隐藏人格：(未解锁)`));
        lines.push(this.formatLine(`操控等级：Lv.${ctrl.controllerLevel || 1}`, `经验:${ctrl.controllerExperience || 0}/100`));
        lines.push(this.formatLine(`人际契合：${ctrl.controllerProfile?.relationship || "青梅竹马"}`));
        lines.push(this.formatLine(`控制起点：${ctrl.controllerProfile?.controlStart ? ctrl.controllerProfile.controlStart.substring(0, 11) + "..." : "未知"}`));
        lines.push("├──────────────────────────────────────┤");
        lines.push(this.formatLine("【契约感知开关】"));
        if (ctrl.controllerProfile?.switches && ctrl.controllerProfile.switches.length > 0) {
            ctrl.controllerProfile.switches.forEach(sw => {
                lines.push(this.formatLine(`- 感知开启: ${sw}`));
            });
        } else {
            lines.push(this.formatLine("- 无任何触发器工作"));
        }
        lines.push("└──────────────────────────────────────┘");

        return lines.join("\n");
    }
}

export const uiRenderer = new UiRenderer();

// 核心过度桥接：拦截原保存角色行为，转入 Controller 生成掷点界面
setTimeout(() => {
    const originalSaveCharacter = window.saveCharacter;
    if (originalSaveCharacter) {
        window.saveCharacter = function() {
            // 1. 先执行你原始写好的保存和 IndexedDB 写入流程
            originalSaveCharacter();

            // 2. 切换界面视图到掷点面板
            document.getElementById("view-creator").classList.add("hidden");
            document.getElementById("view-match").classList.remove("hidden");

            // 3. 运行匹配生成管线
            startControllerRoll();
        };
    }
}, 200);

/**
 * 掷点匹配并向数据库写入初始中间变量
 */
async function startControllerRoll() {
    const logDiv = document.getElementById("match-loading-log");
    if (!logDiv) return;

    logDiv.innerHTML = "";
    const printLog = (text, delay = 350) => new Promise(res => setTimeout(() => {
        logDiv.innerHTML += `> <span style="color: #4ade80;">[SYSTEM]</span> ${text}<br/>`;
        logDiv.scrollTop = logDiv.scrollHeight;
        res();
    }, delay));

    try {
        await printLog("正在检测本地运行时状态...", 200);
        
        const response = await fetch("data/library/controller_masks.json");
        if (!response.ok) {
            throw new Error(`网络请求失败，HTTP 状态码: ${response.status}`);
        }
        const masksLib = await response.json();

        await printLog("读取玩家特征与性敏感度限制项中...", 300);
        const playerProfile = window.player || {}; // 获取 creator.js 内存中的玩家设定对象

        // 适配倾向 (增加安全可选链 ?. 保护)
        const rolePref = playerProfile.profile?.identity?.rolePreference || "被支配方(Sub/M)";
        let maskDirection = "dominant";
        if (rolePref.includes("Dom/S")) maskDirection = "submissive";
        if (rolePref.includes("Switch")) maskDirection = "mixed";

        // 匹配主面具
        const pool = masksLib.maskPool.filter(m => m.direction === maskDirection || m.direction === "mixed");
        const primaryMask = pool[Math.floor(Math.random() * pool.length)] || { name: "冷淡克制" };
        let hiddenMask = pool[Math.floor(Math.random() * pool.length)] || { name: "若即若离" };
        if (primaryMask.id === hiddenMask.id) {
            hiddenMask = pool.find(m => m.id !== primaryMask.id) || hiddenMask;
        }

        await printLog(`🎲 [主面具判定] 锁定的外显面具为: 〖${primaryMask.name}〗`, 500);
        await printLog(`🎲 [次面具判定] 锁定的隐藏面具为: 〖${hiddenMask.name}〗`, 400);

        // 匹配内核
        const cores = masksLib.corePool;
        const selectedCore = cores[Math.floor(Math.random() * cores.length)] || { name: "绝对支配" };
        await printLog(`🎲 [深层内心动机] 确定为: 〖${selectedCore.name}〗`, 400);

        // 匹配关系与起点
        const relationships = masksLib.relationshipPool.find(r => r.group === "daily_contact").items;
        const relation = relationships[Math.floor(Math.random() * relationships.length)] || "同学";
        const startingPoints = masksLib.startingPointPool;
        const startingPoint = startingPoints[Math.floor(Math.random() * startingPoints.length)] || { description: "当天操控" };

        await printLog(`🎲 [现实关系连线] 操控者身份是你的: 【${relation}】`, 400);
        await printLog(`🎲 [时空原点溯源] 连线起点：${startingPoint.description}`, 400);

        // 匹配开关
        const selectedSwitches = ["眼泪反应", "沉默制裁", "失控边缘"];
        await printLog(`🎲 [感官触觉开关] 已成功配置传感器：${selectedSwitches.join(", ")}`, 400);

        // 数据写入
        await printLog("正在同步连线状态到中间变量数据库...", 300);
        
        // 核心修正：移除 await stateManager.initialize() 这一行，直接同步写入变量
        stateManager.set("playerProfile", playerProfile);
        
        // 安全读取性羞耻度
        const shameLevel = playerProfile.psychology?.shame || "中等";
        const baseCorruption = shameLevel === "容易羞耻" ? 15 : (shameLevel === "不易羞耻" ? 5 : 10);

        // 核心修正：同步调用 stateManager.patch 写入生成的 Controller 参数
        stateManager.patch({
            controllerLevel: 1,
            controllerExperience: 0,
            orgasmValue: 12, // 初始预热值
            wakeValue: 5,
            currentScene: "scene_bedroom",
            currentTaskId: "init_001",
            inventory: {
                "eq_toy_tiaodan": 1,
                "ticket_skip_task": 1
            },
            controllerProfile: {
                generated: true,
                maskPrimary: primaryMask.name,
                maskHidden: hiddenMask.name,
                core: selectedCore.name,
                relationship: relation,
                switches: selectedSwitches,
                controlStart: startingPoint.description
            },
            currentProgress: {
                name: playerProfile.profile?.identity?.name || "未知",
                corruption: baseCorruption
            }
        });

        // 展现信息卡片内容
        document.getElementById("ctrl-primary-mask").innerText = primaryMask.name;
        document.getElementById("ctrl-core").innerText = selectedCore.name;
        document.getElementById("ctrl-relation").innerText = relation;
        document.getElementById("ctrl-starting").innerText = startingPoint.description.substring(0, 15) + "...";

        // 展示整个操作按钮组（重新匹配与确认继续）
        document.getElementById("controller-card").classList.remove("hidden");
        document.getElementById("match-actions").classList.remove("hidden");

        await printLog("✨ 连线链路建立成功，等待接入...", 200);

    } catch (e) {
        await printLog(`❌ 连线崩溃原因：${e.message}`, 0);
        console.error("游戏连线阶段崩溃详情:", e);
    }
}


window.handleInputKey = (event) => {
    if (event.key === "Enter") {
        uiRenderer.handleInputSubmit();
    }
};

window.sendActionText = () => {
    uiRenderer.handleInputSubmit();
};

window.showAppModal = async (tab) => {
    const overlay = document.getElementById("modal-overlay");
    const modal = document.getElementById("app-modal");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body-content");

    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");

    const player = stateManager.getPlayer();
    const ctrl = stateManager.getController();
    const prog = stateManager.getProgressionState();

    if (tab === "tasks") {
        title.innerText = "📱 Sweet Dream APP 终端";
        const asciiUI = await uiRenderer.buildTargetAppUI(player, ctrl, prog);
        body.innerHTML = `
            <p style="color: var(--accent-pink); font-size: 11px; margin-bottom: 8px;">提示：数据每回合同步更新。在截止前通过APP上传凭证。</p>
            <pre style="background: #000; color: #f43f5e; border: 1px solid #1f2235; border-radius: 4px; padding: 10px; font-family: monospace; font-size:11px; line-height: 1.35;">${asciiUI}</pre>
        `;
    } else if (tab === "bag") {
        title.innerText = "📟 操控者连接监控";
        const asciiCtrl = uiRenderer.buildControllerMonitorUI(player, ctrl);
        body.innerHTML = `
            <pre style="background: #000; color: #38bdf8; border: 1px solid #1f2235; border-radius: 4px; padding: 10px; font-family: monospace; font-size:11px; line-height: 1.35;">${asciiCtrl}</pre>
        `;
    } else if (tab === "settings") {
        title.innerText = "🛠 连线设置 & 系统手册";
        
        body.innerHTML = `
            <div style="background: #111422; padding: 12px; border-radius: 6px; border: 1px solid #1f2235; margin-bottom: 15px;">
                <div style="color: var(--accent-pink); font-weight: bold; font-size: 12px; margin-bottom: 8px;">📡 AI 神经连线配置</div>
                <div style="margin-bottom: 10px;">
                    <label style="font-size: 11px; color: var(--text-muted);">API 密钥 (API Key):</label>
                    <input type="password" id="modal-api-key" value="${aiEngine.apiConfig.apiKey || ''}" placeholder="sk-..." style="margin-top: 4px; font-size:12px; width:100%;" />
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="font-size: 11px; color: var(--text-muted);">自定义中转接口 (Endpoint):</label>
                    <input type="text" id="modal-api-endpoint" value="${aiEngine.apiConfig.endpoint || ''}" style="margin-top: 4px; font-size:12px; width:100%;" />
                </div>
                <div>
                    <label style="font-size: 11px; color: var(--text-muted);">使用模型 (Model):</label>
                    <input type="text" id="modal-api-model" value="${aiEngine.apiConfig.model || ''}" style="margin-top: 4px; font-size:12px; width:100%;" />
                </div>
                <button class="btn btn-primary" onclick="saveRuntimeApiConfig()" style="width:100%; margin-top:10px; padding: 8px; font-size:11px;">保存配置</button>
            </div>
            
            <p style='color: var(--border-pink); margin-bottom: 10px; font-size: 12px;'>系统手册 · 动作行为效果索引：</p>
            <div id="manual-actions-list">加载中...</div>
        `;

        const actionsLib = await uiRenderer.db.get("actions");
        let infoHtml = "";
        actionsLib.actions.forEach(act => {
            infoHtml += `
                <div style="background: #111422; padding: 8px; border-radius: 4px; margin-bottom: 6px; border: 1px solid #1f2235; font-size: 11px;">
                    <span style="color: var(--accent-blue); font-weight: bold;">${act.name}</span> - ${act.description}
                </div>
            `;
        });
        document.getElementById("manual-actions-list").innerHTML = infoHtml;
    }
};

window.saveRuntimeApiConfig = () => {
    const key = document.getElementById("modal-api-key").value.trim();
    const endpoint = document.getElementById("modal-api-endpoint").value.trim();
    const model = document.getElementById("modal-api-model").value.trim();

    aiEngine.setApiConfig(key, endpoint, model);
    alert("AI 神经连线参数已成功保存并启用。");
};

window.closeAppModal = () => {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.getElementById("app-modal").classList.add("hidden");
};



