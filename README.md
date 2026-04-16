
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

## 🛠 Supported Tools (Summary)

> For detailed tools, supported excluded documents, and other notes, please refer to the [Supported Tools](#supported-tools) section.

- Document and block operations: create, read, update, and delete;
- Database operations:
  - Create databases, add/delete/update database rows, add/delete database columns, and retrieve database structure information;
- Attribute operations: create, read, update, and delete;
- Flashcard operations: create flashcards from Markdown content, create flashcards by block ID, delete flashcards by block ID;
- Template operations: retrieve existing templates, get raw template file content, preview template rendering results, preview Sprig rendering results, create or overwrite templates, render templates and insert at the beginning of a document, delete existing templates;
- Notebook operations: list notebooks, rename notebooks;

## ❓ Frequently Asked Questions

- **Q1: How to use it in an MCP client?**
  Please refer to the subsequent sections.
- **Q2: What are some common MCP clients?**
  - Please refer to: [https://github.com/punkpeye/awesome-mcp-clients](https://github.com/punkpeye/awesome-mcp-clients) or [https://modelcontextprotocol.io/clients](https://modelcontextprotocol.io/clients).
- **Q3: Does the plugin support authentication?**
  - Version v0.2.0 and above support authentication. After setting an authentication token in the plugin settings, you must set the `authorization` request header in your MCP client with the value `Bearer YourToken`.
- **Q4: Can it be used in Docker?**
  - No. The plugin depends on a Node.js environment and does not support running on mobile devices or within Docker.
  
    > To support SiYuan deployed in Docker, it is recommended to switch to other MCP projects. Some projects are listed [here](https://github.com/siyuan-note/siyuan/issues/13795).
    > 
    > Alternatively, you can modify the code to decouple this plugin from the SiYuan frontend.
- **Q5: How can I view the configured authorization code?**
  - Authorization codes are saved as hashes. You can only modify them; you cannot view the currently active authorization code.
- **Q6: When connecting an MCP client, I get an error `Invalid Host: x.x.x.x` or something similar. How do I fix it?**
  ```json
  {
    "jsonrpc": "2.0",
    "error": {
      "code": -32000,
      "message": "Invalid Host: x.x.x.x"
    },
    "id": null
  }
  ```

  - By default, for security reasons, the service only handles requests from `localhost`. If you need to access it via a specific domain or connect to the MCP service in a non-local environment, you must manually declare it in **Plugin Settings - Allowed Hosts**.
  - Fill in this setting with the corresponding local network IP of the computer or the bound domain name.
  - Simply put: whatever IP or domain name you entered in the MCP client must also be entered here.
- **Q7: I only connected once, why does the settings page show a connection count greater than 1?**
   - **Delayed Statistics**: Please click the refresh status button manually to get the latest results.
   - **Connection Leak**: Some MCP clients do not send a standard disconnect signal when closing, causing old connections to remain occupied in the background. When the function is restarted, the system establishes a new overlapping connection.
   - **Multi-device Connection**: Please confirm if other software is accessing the MCP service or the relevant port.
   - **Still having issues?** Please check the plugin logs or set an authorization code to prevent information leakage.

- **Q8: What is the "Vector Index Client Plugin - Query" tool?**
   - This tool retrieves matching content blocks or answers questions directly via Knowledge Graph/Vector Search.
   - To use this tool, you need to download, enable, and correctly configure the [syplugin-vectorIndexClient](https://github.com/OpaqueGlass/syplugin-vectorIndexClient) plugin.
   - Currently, this plugin only supports lightRAG-server.

- **Q9: How to better utilize the MCP services provided by the plugin?**
   - Limit available tools for different tasks. For example, disable template-related tools when you don't need to manipulate templates.
   - The plugin provides Prompts suitable for certain task types. You need to use these related prompts in your MCP client; please refer to each client's documentation for specific operation methods.

- **Q10: Can I create an HTTPS-based service?**
   - Yes. You need to place two files, `server-key.pem` and `server-cert.pem`, in the directory `Workspace/data/storage/petal/syplugin-anMCPServer`, then restart SiYuan Note. If the notification message when the MCP service starts ends with `with HTTPS`, it means it has been enabled.
   - **Q10.1: MCP client shows `net::ERR_CERT_AUTHORITY_INVALID`**
      - This is expected with self-signed certificates. Refer to the previous point: a) Delete the two certificate files and continue using HTTP; b) Replace them with certificates issued by an authoritative CA; c) Or add the self-signed certificate to your trust list (not recommended).

   - **Q10.2: MCP client shows `net::ERR_EMPTY_RESPONSE`**
      - Please check: if HTTPS is used, the client URL must start with `https://`. Otherwise, delete the two certificate files and continue using HTTP.

   - **Q10.3: MCP client shows `net::ERR_CERT_COMMON_NAME_INVALID`**
      - When generating the certificate, ensure the correctness of the **CN (Common Name)** field and add the **`subjectAltName` (SAN)** field. Using `localhost` as an example:
        ```
        openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes -keyout server-key.pem -out server-cert.pem -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
        ```

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

## 🔧 Supported Tools

> [!WARNING]
>
> Not all tools enforce strict excluded document validation. Before using excluded documents or after updating MCP tools, please read the tool support list carefully and consider disabling some tools.

| Target | R/W | Destructive / Manual review available<br /> | Tool Function | Excluded Doc | Status / Notes |
|:--- |:--- |:--- |:--- |:---: |:--- |
| **Documents & Blocks** | | | | | |
| | Read | | Search using SQL | ⚠️ | Excluded documents are only checked if the result contains IDs and the number of returned items < 300 |
| | | | Get document Markdown by ID | ✅ | — |
| | | | Get block Kramdown by ID | ✅ | — |
| | | | List child documents of a document | ✅ | — |
| | | | List child blocks | ✅ | — |
| | | | Vector Retrieval Client Plugin - Query | ❌ | Requires downloading and properly configuring the syplugin-vectorIndexClient plugin<br />Excluded documents are not yet supported for this tool |
| | | | Get backlinks by ID | ✅ | — |
| | Write | | Append content to daily note | ✅ | — |
| | | | Append content to specified document by ID | ✅ | domstring not supported |
| | | | Create new document at specified position by ID | ✅ | domstring not supported |
| | | | Insert child block (before / after) | ✅ | domstring not supported |
| | | | Insert block at specified position | ✅ | domstring not supported |
| | | Yes / Yes | Update block | ✅ | domstring not supported |
| | | | Rename document | ✅ | — |
| | | Yes / No | Move document | ✅ | — |
| | | Yes / No | Move block | ✅ | ⚠️ Moving headings requires folding first, which will cause folding state to be lost |
| | | Yes / Yes | Delete document | ✅ | — |
| | | Yes / Yes | Delete block | ✅ | — |
| **Database** | | | | | Only basic database operations are supported, see [reference](./static/data_db_EN.md) |
| | Read | | Get database schema | ✅ | — |
| | | | Get database view schema | ✅ | — |
| | | | Query database results | ✅ | — |
| | | | Get block ID where database is located | ✅ | — |
| | Write | | Create database | ✅ | — |
| | | | Add new database row | ✅ | — |
| | | | Modify database row | ✅ | Rollup, template and relation column types are not supported |
| | | Yes / Yes | Delete database row | ✅ | — |
| | | | Add database column | ✅ | — |
| | | Yes / Yes | Delete database column | ✅ | — |
| **Attributes** | | | | | |
| | Read | | Read attributes | ✅ | — |
| | Write | | Modify attributes (add / delete / update) | ✅ | — |
| **Flashcards** | | | | | |
| | Write | | Create flashcard from Markdown content | ✅ | — |
| | | | Create flashcard by block ID | ✅ | — |
| | | Yes / No | Delete flashcard by block ID | ❌ | — |
| **Templates** | | | | | |
| | Read | | List existing templates | ❌ | — |
| | | | Raw template file content | ❌ | — |
| | | | Preview template rendering result | ⚠️ | Only kramdown is returned; checks may be bypassed via getBlock |
| | | | Preview Sprig rendering result | ❌ | Does not involve user documents |
| | Write | | Create or overwrite template | ❌ | Does not involve user documents |
| | | | Render template and insert at document start | ⚠️ | Insertion is fixed at document start and cannot be specified<br />Since functions like `getBlock` can be used in templates, this tool may bypass checks to access excluded documents |
| | | | Delete existing template | ❌ | — |
| **Notebooks** | | | | | |
| | Read | | List notebooks | ❌ | Does not involve user documents |
| | Write | | Rename notebook | ✅ | — |

## 🙏 References & Acknowledgements

> Some dependencies are listed in `package.json`.

| Developer/Project                                                         | Project Description           | Citation         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | Provides MCP service within the terminal software Tabby; MIT License | Implementation method of MCP service |
| [wilsons](https://ld246.com/article/1756172573626/comment/1756384424179?r=wilsons#comments) / [Frostime](https://ld246.com/article/1739546865001#%E6%80%9D%E6%BA%90-SQL-%E6%9F%A5%E8%AF%A2-System-Prompt) | System Prompt CC BY-SA 4.0 | System Prompts etc. which locate at `static/` |