---
title: "数据库表设计基础：主键、外键、约束与表关系"
published: 2026-08-11
description: "归纳关系型数据库表设计中的主键、外键、唯一约束、非空约束、默认值、检查约束以及一对一、一对多、多对多关系的建模方法。"
tags: ["SQL", "数据库", "表设计", "主键", "外键", "约束"]
category: "数据库"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

关系型数据库中的数据通常不是随意放在一张大表里，而是按照业务对象拆分成多张表，再通过主键、外键和约束建立数据之间的关系。表设计决定了后续查询、维护、扩展和排错的复杂度。

一张设计合理的表，应该至少回答以下问题：

```text
这张表描述的对象是什么
每一行如何被唯一识别
字段是否允许为空
字段是否允许重复
字段之间是否存在依赖关系
这张表与其他表是什么关系
删除或更新数据时会影响哪些关联数据
```

## 表、字段与记录

在关系型数据库中，表用于描述一类对象，字段用于描述对象的属性，记录表示某一个具体对象。

以用户表为例：

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

这里可以这样理解：

| 结构 | 含义 |
| --- | --- |
| `users` | 表，表示用户集合 |
| `id`、`username`、`email` | 字段，表示用户属性 |
| 表中的每一行 | 一条用户记录 |
| `PRIMARY KEY` | 用于唯一标识一条记录 |

表设计的核心不是先写 SQL，而是先明确数据对象和对象之间的关系。

## 主键：唯一标识一行数据

主键用于唯一定位一条记录。一个表通常应该有主键，否则后续更新、删除和关联查询都会变得不稳定。

常见写法：

```sql
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
);
```

主键的特点：

- 不能重复；
- 不能为 `NULL`；
- 通常不会频繁修改；
- 经常被其他表引用。

### 自然主键与代理主键

主键大致可以分为两类。

| 类型 | 示例 | 特点 |
| --- | --- | --- |
| 自然主键 | 身份证号、学号、员工编号 | 来自业务本身，有实际含义 |
| 代理主键 | 自增 ID、UUID | 人为生成，主要用于唯一标识 |

在实际系统中，更常见的是使用自增 ID 或 UUID 作为代理主键。原因是业务字段可能变化，例如邮箱、手机号、员工编号都可能被修改，而主键最好保持稳定。

## 外键：建立表与表之间的关系

外键用于表示一张表中的字段引用另一张表的主键。

例如，一个部门可以有多个员工：

```sql
CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  department_id INT,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

这里的关系是：

```text
departments.id  ←  employees.department_id
```

含义是：员工属于某一个部门，`employees.department_id` 必须引用 `departments` 表中已经存在的 `id`。

外键的作用：

- 防止引用不存在的数据；
- 表达表与表之间的业务关系；
- 减少孤立数据；
- 让数据库本身参与数据一致性检查。

需要注意，外键并不是所有系统都会强制使用。有些系统会在应用层维护关系，但从学习表设计的角度，先理解外键非常重要。

## 常见表关系

### 一对一

一对一表示一条记录只对应另一张表中的一条记录。

例如用户基本信息和用户扩展信息：

```text
users 1 ─── 1 user_profiles
```

可以把不常用或字段较多的信息拆到扩展表中：

```sql
CREATE TABLE user_profiles (
  user_id INT PRIMARY KEY,
  bio VARCHAR(255),
  avatar_url VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

这里 `user_profiles.user_id` 既是主键，也是外键，表示一个用户最多只有一条扩展信息。

### 一对多

一对多是最常见的关系。

例如一个部门有多个员工：

```text
departments 1 ─── N employees
```

实现方式通常是在“多”的一侧保存外键：

```sql
CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  department_id INT,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

判断一对多关系时，可以用一句话检查：

```text
一个部门可以有多个员工，一个员工通常只属于一个部门。
```

所以外键放在员工表中。

### 多对多

多对多不能直接只靠两张表表达，通常需要一张中间表。

例如学生和课程：

```text
students N ─── N courses
```

一个学生可以选多门课，一门课也可以被多个学生选择。因此需要选课表：

```sql
CREATE TABLE students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE student_courses (
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  selected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

`student_courses` 叫做关联表或中间表。它把学生和课程的多对多关系拆成两组一对多关系。

## 常见约束

约束用于限制字段中的数据，避免脏数据进入数据库。

### NOT NULL

`NOT NULL` 表示字段不能为空。

```sql
username VARCHAR(50) NOT NULL
```

适合用于必须填写的字段，例如用户名、订单编号、商品名称等。

### UNIQUE

`UNIQUE` 表示字段值不能重复。

```sql
email VARCHAR(100) UNIQUE
```

适合用于邮箱、手机号、业务编号等不允许重复的字段。

如果一个字段既不能空，又不能重复，可以组合使用：

```sql
email VARCHAR(100) NOT NULL UNIQUE
```

### DEFAULT

`DEFAULT` 表示字段没有指定值时使用默认值。

```sql
status VARCHAR(20) DEFAULT 'ACTIVE'
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

默认值常用于状态字段、创建时间字段等。

### CHECK

`CHECK` 用于限制字段值必须满足某个条件。

```sql
age INT CHECK (age >= 0)
```

再比如订单金额不能小于 0：

```sql
amount DECIMAL(10, 2) CHECK (amount >= 0)
```

不同数据库对 `CHECK` 的支持细节可能不同，使用前需要结合具体数据库版本确认。

## 级联操作

外键可以设置级联删除或级联更新。

```sql
FOREIGN KEY (department_id)
REFERENCES departments(id)
ON DELETE CASCADE
ON UPDATE CASCADE
```

含义是：

| 选项 | 含义 |
| --- | --- |
| `ON DELETE CASCADE` | 删除父表记录时，自动删除子表关联记录 |
| `ON UPDATE CASCADE` | 更新父表主键时，自动更新子表外键 |
| `ON DELETE SET NULL` | 删除父表记录时，将子表外键设为 NULL |
| `RESTRICT` / `NO ACTION` | 如果存在关联记录，则阻止删除或更新 |

级联删除要谨慎使用。它可以减少手动清理数据的工作，但如果关系设计不清晰，也可能导致误删大量关联数据。

## 表设计示例

下面用一个简单的课程选课系统串联主键、外键和约束。

```sql
CREATE TABLE students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_no VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_code VARCHAR(30) NOT NULL UNIQUE,
  course_name VARCHAR(100) NOT NULL,
  credit INT NOT NULL CHECK (credit > 0)
);

CREATE TABLE enrollments (
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

这个设计中：

- `students.id` 唯一标识学生；
- `courses.id` 唯一标识课程；
- `student_no` 和 `course_code` 使用 `UNIQUE` 防止业务编号重复；
- `enrollments` 用于表达学生和课程的多对多关系；
- `PRIMARY KEY (student_id, course_id)` 防止同一个学生重复选择同一门课程；
- 外键保证选课记录必须引用真实存在的学生和课程。

## 常见设计问题

### 把所有字段放在一张大表里

如果把学生、课程、教师、选课记录都放在同一张表中，会出现大量重复数据。

```text
学生姓名重复
课程名称重复
教师信息重复
修改一处信息时需要同步修改多行
```

这会增加数据不一致的风险。

### 缺少唯一约束

如果邮箱、学号、订单号等字段没有唯一约束，数据库就无法阻止重复数据。

```sql
email VARCHAR(100)
```

更合理的写法是：

```sql
email VARCHAR(100) UNIQUE
```

如果字段本身必须填写，还应加上 `NOT NULL`。

### 外键字段类型不一致

外键字段和被引用字段的类型应保持一致。

例如 `departments.id` 是 `INT`，那么 `employees.department_id` 也应该是 `INT`。

### 过度依赖业务字段作为主键

手机号、邮箱、姓名等字段都可能变化，不适合作为长期稳定的主键。更常见的做法是使用 `id` 作为主键，再对业务字段添加唯一约束。

## 基本设计步骤

设计一组表时，可以按以下顺序思考：

1. 找出系统中的主要对象；
2. 每个对象单独建表；
3. 为每张表设置稳定主键；
4. 判断对象之间是一对一、一对多还是多对多；
5. 在合适的位置添加外键；
6. 为必须存在的字段添加 `NOT NULL`；
7. 为不能重复的字段添加 `UNIQUE`；
8. 为状态、时间等字段添加合理默认值；
9. 对范围类字段添加 `CHECK`；
10. 最后再根据查询需求补充索引。

