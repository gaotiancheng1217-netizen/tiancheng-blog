---
title: "MySQL 基础操作：数据库初始化、用户授权与连接排查"
published: 2026-07-29
description: "归纳 MySQL 在服务器部署场景中的基础操作，包括登录数据库、创建数据库、创建用户、授权、导入导出 SQL、查看连接信息和排查常见连接失败问题。"
tags: ["MySQL", "数据库", "SQL", "部署", "故障排查"]
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
