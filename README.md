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

## 启动（规划）

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```
