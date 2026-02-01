# 测试用例：{{FEATURE_NAME}}

> 生成时间: {{TIMESTAMP}}
> 状态: [草稿/已确认]
> 关联文档: [1-requirements.md](./1-requirements.md) | [3-api-spec.md](./3-api-spec.md)
> 项目类型: {{PROJECT_TYPE}}
> 测试框架: {{TEST_FRAMEWORK}}

## 0. 测试环境配置

> **配置文件**: `{{TEST_ENV_CONFIG}}`

**关键配置说明**:
- 数据库: {{DB_CONFIG_SUMMARY}}
- 缓存: {{CACHE_CONFIG_SUMMARY}}
- 外部服务: {{EXTERNAL_SERVICES_MOCK_STRATEGY}}

---

## 测试覆盖总览

| 类型 | 总数 | 已实现 | 通过 |
|------|------|--------|------|
| 集成测试 (IT) | {{IT_TOTAL}} | 0 | 0 |
| 接口测试 (AT) | {{AT_TOTAL}} | 0 | 0 |

---

## 一、集成测试用例 (Integration Tests)

### 1.1 {{TARGET_COMPONENT}} 测试

> **注意**: 禁止使用 Mock 工具/框架模拟数据库操作。

| ID | 测试点 | 测试方法名 | 输入 | 预期数据库状态 | 状态 |
|----|--------|-----------|------|----------------|------|
| IT-1 | 正常场景 | test_{{METHOD}}_success | {{INPUT_1}} | 数据已写入/更新 | [ ] |
| IT-2 | 参数为空 | test_{{METHOD}}_null_param | 空值 | 无数据变更 | [ ] |
| IT-3 | 数据不存在 | test_{{METHOD}}_not_found | 不存在的ID | 无数据变更 | [ ] |
| IT-4 | 边界条件 | test_{{METHOD}}_boundary | {{BOUNDARY_INPUT}} | 边界值正确存储 | [ ] |

### 1.2 详细用例描述

#### IT-1: 正常场景

**测试目标**: 验证正常输入时功能正确运行，且数据库状态正确

**前置条件 (Database)**:
- {{PRECONDITION_DB_STATE}}

**测试数据**:
```
输入: {{TEST_INPUT}}
```

**测试步骤**:
1. 清理/准备数据库环境
2. 调用目标方法
3. 验证返回结果
4. 查询数据库验证数据一致性

**预期结果**:
- [ ] 返回值正确
- [ ] 数据库产生预期的新增/修改记录
- [ ] 缓存状态正确（如有）
- [ ] 无异常抛出

**伪代码**:
```
// Given - 清理并插入基础数据到真实 DB
{{GIVEN_DB_SETUP}}

// When - 执行操作
{{WHEN_ACTION}}

// Then - 验证结果 & 查库校验
{{THEN_DB_VERIFICATION}}
```

#### IT-2: 参数为空

**测试目标**: 验证空参数时正确抛出异常

**测试步骤**:
1. 传入空值参数
2. 验证抛出参数校验异常

**预期结果**:
- [ ] 抛出参数异常
- [ ] 异常信息正确

---

## 二、接口测试

### 2.1 接口测试列表

> **注意**: 模拟真实 HTTP 请求，验证全链路逻辑。

| ID | 场景 | 测试方法名 | Method | Path | Body | 预期状态码 | 预期 DB 状态 | 状态 |
|----|------|-----------|--------|------|------|-----------|--------------|------|
| AT-1 | 正常请求 | test_{{API}}_success | {{HTTP_METHOD}} | {{PATH}} | 有效数据 | 200 | 数据落库成功 | [ ] |
| AT-2 | 参数缺失 | test_{{API}}_missing_param | {{HTTP_METHOD}} | {{PATH}} | 缺少必填字段 | 400 | 无变更 | [ ] |
| AT-3 | 参数格式错误 | test_{{API}}_invalid_format | {{HTTP_METHOD}} | {{PATH}} | 格式错误 | 400 | 无变更 | [ ] |
| AT-4 | 资源不存在 | test_{{API}}_not_found | GET | {{PATH}}/999 | - | 404 | 无变更 | [ ] |
| AT-5 | 未授权 | test_{{API}}_unauthorized | {{HTTP_METHOD}} | {{PATH}} | - | 401 | 无变更 | [ ] |

### 2.2 详细用例描述

#### AT-1: 正常请求

**测试目标**: 验证正常请求返回预期结果

**请求信息**:
- Method: {{HTTP_METHOD}}
- Path: {{PATH}}
- Headers: Content-Type: application/json

**请求体**:
```json
{
  "{{FIELD_1}}": "{{VALUE_1}}",
  "{{FIELD_2}}": "{{VALUE_2}}"
}
```

**预期响应**:
- 状态码: 200
- 响应体:
```json
{
  "code": 200,
  "data": {
    "{{RESPONSE_FIELD}}": "{{RESPONSE_VALUE}}"
  }
}
```

**验证点**:
- [ ] HTTP 状态码正确
- [ ] 响应 JSON 结构匹配
- [ ] 核心字段值正确
- [ ] **DB 数据已正确创建/更新**

#### AT-2: 参数缺失

**测试目标**: 验证缺少必填参数时返回正确错误

**请求体** (缺少必填字段):
```json
{
  "{{OPTIONAL_FIELD}}": "{{VALUE}}"
}
```

**预期响应**:
- 状态码: 400
- 错误信息包含: 参数缺失说明

---

## 三、测试数据

### 3.1 正常数据

```json
{
  "{{FIELD_1}}": "{{VALID_VALUE_1}}",
  "{{FIELD_2}}": "{{VALID_VALUE_2}}"
}
```

### 3.2 边界数据

| 字段 | 边界类型 | 值 | 预期行为 |
|------|----------|-----|----------|
| {{FIELD}} | 最小值 | {{MIN_VALUE}} | 成功 |
| {{FIELD}} | 最大值 | {{MAX_VALUE}} | 成功 |
| {{FIELD}} | 超出范围 | {{OVERFLOW}} | 失败 |

### 3.3 异常数据

| 字段 | 异常类型 | 值 | 预期错误 |
|------|----------|-----|----------|
| {{FIELD}} | 空值 | null/undefined | REQUIRED |
| {{FIELD}} | 格式错误 | "invalid" | INVALID_FORMAT |

---

## 四、数据准备与清理 (Data Setup & Teardown)

### 4.1 基础数据准备 (Fixtures)

| 实体 | 准备方式 | 关键字段值 | 说明 |
|------|----------|------------|------|
| {{ENTITY_1}} | 直接插入 DB | {{KEY_VALUE_1}} | 前置依赖数据 |
| {{ENTITY_2}} | API 创建 | {{KEY_VALUE_2}} | 通过已有接口创建 |

### 4.2 数据清理策略

- [ ] 事务自动回滚 (Transaction Rollback)
- [ ] 显式清理 (Teardown/AfterEach)
- [ ] 容器销毁 (TestContainers)

> **原则**: 每个测试用例执行前必须保证环境一致，执行后不应污染环境。

---

## 五、执行说明

### 5.1 测试执行命令

{{TEST_COMMANDS}}

<!--
执行命令参考：

【后端 - Java/Maven】
mvn test -Dtest=XxxServiceTest
mvn test -Dtest=XxxControllerTest

【后端 - Python/pytest】
pytest tests/test_xxx.py -v
pytest tests/ -k "test_xxx"

【前端 - npm/Jest】
npm test -- --testPathPattern=xxx
npm run test:unit

【前端 - npm/Vitest】
npm run test
npx vitest run xxx.test.ts
-->

### 5.2 覆盖率要求

- 集成测试覆盖率: >= {{IT_COVERAGE}}%
- 分支覆盖率: >= {{BRANCH_COVERAGE}}%

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 0.1 | {{TIMESTAMP}} | 初始版本 | AI |
