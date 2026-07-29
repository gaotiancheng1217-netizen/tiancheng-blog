---
title: "Oracle SQL 基础复习：表管理、数据操作与多表查询"
published: 2026-07-29
description: "基于 FIT5137 Lab 01 整理 Oracle SQL 的基础用法，包括建表、插入数据、修改表结构、事务提交、日期处理、连接查询、子查询和聚合统计。"
tags: ["Oracle", "SQL", "数据库", "DDL", "DML", "Join"]
category: "数据库"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

SQL 可以分成几类常见操作。学习数据库时，先把这些操作分清楚，会比直接背语句更容易建立整体结构。

| 类型 | 作用 | 常见语句 |
| --- | --- | --- |
| DDL | 定义或修改数据库对象 | `CREATE TABLE`、`ALTER TABLE`、`DROP TABLE` |
| DML | 操作表中的数据 | `INSERT`、`UPDATE`、`DELETE` |
| DQL | 查询数据 | `SELECT` |
| TCL | 控制事务 | `COMMIT`、`ROLLBACK` |

本笔记使用 Oracle SQL 语法，和 MySQL 有一些差异。例如 Oracle 常用 `NUMBER`、`VARCHAR2`、`TO_DATE`，查看表结构时也会用到 `USER_TAB_COLUMNS`。

## 查看当前用户下的表

Oracle 中可以用：

```sql
SELECT *
FROM tab;
```

这条语句用于查看当前用户 schema 下已有的表、视图等对象。

在 DBeaver 中，`DESC table_name` 可能不可用。可以改用数据字典表查询字段信息：

```sql
SELECT column_name,
       data_type
FROM user_tab_columns
WHERE table_name = 'STUDENT';
```

注意：Oracle 默认会把未加双引号的表名、字段名转成大写，因此这里写 `'STUDENT'`。

## 创建表：CREATE TABLE

创建表时，需要定义字段名、数据类型、是否允许为空，以及主键等约束。

示例：

```sql
CREATE TABLE lecturer (
    staffno       NUMBER(6) NOT NULL,
    title         VARCHAR2(3),
    fname         VARCHAR2(30),
    lname         VARCHAR2(30),
    streetaddress VARCHAR2(70),
    suburb        VARCHAR2(40),
    city          VARCHAR2(40),
    postcode      VARCHAR2(4),
    country       VARCHAR2(30),
    lecturerlevel CHAR(2),
    bankno        CHAR(20),
    bankname      VARCHAR2(40),
    salary        NUMBER(8,2),
    workload      NUMBER(2,1) NOT NULL,
    researcharea  VARCHAR2(40),
    PRIMARY KEY (staffno)
);
```

几个常见数据类型：

| 类型 | 含义 |
| --- | --- |
| `NUMBER(6)` | 最多 6 位数字 |
| `NUMBER(8,2)` | 总共 8 位数字，其中 2 位小数 |
| `VARCHAR2(30)` | 可变长度字符串，最多 30 个字符 |
| `CHAR(2)` | 固定长度字符串 |
| `DATE` | 日期时间类型 |

`PRIMARY KEY` 表示主键。主键字段不能重复，也不能为空，通常用于唯一标识一行记录。

## 插入数据：INSERT INTO

插入数据有两种常见写法。

第一种：指定字段名。

```sql
INSERT INTO lecturer (
    staffno,
    title,
    fname,
    lname,
    streetaddress,
    suburb,
    city,
    postcode,
    country,
    lecturerlevel,
    bankno,
    bankname,
    salary,
    workload,
    researcharea
) VALUES (
    1000,
    'Dr',
    'David',
    'Taniar',
    '3 Robinson Av',
    'Kew',
    'Melbourne',
    '3080',
    'Australia',
    '5',
    '1000567237',
    'CommBank',
    89000.00,
    2.0,
    'O-R DB'
);
```

第二种：不指定字段名，直接按表结构顺序插入。

```sql
INSERT INTO lecturer
VALUES (
    3000,
    'Mr',
    'Daniel',
    'Wright',
    '22 Crystal Cres',
    'Alphington',
    'Melbourne',
    '3790',
    'Australia',
    '5',
    '1000654321',
    'CommBank',
    89000.00,
    2.0,
    'DB'
);
```

第二种写法更短，但依赖字段顺序。一旦表结构变化，语句更容易出错。因此在正式脚本中，通常更推荐显式写出字段名。

## 主键重复错误

如果主键已经存在，再插入相同主键，会报错。

例如已经存在 `staffno = 1000`，再次插入同样的 `staffno`：

```sql
INSERT INTO lecturer (...)
VALUES (1000, ...);
```

会违反主键唯一性约束。

处理方法不是绕过主键，而是确认数据是否应该是新记录。如果是新讲师，应使用新的 `staffno`，例如：

```sql
VALUES (2000, ...);
```

主键冲突是数据库中很常见的问题。排查时先看：

```text
插入的主键值是否已经存在
业务上是否应该更新旧记录
是否误把新增操作写成重复插入
```

## 部分字段插入

如果只插入部分字段，必须写出字段名，并且所有 `NOT NULL` 字段都必须提供值。

```sql
INSERT INTO lecturer (
    staffno,
    title,
    fname,
    lname,
    streetaddress,
    suburb,
    postcode,
    country,
    researcharea,
    workload
) VALUES (
    4000,
    'Mr',
    'RaiHong',
    'Lam',
    '12 Oracle Dr',
    'Fitzroy',
    '3424',
    'Australia',
    'Data Mining',
    1
);
```

没有提供的字段会被设置为 `NULL`，前提是这些字段允许为空。

## 日期处理：TO_DATE 与 TO_CHAR

Oracle 中插入日期时，常使用 `TO_DATE` 把字符串转换成日期。

```sql
INSERT INTO student
VALUES (
    30001,
    TO_DATE('12-FEB-2002', 'DD-MON-YYYY'),
    'Alice',
    'Brown',
    'Melbourne',
    '3000',
    'Australia',
    5000.00,
    TO_DATE('15-JUL-2026', 'DD-MON-YYYY')
);
```

如果包含时间，可以写成：

```sql
TO_DATE('12-MAR-2001 16:15', 'DD-MON-YYYY HH24:MI')
```

查询时如果要控制日期显示格式，可以用 `TO_CHAR`：

```sql
SELECT TO_CHAR(SYSDATE, 'DD-MON-YYYY HH24:MI')
FROM dual;
```

`DUAL` 是 Oracle 中常用的虚拟表，适合执行不依赖真实业务表的表达式查询。

## 修改表结构：ALTER TABLE

添加字段：

```sql
ALTER TABLE student ADD (
    streetaddress VARCHAR2(70),
    suburb        VARCHAR2(40)
);
```

删除字段：

```sql
ALTER TABLE student DROP (citty);
```

添加单个字段：

```sql
ALTER TABLE student ADD email VARCHAR2(50);
```

修改字段类型：

```sql
ALTER TABLE student MODIFY (
    city VARCHAR2(40)
);
```

在 Oracle 中，`ADD` 和 `DROP` 是不同的 `ALTER TABLE` 操作，通常需要拆成不同语句执行。

```sql
ALTER TABLE student ADD email VARCHAR2(50);
ALTER TABLE student DROP COLUMN postcode;
```

## CHAR 与 VARCHAR2 的区别

`CHAR` 是固定长度，`VARCHAR2` 是可变长度。

| 类型 | 特点 | 适合场景 |
| --- | --- | --- |
| `CHAR(40)` | 固定占用 40 个字符长度 | 长度固定的编码、状态位 |
| `VARCHAR2(40)` | 按实际内容长度存储，最多 40 个字符 | 姓名、城市、地址等长度不固定文本 |

例如 `city CHAR(40)` 即使只存 `'Melbourne'`，也会按固定长度处理。对于城市名这种长度不固定的数据，`VARCHAR2(40)` 更合适。

## 更新数据：UPDATE

更新学生地址：

```sql
UPDATE student
SET streetaddress = '12 New St'
WHERE studentno = 30001;
```

`WHERE` 非常重要。如果省略 `WHERE`，会更新整张表：

```sql
UPDATE student
SET streetaddress = '12 New St';
```

这类语句在实际环境中风险很高。更新或删除前应先用 `SELECT` 确认影响范围：

```sql
SELECT *
FROM student
WHERE studentno = 30001;
```

## 提交事务：COMMIT

Oracle 中执行插入、更新、删除后，通常需要提交事务：

```sql
COMMIT;
```

`COMMIT` 表示永久保存当前事务中的修改。提交后，不能再通过 `ROLLBACK` 撤销这些已提交的变化。

常见理解：

```text
INSERT / UPDATE / DELETE 只是产生修改
COMMIT 才是确认保存
ROLLBACK 用于撤销未提交修改
```

## 复制已有表：CREATE TABLE AS SELECT

Lab 中使用了 `CREATE TABLE AS SELECT`，简称 CTAS，用于从已有表复制数据到新表。

```sql
CREATE TABLE subject AS
SELECT *
FROM dtaniar.subject;
```

这条语句会根据查询结果创建一张新表，并把数据复制过来。

如果要复制多个基础表，可以依次执行：

```sql
CREATE TABLE student AS SELECT * FROM dtaniar.student;
CREATE TABLE lecturer AS SELECT * FROM dtaniar.lecturer;
CREATE TABLE lecture AS SELECT * FROM dtaniar.lecture;
CREATE TABLE tutor AS SELECT * FROM dtaniar.tutor;
CREATE TABLE lab AS SELECT * FROM dtaniar.lab;
CREATE TABLE student_enrolment AS SELECT * FROM dtaniar.student_enrolment;
CREATE TABLE lab_signup AS SELECT * FROM dtaniar.lab_signup;
```

复制完成后可以统计每张表的数据量：

```sql
SELECT COUNT(*)
FROM student;
```

## 基础查询：WHERE 与 IN

查询第一学期开设的课程：

```sql
SELECT subjectcode,
       name
FROM subject
WHERE semester = 1;
```

查询出生日期在某个范围内的学生：

```sql
SELECT fname,
       lname,
       dob,
       feepaid
FROM student
WHERE dob > TO_DATE('31-DEC-1990', 'DD-MON-YYYY')
  AND dob < TO_DATE('01-JAN-1995', 'DD-MON-YYYY');
```

查询多个课程代码可以用 `IN`：

```sql
SELECT s.studentno,
       s.fname,
       s.lname,
       se.subjectcode
FROM student s
JOIN student_enrolment se
  ON s.studentno = se.studentno
WHERE se.subjectcode IN ('CSE21DB', 'CSE31DB', 'CSE41FDB')
ORDER BY se.subjectcode,
         s.studentno;
```

`IN` 适合表达“字段值属于某个集合”。

## 多表查询：JOIN

列出讲师及其授课安排：

```sql
SELECT l.staffno,
       l.title,
       l.fname,
       l.lname,
       le.subjectcode,
       le.lectday,
       le.lecttime,
       le.venue
FROM lecturer l
LEFT JOIN lecture le
  ON l.staffno = le.staffno
ORDER BY l.staffno,
         le.lectday,
         le.lecttime;
```

这里使用 `LEFT JOIN`，表示即使某个 lecturer 没有对应 lecture，也仍然保留 lecturer 记录。

常见连接方式：

| JOIN 类型 | 含义 |
| --- | --- |
| `JOIN` / `INNER JOIN` | 只返回两边都匹配的数据 |
| `LEFT JOIN` | 保留左表全部数据，右表没有匹配时显示 `NULL` |
| `RIGHT JOIN` | 保留右表全部数据 |

## NOT EXISTS：查找没有关联记录的数据

查询没有授课安排的讲师：

```sql
SELECT l.staffno,
       l.title,
       l.fname,
       l.lname
FROM lecturer l
WHERE NOT EXISTS (
    SELECT *
    FROM lecture le
    WHERE le.staffno = l.staffno
);
```

`NOT EXISTS` 常用于找“主表中存在，但关联表中不存在”的记录。

可以理解为：

```text
对每一个 lecturer
检查 lecture 表里是否存在对应 staffno
如果不存在，就返回这个 lecturer
```

## 聚合函数：AVG、MIN、MAX、COUNT、SUM

计算讲师平均工资：

```sql
SELECT AVG(salary) AS averagesalary
FROM lecturer;
```

计算最低和最高工资：

```sql
SELECT MIN(salary) AS minimumsalary,
       MAX(salary) AS maximumsalary
FROM lecturer;
```

统计数据库实验课每周成本：

```sql
SELECT SUM(l.duration * t.salaryperhour) AS totalweeklycost
FROM lab l
JOIN tutor t
  ON l.tutorno = t.tutorno
WHERE l.subjectcode IN ('CSE21DB', 'CSE31DB', 'CSE41FDB');
```

常见聚合函数：

| 函数 | 作用 |
| --- | --- |
| `COUNT(*)` | 统计行数 |
| `AVG(column)` | 平均值 |
| `MIN(column)` | 最小值 |
| `MAX(column)` | 最大值 |
| `SUM(column)` | 求和 |

## GROUP BY：分组统计

统计每门课、每个学期的 tutor 数量：

```sql
SELECT s.subjectcode,
       s.name,
       s.semester,
       COUNT(DISTINCT l.tutorno) AS numberoftutors
FROM subject s
JOIN lab l
  ON s.subjectcode = l.subjectcode
GROUP BY s.subjectcode,
         s.name,
         s.semester
ORDER BY s.subjectcode,
         s.semester;
```

使用 `GROUP BY` 时，`SELECT` 中非聚合字段通常都要出现在 `GROUP BY` 中。

例如下面这些字段都不是聚合结果：

```text
s.subjectcode
s.name
s.semester
```

所以它们需要一起写进 `GROUP BY`。

## 多表连接与分组统计

统计每个 lab 的学生人数，并显示 tutor 姓名：

```sql
SELECT l.subjectcode,
       l.labno,
       s.fname AS tutorfirstname,
       s.lname AS tutorlastname,
       COUNT(ls.studentno) AS totalstudents
FROM lab l
JOIN tutor t
  ON l.tutorno = t.tutorno
JOIN student s
  ON t.studentno = s.studentno
LEFT JOIN lab_signup ls
  ON l.labno = ls.labno
GROUP BY l.subjectcode,
         l.labno,
         s.fname,
         s.lname
ORDER BY l.subjectcode,
         l.labno;
```

这类查询要先理清表之间的关系：

```text
lab.tutorno → tutor.tutorno
tutor.studentno → student.studentno
lab.labno → lab_signup.labno
```

写复杂查询时，可以按这个顺序构造：

```text
1. 先确定最终要显示哪些字段
2. 找出这些字段分别来自哪些表
3. 找出表和表之间的连接条件
4. 决定使用 INNER JOIN 还是 LEFT JOIN
5. 加 WHERE 过滤条件
6. 如需统计，再加 GROUP BY
7. 最后加 ORDER BY 排序
```

## 本次 Lab 的核心知识点

这次练习可以归纳为几组能力：

```text
查看 schema 中已有表
创建表并设置主键
插入完整数据和部分数据
处理主键重复错误
使用 Oracle 日期函数
修改表结构
理解 CHAR 和 VARCHAR2 的区别
提交事务
从已有 schema 复制表
使用 JOIN 和 NOT EXISTS 查询关联数据
使用聚合函数和 GROUP BY 做统计
```

如果只记一句话：Part A 主要练表结构和数据维护，Part B 主要练多表查询和聚合统计。
