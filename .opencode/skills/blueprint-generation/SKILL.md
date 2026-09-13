---
name: blueprint-generation
description: 让 AI Agent 阅读任意语言的完整代码库，产出功能结构蓝图 blueprint.json（业务大功能→子功能→原子功能 + 关系边 + 中文名），供 BluePrint 可视化系统导入。当需要"为某个项目生成/更新功能蓝图"时加载本 skill。
---

# 功能蓝图生成（Agent 建图，语言无关）

**目标**：Agent 阅读项目**全部代码**（Python / JS / TS / Vue / React / Java / Go / C / C++ / C# / Rust / Shell …任意语言），产出一份 `blueprint.json`，描述项目的**功能结构**，交由 BluePrint 渲染。

**分工铁律**：功能结构由 **Agent 语义分析**得出；BluePrint 软件**不做**语义判断，只负责导入、校验、渲染、Git 状态增强。

---

## 一、输出格式（blueprint.json）

```json
{
  "version": 1,
  "project_name": "项目名",
  "generated_by": "agent",
  "generated_at": "ISO8601",
  "functions": [
    {
      "id": "write",
      "name": "写正文",
      "level": 0,
      "parent": null,
      "kind": "block",
      "description": "依据章纲逐章生成正文",
      "files": ["backend/app/routes/writing.py", "frontend/src/pages/Write.tsx"],
      "symbols": ["write_chapter", "WritePage"],
      "isolated": false
    },
    {
      "id": "write.stream",
      "name": "流式正文生成",
      "level": 1,
      "parent": "write",
      "kind": "group",
      "files": ["backend/app/services/novel_writer.py"],
      "symbols": ["NovelWriter"],
      "isolated": false
    },
    {
      "id": "write.stream.generate",
      "name": "生成单章正文",
      "level": 2,
      "parent": "write.stream",
      "kind": "atomic",
      "files": ["backend/app/services/novel_writer.py"],
      "symbols": ["generate_chapter"],
      "isolated": false
    }
  ],
  "edges": [
    { "source": "material", "target": "write", "type": "workflow", "label": "大纲→正文" }
  ],
  "symbol_names": {
    "backend/app/services/memory_analysis_service.py::load_chapters": "加载章节片段",
    "frontend/src/pages/Write.tsx::WritePage": "写作页面"
  },
  "ignored": ["node_modules/", ".git/", "dist/", "build/", "*.min.js"]
}
```

字段：`id` 全局唯一（建议 `block.sub.atomic`）；`name` 业务名（中文优先）；`level` 0/1/2；`parent` 父 id（L0 为 null）；`kind` block/group/atomic；`files` 相对项目根的 POSIX 路径（**任意语言**）；`symbols` 关键函数/类/组件名；`isolated` 是否孤立；`edges[].type` workflow/data/call/import；`symbol_names` 符号→中文名（键 `文件::符号` 或 `符号`）。

---

## 二、层级语义

| level | kind | 含义 |
|-------|------|------|
| 0 | block | 业务大功能块（用户能感知的能力，如 生成素材/写正文/审核/提取信息/设置） |
| 1 | group | 大功能拆分出的子功能 |
| 2 | atomic | 原子功能（一个函数/类/组件就是一个功能） |

- 一个文件可贡献多个功能；一个功能可跨多个文件、多种语言。
- 判断"一个功能"：能独立描述输入→输出、可单独验收的最小能力。
- 前端组件、页面、hook、API 客户端、状态管理都应作为功能节点纳入。

---

## 三、执行步骤

1. **盘点全量源码**：递归列目录，排除 `ignored`（`.git`、`node_modules`、`.venv`、`dist`、`build`、`__pycache__`、`.next`、点号目录等）。记录所有源文件（任意语言）。
2. **识别 L0 业务大功能块**：从"用户能感知的业务能力"出发，不要按技术分层（routes/services/components）命名。
3. **拆分子功能（L1）与原子功能（L2）**：
   - 每个 L0 读其入口（路由/页面/命令/入口函数），沿调用链/组件树向下拆。
   - 到函数/类/组件粒度即原子功能。
   - 前后端同一业务的功能归到同一个 L0 下（跨语言合并）。
4. **建立关系边**：真实的数据流/调用/流程顺序才连边，给 `type` 与 `label`。
5. **标注孤立功能**：无上下游关系的独立功能（设置、工具、独立页面、等待态）`isolated: true`。
6. **填 files / symbols**：每个功能给出实现它的文件（任意语言）与关键符号。
7. **生成中文名**：`symbol_names` 为每个原子符号给出简短中文名（**读懂代码后语义命名，不要逐词直译**）。`functions[].name` 用业务中文名。
8. **覆盖校验**：项目内每个源文件要么被某个功能的 `files` 覆盖，要么在 `ignored` 中说明。

---

## 四、硬性校验（输出前自检）

- [ ] 顶层是**业务大功能块**，不是技术目录
- [ ] 功能名是业务语言；文件名只出现在 `files`
- [ ] `id` 唯一；`parent` 存在且 `parent.level = child.level - 1`
- [ ] `level` 与 `kind` 一致（0↔block、1↔group、2↔atomic）
- [ ] 边端点都是已定义 id
- [ ] 原子功能有 `symbols`
- [ ] 孤立功能显式 `isolated: true`
- [ ] 文件覆盖完整（或已在 `ignored` 说明）
- [ ] **所有语言的源码都已纳入**（前端、脚本、配置等），无遗漏
- [ ] 输出是合法 JSON

---

## 五、可复制的提示词模板

```text
你是本项目的架构分析师。请阅读项目【全部代码】（任意语言：Python/JS/TS/Vue/React/Java/Go/C/C++/C#/Rust/Shell…），
产出一份功能结构蓝图 blueprint.json。

要求：
1. 以"业务功能"为单位，不要以文件/目录为单位；一个文件可贡献多个功能，一个功能可跨多个文件/多种语言。
2. 三层：L0 业务大功能块 → L1 子功能 → L2 原子功能（函数/类/组件）。
3. 前后端同一业务的功能归到同一个 L0 下。
4. 用 files（相对项目根 POSIX 路径）与 symbols 映射到代码，覆盖全部源码（排除 node_modules/.git/dist/build 等）。
5. 只连真实存在的调用/数据流/流程关系，给 type 与 label。
6. 无依赖的独立功能标记 isolated: true。
7. 为每个原子符号在 symbol_names 里给出中文名（读懂代码后语义命名，不要直译）。
8. 严格按 .opencode/skills/blueprint-generation/SKILL.md 第一节 JSON schema 输出，并通过第四节自检。
9. 只输出 blueprint.json 内容，不要额外解释。

项目根目录：<PROJECT_ROOT>
```

---

## 六、导入 BluePrint

产出 `blueprint.json` 后，用接口导入（会重建并持久化）：

```
POST /api/projects/{project_id}/blueprint
Content-Type: application/json
<blueprint.json>
```

若项目尚未扫描，先 `POST /api/blueprint/scan {"project_path": "..."}` 得到 `project_id`，再导入蓝图。
后续增量：Git 变更只影响状态色；功能结构变更由 Agent 重新生成并再次导入。
