[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/opaqueglass-syplugin-anmcpserver-badge.png)](https://mseep.ai/app/opaqueglass-syplugin-anmcpserver)


# A little MCP server for siyuan-note

[中文](./README_zh_CN.md)

> A plugin that provides MCP service for [Siyuan Note](https://github.com/siyuan-note/siyuan).

> Current Version: v0.2.0 (This version contains breaking changes)  
> 
> Improvements:  
> Added support for Streamable HTTP connections (endpoint changes required)  
> 
> Marked SSE connection as deprecated (will be removed in future versions) - Please reconfigure according to documentation  
> 
> Different devices can now use separate config files - Note: Upgrading will reset existing configurations  
> 
> New Feature:  
> Added access authorization code support  

## ✨ Quick Start

- Download from the marketplace or 1. unzip the `package.zip` in Release, 2. move the folder to `workspace/data/plugins/`, 3. and rename the folder to `syplugin-anMCPServer`;
- Enable the plugin;
- The plugin listens on port `16806` by default (Host: `127.0.0.1`), please use `http://127.0.0.1:16806/sse` as the server access address;

> ⭐ If this is helpful to you, please consider giving it a star!

## 🔧 Supported Tools

- [Search]
  - Use keyword search;
  - Use SQL search;
- [Retrieve]
  - Fetch document kramdown by ID;
  - List notebooks;
- [Write]
  - Append content to diary;
  - Append content to a specific document by ID;

## ❓ FAQ

- Q: How to use it in an MCP client?  
  Please refer to the later sections;  

- Q: What are some common MCP clients?  
  - Refer to: https://github.com/punkpeye/awesome-mcp-clients or https://modelcontextprotocol.io/clients;  

- Q: Does the plugin support authentication?  
  - Version v0.2.0 now supports authentication. After setting the authentication token in the plugin settings, the MCP client needs to configure the `authorization` request header with the value `Bearer YourToken`;  

- Q: What is the connection count?  
  - In SSE mode, this represents an active SSE connection. Due to clients not disconnecting properly or unknown software connections, the count may fluctuate;  
  - In Streamable HTTP mode and the current plugin implementation, the connection count is always 0;  

- Q: Can it be used in Docker?  
  - No, the plugin relies on a Node.js environment and does not support running on mobile devices or Docker.  

    > To support SiYuan deployed in Docker, it is recommended to switch to other MCP projects. Some relevant projects may be listed [here](https://github.com/siyuan-note/siyuan/issues/13795).
    >  
    > Alternatively, decouple this plugin from the SiYuan frontend.  

## How to Configure in an MCP Client?  

> Different MCP clients require different configuration methods. Please refer to the MCP client documentation.  
>  
> MCP clients are continuously updated, so the configuration or usage instructions here may not be directly applicable and are for reference only.  
>  
> Here, we assume: the plugin’s port is `16806`, and the authorization token is `abcdefg`.  

Modify the MCP application’s configuration, select the `Streamable HTTP` type, and configure the endpoint.  

### Clients Supporting Streamable HTTP  

The following configuration uses [Cherry Studio](https://github.com/CherryHQ/cherry-studio) as an example. Different MCP clients may require different configuration formats—please refer to the MCP client documentation.  

**Plugin Without Authorization Token**  

1. Type: Select Streamable HTTP (`streamablehttp`);  
2. URL: `http://127.0.0.1:16806/mcp`;  
3. Headers: Leave empty;  

**Plugin With Authorization Token**  

1. Type: Select Streamable HTTP (`streamablehttp`);  
2. URL: `http://127.0.0.1:16806/mcp`;  
3. Headers: `Authorization=Bearer abcedfg`;  

### Clients Supporting Only Stdio  

If the MCP client does not support HTTP-based communication and only supports stdio, a conversion method is needed.  

Here, we use `node.js` + `mcp-remote@next`.  

1. Download Node.js: https://nodejs.org/en/download  

2. Install `mcp-remote@next`:  
  ```bash  
  npm install -g mcp-remote@next  
  ```  

The following configuration uses [5ire](https://5ire.app/) as an example. Different MCP clients may require different configuration formats—please refer to the MCP client documentation.  

**Plugin Without Authorization Token**  

Command:  
```  
npx mcp-remote@next http://127.0.0.1:16806/mcp  
```  

**Plugin With Authorization Token**  

Command:  
```  
npx mcp-remote@next http://127.0.0.1:16806/mcp --header Authorization:${AUTH_HEADER}  
```  

Environment Variable:  

Name: `AUTH_HEADER`  
Value: `Bearer abcdefg`

## 🙏 References & Acknowledgements

> Some dependencies are listed in `package.json`.

| Developer/Project                                                         | Project Description           | Citation         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | Provides MCP service within the terminal software Tabby; MIT License | Implementation method of MCP service |