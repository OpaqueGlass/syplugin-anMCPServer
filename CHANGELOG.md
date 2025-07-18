## 更新日志 | CHANGELOG

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