# 一个MCP服务端插件

> 为[思源笔记](https://github.com/siyuan-note/siyuan)提供MCP服务的插件。

> 当前版本: v0.1.2
>
> 改进：获取文档内容支持分页，默认1万个字符；改进：对搜索结果进行过滤，去除了部分返回值；
>
> 修复：搜索类型限制设置无效的问题；
>
> 其他详见[更新日志](./CHANGELOG.md)。

## ✨快速开始

- 从集市下载 或 1、解压Release中的`package.zip`，2、将文件夹移动到`工作空间/data/plugins/`，3、并将文件夹重命名为`syplugin-anMCPServer`;
- 开启插件；
- 打开插件设置，启动服务；
- 插件默认监听`16806`端口（Host: `127.0.0.1`），请使用`http://127.0.0.1:16806/sse`作为服务端访问地址；

> ⭐ 如果这对你有帮助，请考虑点亮Star！

## 🔧支持的工具

- 【检索】
  - 使用关键词搜索；
  - 使用SQL搜索；
- 【获取】
  - 通过id获取文档kramdown；
  - 列出笔记本；
- 【写入】
  - 向日记追加内容；
  - 通过id向指定文档追加内容；

## ❓可能常见的问题

- Q: 如何在MCP客户端中使用？
  - A: 修改MCP应用的配置，选择`SSE`类型，并配置端点。
    配置格式可能例如：

    （下面的配置以 [chatmcp](https://github.com/daodao97/chatmcp) 为例，针对不同的MCP客户端，可能需要不同的配置格式，请以MCP客户端文档为准）
    ```json
    {
    "mcpServers": {
        "siyuan": {
            "type": "sse",
            "command": "http://127.0.0.1:16806/sse",
            "args": [
                ""
            ],
            "env": {},
            "auto_approve": false
        }
    }
    }
    ```
- Q: 我的MCP客户端不支持基于HTTP的通信方式，仅支持stdio
  - 换用支持HTTP通信方式的MCP Host应用；
  - 或者使用`node.js` + `mcp-remote`的方案，
    ```bash
    npm install -g mcp-remote
    ```
    在应用中使用类似下面的配置

    （下面的配置以 [5ire](https://5ire.app/) 为例，针对不同的MCP客户端，可能需要不同的配置格式，请以MCP客户端文档为准）
    ```json
    {
      "servers": [
        {
          "name": "思源笔记",
          "key": "siyuan",
          "description": "访问笔记数据库",
          "command": "npx",
          "args": [
            "mcp-remote",
            "http://127.0.0.1:16806/sse"
          ],
          "isActive": true
        }
      ]
    }
    ```
- Q: 常见的MCP客户端有哪些？
  - 请参考：https://github.com/punkpeye/awesome-mcp-clients 或 https://modelcontextprotocol.io/clients ；
- Q: 可以在docker使用吗？
  - 不可以，插件依赖nodejs环境，不支持在移动端、docker运行；
  
    > 若要支持docker中部署的思源，插件需要像`mcp-obsidian`一样基于python构建、通过API访问思源内容；
    > 
    > 或者将本插件和思源前端解耦；

## 🙏参考&感谢

> 部分依赖项在`package.json`中列出。

| 开发者/项目                                                         | 项目描述           | 引用方式         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | 在终端软件Tabby中提供MCP服务； MIT License | MCP服务实现方式 |