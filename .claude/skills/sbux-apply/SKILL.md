---
name: sbux:apply
description: 执行实现。基于提案文档执行编码和测试。当用户需要实现功能、写代码、写测试时使用。触发词：实现、编码、开发、apply。
---

# /sbux:apply - 执行实现

## 描述

基于已生成的提案文档，执行编码和测试。

**模式**：Auto 模式（默认全自动，支持阶段确认）

---

## 参数

- `$ARGUMENTS`：提案名称（可选，默认使用最新提案）

**选项**：
- `--step`：阶段确认模式，每阶段完成后等待确认
- `--skip-test`：跳过测试阶段（仅编码）

**示例**：
```
/apply user-register
/apply user-register --step
/apply --skip-test
```

---

## 执行流程

### Step 0: 确认提案

1. 确定目标提案目录（`.proposal/{feature-name}/`）
2. 检查文档完整性：
   - 1-requirements.md ✓
   - 2-design.md ✓
   - 3-api-spec.md ✓
   - 4-test-cases.md ✓
   - 5-tasks.md ✓
3. **[强制] 扫描所有文档中的 `[待确认]` 标记**：
   - 使用 grep 搜索所有 5 个文档中的 `[待确认]`
   - 如果发现任何 `[待确认]` 项，**必须停止执行**，输出错误并列出所有待确认项
   - **只有在所有 `[待确认]` 项都被处理后才能继续**
4. **[状态更新] 用 Edit 工具更新 `1-requirements.md` 顶部状态**：`草稿` → `已确认`
5. 显示任务摘要，确认开始

**待确认项检查失败输出：**
```
❌ 发现未处理的 [待确认] 项，无法继续执行

📋 待确认项列表：
├── 1-requirements.md:
│   └── L72: [待确认] 用户注册是否需要邮箱验证？
├── 2-design.md:
│   └── L45: [待确认] 密码加密算法使用 bcrypt 还是 argon2？
│   └── L89: [待确认] 数据库表名前缀

👉 请先处理以上待确认项：
   1. 在对应文档中更新确认结果
   2. 删除 [待确认] 标记
   3. 重新运行 /sbux:apply
```

### Step 1: 编码阶段

**执行所有编码任务（C-*），每个批次启动独立 SubAgent，批次间顺序执行。**

**执行方式**：

1. **读取编码批次列表**：
   - 从 `5-tasks.md` 提取「一、编码任务」部分的所有批次（Batch-1, Batch-2, Batch-3...）
   - 每个批次仅包含 C-*（编码）任务
   - 过滤掉已全部完成的批次（所有任务都标记为 `[x]`）

2. **顺序执行每个批次**：
   ```
   for each Batch-N in [Batch-1, Batch-2, Batch-3, ...]:
       if 批次内所有任务已完成: continue
       启动 SubAgent 执行 Batch-N 的所有编码任务
       等待完成
       if 失败: 重试最多 3 次，仍失败则停止
       更新 5-tasks.md 标记已完成的任务 [x]
   ```

3. **单个批次的 SubAgent Prompt**：
```
执行编码批次任务，按顺序完成批次内的所有任务。

## 批次信息
- 批次: {batch_name}（如 Batch-1）
- 任务列表:
  - {task_id_1}: {task_description_1} → {file_path_1}
  - {task_id_2}: {task_description_2} → {file_path_2}
  - ...

## 输入文档
- 需求文档: .proposal/{feature}/1-requirements.md
- 设计文档: .proposal/{feature}/2-design.md
- API 规格: .proposal/{feature}/3-api-spec.md
- 编码规范: 读取 CODING.md

## 执行要求
1. 按顺序完成批次内的所有编码任务
2. 按设计文档和 API 规格实现代码
3. 完成后验证编译/构建
4. 每个任务完成后，用 Edit 工具更新 5-tasks.md，将对应任务的 [ ] 改为 [x]
5. 如果某个任务失败，停止执行并报告

## 输出格式
{
  "batch": "{batch_name}",
  "status": "success|partial|failed",
  "tasks": [
    {"task_id": "C-1", "status": "success", "files": ["User.java"]},
    {"task_id": "C-2", "status": "success", "files": ["UserDTO.java"]}
  ],
  "build_status": "pass|fail",
  "error": "错误信息（如果失败）"
}
```

4. **处理 SubAgent 结果**：
   - 成功：记录结果，继续下一个批次
   - 失败：重试最多 3 次，仍失败则停止并提示

**执行过程输出**：
```
🔨 编码阶段（每批次独立 SubAgent）

[Batch-1]
├── C-1: 创建 UserDTO ✅
├── C-2: 创建 UserEntity ✅
└── 批次完成 ✅

[Batch-2]
├── C-3: 创建 UserRepository ✅
└── 批次完成 ✅

[Batch-3]
├── C-4: 创建 UserService ✅
└── 批次完成 ✅

[Batch-4]
├── C-5: 创建 UserController ✅
└── 批次完成 ✅

...
```

**阶段完成输出**：
```
✅ 编码阶段完成
├── 完成批次: Batch-1 ~ Batch-N
├── 编码任务: C-1 ~ C-X (X 个)
├── 创建文件: X 个
├── 编译状态: 通过
└── 执行模式: 每批次独立 SubAgent

[--step 模式] 是否继续测试阶段？(y/n)
```

### Step 2: 测试阶段

**执行所有测试任务（T-*），每个批次启动独立 SubAgent，批次间顺序执行。**

**执行方式**：

1. **读取测试批次列表**：
   - 从 `5-tasks.md` 提取「二、测试任务」部分的所有批次（Batch-1, Batch-2...）
   - 每个批次仅包含 T-*（测试）任务
   - 过滤掉已全部完成的批次（所有任务都标记为 `[x]`）

2. **顺序执行每个批次**：
   ```
   for each Batch-N in [Batch-1, Batch-2, ...]:
       if 批次内所有任务已完成: continue
       启动 SubAgent 执行 Batch-N 的所有测试任务
       等待完成
       if 失败: 重试最多 3 次，仍失败则停止
       更新 5-tasks.md 标记已完成的任务 [x]
   ```

3. **单个批次的 SubAgent Prompt**：
```
执行测试批次任务，按顺序完成批次内的所有任务。

## 批次信息
- 批次: {batch_name}（如 Batch-1）
- 任务列表:
  - {task_id_1}: {task_description_1} → {file_path_1} (覆盖用例: IT-01~03)
  - {task_id_2}: {task_description_2} → {file_path_2} (覆盖用例: AT-01~04)
  - ...

## 输入文档
- 需求文档: .proposal/{feature}/1-requirements.md
- 设计文档: .proposal/{feature}/2-design.md
- API 规格: .proposal/{feature}/3-api-spec.md
- 测试用例: .proposal/{feature}/4-test-cases.md
- 测试规范（集成）: 读取 INTEGRATION-TEST.md
- 测试规范（接口）: 读取 API-TEST.md

## 执行要求
1. 按顺序完成批次内的所有测试任务
2. 按测试用例文档编写测试代码
3. 运行测试，如果失败则分析并修复
4. 更新 4-test-cases.md 中对应用例的状态
5. 追加 test-case-detail.md 用例执行详情
6. 每个任务完成后，用 Edit 工具更新 5-tasks.md，将对应任务的 [ ] 改为 [x]
7. 如果某个任务失败，停止执行并报告

## 输出格式
{
  "batch": "{batch_name}",
  "status": "success|partial|failed",
  "tasks": [
    {"task_id": "T-1", "status": "success", "files": ["UserServiceTest.java"], "cases_passed": ["IT-01", "IT-02", "IT-03"]},
    {"task_id": "T-2", "status": "success", "files": ["UserControllerTest.java"], "cases_passed": ["AT-01", "AT-02"]}
  ],
  "error": "错误信息（如果失败）"
}
```

4. **处理 SubAgent 结果**：
   - 成功：记录结果，继续下一个批次
   - 失败：重试最多 3 次，仍失败则停止并提示

**执行过程输出**：
```
🧪 测试阶段（每批次独立 SubAgent）

[Batch-1]
├── T-1: UserService 测试 (IT-01~03) ✅
└── 批次完成 ✅

[Batch-2]
├── T-2: UserController 测试 (AT-01~04) ✅
└── 批次完成 ✅

...
```

**阶段完成输出**：
```
✅ 测试阶段完成
├── 完成批次: Batch-1 ~ Batch-N
├── 测试任务: T-1 ~ T-Y (Y 个)
├── IT 覆盖率: X/Y (100%)
├── AT 覆盖率: X/Y (100%)
└── 执行模式: 每批次独立 SubAgent

[--step 模式] 是否继续验证阶段？(y/n)
```

**覆盖度检查失败**：
```
⚠️ 测试用例覆盖不完整

未执行用例：
├── IT-05: Redis TTL 过期策略
├── IT-08: 并发锁释放测试
├── AT-05: Redis 正常消费
└── AT-07: 系统繁忙错误

👉 请补充执行以上用例
```

### Step 3: 验证阶段

**运行验证任务，确保构建和全量测试通过。**

**执行方式**：

1. **读取验证任务**：
   - 从 `5-tasks.md` 提取「三、验证任务」部分的 V-* 任务
   - 过滤掉已完成的任务（标记为 `[x]`）

2. **顺序执行验证任务**：
   - V-1: 构建检查
   - V-2: 集成测试
   - V-3: 接口测试
   - V-4: 全量测试

3. **更新任务状态**：
   - 每个验证任务完成后更新 5-tasks.md

**执行过程输出**：
```
✅ 验证阶段

[V-1] 构建检查 ✅
[V-2] 集成测试 ✅ (X 个用例通过)
[V-3] 接口测试 ✅ (X 个用例通过)
[V-4] 全量测试 ✅
```

### Step 4: 完成 + 询问下一步

1. **验证 `5-tasks.md` 所有任务已标记为 `[x]`**（各阶段已实时更新）
2. **用 Edit 工具更新 `5-tasks.md` 顶部状态**：`进行中` → `已完成`
3. **用 Edit 工具更新 `1-requirements.md` 顶部状态**：`已确认` → `已完成`
4. 输出最终摘要
5. **询问用户下一步操作**

**实现完成后，使用 AskUserQuestion 工具询问用户下一步操作**：

**第一步**：询问执行方式

```
代码实现完成，请选择下一步操作：
```

| 选项 | 说明 |
|------|------|
| SubAgent 执行（推荐） | 启动独立 SubAgent 执行 /sbux:review |
| 直接执行命令 | 当前会话直接执行 /sbux:review |
| 不执行 | 跳过审查，直接进入 /sbux:git commit 流程 |

**第二步**：如果用户选择了「SubAgent 执行」，再使用 AskUserQuestion 询问执行模式：

| 选项 | 说明 |
|------|------|
| 同步等待（推荐） | 等待 SubAgent 完成后返回结果 |
| 异步执行 | 后台运行，当前会话可继续其他工作 |

**用户选择后的行为**：

1. **选择「SubAgent 执行」**：
   - 询问同步/异步后：
   - **同步**：使用 Task 工具启动 SubAgent（subagent_type: general-purpose），prompt: `/sbux:review {feature-name}`，等待完成返回结果
   - **异步**：设置 run_in_background: true，告知用户可通过 `/tasks` 查看进度

2. **选择「直接执行命令」**：
   - 调用 Skill `sbux:review`，参数为 `{feature-name}`
   - 当前会话执行代码审查

3. **选择「不执行」**：
   - 输出提示并结束

**不执行输出**：
```
👉 下一步：
   1. /sbux:git commit 提交代码
   2. 创建 Pull Request
   3. 后续可随时执行 /sbux:review 进行代码审查
```

---

## 输出

完成后显示：

```
✅ 实现完成：{feature-name}

📊 执行摘要：
├── 编码阶段
│   ├── 创建文件: X 个
│   ├── 修改文件: X 个
│   └── 编译: 通过
├── 集成测试
│   ├── 测试数: X 个
│   └── 通过率: 100%
├── 接口测试
│   ├── 测试数: X 个
│   └── 通过率: 100%
└── 详情报告: [test-case-detail.md](.proposal/{feature}/test-case-detail.md)

📁 新增文件：
├── [根据实际项目结构列出]
└── ...

👉 下一步：
   1. 代码审查
   2. git add && git commit
   3. 创建 Pull Request
```

---

## 失败处理

### 编译失败

```
❌ 编译失败

错误信息：
[具体错误]

🔧 自动修复中...
[修复操作]

重新编译...
✅ 编译通过
```

### 测试失败

```
❌ 测试失败

失败用例：
- testXxx_Scenario: [错误信息]

🔧 自动修复中...
[分析原因]
[修复操作]

重新运行测试...
✅ 测试通过
```

### 多次失败

```
❌ 修复失败（已重试 3 次）

需要人工介入：
1. 检查错误信息
2. 手动修复后重新运行 /sbux:apply

最后的错误：
[错误详情]
```

---

## 注意事项

1. **SubAgent 隔离**：每个任务（C-xxx, T-xxx）独立 SubAgent 执行，避免上下文污染
2. **顺序执行**：任务按 `5-tasks.md` 定义的顺序执行，保证依赖关系
3. **文档完整性**：确保所有文档存在且无 `[待确认]` 项
4. **自动修复**：失败时自动分析并尝试修复（最多 3 次）
5. **进度追踪**：实时更新 tasks.md 中的任务状态
6. **可恢复**：失败后可以重新运行，已完成的任务（标记为 `[x]`）会被跳过
7. **错误隔离**：单个任务失败不影响其他任务的上下文
