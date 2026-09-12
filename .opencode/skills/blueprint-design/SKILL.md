---
name: blueprint-design
description: BluePrint（机器人大脑项目蓝图可视化）的架构设计约束。每次生成、修改本项目代码时必须加载此 skill。
---

# BluePrint 架构设计 Skill

> 由 initial-design-control 于 2026-09-13 生成。如需变更架构决策，重新执行 initial-design-control。

## 一、项目概要

本地运行的蓝图可视化系统：指定项目目录，自动扫描 Python 文件并读取 Git 历史，生成 import 依赖图，在无限画布上以科技树式圆圈节点展示，用颜色区分新旧提交。

## 二、核心技术约束（锁定）

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 项目类型 | 本地 Web（前后端分离） | 个人使用 |
| 设计方向 | 数据驱动（扫描 → 构图 → 展示） | 无事件编排 |
| 后端语言 | Python 3.12 | |
| 后端框架 | FastAPI + Uvicorn | |
| Git 读取 | subprocess 单次 `git log --name-only` | 不用 GitPython |
| AST 解析 | 标准库 `ast` | |
| 图算法 | 自建邻接表（MVP 不引 NetworkX） | |
| 前端 | React 18 + TypeScript + Vite + React Flow v12 + Zustand + Tailwind | |
| 布局 | @dagrejs/dagre，退化网格 | |
| 数据存储 | 蓝图不落库（内存计算）；日志落 SQLite（后端）/ IndexedDB（前端） | |
| 用户模型 | 单用户 | |
| 并发策略 | 单进程异步 | |
| 许可证 | 专有/本地（未指定） | |
| 部署方式 | 纯源码本地运行 | 无 Docker |

## 三、代码生成约束

### 架构约束
- 分层：`api`（路由）→ `services`（编排）→ `scanner`（纯逻辑），模型放 `models/schemas.py`
- `scanner/` 内模块保持纯函数、可单测，不直接处理 HTTP
- 所有对外响应使用 Pydantic 模型，字段名与 `docs/工程设计文档_v1.0.md` §3.3 一致
- MVP 只暴露 `POST /api/blueprint/scan`、`GET /api/health`、`POST /api/logs/export`，不提前加 v0.2 的其余接口

### 数据约束
- 蓝图数据不持久化；仅日志写 SQLite（`backend/data/blueprint_logs.db`）
- 时间一律用带时区 datetime（UTC）比较，禁止 naive datetime

### 依赖约束
- 后端依赖仅：fastapi、uvicorn、pydantic、pytest、httpx（测试）
- 前端依赖仅：react、react-dom、@xyflow/react、zustand、@dagrejs/dagre、tailwindcss、vite、typescript
- 禁止引入 GitPython、NetworkX、任何外部网络/云服务
- 外部资源使用国内可访问镜像（npm 用 npmmirror，pip 用清华源）

### 编码约束
- 跨进程文本管道显式统一 UTF-8（见全局 IO 编码规则）
- 每个关键流程/错误分支/外部调用写日志（后端 SQLite、前端 IndexedDB）
- 单文件解析失败必须跳过并记日志，不得中断整体扫描
- 遵循全局日志硬规则：设置页提供按时间过滤的日志导出

## 四、修订历史

| 日期 | 变更内容 |
|------|----------|
| 2026-09-13 | 初始创建，锁定 MVP 架构决策 |

## 五、项目本地知识沉淀模板

对话结束时把项目特定知识沉淀到本文件：

### 沉淀内容类型
1. 设计决策 2. 架构约束 3. 编码准则 4. 修改记录 5. 经验教训

### 沉淀格式
```markdown
## [章节标题]

[简单描述本对话确认的设计决策或约束]

**来源**：[对话日期] [简要说明]
```

### 沉淀原则
1. 用最简单语言描述，避免冗长
2. 只沉淀项目特定知识，不重复全局 skill
3. 追加到相应章节并更新修订历史
4. 避免重复，合并相似内容

## 六、项目本地知识沉淀（实际记录）

### 扫描根 = 模块命名空间
后端解析 import 时，模块名以**扫描根**为基准。若扫描仓库根（含 `backend/`），文件模块名是 `backend.app.x`，而代码写 `app.x` → 全部解析落空、`edge_count=0`（界面仍正常显示孤立节点）。要正确连线，应扫描**包根**（如 `backend/`）；但 MVP 要求扫描目录内含 `.git`，二者在 BluePrint 自身不一致。后续可增强：同一入口内分别识别仓库根与包根。
**来源**：2026-09-13 端到端验证（commit f06a8cd）。

### 前端构建：单 tsconfig + `tsc --noEmit`
不要用 `tsc -b` + composite 引用（会把 `vite.config.js/.d.ts` 写回源码目录，且 `noEmit` 触发 TS6310）。本项目 `build` = `tsc --noEmit && vite build`，`tsconfig.json` 的 `include` 含 `vite.config.ts`，无 `tsconfig.node.json`。
**来源**：2026-09-13 构建修复（commit f06a8cd）。

### 端到端测试用原生 Edge + CDP
Tabbit 在本机报 `Target.createTarget` CDP 错误不可用。可用原生 Edge headless：`msedge --headless=new --remote-debugging-port=9222 --user-data-dir=<temp>`，再用 Node 内置 `WebSocket` 走 CDP（`/json/new` → `Runtime.evaluate` 填 React 受控输入 + 点击 → `Page.captureScreenshot`）。
**来源**：2026-09-13 前端验证（用户指定改用 Edge）。

## 修订历史（追加）

| 日期 | 变更内容 |
|------|----------|
| 2026-09-13 | MVP 全量交付；沉淀扫描根/构建/Edge 测试三条项目知识 |
