---
name: sbux:review
description: 代码审查。执行需求覆盖、设计符合性、API 一致性和代码质量检查。触发词：review、审查、代码审查。
---

# /sbux:review - 代码审查

## 描述

在代码实现完成后执行全面审查，验证代码是否符合需求、设计和 API 规格，并检查代码质量。

**模式**：Auto 模式（支持交互式确认）

---

## 参数

- `$ARGUMENTS`：提案名称（可选，默认使用最新提案）

**示例**：
```
/review user-register
/review
```

---

## 执行流程

### Step 0: 准备阶段

1. 确定目标提案目录（`.proposal/{feature-name}/`）
2. 检查提案文档是否存在：
   - 1-requirements.md ✓
   - 2-design.md ✓
   - 3-api-spec.md ✓
   - 4-test-cases.md ✓
3. 检查是否有代码变更：
   ```bash
   git diff --name-only HEAD~10
   git status --short
   ```
4. 如果没有变更，提示用户先完成实现

**准备完成输出**：
```
📋 审查准备
├── 提案: {feature-name}
├── 文档: 4/4 完整
└── 变更文件: X 个

开始执行审查...
```

---

### Step 1: 并行执行检查

**使用 Task 工具启动 4 个 subagent 并行执行检查。**

在单个消息中同时调用 4 个 Task 工具，每个 subagent 负责一项检查：

```
Task 1: requirements-check    - 需求实现验证
Task 2: design-check          - 设计符合性检查
Task 3: api-check             - API 一致性检查
Task 4: code-quality-check    - 代码质量检查
```

#### 1.1 启动 Subagent

**重要**：必须在**单个消息**中并行调用 4 个 Task 工具，以实现真正的并行执行。

每个 Task 调用使用以下配置：
- `subagent_type`: `general-purpose`

**Subagent 1: 需求实现验证**

```
prompt: |
  执行需求实现验证检查。

  ## 输入文件
  - 需求文档: .proposal/{feature}/1-requirements.md
  - 测试用例: .proposal/{feature}/4-test-cases.md
  - 检查规范: 读取 .claude/skills/sbux-review/REQUIREMENTS-CHECK.md

  ## 检查内容
  1. 代码实现检查（FR → 代码）
     - 提取需求文档中的功能要求（FR-*）
     - 通过 git diff --name-only HEAD~10 获取变更文件
     - 验证每个 FR 是否有对应实现
     - 标记未实现/部分实现的需求

  2. 测试覆盖检查（FR → 测试用例）
     - 构建 FR → 测试用例追溯矩阵
     - 计算覆盖率

  ## 判定规则
  - 存在未实现或部分实现的 FR → ❌ 失败
  - 测试覆盖率 < 80% → ⚠️ 警告
  - 全部实现且覆盖率 ≥ 80% → ✅ 通过

  ## 输出格式（严格按此格式返回 JSON）
  {
    "check_type": "requirements",
    "status": "pass|warning|fail",
    "summary": {
      "total_fr": 0,
      "implemented": 0,
      "partial": 0,
      "not_implemented": 0,
      "test_coverage": 0
    },
    "errors": [
      {"id": "FR-X", "type": "not_implemented|partial", "description": "...", "location": "file:line"}
    ],
    "warnings": [
      {"id": "FR-X", "description": "...", "location": "file:line"}
    ],
    "info": [
      {"id": "FR-X", "description": "..."}
    ]
  }
```

**Subagent 2: 设计符合性检查**

```
prompt: |
  执行设计符合性检查。

  ## 输入文件
  - 设计文档: .proposal/{feature}/2-design.md
  - 检查规范: 读取 .claude/skills/sbux-review/DESIGN-CHECK.md

  ## 检查内容
  1. 提取设计决策（架构模式、技术选型、命名约定、数据结构）
  2. 根据设计文档中指定的模块/文件路径定位代码
  3. 验证代码是否符合设计决策
  4. 识别偏离设计的实现

  ## 输出格式（严格按此格式返回 JSON）
  {
    "check_type": "design",
    "status": "pass|warning|fail",
    "summary": {
      "design_elements": 0,
      "files_checked": 0,
      "compliant": 0,
      "deviations": 0
    },
    "errors": [
      {"id": "D-X", "description": "...", "location": "file:line"}
    ],
    "warnings": [
      {"id": "D-X", "description": "...", "location": "file:line"}
    ],
    "info": []
  }
```

**Subagent 3: API 一致性检查**

```
prompt: |
  执行 API 一致性检查。

  ## 输入文件
  - API 规格: .proposal/{feature}/3-api-spec.md
  - 检查规范: 读取 .claude/skills/sbux-review/API-CHECK.md

  ## 检查内容
  1. 提取 API 规格（路径、方法、参数、响应、错误码）
  2. 分析已实现的 Controller/Router 代码
  3. 对比规格与实现
  4. 识别差异

  ## 输出格式（严格按此格式返回 JSON）
  {
    "check_type": "api",
    "status": "pass|warning|fail",
    "summary": {
      "spec_apis": 0,
      "implemented_apis": 0,
      "consistent": 0,
      "differences": 0
    },
    "errors": [
      {"id": "API-X", "endpoint": "METHOD /path", "description": "...", "location": "file:line"}
    ],
    "warnings": [
      {"id": "API-X", "endpoint": "METHOD /path", "description": "...", "location": "file:line"}
    ],
    "info": []
  }
```

**Subagent 4: 代码质量检查**

```
prompt: |
  执行代码质量检查。

  ## 输入文件
  - 检查规范: 读取 .claude/skills/sbux-review/CODE-QUALITY.md

  ## 检查内容
  1. 检测项目 linter 配置
  2. 根据设计文档中指定的模块/文件路径定位代码
  3. 运行 linter 或执行基础检查：
     - 未使用的导入/变量
     - 过长的方法/函数
     - 硬编码值
     - 缺少错误处理
     - TODO/FIXME 标记

  ## 输出格式（严格按此格式返回 JSON）
  {
    "check_type": "code_quality",
    "status": "pass|warning|fail",
    "summary": {
      "tool": "eslint|checkstyle|基础检查",
      "files_checked": 0,
      "errors": 0,
      "warnings": 0
    },
    "errors": [
      {"id": "CQ-X", "description": "...", "location": "file:line"}
    ],
    "warnings": [
      {"id": "CQ-X", "description": "...", "location": "file:line"}
    ],
    "info": []
  }
```

#### 1.2 等待所有 Subagent 完成

所有 Task 工具调用将并行执行，Claude 会自动等待所有 subagent 返回结果后继续执行。

#### 1.3 收集检查结果

从 4 个 subagent 的返回结果中提取 JSON 数据，用于生成综合报告。

---

### Step 2: 生成综合审查报告

**汇总所有 subagent 的检查结果，生成最终报告并写入文件。**

**输入**：4 个 subagent 返回的 JSON 结果

**执行**：
1. 解析并合并所有 subagent 返回的 JSON 结果
2. 按严重程度分类问题：
   - 🔴 ERROR：必须修复
     - 未实现的需求（FR）
     - 部分实现的需求（FR）
     - API 规格不一致
     - 代码质量问题
     - TODO/FIXME 标记
   - 🟡 WARNING：建议修复
     - 测试覆盖率不足
     - 轻微设计偏离
   - 🔵 INFO：供参考
3. 生成修复建议
4. 判定审查结果：通过/不通过
5. **【强制】将审查报告写入 `.proposal/{feature-name}/review-report.md`**

**审查报告文件格式**（`.proposal/{feature-name}/review-report.md`）：

参考模板 `review-report.template.md`，包含以下部分：
- 审查元信息（提案名、时间、结果）
- 检查汇总表格
- 必须修复问题列表（ERROR）
- 建议修复问题列表（WARNING）
- 参考信息列表（INFO）
- 详细修复建议

**控制台输出**：
```
═══════════════════════════════════════════
📝 代码审查报告：{feature-name}
═══════════════════════════════════════════

📊 检查汇总（并行执行完成）
├── 需求覆盖: ✅ 100%
├── 设计符合: ✅ 通过
├── API 一致: ⚠️ 2 个差异
└── 代码质量: ✅ 通过

🔴 必须修复 (X 个)
├── [需求] FR-3: 密码长度验证未实现
├── [需求] FR-5: 邮箱格式校验部分实现，缺少友好错误提示
├── [API] POST /api/users 缺少 email 字段验证
└── [API] 响应码 400 未按规格返回错误详情

🟡 建议修复 (X 个)
├── [设计] UserService.createUser 方法过长（120行）
└── [质量] UserController.java:58 存在未使用的导入

🔵 参考信息 (X 个)
└── [需求] FR-3 仅有 1 个测试用例覆盖

═══════════════════════════════════════════
🎯 审查结果: ❌ 不通过 / ⚠️ 有警告 / ✅ 通过
═══════════════════════════════════════════

📄 审查报告已保存: .proposal/{feature-name}/review-report.md
```

---

### Step 3: 下一步选择

**审查完成后，使用 AskUserQuestion 工具根据审查结果提供不同选项。**

#### 审查不通过（存在 ERROR）

提示：`审查发现必须修复的问题，请选择下一步操作：`

| 选项 | 说明 |
|------|------|
| 执行修复 | 根据审查报告自动修复问题，修复后重新运行审查 |
| 手动修复 | 结束当前流程，由开发者手动修复后重新运行 /sbux:review |

**选择"执行修复"的行为**：
1. 读取 `review-report.md` 中的问题列表
2. 按优先级逐个修复 ERROR 级别问题
3. 每修复一个问题后验证编译
4. 全部修复后自动重新运行 `/sbux:review`
5. 如果修复 3 次仍不通过，提示手动介入

#### 审查有警告（只有 WARNING）

提示：`审查发现建议修复的问题，请选择下一步操作：`

| 选项 | 说明 |
|------|------|
| 执行修复 | 根据审查报告修复警告问题 |
| 跳过警告 | 忽略警告，继续提交代码 |

#### 审查通过

提示：`审查通过，请选择下一步操作：`

| 选项 | 说明 |
|------|------|
| 执行提交 | 调用 /sbux:git 提交代码 |
| 结束 | 结束审查流程 |

---

## 审查结果判定规则

| 条件 | 结果 |
|------|------|
| 存在 🔴 ERROR | ❌ 不通过 |
| 只有 🟡 WARNING | ⚠️ 有警告（可选择继续） |
| 只有 🔵 INFO 或无问题 | ✅ 通过 |

---

## 注意事项

1. **并行执行**：4 个检查通过 subagent 并行执行，显著提升审查速度
2. **文档依赖**：审查需要完整的提案文档支持
3. **报告持久化**：审查报告保存在提案目录中，便于追溯
4. **增量审查**：只检查自上次审查后的变更
5. **自动修复**：ERROR 级别问题支持自动修复，WARNING 级别可选
6. **人工判断**：警告级别问题由开发者决定是否修复
7. **可重复执行**：修复问题后可重新运行审查

---

## 并行执行说明

### 为什么使用并行

- **性能优化**：4 个检查同时执行，总耗时约等于最慢的单个检查
- **独立性**：每个检查相互独立，无需等待其他检查完成

### Task 工具调用示例

```
// 在单个消息中并行调用 4 个 Task
Task(
  description: "需求实现验证",
  subagent_type: "general-purpose",
  prompt: "..."
)
Task(
  description: "设计符合性检查",
  subagent_type: "general-purpose",
  prompt: "..."
)
Task(
  description: "API 一致性检查",
  subagent_type: "general-purpose",
  prompt: "..."
)
Task(
  description: "代码质量检查",
  subagent_type: "general-purpose",
  prompt: "..."
)
```

### 结果合并

所有 subagent 返回 JSON 格式结果，主流程负责：
1. 解析各 subagent 返回的 JSON
2. 合并 errors、warnings、info 列表
3. 按严重程度排序
4. 生成综合报告
