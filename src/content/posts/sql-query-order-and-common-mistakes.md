---
title: "SQL 查询执行顺序与常见错误"
published: 2026-08-05
description: "整理 SELECT 查询的逻辑执行顺序，说明 FROM、JOIN、WHERE、GROUP BY、HAVING、SELECT、ORDER BY 的关系，并归纳 WHERE 与 HAVING、ON 与 WHERE、COUNT 与 NULL 等常见易错点。"
tags: ["SQL", "数据库", "查询", "故障排查"]
category: "数据库"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

写 SQL 时，语句的书写顺序和数据库的逻辑处理顺序并不完全一致。理解查询的逻辑执行顺序，可以帮助定位很多常见错误，例如字段找不到、分组报错、聚合结果异常、`LEFT JOIN` 结果少于预期等。

## SELECT 的书写顺序

一条常见查询语句通常写成：

```sql
SELECT column1,
       COUNT(*) AS total
FROM table_a a
JOIN table_b b
  ON a.id = b.a_id
WHERE a.status = 'ACTIVE'
GROUP BY column1
HAVING COUNT(*) > 1
ORDER BY total DESC;
```

书写顺序是：

```text
SELECT
FROM
JOIN / ON
WHERE
GROUP BY
HAVING
ORDER BY
```

但这不是数据库理解查询时的逻辑顺序。

## SELECT 的逻辑执行顺序

更接近数据库处理过程的顺序是：

```text
1. FROM
2. JOIN / ON
3. WHERE
4. GROUP BY
5. HAVING
6. SELECT
7. ORDER BY
```

可以理解为：

```text
先确定数据来自哪些表
再确定表之间如何连接
再过滤原始行
然后分组
再过滤分组后的结果
最后选择要显示的字段并排序
```

这也是为什么有些字段别名不能在 `WHERE` 中直接使用，因为 `WHERE` 发生在 `SELECT` 之前。

例如：

```sql
SELECT salary * 12 AS annual_salary
FROM lecturer
WHERE annual_salary > 100000;
```

这类写法在很多数据库中会报错，因为 `WHERE` 执行时，`annual_salary` 这个别名还没有生成。

更稳妥的写法是：

```sql
SELECT salary * 12 AS annual_salary
FROM lecturer
WHERE salary * 12 > 100000;
```

## WHERE 与 HAVING 的区别

`WHERE` 用来过滤原始行，发生在分组之前。

```sql
SELECT subjectcode,
       COUNT(*) AS total
FROM lab
WHERE duration > 1
GROUP BY subjectcode;
```

这表示：先过滤出 `duration > 1` 的 lab，再按课程分组统计。

`HAVING` 用来过滤分组后的结果，发生在 `GROUP BY` 之后。

```sql
SELECT subjectcode,
       COUNT(*) AS total
FROM lab
GROUP BY subjectcode
HAVING COUNT(*) > 2;
```

这表示：先按课程分组统计，再只保留 lab 数量大于 2 的课程。

对比：

| 子句 | 过滤对象 | 是否能直接使用聚合函数 |
| --- | --- | --- |
| `WHERE` | 分组前的原始行 | 通常不能 |
| `HAVING` | 分组后的结果 | 可以 |

错误示例：

```sql
SELECT subjectcode,
       COUNT(*) AS total
FROM lab
WHERE COUNT(*) > 2
GROUP BY subjectcode;
```

问题在于 `WHERE` 阶段还没有完成分组，也就没有 `COUNT(*)` 的结果。

正确写法：

```sql
SELECT subjectcode,
       COUNT(*) AS total
FROM lab
GROUP BY subjectcode
HAVING COUNT(*) > 2;
```

## ON 与 WHERE 的区别

`ON` 用来描述表和表之间如何匹配。

```sql
SELECT s.studentno,
       s.fname,
       se.subjectcode
FROM student s
JOIN student_enrolment se
  ON s.studentno = se.studentno;
```

`WHERE` 用来在连接结果中继续过滤数据。

```sql
SELECT s.studentno,
       s.fname,
       se.subjectcode
FROM student s
JOIN student_enrolment se
  ON s.studentno = se.studentno
WHERE se.subjectcode = 'CSE21DB';
```

在 `INNER JOIN` 中，把条件放在 `ON` 或 `WHERE` 中，很多时候结果相同。

但在 `LEFT JOIN` 中，`ON` 和 `WHERE` 的位置会明显影响结果。

## LEFT JOIN 中 WHERE 的陷阱

假设要列出所有讲师，以及他们的授课安排：

```sql
SELECT l.staffno,
       l.fname,
       le.subjectcode
FROM lecturer l
LEFT JOIN lecture le
  ON l.staffno = le.staffno;
```

`LEFT JOIN` 的含义是：保留左表 `lecturer` 的全部记录，即使右表 `lecture` 没有匹配，也显示出来，只是右表字段为 `NULL`。

如果后面加上：

```sql
WHERE le.subjectcode = 'CSE21DB'
```

完整语句变成：

```sql
SELECT l.staffno,
       l.fname,
       le.subjectcode
FROM lecturer l
LEFT JOIN lecture le
  ON l.staffno = le.staffno
WHERE le.subjectcode = 'CSE21DB';
```

这会把 `le.subjectcode` 为 `NULL` 的行过滤掉。结果上，`LEFT JOIN` 很容易表现得像 `INNER JOIN`。

如果想保留没有授课记录的讲师，就不能简单地把右表过滤条件放到 `WHERE` 中，而应根据查询目的调整条件位置。

例如只匹配某门课，但仍保留所有讲师：

```sql
SELECT l.staffno,
       l.fname,
       le.subjectcode
FROM lecturer l
LEFT JOIN lecture le
  ON l.staffno = le.staffno
 AND le.subjectcode = 'CSE21DB';
```

这里条件写在 `ON` 中，表示连接时只匹配 `CSE21DB`，但左表 lecturer 仍然保留。

## GROUP BY 常见规则

使用 `GROUP BY` 时，`SELECT` 中出现的字段通常分为两类：

```text
分组字段
聚合结果
```

例如：

```sql
SELECT subjectcode,
       COUNT(*) AS total
FROM lab
GROUP BY subjectcode;
```

`subjectcode` 是分组字段，`COUNT(*)` 是聚合结果。

如果写成：

```sql
SELECT subjectcode,
       labno,
       COUNT(*) AS total
FROM lab
GROUP BY subjectcode;
```

这里 `labno` 既不是聚合函数，也不在 `GROUP BY` 中，很多数据库会报错。

正确做法之一是把 `labno` 也加入分组：

```sql
SELECT subjectcode,
       labno,
       COUNT(*) AS total
FROM lab
GROUP BY subjectcode,
         labno;
```

但这会改变统计粒度：从“按课程统计”变成“按课程 + lab 编号统计”。

因此写 `GROUP BY` 前要先判断统计粒度：

```text
我要按什么维度统计？
一行结果代表什么？
哪些字段只是展示，哪些字段用于聚合？
```

## COUNT(*)、COUNT(column)、COUNT(DISTINCT column)

这三个写法很常见，但含义不同。

| 写法 | 含义 |
| --- | --- |
| `COUNT(*)` | 统计行数，包括字段为 `NULL` 的行 |
| `COUNT(column)` | 统计该字段非 `NULL` 的行数 |
| `COUNT(DISTINCT column)` | 统计该字段去重后的非 `NULL` 数量 |

示例：

```sql
SELECT COUNT(*) AS all_rows,
       COUNT(email) AS rows_with_email,
       COUNT(DISTINCT city) AS different_cities
FROM student;
```

如果某些学生的 `email` 是 `NULL`，那么 `COUNT(email)` 会少于 `COUNT(*)`。

这一点在统计报名人数、邮箱数量、实际填写字段数量时很重要。

## NULL 的常见影响

`NULL` 表示未知或缺失，不等同于空字符串，也不等同于 0。

错误写法：

```sql
SELECT *
FROM student
WHERE email = NULL;
```

正确写法：

```sql
SELECT *
FROM student
WHERE email IS NULL;
```

判断非空：

```sql
SELECT *
FROM student
WHERE email IS NOT NULL;
```

聚合时也要注意 `NULL`：

```sql
SELECT AVG(feepaid)
FROM student;
```

`AVG(column)` 会忽略 `NULL` 值，而不是把 `NULL` 当成 0。

## ORDER BY 与别名

`ORDER BY` 通常可以使用 `SELECT` 中定义的别名，因为它在逻辑顺序上发生在 `SELECT` 之后。

```sql
SELECT subjectcode,
       COUNT(*) AS total
FROM lab
GROUP BY subjectcode
ORDER BY total DESC;
```

这里 `total` 是 `COUNT(*)` 的别名，可以用于排序。

也可以直接写聚合表达式：

```sql
ORDER BY COUNT(*) DESC;
```

## 多表查询的排错顺序

复杂 SQL 出错时，不要一上来就看完整语句。可以按步骤拆开：

```text
1. 先查主表，确认基础数据存在
2. 加第一张 JOIN 表，确认连接条件正确
3. 再加第二张 JOIN 表
4. 加 WHERE 条件
5. 加 GROUP BY
6. 加 HAVING
7. 最后加 ORDER BY
```

例如先查：

```sql
SELECT *
FROM lecturer;
```

再加连接：

```sql
SELECT *
FROM lecturer l
LEFT JOIN lecture le
  ON l.staffno = le.staffno;
```

再逐步减少字段、增加过滤条件和分组。

这种方式比直接改一整条复杂 SQL 更容易定位问题。

## 常见错误总结

| 问题 | 常见原因 |
| --- | --- |
| 字段不存在 | 表别名写错、字段来自另一张表、字段名拼写错误 |
| 分组报错 | `SELECT` 中有非聚合字段没有写进 `GROUP BY` |
| 查询结果比预期少 | `WHERE` 条件过滤过多，或 `LEFT JOIN` 被写成类似 `INNER JOIN` |
| 统计数量异常 | 混淆 `COUNT(*)` 和 `COUNT(column)` |
| 查不到空值 | 使用了 `= NULL`，应改为 `IS NULL` |
| 排序不符合预期 | 字段类型、空值、别名或排序方向不符合预期 |

## 总结

SQL 查询不是简单从上到下执行。理解逻辑顺序后，很多错误会变得更容易解释：

```text
FROM / JOIN 先确定数据来源
WHERE 过滤原始行
GROUP BY 形成分组
HAVING 过滤分组结果
SELECT 决定显示内容
ORDER BY 最后排序
```

写复杂查询时，先确认“数据从哪来”，再确认“怎么过滤”，最后再处理“怎么统计和展示”。这比直接拼完整 SQL 更稳定。
