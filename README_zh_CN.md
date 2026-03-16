# 一个MCP服务端插件

> 为[思源笔记](https://github.com/siyuan-note/siyuan)提供MCP服务的插件。

> 当前版本: v1.0.0-alpha
>
> 新增：MCP连接、工具调用日志；
>
> 其他详见[更新日志](./CHANGELOG.md)。

## 🌻特点

- 大部分工具提供排除文档功能；
- 有一定的输入参数检查，并不是直接将思源笔记的API包装为工具；
- 在电脑客户端安装插件即可使用；不支持Docker/移动端；

## ✨快速开始

- 从集市下载 或 1、解压Release中的`package.zip`，2、将文件夹移动到`工作空间/data/plugins/`，3、并将文件夹重命名为`syplugin-anMCPServer`;
- 开启插件；
- 打开插件设置，启动服务；
- 插件默认监听`16806`端口（Host: `127.0.0.1`），请使用`http://127.0.0.1:16806/mcp`作为服务端访问地址；

> ⭐ 如果这对你有帮助，请考虑点亮Star！

## 🔧支持的工具

| 分类        | 功能项                       | 排除文档 | 状态/说明                                                   |
| ------------- | ------------------------------ | ---------- | ------------------------------------------------------------- |
| 检索        | 使用关键词搜索               | ❌       | ⚠️ 暂时移除，如有需要请反馈                               |
| 检索        | 使用 SQL 搜索                | ⚠️     | 排除文档仅在：返回值含 ID 且条目数 < 300 时检查             |
| 检索        | 笔记索引库问答 (RAG)         | ❌       | 🚫 即将移除，后续将采用新方案                               |
| 获取        | 通过 ID 获取文档 Markdown    | ✅       | —                                                          |
| 获取        | 通过 ID 获取块 Kramdown      | ✅       | —                                                          |
| 获取        | 列出笔记本                   | ❌       | —                                                          |
| 获取        | 通过 ID 获取反向链接         | ✅       | —                                                          |
| 获取        | 获取文档的子文档列表         | ✅       | —                                                          |
| 获取        | 获取子块列表                 | ✅       | —                                                          |
| 获取        | 读取属性                     | ✅       | —                                                          |
| 获取        | 读取指定日期日记             | ❌       | 🚫暂时移除，如有需要请反馈                                  |
| 获取        | 思源笔记数据库格式           | 无需     | 此功能不涉及用户文档                                        |
| 获取        | 向量检索客户端插件-查询      | ❌       | 使用此功能需要下载并正确配置 [syplugin-vectorIndexClient](https://github.com/OpaqueGlass/syplugin-vectorIndexClient)插件<br />此工具暂不支持排除文档<br /> |
| 写入 / 文档 | 向日记追加内容               | ✅       | —                                                          |
| 写入 / 文档 | 通过 ID 向指定文档追加内容   | ✅       | —                                                          |
| 写入 / 文档 | 通过 ID 在指定位置创建新文档 | ✅       | —                                                          |
| 写入 / 文档 | 插入子块（前置/后置）        | ✅       | —                                                          |
| 写入 / 文档 | 插入块（指定位置）           | ✅       | —                                                          |
| 写入 / 文档 | 更新块                       | ✅       | —                                                          |
| 写入 / 闪卡 | 通过 Markdown 内容创建闪卡   | ✅       | —                                                          |
| 写入 / 闪卡 | 通过块 ID 创建闪卡           | ✅       | —                                                          |
| 写入 / 闪卡 | 通过块 ID 删除闪卡           | ❌       | —                                                          |
| 写入 / 属性 | 更改属性（增/删/改）         | ✅       | —                                                          |
| 写入 / 移动 | 移动文档                     | ✅       | —                                                          |
| 写入 / 移动 | 移动块                       | ✅       | ⚠️ 移动标题需折叠移动，会导致折叠状态丢失                 |


## ❓可能常见的问题

- Q: 如何在MCP客户端中使用？
  请参考后文；
- Q: 常见的MCP客户端有哪些？
  - 请参考：https://github.com/punkpeye/awesome-mcp-clients 或 https://modelcontextprotocol.io/clients ；
- Q：插件支持鉴权吗？
  - v0.2.0版本已支持鉴权，在插件设置处设置鉴权token后，在MCP客户端，需要设置`authorization`请求头，其值为 `Bearer 你的Token`；
- Q: 可以在docker使用吗？
  - 不可以，插件依赖nodejs环境，不支持在移动端、docker运行；
  
    > 若要支持docker中部署的思源，建议转为使用其他MCP项目，部分项目可能在[这里](https://github.com/siyuan-note/siyuan/issues/13795)列出；
    > 
    > 或者，修改代码，将本插件和思源前端解耦；
- Q: 如何查看已经设置的授权码？
  - 授权码哈希后保存，只能修改，不能查看生效中的授权码；
- Q: 我只连接了一次，为何设置页中显示连接数的连接数大于1？
  - 统计更新不及时：请手动点击刷新状态获取最新结果；
  - 未完全释放连接：部分 MCP 客户端在关闭时未发送标准的断开信号，导致旧连接仍在后台占用。重新开启功能时，系统会建立新的连接叠加；
  - 多端连接：请确认是否有其他软件正在访问mcp服务或相关端口；
  - 仍有问题？请查看插件日志，或设置授权码避免信息泄露；
- Q：什么是“向量检索客户端插件-查询”工具？
  - 该工具通过知识图谱/向量检索等方式获取匹配的内容块或直接回答问题。
  - 要使用此工具，需要先下载、启用并正确配置[syplugin-vectorIndexClient](https://github.com/OpaqueGlass/syplugin-vectorIndexClient)插件。
  - 目前该插件仅支持lightRAG-server。

## ✅如何在MCP客户端中配置？

> MCP客户端不断迭代更新，这里的配置或使用说明未必能够直接套用，仅供参考；
>
> 这里假设：插件设置的端口号为 `16806`，授权码为 `abcdefg`，请以实际填写的插件设置为准。

修改MCP应用的配置，选择`Streamable HTTP`类型，并配置端点。

### 支持Streamable HTTP类型的客户端

下面的配置以 [Cherry Studio](https://github.com/CherryHQ/cherry-studio) 为例，针对不同的MCP客户端，可能需要不同的配置格式，请以MCP客户端文档为准。

**插件未设置授权码**

1. 类型：选择 可流式传输的HTTP（streamablehttp）；
2. URL：`http://127.0.0.1:16806/mcp`；
3. 请求头：空；

**插件已设置授权码**

1. 类型：选择 可流式传输的HTTP（streamablehttp）；
2. URL：`http://127.0.0.1:16806/mcp`；
3. 请求头：`Authorization=Bearer abcdefg`；

> 这里假设：插件设置的端口号为 `16806`，授权码为 `abcdefg`，请以实际填写的插件设置为准。

### 仅支持stdio的客户端

若MCP客户端不支持基于HTTP的通信方式，仅支持stdio，则需要通过转换后使用。

这里使用`node.js` + `mcp-remote@next`的方案。

1. 下载nodejs https://nodejs.org/zh-cn/download

2. 安装mcp-remote@next
  ```bash
  npm install -g mcp-remote@next
  ```

下面的配置以 [5ire](https://5ire.app/) 为例，针对不同的MCP客户端，可能需要不同的配置格式，请以MCP客户端文档为准。

**插件未设置授权码**

命令：

```
npx mcp-remote@next http://127.0.0.1:16806/mcp
```

**插件已设置授权码**

命令：
```
npx mcp-remote@next http://127.0.0.1:16806/mcp --header Authorization:${AUTH_HEADER}
```

环境变量：

名称：`AUTH_HEADER`
值：`Bearer abcdefg`

> 这里假设：插件设置的端口号为 `16806`，授权码为 `abcdefg`，请以实际填写的插件设置为准。

## 🙏参考&感谢

> 部分依赖项在`package.json`中列出。

| 开发者/项目                                                         | 项目描述           | 引用方式         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | 在终端软件Tabby中提供MCP服务； MIT License | MCP服务实现方式 |
| [wilsons](https://ld246.com/article/1756172573626/comment/1756384424179?r=wilsons#comments) / [Frostime](https://ld246.com/article/1739546865001#%E6%80%9D%E6%BA%90-SQL-%E6%9F%A5%E8%AF%A2-System-Prompt) | 提示词/系统提示词 CC BY-SA 4.0 | 系统提示词等，位于项目的`static/`目录 |
