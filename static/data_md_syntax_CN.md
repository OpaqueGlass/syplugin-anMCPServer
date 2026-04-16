---
name: siyuan-markdown-syntax
description: "思源笔记Markdown语法说明文档。该文档详细介绍了思源笔记中支持的Markdown语法特性，包括基本语法、扩展语法以及与思源笔记特定功能的结合使用方法。"
---

## 基本元素概述

思源笔记支持多种Markdown语法元素，主要包括：

- 标题
- 列表（有序列表、无序列表、任务列表）
- 文本格式（加粗、斜体、删除线、下划线）
- 链接和图片

## 提示块

增强提示块用于在长段文本中划分视觉重点，其基于引述块实现，第一行指定提示块类型、可选emoji和标题文本，语法格式为：

```
> [!TYPE] 可选emoji 标题文本
> 提示块内容文本
```

支持的类型包括：
- NOTE：备注
- TIP：提示
- IMPORTANT：重要
- WARNING：警告
- CAUTION：小心

各类型提示块的显示颜色不同，以默认主题为例，NOTE为蓝色，TIP为绿色，IMPORTANT为紫色，WARNING为橙色，CAUTION为红色。颜色与主题相关，不支持通过语法自定义。

示例如下：
```
> [!CAUTION] 🚫 禁止
> 禁止在管理员权限下进行操作。
```

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
