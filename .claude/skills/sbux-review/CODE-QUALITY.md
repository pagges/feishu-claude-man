# 代码质量检查规范

本文档定义代码质量检查的规则和执行方法。

---

## 检查目标

检查变更代码的质量问题，包括代码风格、潜在错误和最佳实践。

---

## Linter 检测和执行

### 自动检测项目 Linter

根据项目配置文件检测使用的 Linter：

| 语言 | 配置文件 | Linter |
|------|----------|--------|
| Java | `checkstyle.xml` | Checkstyle |
| Java | `pmd.xml` | PMD |
| Java | `spotbugs.xml` | SpotBugs |
| JavaScript/TypeScript | `.eslintrc.*`, `eslint.config.*` | ESLint |
| Python | `.pylintrc`, `pylintrc` | Pylint |
| Python | `.flake8`, `setup.cfg` | Flake8 |
| Python | `ruff.toml`, `pyproject.toml` | Ruff |
| Go | `.golangci.yml` | golangci-lint |

### 执行 Linter

**Java (Maven)**：
```bash
# Checkstyle
mvn checkstyle:check

# PMD
mvn pmd:check

# SpotBugs
mvn spotbugs:check
```

**Java (Gradle)**：
```bash
./gradlew checkstyleMain
./gradlew pmdMain
./gradlew spotbugsMain
```

**JavaScript/TypeScript**：
```bash
npx eslint src/ --format json
npm run lint
```

**Python**：
```bash
# Pylint
pylint src/

# Flake8
flake8 src/

# Ruff
ruff check src/
```

**Go**：
```bash
golangci-lint run ./...
```

---

## 基础代码检查（无 Linter 时）

如果项目没有配置 Linter，执行以下基础检查：

### 1. 未使用的导入/变量

**检查方法**：分析代码中定义但未使用的元素

**Java**：
```java
// 问题
import java.util.List;  // 未使用

public class User {
    private String unused;  // 未使用的字段
}
```

**JavaScript/TypeScript**：
```javascript
// 问题
import { unused } from './module';  // 未使用
const temp = 1;  // 未使用的变量
```

### 2. 过长的方法/函数

**阈值**：
- 方法行数 > 50 行：⚠️ 警告
- 方法行数 > 100 行：🔴 错误

**检查方法**：统计方法体的行数

### 3. 重复代码

**检查方法**：识别相似的代码块

**阈值**：
- 连续重复行 > 10 行：⚠️ 警告
- 重复代码块 > 3 处：🔴 错误

### 4. 硬编码值

**检查范围**：
- 魔法数字（除 0, 1, -1 外的数字常量）
- 硬编码字符串（URL、路径、配置值）
- 硬编码凭证（密码、密钥、Token）

**示例**：
```java
// 问题
if (status == 3) { }  // 魔法数字
String url = "http://api.example.com";  // 硬编码 URL
String password = "admin123";  // 硬编码密码 🔴

// 正确
if (status == STATUS_APPROVED) { }
String url = config.getApiUrl();
String password = env.get("DB_PASSWORD");
```

### 5. 缺少错误处理

**检查范围**：
- 空的 catch 块
- 忽略返回值（可能为 null 或 error）
- 未处理的 Promise

**Java**：
```java
// 问题
try {
    doSomething();
} catch (Exception e) {
    // 空 catch 块
}

// 正确
try {
    doSomething();
} catch (Exception e) {
    log.error("操作失败", e);
    throw new ServiceException("操作失败", e);
}
```

**JavaScript**：
```javascript
// 问题
promise.then(data => process(data));  // 未处理错误

// 正确
promise
    .then(data => process(data))
    .catch(err => handleError(err));
```

### 6. 安全问题

**检查范围**：
- SQL 拼接（SQL 注入风险）
- 未转义的用户输入（XSS 风险）
- 不安全的随机数生成
- 敏感信息日志输出

**SQL 注入**：
```java
// 问题
String sql = "SELECT * FROM users WHERE id = " + userId;

// 正确
String sql = "SELECT * FROM users WHERE id = ?";
preparedStatement.setLong(1, userId);
```

**XSS**：
```javascript
// 问题
element.innerHTML = userInput;

// 正确
element.textContent = userInput;
```

---

## 问题严重程度

| 级别 | 描述 | 示例 |
|------|------|------|
| 🔴 ERROR | 必须修复的问题 | **TODO、FIXME、未完成代码、桩代码**、硬编码凭证、SQL 注入、空 catch |
| 🟡 WARNING | 建议修复的问题 | 过长方法、未使用变量、魔法数字 |
| 🔵 INFO | 供参考的建议 | 代码风格、命名建议 |

---

## 检查执行流程

### 步骤 1：检测项目配置

```bash
# 检查是否有 linter 配置
ls -la .eslintrc* eslint.config.* .pylintrc checkstyle.xml 2>/dev/null
```

### 步骤 2：获取变更文件

```bash
git diff --name-only HEAD~10 -- "*.java" "*.ts" "*.js" "*.py" "*.go"
```

### 步骤 3：执行检查

如果有 Linter：
```bash
# 只检查变更文件
eslint file1.ts file2.ts --format json
```

如果无 Linter：
- 读取变更文件
- 应用基础检查规则

### 步骤 4：汇总结果

```
总问题数: 15
├── 🔴 ERROR: 3
├── 🟡 WARNING: 8
└── 🔵 INFO: 4
```

---

## 输出格式

### 通过

```
🔍 代码质量检查
├── 检查工具: ESLint
├── 检查文件: 8 个
├── 错误: 0 个
├── 警告: 0 个
└── 状态: ✅ 通过
```

### 有问题

```
🔍 代码质量检查
├── 检查工具: ESLint + 基础检查
├── 检查文件: 8 个
├── 错误: 2 个
├── 警告: 5 个
├── 问题列表:
│   ├── [ERROR] UserService.java:42 - 空的 catch 块
│   ├── [ERROR] UserController.java:58 - SQL 拼接
│   ├── [WARN] UserService.java:15 - 未使用的导入
│   ├── [WARN] UserService.java:80 - 方法过长（75行）
│   └── ...
└── 状态: ❌ 失败
```

---

## 问题详情报告

```
══════════════════════════════════════════════════
代码质量问题详情
══════════════════════════════════════════════════

🔴 ERROR: 空的 catch 块
   文件: UserService.java:42-45
   代码:
   │ try {
   │     userMapper.insert(user);
   │ } catch (Exception e) {
   │     // TODO: handle exception
   │ }
   建议: 添加错误处理逻辑或重新抛出异常

🔴 ERROR: SQL 拼接（注入风险）
   文件: UserRepository.java:28
   代码:
   │ String sql = "SELECT * FROM users WHERE name = '" + name + "'";
   建议: 使用参数化查询

🟡 WARNING: 方法过长
   文件: UserService.java:60-135
   方法: createUser (75行)
   建议: 拆分为多个小方法
```

---

## 常见问题修复模式

### 空 catch 块

```java
// 问题
try {
    operation();
} catch (Exception e) { }

// 修复选项 1: 记录日志
try {
    operation();
} catch (Exception e) {
    log.error("操作失败", e);
}

// 修复选项 2: 重新抛出
try {
    operation();
} catch (Exception e) {
    throw new ServiceException("操作失败", e);
}
```

### 方法过长

```java
// 问题: 一个大方法
public void processOrder() {
    // 验证 (20行)
    // 计算价格 (30行)
    // 创建订单 (25行)
    // 发送通知 (20行)
}

// 修复: 拆分为小方法
public void processOrder() {
    validateOrder();
    calculatePrice();
    createOrder();
    sendNotification();
}
```

### 硬编码值

```java
// 问题
if (retryCount > 3) { }

// 修复
private static final int MAX_RETRY_COUNT = 3;
if (retryCount > MAX_RETRY_COUNT) { }
```

---

## 检查豁免

某些场景可能需要豁免检查：

1. **测试代码**：测试中的魔法数字通常可以接受
2. **生成代码**：自动生成的代码不需要检查
3. **第三方代码**：vendor 目录下的代码跳过

**豁免标记**：
```java
// @SuppressWarnings("checkstyle:MagicNumber")
private static final int BUFFER_SIZE = 8192;
```

```javascript
// eslint-disable-next-line no-magic-numbers
const BUFFER_SIZE = 8192;
```
