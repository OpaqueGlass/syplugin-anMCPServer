# 一个MCP服务端插件

## ✨快速开始

- 从集市下载 或 1、解压Release中的`package.zip`，2、将文件夹移动到`工作空间/data/plugins/`，3、并将文件夹重命名为`syplugin-aMCPServer`;
- 开启插件；
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
  - A: 修改MCP应用的配置，选择`SSE`类型，并配置端点，例如：
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
    在应用中使用类似下面的配置：
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
  - 请参考：https://github.com/punkpeye/awesome-mcp-clients 或 https://modelcontextprotocol.io/clients；

## 🙏参考&感谢

> 部分依赖项在`package.json`中列出。

| 开发者/项目                                                         | 项目描述           | 引用方式         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | 在终端软件Tabby中提供MCP服务； MIT License | MCP服务实现方式 |