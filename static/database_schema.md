你可以使用SQL对思源笔记的数据库进行查询，下面是一些查询提示。

## `blocks`表

该数据表存储了所有的内容块数据。

### 字段说明

* `id`: 内容块 ID，格式为 `时间-7位随机字符`，例如 `20210104091228-d0rzbmm`。
* `parent_id`: 双亲块 ID，格式同 `id`
* `root_id`: 所在文档块 ID，格式同 `id`
* `box`: 所在笔记本 ID，格式同 `id`
* `path`: 内容块所在文档路径，例如 `/20200812220555-lj3enxa/20210808180320-abz7w6k/20200825162036-4dx365o.sy`
* `hpath`: 人类可读的内容块所在文档路径，例如 `/0 请从这里开始/编辑器/排版元素`
* `name`: 内容块名称
* `alias`: 内容块别名
* `memo`: 内容块备注
* `tag`: 标签，例如 `#标签1 #标签2# #标签3#`
* `content`: 去除了 Markdown 标记符的文本，在`type`=`d`时，该字段提供文档标题
* `fcontent`: 存储容器块第一个子块的内容
* `markdown`: 包含完整 Markdown 标记符的文本
* `length`: `markdown` 字段文本长度
* `type`: 内容块类型，详见下面的块主类型
* `subtype`: 特定类型的内容块还存在子类型，详见下方的块次类型
* `ial`: 内联属性列表，形如 `{: name="value"}`，例如 `{: id="20210104091228-d0rzbmm" updated="20210604222535"}`
* `sort`: 排序权重，数值越小排序越靠前
* `created`: 创建时间，格式为 `yyyyMMddHHmmss`，例如 `20210104091228`
* `updated`: 更新时间，格式同 `created`

### `blocks.type`

块主类型
- `audio`：音频块
- `av`：属性表（数据库在内容块中的名称）
- `b`：引述块
- `c`：代码块
- `d`：文档块
- `h`：标题块
- `html`：HTML块
- `i`：列表项
- `iframe`：iframe块
- `l`：列表块
- `m`：公式块
- `p`：段落块
- `query_embed`：嵌入块
- `s`：超级块
- `t`：表格块
- `tb`：分割线
- `video`：视频块
- `widget`：挂件块

### `blocks.subtype`

块次类型，默认为空字符串

- `h1`：一级标题块（关联 `h` 类型）
- `h2`：二级标题块（关联 `h` 类型）
- `h3`：三级标题块（关联 `h` 类型）
- `h4`：四级标题块（关联 `h` 类型）
- `h5`：五级标题块（关联 `h` 类型）
- `h6`：六级标题块（关联 `h` 类型）
- `o`：有序列表块（关联 `l` 类型）
- `u`：无序列表块（关联 `l` 类型）
- `t`：任务列表块（关联 `l` 类型）

## `refs`表

该表格中记录了内容块之间的引用关系。

* `id`: 引用 ID，格式为 `时间-随机字符`，例如 `20211127144458-idb32wk`
* `def_block_id`: 被引用块的块 ID，格式同 `id`
* `def_block_root_id`: 被引用块所在文档的 ID，格式同 `id`
* `def_block_path`: 被引用块所在文档的路径，例如 `/20200812220555-lj3enxa/20210808180320-fqgskfj/20200905090211-2vixtlf.sy`
* `block_id`: 引用所在内容块 ID，格式同 `id`
* `root_id`: 引用所在文档块 ID，格式同 `id`
* `box`: 引用所在笔记本 ID，格式同 `id`
* `path`: 引用所在文档块路径，例如 `/20200812220555-lj3enxa/20210808180320-fqgskfj/20200905090211-2vixtlf.sy`
* `content`: 引用锚文本

## `attributes`表

该表格中记录了内容块的属性信息。

* `id`: 属性 ID，格式为 `时间-随机字符`，例如 `20211127144458-h7y55zu`
* `name`: 属性名称

  * 注意：思源中的用户自定义属性必须加上 `custom-` 前缀
  * 例如 `name` 是块的内置属性，但 `custom-name` 就是用户的自定义属性了
* `value`: 属性值
* `type`: 类型，例如 `b`
* `block_id`: 块 ID，格式同 `id`
* `root_id`: 文档 ID，格式同 `id`
* `box`: 笔记本 ID，格式同 `id`
* `path`: 文档文件路径，例如 `/20200812220555-lj3enxa.sy`。

## 查询要点

* 所有 SQL 查询语句如果没有明确指定 `limit`，则会被思源查询引擎默认设置 `limit 64`
* 块属性格式相关

  * 块 ID 格式统一为 `时间-随机字符`,  例如  `20210104091228-d0rzbmm`
  * 块的时间属性，如 created updated 的格式为 `YYYYMMDDHHmmss`  例如 `20210104091228`
* 块之间的关系

  * 层级关系：块大致可以分为

    * 内容块（叶子块）：仅包含内容的块，例如段落 `p`，公式块 `m`，代码块 `c`，标题块 `h`，表格块 `t` 等

      * 内容块的 `content`和 `markdown` 字段为块的内容
    * 容器块：包含其他内容块或者容器块的块，例如 列表块 `l`，列表项块 `i`，引述块/引用块 `b`，超级块 `s`

      * 每个块的 `parent_id` 指向他直接上层的容器块
      * 容器块的 `content`和 `markdown` 字段为容器内所有块的内容
    * 文档块：包含同一文档中所有内容块和容器块的块，`d`

      * 每个块的 `root_id` 指向他所在的文档
      * 容器块的 `content` 字段为文档的标题
  * 引用关系：当一个块引用了另一个块的时候，会在 refs 表中建立联系

    * 如果有多个块引用了同一个块，那么对这个被引用的块而言，这些引用它的块构成了它的反向链接（反链）
    * 所有引用关系被存放在 ref 表当中；使用的时候将 blocks 表和 ref 表搭配进行查询
* Daily Note：又称日记，每日笔记，是一种特殊的**文档块**

  * daily note 文档有特殊属性：`custom-dailynote-<yyyyMMdd>=<yyyyMMdd>`；被标识了这个属性的文档块(type='d')，会被视为是对应日期的 daily note
  * 例如 `custom-dailynote-20240101=20240101` 的文档，被视为 2024-01-01 这天的 daily note 文档
  * 请注意！ daily note （日记）是一个文档块！如果要查询日记内部的内容，请使用 `root_id` 字段来关联日记文档和内部的块的关系
* 书签：含有属性 `bookmark=<书签名>` 的块会被加入对应的书签
* 涉及到时间查询的问题，如果需要查询笔记内容，请灵活应用上面的规则，并结合工具siyuan_query_sql查询，并把查询结果输出。如果查询不到，输出你使用的SQL，让用户检查SQL是否有问题。

## SQL 示例

* 查询所有文档块

  ```sql
  select * from blocks where type='d'
  ```
* 查询所有二级标题块

  ```sql
  select * from blocks where subtype = 'h2'
  ```
* 查询某个文档的子文裆

  ```sql
  select * from blocks
  where path like '%/<当前文档id>/%' and type='d'
  ```
* 随机漫游某个文档内所有标题块

  ```sql
  SELECT * FROM blocks
  WHERE root_id LIKE '<文档 id>' AND type = 'h'
  ORDER BY random() LIMIT 1
  ```
* 查询含有关键词「唯物主义」的段落块

  ```sql
  select * from blocks
  where markdown like '%唯物主义%' and type ='p'
  ORDER BY updated desc
  ```
* 查询过去 7 天内没有完成的任务（任务列表项）

  > 注：思源中，任务列表项的 markdown 为 `* [ ] Task text` 如果是已经完成的任务，则是 `* [x] Task Text`
  >

  ```sql
  SELECT * from blocks
  WHERE type = 'l' AND subtype = 't'
  AND created > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day')) 
  AND markdown like'* [ ] %'
  AND parent_id not in (
    select id from blocks where subtype = 't'
  )
  ```
* 查询过去7天内创建的日记
  ```sql
  select distinct B.* 
  from blocks as B 
  join attributes as A 
    on B.id = A.block_id
  where A.name like 'custom-dailynote-%' 
    and B.type = 'd'
    and A.value >= strftime('%Y%m%d', datetime('now', '-7 day'))
    and A.value <= strftime('%Y%m%d', 'now')
  order by A.value desc;
  ```

* 查询某个块所有的反链块（引用了这个块的所有块）

  ```sql
  select * from blocks where id in (
      select block_id from refs where def_block_id = '<被引用的块ID>'
  ) limit 999
  ```
* 查询某个时间段内的 daily note（日记）

  > 注意由于没有指定 limit，最大只能查询 64 个
  >

  ```sql
  select distinct B.* from blocks as B join attributes as A
  on B.id = A.block_id
  where A.name like 'custom-dailynote-%' and B.type='d'
  and A.value >= '20231010' and A.value <= '20231013'
  order by A.value desc;
  ```
* 查询某个笔记本下没有被引用过的文档，限制 128 个

  ```sql
  select * from blocks as B
  where B.type='d' and box='<笔记本 BoxID>' and B.id not in (
      select distinct R.def_block_id from refs as R
  ) order by updated desc limit 128
  ``` 
* 按文档分组查询结果，以查询“内容”为例；
  ```sql
    WITH document_id_temp AS ( SELECT root_id,Max(CASE WHEN type = 'd' THEN ( content || tag || name || alias || memo ) END) documentContent FROM blocks WHERE 1 = 1 AND type IN ( 'd' , 'h' , 'c' , 'm' , 't' , 'p' , 'html' , 'av' ) GROUP BY root_id HAVING 1 = 1 AND ( GROUP_CONCAT( ( content || tag || name || alias || memo ) ) LIKE '%内容%' ) ORDER BY ( (documentContent LIKE '%内容%') ) DESC , MAX(updated) DESC ) SELECT *, ( content || tag || name || alias || memo ) AS concatContent , (SELECT count( 1 ) FROM document_id_temp) as documentCount FROM blocks WHERE 1 = 1 AND type IN ( 'd' , 'h' , 'c' , 'm' , 't' , 'p' , 'html' , 'av' , 'd' ) AND ( id IN ( SELECT root_id FROM document_id_temp LIMIT 10 OFFSET 0 ) OR ( root_id IN ( SELECT root_id FROM document_id_temp LIMIT 10 OFFSET 0 ) AND ( concatContent LIKE '%内容%' ) ) ) ORDER BY sort ASC ,( (concatContent LIKE '%内容%') ) DESC , updated DESC LIMIT 2048;
  ```