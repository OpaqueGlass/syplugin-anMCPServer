## 更新日志 | CHANGELOG

### v0.6.0 (2025-11-01)

- 新增：设置排除笔记本ID或文档ID，在部分工具避免返回敏感内容；
  - 请注意此功能并非严格排除：由于实现方式的问题，对部分工具或部分情况并不过滤；
- 修复：`insertBlock`API传入参数非`parentID`时未被校验的问题；
- 修复：检查id时可能被sql注入的问题；

### v0.5.1 (2025-09-08)

- 修复：历史记录页面 点击“完整内容”后界面错乱的问题；
- 改进：历史记录页面 块不存在时的提示信息；
- 修复：历史记录页面 块点击跳转文档打开后显示不完整的问题；
- 改进：appendBlock 工具返回值调整为第一个doOperation；

### v0.5.0 (2025-09-08)

- 新增：块编辑API；（插入块*3、更新块、块kramdown）
- 新增：审计日志；（新增或修改类型的工具调用将记录操作结果，但不记录更新前内容）
  - 块编辑工具默认等待用户批准后更新；
- 改进：gutSubDocIds -> listSubDocs；

### v0.4.0 (2025-08-31)

- 修复：升级依赖版本，使工具可以被并发调用；
- 改进：调整思源数据库结构提示词；
- 新增：新增部分工具；
  - 闪卡、属性；
- 移除：移除文本搜索工具；
- 新增：只读模式；

### v0.3.1 (2025年7月25日)

- 修复：（RAG）不能索引下层文档的问题；
- 新增：（工具）传送Markdown内容，按照指定的方式制卡；
- 新增：（提示词参考）调用制卡工具的系统提示词；

### v0.3.0 (2025年7月13日)

- 新增：（工具）和后端通信的知识库问答API；
- 修复：工具获取块内容错误文档标题的问题；

### v0.2.1 (2025年6月30日)

- 改进：在日记不存在时，由MCP创建的日记移除开头空行；
- 新增：工具
  - 在任意位置创建新文档；
  - 获取反向链接；
- 改进：工具获取块内容现在支持返回图片、音频附件（出于接收方能力考虑，有大小限制）；

### v0.2.0 (2025年6月15日)

- 改进：支持Streamable HTTP连接方式，对应有端点更改；原有SSE连接方式标记为弃用，**请参考文档重新设置**；
- 改进：不同设备可以使用不同的配置文件，这意味着升级到此版本后原有的配置将丢失；
- 新增：支持设置访问授权码；


- Improvement: Added support for Streamable HTTP connection method, with corresponding endpoint changes; the original SSE connection method is marked as deprecated. **Please reconfigure by referring to the documentation**;  
- Improvement: Different devices can now use different configuration files. This means that upgrading to this version will cause the loss of previous configurations;  
- New Feature: Added support for setting access authorization codes;

### v0.1.2 （2025年5月20日）

- 修复：搜索类型限制设置无效的问题；
- 改进：获取文档内容支持分页，默认1万个字符；
- 改进：对搜索结果进行过滤，去除了部分返回值；
- 改进：改为获取文档Markdown内容，不再获取Kramdown内容；

### v0.1.1 （2025年5月12日）

- 修复：工具“追加到指定文档”总是失败的问题；
- 修复：工具“追加到日记”缺失工具描述的问题；
- 改进：工具“搜索”补充 `groupBy` `orderBy` `method`参数；

### v0.1.0 （2025年5月4日）

- 从这里开始；