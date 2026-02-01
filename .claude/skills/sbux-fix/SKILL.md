---
name: sbux:fix
description: 定点修复。根据问题描述定位并修复代码问题。当用户报告 Bug、错误、测试失败时使用。触发词：修复、fix、bug、错误、失败。
---

# /sbux:fix - 定点修复

## 描述

根据用户提供的详细问题信息，定位并修复代码问题。

**模式**：Auto 模式（快速定位修复）

**执行方式**：SubAgent 逐个顺序修复

---

## 参数

- `$ARGUMENTS`：问题描述（越详细越好）

**推荐包含**：
- 错误信息/异常堆栈
- 复现步骤
- 期望行为 vs 实际行为
- 相关日志
- 涉及的文件或接口

**示例**：
```
/sbux:fix 用户注册接口返回500错误，日志显示 NullPointerException at UserService.java:42

/sbux:fix 登录接口密码校验不生效，任意密码都能登录成功。接口路径 POST /api/users/login

/sbux:fix 集成测试 UserServiceTest.testRegister_EmailExists 失败，报错信息：expected EMAIL_EXISTS but was null

/sbux:fix 集成测试 OrderIntegrationTest.testCreateOrder_WithPayment 失败，数据库事务未回滚
```

**多任务示例**：
```
/sbux:fix review 报告中的以下问题：
1. UserService.java:42 缺少空值检查
2. OrderController.java:88 响应缺少 status 字段
3. PaymentService.java:156 异常未正确处理

/sbux:fix 以下测试失败：
- UserServiceTest.testRegister_EmailExists
- OrderServiceTest.testCreateOrder_InvalidAmount
- PaymentServiceTest.testRefund_AlreadyRefunded
```

---

## 执行流程

### Step 1: 解析任务列表

**从用户输入提取修复任务**：

```
任务列表：
├── FIX-1: UserService.java:42 缺少空值检查
├── FIX-2: OrderController.java:88 响应缺少 status 字段
└── FIX-3: PaymentService.java:156 异常未正确处理
```

### Step 2: 逐个启动 SubAgent 修复

- 使用 Task 工具，**逐个**发起 Task 调用
- subagent_type: `general-purpose`
- 每个 SubAgent 的 prompt 格式：
  ```
  执行单个修复任务，不要使用 SubAgent：

  问题描述：{具体问题描述}

  修复流程：
  1. 定位问题代码
  2. 分析根因
  3. 修复代码
  4. 验证修复（编译 + 相关测试）
  5. 输出修复报告

  修复完成后输出格式：
  🔧 FIX-{N} 修复结果：[成功/失败]
  ├── 问题：{问题简述}
  ├── 文件：{修改的文件}
  ├── 修改：{修改内容简述}
  └── 验证：{测试结果}
  ```
- **等待当前 SubAgent 完成后，再启动下一个**

### Step 3: 汇总结果

```
🔧 修复完成

📊 修复汇总：
├── 总任务: 3 个
├── 成功: 2 个
└── 失败: 1 个

✅ 成功任务：
├── FIX-1: UserService.java:42 空值检查 → 添加 Optional 处理
└── FIX-2: OrderController.java:88 status 字段 → 添加响应字段

❌ 失败任务：
└── FIX-3: PaymentService.java:156 → [失败原因]

👉 下一步：
- 失败任务可单独执行: /sbux:fix PaymentService.java:156 异常处理
- 成功任务提交: /sbux:git commit
```

---

## 输出

### 修复成功

```
🔧 修复完成

📋 问题分析：
├── 问题类型: NullPointerException
├── 错误位置: UserService.java:42
├── 根本原因: userMapper.findById() 返回 null 未处理
└── 影响范围: 用户查询功能

🛠 修复内容：
├── 文件: src/main/java/.../UserService.java
├── 修改: 添加 Optional 处理，返回 null 时抛出 UserNotFoundException
└── 行数: 42-45

✅ 验证结果：
├── 编译: 通过
├── 相关测试: UserServiceTest (5/5 通过)
└── 回归测试: 无新增失败

📝 建议：
- 考虑在其他类似场景添加空值检查
- 补充测试用例覆盖此场景
```

### 修复失败

```
❌ 修复失败（已重试 3 次）

📋 问题分析：
├── 问题类型: [类型]
├── 错误位置: [位置]
└── 尝试的修复: [修复内容]

🚫 失败原因：
[详细原因]

💡 建议：
1. 检查 [具体建议]
2. 可能需要 [进一步操作]

📎 相关文件：
- [文件列表]
```

---

## 常见问题修复模式

### NullPointerException

```java
// 问题代码
User user = userMapper.findById(id);
return user.getName(); // NPE

// 修复后
User user = userMapper.findById(id);
if (user == null) {
    throw new UserNotFoundException(id);
}
return user.getName();

// 或使用 Optional
return userMapper.findById(id)
    .map(User::getName)
    .orElseThrow(() -> new UserNotFoundException(id));
```

### 逻辑错误

```java
// 问题代码
if (password.equals(user.getPassword())) { // 明文比较

// 修复后
if (passwordEncoder.matches(password, user.getPassword())) { // 加密比较
```

### 测试失败

```java
// 问题：Mock 未配置
when(userMapper.existsByEmail(anyString())).thenReturn(false); // 添加

// 问题：断言值错误
assertEquals("EMAIL_EXISTS", ex.getMessage()); // 检查实际值
```

---

## 注意事项

1. **信息越详细越好**：错误信息、日志、堆栈都有帮助
2. **最小改动**：只修复问题，不做额外重构
3. **验证必须**：修复后必须运行相关测试
4. **记录问题**：如果是常见错误，考虑记录到 CLAUDE.md
5. **多次失败求助**：超过 3 次失败，建议人工介入
