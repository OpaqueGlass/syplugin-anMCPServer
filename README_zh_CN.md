# 一个MCP服务端插件

> 为[思源笔记](https://github.com/siyuan-note/siyuan)提供MCP服务的插件。

> 当前版本: v0.2.0 此版本包含API更改
>
> 改进：弃用SSE连接方式，换用Streamable HTTP，对应有端点更改，请参考文档重新设置；
>
> 其他详见[更新日志](./CHANGELOG.md)。

## ✨快速开始

- 从集市下载 或 1、解压Release中的`package.zip`，2、将文件夹移动到`工作空间/data/plugins/`，3、并将文件夹重命名为`syplugin-anMCPServer`;
- 开启插件；
- 打开插件设置，启动服务；
- 插件默认监听`16806`端口（Host: `127.0.0.1`），请使用`http://127.0.0.1:16806/mcp`作为服务端访问地址；

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
  请参考后文；
- Q: 常见的MCP客户端有哪些？
  - 请参考：https://github.com/punkpeye/awesome-mcp-clients 或 https://modelcontextprotocol.io/clients ；
- Q：插件支持鉴权吗？
  - v0.2.0版本已支持鉴权，在插件设置处设置鉴权token后，在MCP客户端，需要设置`authorization`请求头，其值为 `Bearer 你的Token`；
- Q: 可以在docker使用吗？
  - 不可以，插件依赖nodejs环境，不支持在移动端、docker运行；
  
    > 若要支持docker中部署的思源，插件需要像`mcp-obsidian`一样基于python构建、通过API访问思源内容；
    > 
    > 或者将本插件和思源前端解耦；

## 如何在MCP客户端中配置？

> 针对不同的MCP客户端，需要不同的配置方式，请以MCP客户端文档为准；
> 
> MCP客户端不断迭代更新，这里的配置或使用说明未必能够直接套用，仅供参考；
>
> 这里假设：插件设置的端口号为`16806`，权限控制认证码为 `abcdefg`。

修改MCP应用的配置，选择`Streamable HTTP`类型，并配置端点。

### 一般地

下面的配置以 [Cherry Studio](https://github.com/CherryHQ/cherry-studio) 为例，针对不同的MCP客户端，可能需要不同的配置格式，请以MCP客户端文档为准。

**插件未设置认证码**

1. 类型：选择 可流式传输的HTTP（streamablehttp）
2. URL：`http://127.0.0.1:16806/mcp`
3. 请求头：空

**插件已设置认证码**

1. 类型：选择 可流式传输的HTTP（streamablehttp）
2. URL：`http://127.0.0.1:16806/mcp`
3. 请求头：`Authorization=Bearer abcedfg`

### 仅支持stdio的MCP客户端

若MCP客户端不支持基于HTTP的通信方式，仅支持stdio，则需要通过转换后使用。

这里使用`node.js` + `mcp-remote@next`的方案。

1. 下载nodejs https://nodejs.org/zh-cn/download

2. 安装mcp-remote@next
  ```bash
  npm install -g mcp-remote@next
  ```

下面的配置以 [5ire](https://5ire.app/) 为例，针对不同的MCP客户端，可能需要不同的配置格式，请以MCP客户端文档为准

**插件未设置认证码**

命令：

```
npx mcp-remote@next http://127.0.0.1:16806/mcp
```

**插件已设置认证码**

命令：
```
npx mcp-remote@next http://127.0.0.1:16806/mcp --header Authorization:${AUTH_HEADER}
```

环境变量：

名称：`AUTH_HEADER`
值：`Bearer abcdefg`

## 🙏参考&感谢

> 部分依赖项在`package.json`中列出。

| 开发者/项目                                                         | 项目描述           | 引用方式         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | 在终端软件Tabby中提供MCP服务； MIT License | MCP服务实现方式 |