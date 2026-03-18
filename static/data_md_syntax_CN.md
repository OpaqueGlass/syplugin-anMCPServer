## SQL嵌入块（块级元素）

SQL 嵌入块是思源笔记的一项进阶自动化功能。它允许你在文档中直接嵌入 SQL 查询语句，系统会在打开或刷新笔记时实时执行并展示最新的搜索结果。

在 Markdown 中使用双大括号`{{ }}`包裹**一行SQL语句**，SQl语句应当返回`blocks`表的全部字段，即，以`SELECT * FROM blocks`开头的SQL语句。

### 示例

引用特定块： 如上例所示，通过唯一 id 精确调用并显示特定内容。
```
{{ SELECT * FROM blocks WHERE id = '20220202210054-cn1g2n6' }}
```

查询所有未勾选的顶层任务列表项：
```
{{SELECT * FROM blocks b1 WHERE b1.type = 'i'  AND b1.subtype = 't'  AND b1.markdown LIKE '- [ ]%' AND EXISTS (SELECT 1 FROM blocks b2 WHERE b2.id = b1.parent_id AND b2.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM blocks b3 WHERE b3.id = b2.parent_id AND b3.type = 'i' AND b3.subtype = 't' ) )}}
```

提示：
1. 要了解数据库表结构等相关信息，需要另外调用`siyuan_database_schema`工具查阅；
2. `{{}}`中只能填写一行SQL语句，不能中间换行；

## 块引用（行级元素）

块引用是在正文中链接到其他内容块的一种方式。它不仅是一个超链接，更能在思源笔记的数据库中建立双向关联。

在Markdown中对应`(())`双小括号包裹的id与锚文本。其中，动态引用使用`''`单引号，静态引用使用`""`双引号

### 示例

动态块引用，块引用的锚文本跟随引用对象而更新（在更新内容时，只要保证引号是单引号即可声明为动态块引用，其中内容无限制），例如：
```
((20260317105218-allsg1m '第12周'))
```

静态块引用，块引用的锚文本固定，不跟随引用对象而更新：
```
((20260317105218-allsg1m "我是静态锚文本"))
```
