# RAG Server API Documentation

本文档描述了RAG（检索增强生成）服务器的REST API接口。

## 基础信息

- **Base URL**: `http://localhost:8000/api/v1/` (默认端口)
- **API版本**: 1.0.0
- **认证方式**: API Key (可选)

## 认证

部分API端点需要API Key认证。在请求头中添加：

```
X-API-Key: your-api-key-here
```

如果服务器未配置API Key，则无需认证。

## API端点

### 1. 健康检查

检查服务状态和版本信息。

**端点**: `GET /health`

**认证**: 无需认证

**请求参数**: 无

**响应**:
- **状态码**: 200 OK
- **响应体**:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

**响应字段说明**:
- `status` (string): 服务状态，正常时为 "ok"
- `version` (string): 服务版本号

**示例请求**:
```bash
curl -X GET "http://localhost:8000/api/v1/health"
```

### 2. 文档索引

添加或更新文档到索引队列中。

**端点**: `POST /index`

**认证**: 需要API Key

**请求体**:
```json
{
  "id": "document-001",
  "content": "这是要索引的文档内容"
}
```

**请求字段说明**:
- `id` (string, 必需): 文档的唯一标识符
- `content` (string, 必需): 要索引的文档文本内容

**响应**:
- **状态码**: 202 Accepted
- **响应体**:
```json
{
  "message": "Document accepted and queued for indexing."
}
```

**响应字段说明**:
- `message` (string): 操作结果消息

**示例请求**:
```bash
curl -X POST "http://localhost:8000/api/v1/index" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "id": "doc-001", 
    "content": "这是一个测试文档的内容"
  }'
```

**注意事项**:
- 文档会被添加到处理队列中，不会立即索引
- 如果相同ID的文档已在队列中，内容会被更新
- 建议使用有意义的文档ID，便于后续管理

### 3. 文档删除

根据文档ID立即删除索引中的文档。

**端点**: `DELETE /index/{doc_id}`

**认证**: 需要API Key

**路径参数**:
- `doc_id` (string, 必需): 要删除的文档ID

**响应**:
- **状态码**: 200 OK (成功) / 500 Internal Server Error (失败)
- **成功响应体**:
```json
{
  "message": "Document with ID 'doc-001' deleted successfully."
}
```

**错误响应体**:
```json
{
  "detail": "错误详细信息"
}
```

**示例请求**:
```bash
curl -X DELETE "http://localhost:8000/api/v1/index/doc-001" \
  -H "X-API-Key: your-api-key"
```

**注意事项**:
- 删除操作是立即执行的，不经过队列
- 如果文档不存在，可能返回错误信息

### 4. 文档查询

对索引的文档执行混合搜索查询。

**端点**: `POST /query`

**认证**: 需要API Key

**请求体**:
```json
{
  "query": "搜索关键词或问题",
  "top_k": 5
}
```

**请求字段说明**:
- `query` (string, 必需): 搜索查询文本
- `top_k` (integer, 可选): 返回结果数量，默认5，范围1-20

**响应**:
- **状态码**: 200 OK (成功) / 500 Internal Server Error (失败)
- **成功响应体**:
```json
{
  "result": "查询结果内容或null"
}
```

**响应字段说明**:
- `result` (string | null): 查询结果，可能是字符串内容或null

**错误响应体**:
```json
{
  "detail": "错误详细信息"
}
```

**示例请求**:
```bash
curl -X POST "http://localhost:8000/api/v1/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "什么是人工智能？",
    "top_k": 3
  }'
```

**注意事项**:
- 查询会对所有已索引的文档进行搜索
- top_k参数控制返回的相关结果数量
- 查询结果格式取决于具体的RAG实现

## 错误处理

### HTTP状态码

- `200 OK`: 请求成功
- `202 Accepted`: 请求已接受，正在处理
- `401 Unauthorized`: 认证失败或缺少API Key
- `500 Internal Server Error`: 服务器内部错误

### 错误响应格式

```json
{
  "detail": "错误描述信息"
}
```

## 使用流程示例

1. **检查服务状态**:
   ```bash
   curl -X GET "http://localhost:8000/api/v1/health"
   ```

2. **添加文档**:
   ```bash
   curl -X POST "http://localhost:8000/api/v1/index" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-key" \
     -d '{"id": "doc1", "content": "文档内容"}'
   ```

3. **查询文档**:
   ```bash
   curl -X POST "http://localhost:8000/api/v1/query" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-key" \
     -d '{"query": "搜索内容", "top_k": 5}'
   ```

4. **删除文档** (如需要):
   ```bash
   curl -X DELETE "http://localhost:8000/api/v1/index/doc1" \
     -H "X-API-Key: your-key"
   ```

## 注意事项

1. 所有请求和响应均使用UTF-8编码
2. POST请求需要设置`Content-Type: application/json`
3. API Key配置是可选的，如果未配置则无需认证
4. 文档索引是异步处理的，查询前请确保文档已完成索引
5. 建议为文档使用有意义的ID，便于管理和删除
