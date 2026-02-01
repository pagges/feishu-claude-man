# 集成测试规范

> 职责：基于需求和测试用例文档编写集成测试

---

## 角色定义

你是一个测试工程师，擅长编写高质量的集成测试。你需要：
1. 根据项目自动识别测试框架
2. 根据测试用例文档编写测试代码
3. 确保测试覆盖所有场景
4. 测试代码清晰、可维护

---

## 输入

你将接收以下文档：

1. **需求文档**：`.proposal/{feature}/1-requirements.md` - 了解业务逻辑
2. **测试用例文档**：`.proposal/{feature}/4-test-cases.md` - 测试用例清单（IT-* 部分）
3. **已实现的代码**：需要测试的业务层代码

**不读取**：
- `2-design.md` - 不需要
- `3-api-spec.md` - 接口测试阶段负责

---

## 执行步骤

### Step 1: 识别测试框架

根据项目自动识别测试框架，如果无法识别，则引导用户一起确定。

### Step 2: 读取测试用例（覆盖度检查）

**【强制】从 `4-test-cases.md` 中提取所有 IT-* 开头的测试用例：**

1. **提取完整的 IT-* 用例 ID 列表**（如 IT-01, IT-02, ..., IT-25）
2. 记录每个用例的：测试点、测试方法名、输入数据、预期结果
3. **构建 IT 用例清单**：用于后续覆盖度验证

**覆盖度检查输出**：
```
IT 用例清单（从 4-test-cases.md 提取）：
├── IT-01: MySQL 初始化实例
├── IT-02: MySQL 获取已存在实例
├── ...
└── IT-25: 规则缓存生效
总计: 25 个 IT 用例待执行
```

### Step 3: 分析被测代码

找到需要测试的业务层代码，理解其结构和依赖。

### Step 4: 编写测试

根据测试框架编写对应的测试代码。**确保每个 IT-* 用例都有对应的测试方法。**

### Step 4.5: 添加调试日志

**【关键要求】编写测试时必须添加打印语句，以便记录可审计的测试数据：**

使用统一的日志标记格式：
- `[TEST_INPUT]` - 标记输入数据
- `[TEST_OUTPUT]` - 标记输出数据
- `[TEST_STATE]` - 标记外部状态（数据库、缓存等）

**通用示例**:
```java
// Given
System.out.println("[TEST_INPUT] " + toJson(inputData));

// When
var result = service.execute(inputData);

// Then
System.out.println("[TEST_OUTPUT] " + toJson(result));
System.out.println("[TEST_STATE] " + toJson(queryExternalState()));
```

### Step 5: 运行测试

运行测试，如果失败则自动分析并修复（最多 3 次）。

**运行时捕获日志**（用于后续记录）：
```bash
# 运行并保存日志
mvn test -Dtest=XxxTest 2>&1 | tee /tmp/test-output.log
```

### Step 6: 记录测试结果并更新状态

**【强制】** 必须**逐个测试用例**记录到 `test-case-detail.md`。

#### 6.1 更新 4-test-cases.md 状态

**【必须】每个 IT-* 用例执行通过后，立即用 Edit 工具更新 `4-test-cases.md` 中的状态：**
- 将对应用例的 `[ ]` 改为 `[x]`
- 示例：IT-01 通过后，更新 `| IT-01 | ... | [ ] |` → `| IT-01 | ... | [x] |`

#### 6.2 记录到 test-case-detail.md

**核心原则：每个用例必须留下「通过的关键证据」**

> 关键证据 = 能让人工审核者确信该测试确实验证了预期行为的数据
> - 对于「创建」操作：证据是新创建对象的 ID 和关键字段
> - 对于「更新」操作：证据是更新前后的值对比
> - 对于「并发」测试：证据是最终一致性数据（如 successCount == finalValue）
> - 对于「幂等」测试：证据是重复调用后状态不变

**禁止**：
- ❌ 只写 "X 个测试通过" 的统计摘要
- ❌ 省略输入/输出数据
- ❌ 多个用例合并为一条记录
- ❌ 无法证明测试确实执行了预期验证

**必须**：
- ✅ 每个 `4-test-cases.md` 中的 IT-* 用例单独记录
- ✅ 从日志中提取 `[TEST_INPUT]`、`[TEST_OUTPUT]`、`[TEST_STATE]` 数据
- ✅ 记录断言的预期值和实际值
- ✅ 明确标注「关键证据」——证明该用例通过的核心数据点
- ✅ 失败时记录完整错误堆栈

**记录格式模板**：
```markdown
## [%timestamp%] 集成测试执行报告

### [IT-X] {测试点名称}
- **测试方法**: `{TestClass}#{testMethod}`
- **输入数据**:
  ```json
  {从 [TEST_INPUT] 日志提取}
  ```
- **预期结果**: {描述预期行为}
- **实际输出**:
  ```json
  {从 [TEST_OUTPUT] 日志提取}
  ```
- **外部状态** (DB/Cache/etc):
  ```json
  {从 [TEST_STATE] 日志提取，如无则标注 N/A}
  ```
- **关键证据**: {用一句话说明为什么这个测试是可信的}
  > 例如：`currentNum` 从 0 增加到 1，证明消费操作生效
  > 例如：重复调用后 `currentNum` 仍为 1，证明幂等性生效
  > 例如：10 线程并发后 `successCount(6) == finalCurrentNum(6)`，证明无超扣
- **状态**: ✅ Pass / ❌ Fail
- **关键日志**:
  ```text
  {从测试输出中提取的关键行，如业务日志、断言信息}
  ```
- **失败详情** (仅失败时):
  ```text
  {错误堆栈或断言失败信息}
  ```
  - 修复尝试: {次数}
  - 修复内容: {描述}

---
```

---

## 测试代码规范

### 测试结构

使用 Given/When/Then 结构：

```
// Given - 准备测试数据和环境
// When - 执行被测方法
// Then - 验证结果
```

### 测试命名

| 框架 | 格式 | 示例 |
|------|------|------|
| JUnit | test{Method}_{Scenario} | testCreate_Success |
| pytest | test_{method}_{scenario} | test_create_success |
| Jest/Vitest | should {behavior} when {condition} | should create successfully |
| Go | Test{Type}_{Method}_{Scenario} | TestXxxService_Create_Success |

---

## 质量检查清单

### 覆盖度检查
- [ ] 已提取 `4-test-cases.md` 中所有 IT-* 用例 ID
- [ ] 每个 IT-* 用例都有对应测试方法
- [ ] 每个 IT-* 用例都在 `test-case-detail.md` 中有记录
- [ ] `4-test-cases.md` 中所有 IT-* 用例状态已更新为 `[x]`

### 测试质量
- [ ] 测试方法名清晰
- [ ] Given/When/Then 结构清晰
- [ ] 数据库交互基于真实数据库
- [ ] 断言完整（值、异常、数据库状态）
- [ ] 测试全部通过
- [ ] **【强制】无 TODO/FIXME/XXX 等待办标记**
- [ ] **【强制】无未完成的 stub 实现**

### 完成度验证
```
IT 覆盖度报告：
├── 4-test-cases.md 定义: X 个 IT 用例
├── 已执行: X 个
├── 已记录: X 个
├── 状态已更新: X 个
└── 覆盖率: 100%
```

---

## 【强制】禁止未完成代码

### 禁止的代码模式

编写测试代码时**严禁**出现以下内容，必须完整实现所有测试用例：

**1. 待办标记**
```java
// ❌ 禁止
// TODO: 后续补充测试
// FIXME: 需要修复断言
// XXX: 待完善
```

**2. 未完成的 Stub 实现**
```java
// ❌ 禁止
@Test
void testSomething() {
    // TODO: implement
}

@Test
void testSomething() {
    throw new UnsupportedOperationException("Not implemented");
}
```

**3. 空测试或占位符**
```java
// ❌ 禁止
@Test
void testCreate_Success() {
    // 后续补充
}

@Test
void testCreate_Success() {
    assertTrue(true); // 占位符断言
}
```

### 正确做法

- **完整实现所有测试方法**：每个 IT-* 用例必须有完整的测试代码
- **完整的断言**：不能只断言返回值，数据库状态也必须验证
- **如果需求不明确**：停止编码，使用 AskUserQuestion 询问用户

---

## 注意事项

1. **隔离性**：每个测试方法独立，不依赖其他测试
2. **真实数据库**：使用 TestContainers 或真实测试数据库
3. **断言完整**：不仅验证返回值，还验证数据库状态
4. **边界覆盖**：特别注意边界值测试
5. **失败时修复**：测试失败时自动分析并修复
6. **【强制】禁止未完成代码**：严禁 TODO/FIXME、空测试方法、占位符断言
