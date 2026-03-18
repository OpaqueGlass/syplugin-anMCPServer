
# An MCP server for siyuan-note

[中文](./README_zh_CN.md)

> A plugin that provides MCP service for [Siyuan Note](https://github.com/siyuan-note/siyuan).

## 🌻 Features

- Most tools support the **exclude document** function.
- It includes certain input parameter validation and is **not a direct API wrapper** for SiYuan Note.
- Ready to use once the plugin is installed and enabled on the **desktop client**; Docker and mobile platforms are **not supported**.

## ✨ Quick Start

- Download from the marketplace or 1. unzip the `package.zip` in Release, 2. move the folder to `workspace/data/plugins/`, 3. and rename the folder to `syplugin-anMCPServer`;
- Enable the plugin;
- The plugin listens on port `16806` by default (Host: `127.0.0.1`), please use `http://127.0.0.1:16806/sse` as the server access address;

> ⭐ If this is helpful to you, please consider giving it a star!

## 🔧 Supported Tools

> [!WARNING]
> Not all tools have strict excluded document validation. Before using excluded documents or after updating MCP tools, please read the tool support list carefully and consider disabling some tools.

| Category     | Item                          | Exclude Doc | Status/Notes                                                                                                         |
|--------------|-------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------|
| Retrieval    | Search using SQL              | ⚠️          | Excluded documents are only checked if: the result contains IDs **and** the number of entries < 300                   |
| Get          | Get document Markdown by ID   | ✅          | —                                                                                                                     |
| Get          | Get block Kramdown by ID      | ✅          | —                                                                                                                     |
| Get          | List notebooks                | ❌          | —                                                                                                                     |
| Get          | Get backlinks by ID           | ✅          | —                                                                                                                     |
| Get          | Get subdocuments of a document| ✅          | —                                                                                                                     |
| Get          | Get child block list          | ✅          | —                                                                                                                     |
| Get          | Read attributes               | ✅          | —                                                                                                                     |
| Get          | SiYuan database format        | ❌          | This function does not involve user documents                                                                         |
| Get          | Vector Search Client Plugin - Query | ❌      | To use this function, download and properly configure the [syplugin-vectorIndexClient](https://github.com/OpaqueGlass/syplugin-vectorIndexClient) plugin.<br />This tool does not support excluded documents yet. |
| Get          | Template file raw content     | ❌          | —                                                                                                                     |
| Get          | Template render result preview| ⚠️          | Only kramdown content is returned.<br />Since functions like `getBlock` can be used in templates, excluded documents may be accessed bypassing checks via this tool. |
| Get          | Sprig render result preview   | ❌          | —                                                                                                                     |
| Get          | Retrieve existing templates   | ❌          | —                                                                                                                     |
| Write / Doc  | Append content to journal     | ✅          | —                                                                                                                     |
| Write / Doc  | Append content to document by ID | ✅       | domstring not supported                                                                                               |
| Write / Doc  | Create new doc at position by ID | ✅        | domstring not supported                                                                                               |
| Write / Doc  | Insert child block (before/after) | ✅      | domstring not supported                                                                                               |
| Write / Doc  | Insert block at specified position | ✅     | domstring not supported                                                                                               |
| Write / Doc  | Update block                  | ✅          | domstring not supported                                                                                               |
| Write / Card | Create flashcard from Markdown | ✅        | —                                                                                                                     |
| Write / Card | Create flashcard by block ID  | ✅          | —                                                                                                                     |
| Write / Card | Delete flashcard by block ID  | ❌          | —                                                                                                                     |
| Write / Attr | Modify attributes (add/del/edit) | ✅       | —                                                                                                                     |
| Write / Move | Move document                 | ✅          | —                                                                                                                     |
| Write / Move | Move block                    | ✅          | ⚠️ Moving headings requires folded movement, which will cause folded state to be lost.                               |
| Write / Tpl  | Create or overwrite template  | ❌          | —                                                                                                                     |
| Write / Doc  | Render template & insert at doc start | ⚠️ | Inserted at document start, position cannot be specified.<br />Since functions like `getBlock` can be used in templates, excluded documents may be accessed bypassing checks via this tool. |
| Write / Tpl  | Delete existing template      | ❌          | —                                                                                                                     |
| Write / Doc  | Rename document               | ✅          | —                                                                                                                     |
| Write / Doc  | Rename notebook              | ✅          | —                                                                                                                     |

## ❓ Frequently Asked Questions

- Q: How to use in an MCP client?
  - Please refer to the sections below.
- Q: What are common MCP clients?
  - Please refer to: https://github.com/punkpeye/awesome-mcp-clients or https://modelcontextprotocol.io/clients.
- Q: Does the plugin support authentication?
  - Authentication is supported since v0.2.0. After setting an auth token in plugin settings, you must set the `authorization` request header in your MCP client with value: `Bearer {YourToken}`.
- Q: Does the plugin support Cloudflare Access authentication?
  - Yes. If you enable the Cloudflare Access–related options in the plugin settings and expose this MCP server through Cloudflare (for example via a Tunnel or a domain protected by a Cloudflare Access application), only requests that have been authenticated by Cloudflare Access will be accepted according to your Cloudflare configuration.
  - In this setup, your MCP client should connect to the public HTTPS endpoint fronted by Cloudflare instead of `http://127.0.0.1:16806/sse`. The Cloudflare Access flow runs in front of the MCP server, so the client does not need to send the plugin’s Bearer token unless you explicitly keep token-based authentication enabled as an additional check.
  - See the plugin settings UI for the exact meaning of each Cloudflare Access option and how it interacts with token-based authentication.
- Q: Can it be used in Docker?
  - No. The plugin depends on the Node.js environment and does not support running on mobile or in Docker.

    > If you need to support SiYuan deployed in Docker, it is recommended to use other MCP projects. Some may be listed [here](https://github.com/siyuan-note/siyuan/issues/13795).
    >
    > Alternatively, modify the code to decouple this plugin from the SiYuan frontend.
- Q: How to view the set authorization token?
  - The token is stored hashed. It can only be modified, not viewed in plaintext while active.
- Q: I only connected once, why does the connection count on the settings page show more than 1?
  - Outdated statistics: Please manually click Refresh Status to get the latest result.
  - Connections not fully released: Some MCP clients do not send a standard disconnect signal on close, leaving old connections alive in the background. New connections are added when the feature is restarted.
  - Multi-device connections: Please confirm whether other software is accessing the MCP service or related ports.
  - Still having issues? Check the plugin logs or set an authorization token to prevent information leakage.
- Q: What is the "Vector Search Client Plugin - Query" tool?
  - This tool retrieves matching content blocks or answers questions directly via knowledge graph / vector search.
  - To use it, you must first download, enable, and properly configure the [syplugin-vectorIndexClient](https://github.com/OpaqueGlass/syplugin-vectorIndexClient) plugin.
  - Currently, this plugin only supports lightRAG-server.

## How to Configure in an MCP Client?  

> Different MCP clients require different configuration methods. Please refer to the MCP client documentation.  
>
> Common patterns:
> - **Local-only:** Connect directly to `http://127.0.0.1:16806/sse` and configure your MCP client to send `authorization: Bearer {YourToken}` if you have set a plugin auth token.
> - **Remote / Cloudflare Access:** Expose the MCP server through Cloudflare (Tunnel or domain) and protect it with a Cloudflare Access application. Configure your MCP client to use the public HTTPS URL; authentication will be enforced by Cloudflare Access according to your Cloudflare settings.
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
| [wilsons](https://ld246.com/article/1756172573626/comment/1756384424179?r=wilsons#comments) / [Frostime](https://ld246.com/article/1739546865001#%E6%80%9D%E6%BA%90-SQL-%E6%9F%A5%E8%AF%A2-System-Prompt) | System Prompt CC BY-SA 4.0 | System Prompts etc. which locate at `static/` |