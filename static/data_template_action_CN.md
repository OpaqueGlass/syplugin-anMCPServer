## 模板标签 `.action{}`（在插入模板时执行一次，替换为固定的文本）

除了 Sprig 内置的变量和函数，还支持如下变量和函数：

- `title`：该变量用于插入当前文档名。比如模板内容为 `# .action{.title}`，则调用后会以一级标题语法插入到当前文档内容中
- `id`：该变量用于插入当前文档 ID
- `name`：该变量用于插入当前文档命名
- `alias`：该变量用于插入当前文档别名
- `getHPathByID`：该函数用于返回块 ID 对应块的可读路径
- `queryBlocks`：该函数用于查询数据库，返回值为 blocks 列表

  ```template
  .action{ $today := now | date "20060102150405" }
  .action{ $blocks := queryBlocks "SELECT * FROM blocks WHERE content LIKE '?' AND updated > '?' LIMIT ?" "%foo%" $today "3" }
  ```
- `getBlock`：该函数用于根据块 ID 查询数据库，返回值为 block

  ```template
  .action{ getBlock "20250331162928-53comqi" }
  ```
- `querySpans`：该函数用于查询数据库，返回值为 spans 列表

  ```template
  .action{ querySpans "SELECT * FROM spans LIMIT ?" "3" }
  ```
- `querySQL`：该函数用于查询数据库，返回值为结果集

  ```template
  .action{ querySQL "SELECT * FROM refs LIMIT 3" }
  ```
- `statBlock`：该函数用于统计块内容

  ```template
  .action{ (statBlock .id).RuneCount }
  .action{ (statBlock .id).WordCount }
  ```

  - RuneCount
  - WordCount
  - LinkCount
  - ImageCount
  - RefCount
  - BlockCount
- `runeCount`：该函数用于返回字符串中的字符数
- `wordCount`：该函数用于返回字符串中的字数
- `parseTime`：该函数用于将时间格式的字符串解析为 `time.Time` 类型，以便使用更多格式化方法渲染该时间
- `Weekday`：该函数用于返回周几 `Sunday=0, Monday=1, ..., Saturday=6`
- `WeekdayCN`：该函数用于返回周几 `Sunday=日, Monday=一, ..., Saturday=六`
- `WeekdayCN2`：该函数用于返回周几 `Sunday=天, Monday=一, ..., Saturday=六`
- `ISOWeek`：该函数用于返回当前周
- `ISOMonth`：该函数用于返回当前月份
- `ISOYear`：该函数用于返回当前年份
- `ISOWeekDate`：该函数用于返回指定周几的日期 `time.Time`，例如返回本周四的日期 `.action{ now | ISOWeekDate 4 | date "2006-01-02" }`
- `pow`：指数计算，返回整数
- `powf`：指数计算，返回浮点数
- `log`：对数计算，返回整数
- `logf`：对数计算，返回浮点数

