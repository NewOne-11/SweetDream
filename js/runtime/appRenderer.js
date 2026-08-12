/**
 * SweetDream
 * App ASCII Screen Renderer
 * 
 * 专门根据你的 StateManager 运行时数据，构建对齐一致的 ASCII 目标手机面板。
 */

export class AppRenderer {
    constructor() {
        this.width = 40; // 面板标准外框宽度
    }

    getCharWidth(str) {
        let width = 0;
        for (let i = 0; i < str.length; i++) {
            width += str.charCodeAt(i) > 127 ? 2 : 1;
        }
        return width;
    }

    formatLine(leftText, rightText = "", panelWidth = 36) {
        const leftWidth = this.getCharWidth(leftText);
        const rightWidth = this.getCharWidth(rightText);
        const padding = " ".repeat(Math.max(0, panelWidth - leftWidth - rightWidth));
        return `│  ${leftText}${padding}${rightText}  │`;
    }

    buildProgressBar(value, size = 10) {
        const ratio = Math.min(100, Math.max(0, value)) / 100;
        const filled = Math.round(ratio * size);
        const empty = size - filled;
        return "█".repeat(filled) + "░".repeat(empty);
    }

    /**
     * 读取状态对象并渲染 ASCII 面板
     */
    render(state) {
        const lines = [];
        
        lines.push("┌──────────────────────────────────────┐");
        lines.push(this.formatLine("Sweet Dream (Active Target)"));
        lines.push("├──────────────────────────────────────┤");

        // 1. 读取 Target 属性
        const name = state.currentProgress?.name || "███";
        const corruption = state.currentProgress?.corruption || 10;
        lines.push(this.formatLine(`目标编号：#3811`, `姓名：${name}`));
        
        let cDesc = "理智尚在";
        if (corruption > 80) cDesc = "彻底沦陷";
        else if (corruption > 60) cDesc = "高度沉溺";
        else if (corruption > 40) cDesc = "身体先于理智";
        else if (corruption > 20) cDesc = "开始沉溺";
        lines.push(this.formatLine(`状态阶段：${cDesc}`, `沦陷度:${corruption}%`));
        lines.push(this.formatLine(`隐藏觉醒：${state.targetAwareness}%`));
        lines.push("├──────────────────────────────────────┤");

        // 2. 动态展示进行中的任务 (从 State 树中读取当前任务 ID)
        lines.push(this.formatLine("【当前进行中任务】"));
        if (state.currentTaskId) {
            lines.push(this.formatLine(`☐ 任务ID: ${state.currentTaskId}`, "★"));
        } else {
            lines.push(this.formatLine("☐ 暂时没有被发布强制命令"));
        }
        lines.push("├──────────────────────────────────────┤");

        // 3. 动态博弈双值
        const oBar = this.buildProgressBar(state.orgasmValue || 0, 10);
        const wBar = this.buildProgressBar(state.wakeValue || 0, 10);
        lines.push(this.formatLine(`体内热度: [${oBar}]`, `${(state.orgasmValue || 0).toFixed(0)}%`));
        lines.push(this.formatLine(`苏醒危机: [${wBar}]`, `${(state.wakeValue || 0).toFixed(0)}%`));
        lines.push("├──────────────────────────────────────┤");

        // 4. 动态私信预览 (读取最新私信历史)
        const mask = state.controllerProfile?.maskPrimary || "操控者";
        lines.push(this.formatLine("【未读私信】"));
        lines.push(this.formatLine(`${mask}：今天第二个任务好好做。`));
        lines.push("├──────────────────────────────────────┤");

        // 5. 动态物品背包
        lines.push(this.formatLine("【安全背包】"));
        const invKeys = Object.keys(state.inventory || {});
        if (invKeys.length > 0) {
            invKeys.forEach(itemId => {
                lines.push(this.formatLine(`- 物品: ${itemId}`, `数量:${state.inventory[itemId]}`));
            });
        } else {
            lines.push(this.formatLine("- 暂时没有收获任何道具卡券"));
        }
        lines.push("└──────────────────────────────────────┘");

        return lines.join("\n");
    }
}

export const appRenderer = new AppRenderer();
