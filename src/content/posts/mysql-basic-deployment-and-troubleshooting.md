---
title: "MySQL 基础操作：数据库初始化、用户授权与连接排查"
published: 2026-07-29
description: "归纳 MySQL 在服务器部署场景中的基础操作，包括数据库初始化、用户授权、连接排查、索引入门、事务基础和常见日志定位方法。"
tags: ["MySQL", "数据库", "SQL", "部署", "故障排查", "索引", "事务"]
category: "数据库"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

MySQL 是常见的关系型数据库。很多 Web 系统、管理后台、业务平台都会把用户、订单、配置、日志索引等结构化数据存放在 MySQL 中。

在服务器部署场景中，MySQL 的基础操作通常围绕几个问题展开：

```text
数据库服务是否运行
能否登录数据库
业务库是否创建
业务用户是否存在
用户权限是否正确
初始化 SQL 是否导入
后端服务能否连接数据库
```

本文整理 MySQL 的基础使用方法，重点放在初始化、授权、导入导出和连接排查。

## MySQL、数据库、表和用户

先区分几个概念：

| 概念 | 含义 |
| --- | --- |
| MySQL Server | 数据库服务进程 |
| Database | 数据库，一个项目通常对应一个或多个库 |
| Table | 表，用来保存具体数据 |
| User | 数据库用户，用来控制访问权限 |
| Privilege | 权限，例如查询、写入、建表、删除 |

可以简单理解为：

```text
MySQL Server
  └── database
        └── table
              └── row
```

部署业务系统时，通常不要直接使用 `root` 用户给应用连接数据库，而是创建一个专用业务用户，只授权它访问指定数据库。

## 登录 MySQL

使用 root 用户登录：

```bash
mysql -u root -p
```

参数含义：

| 参数 | 含义 |
| --- | --- |
| `-u root` | 指定用户名为 root |
| `-p` | 使用密码登录 |

执行后会提示输入密码。密码输入时通常不会显示字符，这是正常现象。

登录成功后会进入 MySQL 命令行：

```text
mysql>
```

退出 MySQL：

```sql
exit;
```

或者：

```sql
quit;
```

## 查看已有数据库和用户

查看数据库：

```sql
SHOW DATABASES;
```

切换数据库：

```sql
USE app_db;
```

查看当前数据库中的表：

```sql
SHOW TABLES;
```

查看用户：

```sql
SELECT user, host FROM mysql.user;
```

`user` 表示用户名，`host` 表示允许从哪里连接。

常见 `host` 写法：

| host | 含义 |
| --- | --- |
| `localhost` | 只允许本机连接 |
| `%` | 允许任意主机连接 |
| `192.168.1.%` | 允许指定网段连接 |

如果后端服务和 MySQL 在同一台服务器，可以优先使用 `localhost`。如果后端和数据库分开部署，则需要根据实际网络设置 `host`。

## 创建数据库

创建数据库：

```sql
CREATE DATABASE app_db;
```

推荐指定字符集：

```sql
CREATE DATABASE app_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

`utf8mb4` 比 `utf8` 更完整，可以保存 emoji 和更多 Unicode 字符。

查看数据库创建语句：

```sql
SHOW CREATE DATABASE app_db;
```

删除数据库：

```sql
DROP DATABASE app_db;
```

删除数据库会清空其中所有表和数据，执行前必须确认是否有备份。

## 创建业务用户

创建用户：

```sql
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'StrongPassword';
```

如果需要允许远程连接：

```sql
CREATE USER 'app_user'@'%' IDENTIFIED BY 'StrongPassword';
```

实际生产环境不建议随意使用 `%`，除非已经通过防火墙、安全组或内网访问做了限制。

修改用户密码：

```sql
ALTER USER 'app_user'@'localhost' IDENTIFIED BY 'NewPassword';
```

删除用户：

```sql
DROP USER 'app_user'@'localhost';
```

## 授权与刷新权限

给用户授权访问指定数据库：

```sql
GRANT ALL PRIVILEGES ON app_db.* TO 'app_user'@'localhost';
```

刷新权限：

```sql
FLUSH PRIVILEGES;
```

查看用户权限：

```sql
SHOW GRANTS FOR 'app_user'@'localhost';
```

如果只需要基本读写权限，可以更细一些：

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON app_db.*
TO 'app_user'@'localhost';
```

常见权限含义：

| 权限 | 作用 |
| --- | --- |
| `SELECT` | 查询数据 |
| `INSERT` | 插入数据 |
| `UPDATE` | 更新数据 |
| `DELETE` | 删除数据 |
| `CREATE` | 创建表 |
| `DROP` | 删除表 |
| `ALTER` | 修改表结构 |
| `INDEX` | 创建索引 |

开发环境可以临时使用较宽权限，正式环境应按应用需要收紧权限。

## 导入 SQL 文件

很多系统会提供初始化 SQL，用于创建表结构和基础数据。

导入 SQL：

```bash
mysql -u app_user -p app_db < init.sql
```

含义是：

```text
用 app_user 登录
把 init.sql 导入 app_db 数据库
```

如果 SQL 文件中已经包含 `CREATE DATABASE` 和 `USE database`，也可以不指定数据库：

```bash
mysql -u root -p < init.sql
```

导入后进入数据库检查：

```sql
USE app_db;
SHOW TABLES;
```

如果导入失败，常见原因包括：

- 数据库不存在；
- 用户没有建表权限；
- SQL 文件编码异常；
- SQL 文件中使用了当前 MySQL 不支持的语法；
- 表已经存在，重复导入冲突。

## 导出 SQL 备份

导出整个数据库：

```bash
mysqldump -u root -p app_db > app_db.sql
```

导出时带上时间更容易管理：

```bash
mysqldump -u root -p app_db > app_db_2026-07-29.sql
```

只导出表结构，不导出数据：

```bash
mysqldump -u root -p --no-data app_db > app_db_schema.sql
```

只导出数据，不导出建表语句：

```bash
mysqldump -u root -p --no-create-info app_db > app_db_data.sql
```

备份文件可以压缩：

```bash
gzip app_db_2026-07-29.sql
```

恢复压缩备份时：

```bash
gunzip app_db_2026-07-29.sql.gz
mysql -u root -p app_db < app_db_2026-07-29.sql
```

## 查看连接与监听端口

查看 MySQL 服务状态：

```bash
systemctl status mysql
```

有些系统服务名可能是：

```bash
systemctl status mysqld
```

查看端口监听：

```bash
ss -lntp | grep 3306
```

MySQL 默认端口是：

```text
3306
```

如果后端连接数据库失败，先确认：

```text
MySQL 服务是否运行
3306 是否监听
后端配置中的 host 是否正确
用户名密码是否正确
用户 host 是否允许当前来源连接
```

## 常见连接配置

后端项目里常见的数据库配置类似：

```yaml
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3306/app_db?useUnicode=true&characterEncoding=utf8
    username: app_user
    password: StrongPassword
```

或者 `.env`：

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=app_db
DB_USER=app_user
DB_PASSWORD=StrongPassword
```

需要重点检查：

| 配置项 | 检查内容 |
| --- | --- |
| Host | 数据库地址是否正确 |
| Port | 端口是否正确，默认 3306 |
| Database | 数据库是否存在 |
| Username | 用户是否存在 |
| Password | 密码是否正确 |
| Charset | 字符集是否符合项目要求 |

如果后端和 MySQL 在同一个 Docker Compose 网络中，数据库地址通常不是 `127.0.0.1`，而是服务名，例如：

```text
DB_HOST=mysql
```

这是因为容器里的 `127.0.0.1` 指向容器自身，不是宿主机，也不是另一个数据库容器。

## SQL 在 MySQL 中的大致执行过程

一条查询语句进入 MySQL 后，不是直接去磁盘里找数据。它通常会经过几个步骤：

```text
客户端连接
  ↓
连接器校验账号和权限
  ↓
解析 SQL 语法
  ↓
优化器选择执行方案
  ↓
执行器调用存储引擎读取数据
  ↓
返回查询结果
```

例如：

```sql
SELECT id, username
FROM users
WHERE username = 'tiancheng';
```

排查 SQL 问题时，可以从几个角度判断：

| 问题 | 可能位置 |
| --- | --- |
| 登录失败 | 连接器、账号、密码、host 权限 |
| SQL 语法错误 | 解析阶段 |
| 查询很慢 | 索引、执行计划、数据量、锁等待 |
| 没有权限 | 用户授权 |
| 数据不一致 | 事务、隔离级别、提交状态 |

这也是为什么排查数据库问题不能只看一条报错，而要同时看账号、权限、表结构、索引和 SQL 写法。

## 存储引擎与 InnoDB

MySQL 支持不同存储引擎。实际使用中最常见的是 `InnoDB`。

查看表使用的存储引擎：

```sql
SHOW TABLE STATUS FROM app_demo LIKE 'users'\G
```

也可以查看建表语句：

```sql
SHOW CREATE TABLE users\G
```

常见存储引擎对比：

| 存储引擎 | 特点 |
| --- | --- |
| InnoDB | 支持事务、行级锁、崩溃恢复，是 MySQL 常用默认引擎 |
| MyISAM | 不支持事务，历史项目中可能会见到 |
| Memory | 数据放在内存中，服务重启后数据会丢失 |

新项目一般优先使用 `InnoDB`。如果遇到老系统，需要留意表是否仍在使用 `MyISAM`，因为它在事务和并发控制方面与 InnoDB 不同。

## 索引的基础作用

索引可以理解为数据库为某些字段建立的“查找目录”。没有索引时，MySQL 可能需要从头到尾扫描整张表；有合适索引时，可以更快定位数据。

查看表索引：

```sql
SHOW INDEX FROM users;
```

给 `username` 字段创建索引：

```sql
CREATE INDEX idx_users_username ON users(username);
```

再次查看：

```sql
SHOW INDEX FROM users;
```

删除索引：

```sql
DROP INDEX idx_users_username ON users;
```

常见索引类型：

| 索引 | 说明 |
| --- | --- |
| 主键索引 | `PRIMARY KEY`，每张表通常有一个 |
| 普通索引 | 加快查询，没有唯一性限制 |
| 唯一索引 | 加快查询，同时要求字段值不能重复 |
| 联合索引 | 多个字段组合成一个索引 |

索引不是越多越好。索引会提高查询速度，但也会增加写入成本，因为插入、更新、删除数据时，索引也要维护。

## 使用 EXPLAIN 查看查询计划

判断 SQL 是否用到索引，可以使用 `EXPLAIN`：

```sql
EXPLAIN SELECT id, username
FROM users
WHERE username = 'tiancheng';
```

常看几个字段：

| 字段 | 含义 |
| --- | --- |
| `type` | 访问类型，通常越接近 `const`、`ref` 越好 |
| `key` | 实际使用的索引 |
| `rows` | 预计扫描的行数 |
| `Extra` | 额外信息，例如是否使用临时表、文件排序 |

如果 `key` 是 `NULL`，通常说明没有使用索引。此时要检查：

```text
查询条件字段是否有索引
SQL 写法是否导致索引失效
数据量是否已经大到需要优化
```

常见导致索引效果变差的写法包括：

```sql
WHERE username LIKE '%cheng';
```

```sql
WHERE LOWER(username) = 'tiancheng';
```

第一种前面带 `%`，索引很难从开头定位；第二种对字段使用函数，也可能导致索引无法正常利用。

## 事务的基本概念

事务用于保证一组数据库操作要么全部成功，要么全部失败。典型场景是转账、下单、库存扣减等。

手动开启事务：

```sql
START TRANSACTION;
```

执行修改：

```sql
UPDATE users
SET email = 'new@example.com'
WHERE username = 'tiancheng';
```

确认提交：

```sql
COMMIT;
```

如果发现操作有问题，可以回滚：

```sql
ROLLBACK;
```

事务有四个常见特性，通常称为 ACID：

| 特性 | 含义 |
| --- | --- |
| Atomicity | 原子性，一组操作要么都成功，要么都失败 |
| Consistency | 一致性，事务前后数据规则保持正确 |
| Isolation | 隔离性，并发事务之间互相隔离 |
| Durability | 持久性，提交后的数据应该持久保存 |

排查数据异常时，要确认修改是否真的执行了 `COMMIT`。如果事务没有提交，另一个连接可能看不到这次修改。

## 事务隔离级别

多个连接同时操作数据库时，事务之间可能互相影响。MySQL 通过隔离级别控制这种影响。

查看当前隔离级别：

```sql
SELECT @@transaction_isolation;
```

MySQL 常见隔离级别：

| 隔离级别 | 特点 |
| --- | --- |
| READ UNCOMMITTED | 可以读到未提交数据，较少使用 |
| READ COMMITTED | 只能读到已提交数据 |
| REPEATABLE READ | MySQL InnoDB 默认隔离级别，同一事务内多次读取结果相对稳定 |
| SERIALIZABLE | 隔离最强，并发能力最低 |

如果遇到“一个连接改了数据，另一个连接暂时看不到”的情况，不一定是数据没写入，也可能和事务是否提交、隔离级别有关。

## MySQL 常见日志

MySQL 排查问题时经常会接触几类日志：

| 日志 | 作用 |
| --- | --- |
| Error Log | 记录 MySQL 启动、停止、崩溃、严重错误 |
| Slow Query Log | 记录执行较慢的 SQL |
| General Log | 记录客户端执行过的 SQL，通常不长期打开 |
| Binary Log | 记录数据变更，可用于主从复制和数据恢复 |
| Redo Log | InnoDB 用于崩溃恢复 |
| Undo Log | 用于事务回滚和一致性读 |

查看日志相关配置：

```sql
SHOW VARIABLES LIKE 'log_error';
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'log_bin';
```

如果要排查慢 SQL，可以关注慢查询日志是否开启：

```sql
SHOW VARIABLES LIKE 'slow_query_log';
```

如果结果是 `OFF`，说明当前没有记录慢查询日志。实际环境是否开启，需要根据性能、磁盘和排查需求决定。

## 锁等待与正在执行的 SQL

当 SQL 卡住不返回时，可能不是数据库宕机，而是出现锁等待或长事务。

查看当前连接：

```sql
SHOW PROCESSLIST;
```

常见关注字段：

| 字段 | 含义 |
| --- | --- |
| `Id` | 连接 ID |
| `User` | 当前连接用户 |
| `Host` | 来源地址 |
| `db` | 当前数据库 |
| `Command` | 当前命令 |
| `Time` | 当前状态持续时间 |
| `State` | 当前状态 |
| `Info` | 正在执行的 SQL |

如果看到某条 SQL 执行时间很长，需要结合业务情况判断是否可以终止。终止连接可以使用：

```sql
KILL 连接ID;
```

生产环境不要随意 `KILL`，需要先确认这条 SQL 是否属于关键业务操作。

## 常见报错与排查

### Access denied

报错类似：

```text
Access denied for user 'app_user'@'localhost'
```

常见原因：

- 密码错误；
- 用户不存在；
- 用户存在但 host 不匹配；
- 用户没有对应数据库权限。

排查命令：

```sql
SELECT user, host FROM mysql.user;
SHOW GRANTS FOR 'app_user'@'localhost';
```

### Unknown database

报错类似：

```text
Unknown database 'app_db'
```

表示数据库不存在或名称写错。

检查：

```sql
SHOW DATABASES;
```

### Communications link failure

这类报错通常说明后端无法连接到 MySQL。

常见原因：

- MySQL 没启动；
- 数据库地址写错；
- 端口不通；
- 防火墙或安全组未放行；
- Docker 网络配置错误；
- MySQL 只监听本地地址。

排查：

```bash
systemctl status mysql
ss -lntp | grep 3306
```

如果是远程连接，还需要从后端所在机器测试端口：

```bash
nc -vz 数据库IP 3306
```

### Table already exists

导入 SQL 时可能出现：

```text
Table 'users' already exists
```

说明表已经存在，重复执行建表语句。

处理方式取决于场景：

- 如果是全新初始化，可以先清空数据库；
- 如果是已有数据环境，不应随意删除表；
- 如果只是导入数据，需要确认 SQL 是否包含重复建表语句。

## 推荐初始化流程

部署新系统时，可以按这个顺序处理 MySQL：

```text
1. 确认 MySQL 服务正在运行
2. 登录 root 用户
3. 创建业务数据库
4. 创建业务用户
5. 授权业务用户访问指定数据库
6. 导入初始化 SQL
7. 检查表是否创建成功
8. 修改后端数据库连接配置
9. 启动后端服务
10. 查看后端日志确认连接是否成功
```

对应命令示例：

```sql
CREATE DATABASE app_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'StrongPassword';

GRANT ALL PRIVILEGES ON app_db.* TO 'app_user'@'localhost';

FLUSH PRIVILEGES;
```

导入：

```bash
mysql -u app_user -p app_db < init.sql
```

验证：

```sql
USE app_db;
SHOW TABLES;
```

## 总结

MySQL 基础操作可以归纳为五件事：

```text
建库
建用户
授权
导入导出
连接排查
```

数据库问题排查时，不要只看后端报错，而要同时检查：

```text
MySQL 服务状态
端口监听
数据库是否存在
用户是否存在
用户 host 是否匹配
用户权限是否正确
后端连接配置是否正确
```

对于多数 Web 系统来说，MySQL 是否配置正确，直接决定后端服务能否正常启动和处理业务请求。
