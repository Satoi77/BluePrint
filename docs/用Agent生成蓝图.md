# 用 AI Agent 生成项目全景蓝图（重要）

> 这是 BluePrint 的核心用法：**让 AI Agent 去读另一个项目的代码，产出一份功能全景蓝图**。
> 注意：BluePrint 自身不做语义分析——功能结构由 Agent 生成。

---

## 一、整体流程（一句话）

```
用 Agent 打开 BluePrint 项目  →  让它访问「要收集信息的那个项目」  →  调用 blueprint-generation skill 遍历代码  →  先产出初步全景视图 blueprint.json  →  导入 BluePrint 渲染
```

---

## 二、前置条件

- BluePrint 已就绪（能启动后端 `uvicorn` 与前端 `npm run dev`）。
- 一个能读写本地文件的 AI Agent（如 **OpenCode**），且它能访问**目标项目目录**。
- 目标项目可以是**任意语言**（Python / JS / TS / Vue / React / Java / Go / C / C++ / C# / Rust / Shell…）。

---

## 三、操作步骤

1. **用 Agent 打开 BluePrint 项目**（工作目录设为 BluePrint 根目录）。
   - 这样 Agent 才能读到本仓库的 skill 与规范：`.opencode/skills/blueprint-generation/SKILL.md`。
2. **告诉 Agent 目标项目目录**（你要收集信息的那个项目的绝对路径）。
3. **让 Agent 调用 `blueprint-generation` skill**：
   - OpenCode 里直接说「加载/调用 blueprint-generation skill」即可（Agent 会读取该 skill 文件并按流程执行）。
4. Agent 按 skill **遍历目标项目的全量代码**，先产出**初步全景视图**：
   - `根（系统总入口）→ 主干（业务大功能块）→ 枝干（子功能）→ 树叶（原子功能/函数）`
   - 建立功能之间的关系边，并为原子功能给出**中文名**（`symbol_names`，语义命名，不逐词直译）。
   - 覆盖全部源文件（排除 `node_modules`/`.git`/`dist`/`build` 等），或在校验中说明忽略项。
5. Agent 输出 **`blueprint.json`**（可直接导入 BluePrint）。
6. **导入 BluePrint**（见下）。

---

## 四、可直接复制的提示词

```text
用 AI Agent（OpenCode）打开 BluePrint 项目（工作目录为 BluePrint 根目录），
然后访问目标项目目录：<目标项目绝对路径>，
调用 blueprint-generation skill（.opencode/skills/blueprint-generation/SKILL.md），
遍历该项目的全部代码（任意语言），先初步生成一份功能全景视图蓝图 blueprint.json
（结构：根 → 主干 → 枝干 → 树叶），并为原子功能给出中文名，
输出可直接导入 BluePrint 的文件。
```

> 先把"全景"搭出来：识别业务大功能块（主干）→ 拆子功能（枝干）→ 到函数/组件（树叶）。
> 后续可再让 Agent 细化，或在 BluePrint 里手动编辑修正。

---

## 五、把蓝图导入 BluePrint

**方式一：接口导入（推荐）**

```bat
:: 1) 先扫描目标项目，拿到 project_id
curl -X POST http://localhost:8000/api/blueprint/scan ^
     -H "Content-Type: application/json" ^
     -d "{\"project_path\":\"<目标项目绝对路径>\"}"

:: 2) 用 Agent 生成的蓝图覆盖导入（project_id 用上一步返回值）
curl -X POST http://localhost:8000/api/projects/<project_id>/blueprint ^
     -H "Content-Type: application/json" ^
     --data-binary @blueprint.json
```

**方式二：手动**
- 把 `blueprint.json` 放到 `examples/` 下，在 BluePrint 界面里通过项目菜单/接口导入。

导入后即可在界面上查看、钻取、搜索、编辑、导出。

---

## 六、要点与注意

- **先粗后细**：先出全景（主干），再逐步下钻到枝干、树叶；不要一上来就纠结每个函数。
- **语言无关**：前后端同一业务归入同一个大功能块。
- **中文名**：`symbol_names` 由 Agent 读懂代码后命名（如 `load_chapters` → "加载章节片段"）。
- **可迭代**：Agent 可重复运行更新蓝图；在 BluePrint 里的手动编辑也可导出回喂 Agent 改代码。
- **不做语义分析**：BluePrint 软件只负责导入、渲染、Git 状态增强与持久化。

---

## 七、相关文件

- Skill：`.opencode/skills/blueprint-generation/SKILL.md`
- 规范：`docs/蓝图生成规范.md`
- 示例：`examples/novel_project_Web.blueprint.json`
