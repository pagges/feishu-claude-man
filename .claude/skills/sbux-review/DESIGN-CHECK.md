# 设计符合性检查规范

本文档定义设计符合性检查的规则和执行方法。

---

## 检查目标

验证代码实现是否符合设计文档中定义的架构决策和技术规范。

---

## 输入来源

### 2-design.md 结构

需要提取的设计要素：

1. **架构模式**
   - 分层架构（Controller → Service → Repository）
   - 模块划分
   - 依赖方向

2. **技术选型**
   - 框架版本
   - 依赖库
   - 中间件

3. **命名约定**
   - 类名规范
   - 方法名规范
   - 变量名规范

4. **数据结构**
   - 实体设计
   - DTO 设计
   - 数据库表结构

5. **设计决策**
   - 明确的技术选择及理由
   - 关键实现方式

### 变更代码

通过 git 获取变更文件：
```bash
git diff --name-only HEAD~10
git diff HEAD~10 -- "*.java" "*.ts" "*.py" "*.go"
```

---

## 设计要素提取

### 架构模式识别

从设计文档提取分层结构：

```markdown
## 架构设计

采用分层架构：
- Controller 层：处理 HTTP 请求
- Service 层：业务逻辑
- Repository 层：数据访问
```

提取结果：
```
layers: [Controller, Service, Repository]
dependencies: Controller → Service → Repository
```

### 命名约定提取

```markdown
## 命名规范

- Controller 类：XxxController
- Service 接口：XxxService
- Service 实现：XxxServiceImpl
- Repository：XxxRepository / XxxMapper
```

提取结果：
```
naming:
  controller: "*Controller"
  service_interface: "*Service"
  service_impl: "*ServiceImpl"
  repository: "*Repository|*Mapper"
```

### 技术决策提取

```markdown
## 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 密码加密 | BCrypt | 安全性高 |
| 日志框架 | SLF4J | 统一日志门面 |
```

提取结果：
```
decisions:
  - id: D-1
    topic: 密码加密
    choice: BCrypt
```

---

## 检查规则

### 1. 分层架构检查

**规则**：各层代码应在对应的包/目录下

| 层 | 期望路径 |
|---|---|
| Controller | `*/controller/*`, `*/controllers/*`, `*/api/*` |
| Service | `*/service/*`, `*/services/*` |
| Repository | `*/repository/*`, `*/mapper/*`, `*/dao/*` |

**检查点**：
- Controller 不直接调用 Repository
- Service 不直接处理 HTTP 请求/响应
- Repository 不包含业务逻辑

### 2. 依赖方向检查

**规则**：依赖只能从上层指向下层

```
Controller → Service → Repository
     ↓          ↓          ↓
    DTO      Entity     Entity
```

**检查点**：
- Repository 不 import Controller
- Service 不 import Controller
- 无循环依赖

### 3. 命名规范检查

**规则**：类名符合约定模式

**检查点**：
- Controller 类以 `Controller` 结尾
- Service 接口以 `Service` 结尾
- Repository 类以 `Repository` 或 `Mapper` 结尾
- DTO 类以 `DTO`、`Request`、`Response` 结尾

### 4. 技术决策符合性

**规则**：代码使用设计文档中决定的技术

**检查点**：
- 密码加密使用指定算法
- 日志使用指定框架
- 其他明确的技术选择

---

## 检查执行

### 步骤 1：解析设计文档

```python
# 伪代码
design_elements = {
    "architecture": extract_architecture(design_doc),
    "naming": extract_naming_rules(design_doc),
    "decisions": extract_decisions(design_doc)
}
```

### 步骤 2：分析变更代码

```python
# 伪代码
for file in changed_files:
    structure = analyze_file(file)
    # - package/module path
    # - class name
    # - imports/dependencies
    # - method signatures
```

### 步骤 3：执行检查

```python
# 伪代码
results = []
for rule in design_elements:
    result = check_compliance(rule, changed_files)
    results.append(result)
```

---

## 问题严重程度

| 级别 | 描述 | 示例 |
|------|------|------|
| 🔴 ERROR | 违反核心架构原则 | Controller 直接访问数据库 |
| 🟡 WARNING | 偏离命名约定 | Service 类命名为 XxxHandler |
| 🔵 INFO | 轻微不一致 | 注释风格差异 |

---

## 输出格式

### 通过

```
📐 设计符合性检查
├── 设计要素: 8 个
├── 已检查文件: 12 个
├── 符合: 12 个
├── 偏离: 0 个
└── 状态: ✅ 通过
```

### 有偏离

```
📐 设计符合性检查
├── 设计要素: 8 个
├── 已检查文件: 12 个
├── 符合: 10 个
├── 偏离: 2 个
│   ├── [WARN] UserHandler.java - 应命名为 UserService
│   └── [ERROR] UserController.java:45 - 直接调用 UserMapper
└── 状态: ❌ 失败
```

---

## 常见偏离场景

### 场景 1：快捷方式

Controller 直接调用 Repository 绕过 Service：
```java
// 问题
@RestController
public class UserController {
    @Autowired
    private UserMapper userMapper;  // 不应直接注入
}
```

### 场景 2：命名不规范

```java
// 问题
public class UserHandler implements UserService { }
// 应该
public class UserServiceImpl implements UserService { }
```

### 场景 3：技术选择不符

```java
// 设计要求使用 BCrypt
// 问题
String hash = MD5.hash(password);
// 应该
String hash = passwordEncoder.encode(password);
```

---

## 例外处理

某些情况下偏离可能是合理的：

1. **设计文档已过时**：记录为 INFO，建议更新文档
2. **特殊场景需求**：记录为 INFO，需要代码注释说明
3. **渐进式重构**：记录为 WARNING，标记待处理

在报告中注明：
```
🔵 [INFO] UserController.java:45 - 直接调用 UserMapper
   └── 原因：历史遗留代码，待重构（参考 TECH-DEBT.md）
```
