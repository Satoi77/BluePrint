# BluePrint — 项目蓝图可视化系统

把代码库（**任意语言**）的**功能结构**画成一张可钻取、可编辑的蓝图：

```
根 → 主干 → 枝干 → 树叶
（系统总入口 → 大功能块 → 子功能 → 原子功能/函数）
```

- **AI Agent 建图**：功能结构由 Agent 阅读代码生成 `blueprint.json`，BluePrint 只负责导入、渲染与 Git 状态增强（不做语义分析）。
- **多语言**：Python / JS / TS / Vue / React / Java / Go / C / C++ / C# / Rust / Shell…；前后端同一业务归入同一大功能块。
- **本地优先**：纯本地运行（FastAPI + React），数据存本地 SQLite，断网可用。
- **可编辑**：节点增删改、手动连线、导出结构化说明回喂 Agent；所有操作自动保存。

## 文档

- 使用说明：[`docs/使用说明.md`](docs/使用说明.md)
- 蓝图生成规范（Agent 建图）：[`docs/蓝图生成规范.md`](docs/蓝图生成规范.md)
- Agent skill：[`.opencode/skills/blueprint-generation/SKILL.md`](.opencode/skills/blueprint-generation/SKILL.md)
- 工程设计：[`docs/工程设计文档_v1.0.md`](docs/工程设计文档_v1.0.md)
- 实施步骤：[`docs/实施步骤文档_v1.0.md`](docs/实施步骤文档_v1.0.md)

## 目录

```
backend/    FastAPI 后端（扫描 + Git + 蓝图渲染 + 编辑 + 日志）
frontend/   React + TypeScript + React Flow 前端
docs/       设计与使用文档
examples/   Agent 蓝图示例
```

## 快速开始

```bat
:: 首次：安装依赖
cd backend && pip install -r requirements.txt
cd ..\frontend && npm install --registry=https://registry.npmmirror.com

:: 一键启动（推荐）：双击 start.bat
:: 或手动：
:: 终端 1   cd backend  && python -m uvicorn app.main:app --port 8000
:: 终端 2   cd frontend && npm run dev
```

浏览器打开 **http://localhost:5173/**。

## 使用

1. 顶部粘贴一个含 `.git` 的项目目录，点「扫描」；或点左上角 ☰ 菜单**新建空白项目**自己设计。
2. 默认显示「根 + 主干」；**点主干逐级展开**（主干→枝干→树叶），点空白处返回上一级。
3. 顶部「全部原子功能」一次查看全部原子功能与调用关系；搜索框按**功能名**模糊查找并跳转。
4. 点节点 → 右侧编辑面板增删改；悬停圆圈出现蓝点可手动连线；点连线删除。
5. 「导出说明」下载 `blueprint_spec.md` 交给 Agent 改代码。

## 技术栈

FastAPI · Uvicorn · SQLite · React 18 · TypeScript · Vite · React Flow v12 · Zustand · TailwindCSS

## 许可证

[MIT](LICENSE)
