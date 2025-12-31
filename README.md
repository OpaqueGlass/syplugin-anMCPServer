
# A little MCP server for siyuan-note

[中文](./README_zh_CN.md)

> A plugin that provides MCP service for [Siyuan Note](https://github.com/siyuan-note/siyuan).

> ⚠️ Breaking changes: Upgrading from v0.1.x to v0.2.x introduces breaking changes. [CHANGELOG_zh-CN](./CHANGELOG.md)

## ✨ Quick Start

- Download from the marketplace or 1. unzip the `package.zip` in Release, 2. move the folder to `workspace/data/plugins/`, 3. and rename the folder to `syplugin-anMCPServer`;
- Enable the plugin;
- The plugin listens on port `16806` by default (Host: `127.0.0.1`), please use `http://127.0.0.1:16806/sse` as the server access address;

> ⭐ If this is helpful to you, please consider giving it a star!

## 🔧 Supported Tools

* **\[Search]**

  * ~~Keyword search;~~ Temporarily removed, please provide feedback if needed
  * SQL search;
  * Notebook index Q\&A (using RAG backend service, [feature in testing](./RAG_BETA.md));

* **\[Retrieve]**

  * Get document kramdown by ID;
  * List notebooks;
  * Get backlinks by ID;
  * Get child document IDs;
  * Read properties;
  * ~~Read journal entries by date;~~ Temporarily removed, please provide feedback if needed

* **\[Write]**

  * **Document type**

    * Append content to journal;
    * Append content to a document by ID;
    * Create a new document at a specified location by ID;
  * **Flashcard type**

    * Create flashcards from Markdown content;
    * Create flashcards by block ID;
    * Delete flashcards by block ID;
  * **Properties**

    * Modify properties;


## ❓ FAQ

- Q: How to use it in an MCP client?  
  Please refer to the later sections;  

- Q: What are some common MCP clients?  
  - Refer to: https://github.com/punkpeye/awesome-mcp-clients or https://modelcontextprotocol.io/clients;  

- Q: Does the plugin support authentication?
  - Version v0.2.0 now supports authentication. After setting the authentication token in the plugin settings, the MCP client needs to configure the `authorization` request header with the value `Bearer YourToken`;
  - Version v0.7.0 adds Cloudflare Access authentication support. See [Cloudflare Access Authentication](#cloudflare-access-authentication) section below;

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

## Cloudflare Access Authentication

Version v0.7.0 adds support for [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) authentication. This allows you to securely expose your MCP server to the internet through Cloudflare Tunnel while using Cloudflare Zero Trust for authentication.

### Use Cases

1. **Self-hosted Public App**: Expose your MCP server via Cloudflare Tunnel and use Cloudflare Access for user authentication
2. **Linked Apps for AI**: Allow AI agents to access your MCP server using [Cloudflare Linked Apps OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/linked-apps/)

### Configuration

1. Set up a self-hosted application in the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
2. Create a Cloudflare Tunnel to expose your MCP server
3. In the plugin settings, enable **Cloudflare Access Authentication**
4. Enter your **Team Domain** (e.g., `https://myteam.cloudflareaccess.com`)
5. Enter your **Application AUD** tag (found in Access > Applications > [Your App] > Overview)
6. Save settings and restart the MCP service

### How It Works

The plugin validates incoming requests using multiple authentication methods:

| Method | Header/Token | Use Case |
|--------|--------------|----------|
| Cloudflare Access | `Cf-Access-Jwt-Assertion` header | Users accessing via Cloudflare Tunnel |
| Cloudflare Linked Apps | `Authorization: Bearer <JWT>` | AI agents with OAuth delegation |
| Local Bearer Token | `Authorization: Bearer <hash>` | Direct local access |

When Cloudflare Access is enabled:
- Requests with `Cf-Access-Jwt-Assertion` header are validated against Cloudflare's JWKS
- Bearer tokens that look like JWTs are also validated as Cloudflare OAuth tokens
- If both Cloudflare Access and local auth are configured, the system tries Cloudflare first, then falls back to local auth

### Performance

The plugin includes optimizations for JWT validation:
- JWKS instances are cached per team domain
- Validated tokens are cached until 30 seconds before expiry
- Repeated requests with the same token skip cryptographic verification

## 🙏 References & Acknowledgements

> Some dependencies are listed in `package.json`.

| Developer/Project                                                         | Project Description           | Citation         |
|---------------------------------------------------------------------|----------------|--------------|
| [thuanpham582002/tabby-mcp-server](https://github.com/thuanpham582002/tabby-mcp-server) | Provides MCP service within the terminal software Tabby; MIT License | Implementation method of MCP service |
| [wilsons](https://ld246.com/article/1756172573626/comment/1756384424179?r=wilsons#comments) / [Frostime](https://ld246.com/article/1739546865001#%E6%80%9D%E6%BA%90-SQL-%E6%9F%A5%E8%AF%A2-System-Prompt) | System Prompt CC BY-SA 4.0 | System Prompts etc. which locate at `static/` |