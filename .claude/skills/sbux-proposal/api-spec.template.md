# API 接口文档：{{FEATURE_NAME}}

> 生成时间: {{TIMESTAMP}}
> 状态: [草稿/已确认]
> 关联设计: [2-design.md](./2-design.md)

---

## 接口总览

| 方法 | 路径 | 描述 | 状态 |
|------|------|------|------|
| POST | {{API_PATH_1}} | {{API_DESC_1}} | [ ] |
| GET | {{API_PATH_2}} | {{API_DESC_2}} | [ ] |

---

## 1. {{API_NAME_1}}

### 基本信息

| 项目 | 值 |
|------|-----|
| 接口路径 | `{{API_PATH_1}}` |
| 请求方法 | {{HTTP_METHOD}} |
| 接口描述 | {{API_DESC_1}} |
| 需要认证 | 是/否 |

### 请求参数

#### Headers

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer Token |
| Content-Type | string | 是 | application/json |

#### Path 参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| {{PATH_PARAM}} | {{TYPE}} | 是 | {{DESC}} | {{EXAMPLE}} |

#### Query 参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 | 示例 |
|--------|------|------|--------|------|------|
| {{QUERY_PARAM}} | {{TYPE}} | 否 | {{DEFAULT}} | {{DESC}} | {{EXAMPLE}} |

#### Body 参数

```json
{
  "{{FIELD_1}}": "{{TYPE_1}}",  // {{DESC_1}}，必填
  "{{FIELD_2}}": "{{TYPE_2}}"   // {{DESC_2}}，选填
}
```

| 参数名 | 类型 | 必填 | 说明 | 校验规则 |
|--------|------|------|------|----------|
| {{FIELD_1}} | {{TYPE_1}} | 是 | {{DESC_1}} | {{VALIDATION_1}} |
| {{FIELD_2}} | {{TYPE_2}} | 否 | {{DESC_2}} | {{VALIDATION_2}} |

### 响应参数

#### 成功响应 (200)

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "{{RESP_FIELD_1}}": "{{RESP_TYPE_1}}",
    "{{RESP_FIELD_2}}": "{{RESP_TYPE_2}}"
  }
}
```

| 参数名 | 类型 | 说明 |
|--------|------|------|
| code | int | 状态码 |
| message | string | 状态信息 |
| data.{{RESP_FIELD_1}} | {{RESP_TYPE_1}} | {{RESP_DESC_1}} |

### 错误码

| code | message | 说明 | 触发场景 |
|------|---------|------|----------|
| 400 | {{ERROR_MSG_1}} | 参数错误 | {{ERROR_SCENARIO_1}} |
| 401 | UNAUTHORIZED | 未授权 | Token无效或过期 |
| 404 | {{ERROR_MSG_2}} | 资源不存在 | {{ERROR_SCENARIO_2}} |
| 500 | INTERNAL_ERROR | 服务器错误 | 系统异常 |

### 请求示例

```bash
curl -X {{HTTP_METHOD}} '{{BASE_URL}}{{API_PATH_1}}' \
  -H 'Authorization: Bearer {{TOKEN}}' \
  -H 'Content-Type: application/json' \
  -d '{
    "{{FIELD_1}}": "{{EXAMPLE_VALUE_1}}",
    "{{FIELD_2}}": "{{EXAMPLE_VALUE_2}}"
  }'
```

### 响应示例

#### 成功

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "{{RESP_FIELD_1}}": "{{EXAMPLE_RESP_1}}"
  }
}
```

#### 失败

```json
{
  "code": 400,
  "message": "{{ERROR_MSG_1}}",
  "data": null
}
```

---

## 2. {{API_NAME_2}}

(同上格式)

---

## 通用说明

### 统一响应格式

```java
public class Result<T> {
    private Integer code;
    private String message;
    private T data;
}
```

### 通用错误码

| code | message | 说明 |
|------|---------|------|
| 200 | success | 成功 |
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未授权 |
| 403 | FORBIDDEN | 禁止访问 |
| 404 | NOT_FOUND | 资源不存在 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 0.1 | {{TIMESTAMP}} | 初始版本 | AI |
