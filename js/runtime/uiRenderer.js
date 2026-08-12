/**
 * SweetDream
 * UI Responsive Console Renderer
 * 
 * 极简主界面 + 数据驱动型自适应 ASCII 弹窗渲染中枢。
 * 路径：js/runtime/uiRenderer.js (新建文件)
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

        // 2. 绑定事件总线，监听中间变量变化
        eventBus.on("action:resolved", (e) => {
            this.writeSystemLog(`系统检测：受到指令刺激。当前体内高潮值累计达 ${e.currentOrgasm.toFixed(0)}%，苏醒值上升至 ${e.currentWake.toFixed(0)}%`);
        });

        eventBus.on("target:woken", () => {
            this.writeSystemLog("❌ 警报：苏醒值触顶，在惊恐中瞬间从床上惊醒！连线被强行切断。");
        });

        eventBus.on("climax:triggered", () => {
            this.writeSystemLog("⚡ 警告：高潮值触顶，重置高潮值并提升操控等级。");
        });

        // 3. 载入第一章开局引言
        this.loadOpeningPlot();
    }

    /**
     * 更新顶部时间戳
     */
    updateTimeDisplay() {
        const timeBox = document.querySelector(".system-title");
        if (timeBox) {
            const formatted = this.currentTime.toLocaleString("zh-CN", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", hour12: false
            });
            timeBox.innerText = `⏱ CONNECTED TERMINAL - [ ${formatted} ]`;
        }
    }

    /**
     * 加载序幕文案
     */
    loadOpeningPlot() {
        this.terminal.innerHTML = `
            <p>那天早上醒来，你发现手机屏幕上多了一个粉色图标。</p>
            <p>「Sweet Dream」——你不记得下载过。删不掉。重启没用。</p>
            <p>你咬着嘴唇点开它。系统提示音突然响亮，第一条任务冷冰冰地弹了出……</p>
        `;
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    /**
     * 发送玩家行为并推进时间与 AI 进度
     */
    async handleInputSubmit() {
        const text = this.inputElement.value.trim();
        if (!text) return;

        this.inputElement.value = "";
        this.writePlayerInput(text);

        // 推进时间（每回合30分钟）
        this.currentTime.setMinutes(this.currentTime.getMinutes() + 30);
        this.updateTimeDisplay();

        // 呼叫 AI 决策
        this.writeSystemLog("正在同步梦境电波信号...");
        const responseText = await aiEngine.generateStoryProgress(text);
        this.writeAIPilot(responseText);
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
        
        lines.push(this.formatLine(`目标编号：#3811`, `姓名：${player.name}`));
        
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

        const mask = ctrl.primaryMask || "操控者";
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
        lines.push(this.formatLine(`主显外壳：${ctrl.primaryMask || "温柔引导"}`));
        lines.push(this.formatLine(`隐藏人格：(未解锁)`));
        lines.push(this.formatLine(`操控等级：Lv.${ctrl.controllerLevel || 1}`, `经验:${ctrl.controllerExperience || 0}/100`));
        lines.push(this.formatLine(`人际契合：${ctrl.relationship || "青梅竹马"}`));
        lines.push(this.formatLine(`控制起点：${ctrl.controlStartingPoint ? ctrl.controlStartingPoint.substring(0, 11) + "..." : "未知"}`));
        lines.push("├──────────────────────────────────────┤");
        lines.push(this.formatLine("【契约感知开关】"));
        if (ctrl.switches && ctrl.switches.length > 0) {
            ctrl.switches.forEach(sw => {
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

window.enterGameTerminal = () => {
    document.getElementById("view-match").classList.add("hidden");
    document.getElementById("view-game").classList.remove("hidden");
    uiRenderer.start();
};

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
