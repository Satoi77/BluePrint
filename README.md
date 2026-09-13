# BluePrint — 项目蓝图可视化系统

本地运行的蓝图可视化工具：指定一个项目目录，自动扫描 Python 文件并读取 Git 提交历史，生成 import 依赖图，在无限画布上以科技树式圆圈节点展示，用颜色区分新旧提交。

## 状态

MVP（最小可运行原型）阶段。设计见 `docs/工程设计文档_v1.0.md`，施工单见 `docs/实施步骤文档_v1.0.md`。

## 目录

```
backend/    FastAPI 后端（扫描 + Git + 构图 + 日志）
frontend/   React + TypeScript + React Flow 前端
docs/       设计与实施文档
```

## 启动

### 首次：安装依赖

```bat
cd backend
pip install -r requirements.txt

cd ..\frontend
npm install --registry=https://registry.npmmirror.com
```

### 一键启动（推荐）

双击项目根目录的 **`start.bat`**：自动启动后端(8000)与前端(5173)并打开浏览器。关闭弹出的两个命令行窗口即停止服务。

### 手动启动（两个终端）

```bat
:: 终端 1 — 后端
cd backend
python -m uvicorn app.main:app --port 8000

:: 终端 2 — 前端
cd frontend
npm run dev
```

浏览器打开 **http://localhost:5173/**。

### 使用

1. 顶部输入项目目录（含 `.git` 的 Python 项目），点「扫描」。
2. 顶部切换「大功能块 / 子功能 / 原子功能」查看分层。
3. 点节点 → 右侧编辑面板可改名称/描述/层级/文件，新增或删除节点；拖圆点手动连线；点连线删除。
4. 「导出说明」下载 `blueprint_spec.md`，交给 AI Agent 修改代码。

> 首次扫描会落到本地数据库 `backend/data/blueprint.db`，下次打开自动恢复上次项目。
