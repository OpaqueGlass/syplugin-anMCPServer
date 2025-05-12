
# A little MCP server for siyuan-note

[中文](./README_zh_CN.md)

> A plugin that provides MCP service for [Siyuan Note](https://github.com/siyuan-note/siyuan).

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

## ❓ Frequently Asked Questions

- Q: How do I use it in an MCP client?
  - A: Modify the MCP application's configuration to select the SSE type and configure the endpoint, for example:
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
- Q: My MCP client does not support HTTP-based communication, only stdio.
  - Use an MCP Host application that supports HTTP communication;
  - Or use the `node.js` + `mcp-remote` solution 
    ```bash
    npm install -g mcp-remote
    ```
    Use a configuration similar to the one below in the application:
    ```json
    {
      "servers": [
        {
          "name": "Siyuan",
          "key": "siyuan",
          "description": "Read notes",
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
- Q: What are some common MCP clients?
  - Please refer to: https://github.com/punkpeye/awesome-mcp-clients or https://modelcontextprotocol.io/clients;

## 🙏 References & Acknowledgements

> Some dependencies are listed in `package.json`.

| Developer/Project                                                         | Project Description           | Citation         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | Provides MCP service within the terminal software Tabby; MIT License | Implementation method of MCP service |