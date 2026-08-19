---
title: "MySQL 数据备份、恢复与导入导出基础"
published: 2026-08-19
description: "整理 MySQL 逻辑备份、恢复、导入导出和常见故障处理方法，说明 mysqldump、mysql 导入、表级备份、结构备份、字符集和权限问题。"
tags: ["MySQL", "数据库", "备份", "恢复", "导入导出"]
category: "数据库"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

数据库中的数据通常比程序文件更重要。程序代码可以重新部署，静态资源可以重新上传，但数据库中保存的用户、订单、配置、业务记录一旦丢失，恢复成本会很高。因此，在执行结构变更、数据迁移、版本升级和批量导入前，应先确认是否已经有可用备份。

MySQL 常见的数据维护操作主要包括：

```text
备份整个数据库
备份指定数据表
只备份表结构
只备份表数据
从 SQL 文件恢复数据
导入初始化 SQL
导出查询结果
排查导入失败
```

## 逻辑备份与物理备份

数据库备份大致可以分为逻辑备份和物理备份。

| 类型 | 说明 | 常见方式 |
| --- | --- | --- |
| 逻辑备份 | 把库、表、数据转换成 SQL 语句 | `mysqldump` |
| 物理备份 | 直接复制数据库底层数据文件 | 复制数据目录、专用备份工具 |

逻辑备份更适合学习、迁移、小型系统和日常导入导出，因为备份文件通常是可读的 `.sql` 文件。

例如逻辑备份文件中可能包含：

```sql
CREATE TABLE users (...);
INSERT INTO users (...) VALUES (...);
```

物理备份速度可能更快，但依赖数据库版本、存储引擎和数据文件状态，操作时更容易受到服务运行状态影响。

## mysqldump 的基本作用

`mysqldump` 是 MySQL 自带的逻辑备份工具，用于把数据库导出成 SQL 文件。

基本格式：

```bash
mysqldump -u 用户名 -p 数据库名 > 备份文件.sql
```

例如备份 `app_demo` 数据库：

```bash
mysqldump -u root -p app_demo > app_demo_backup.sql
```

执行后会要求输入密码。密码输入时通常不会显示在终端中，这是正常现象。

在 Windows 中，如果没有配置环境变量，可以使用完整路径：

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p app_demo > app_demo_backup.sql
```

PowerShell 中路径包含空格时，需要使用 `&` 调用可执行文件，并把路径放在引号中。

## 备份整个数据库

备份单个数据库：

```bash
mysqldump -u root -p app_demo > app_demo.sql
```

这个文件通常包含：

- 建表语句；
- 表结构；
- 表数据；
- 字符集信息；
- 部分会话参数。

可以通过查看文件开头确认备份内容：

```bash
head -n 30 app_demo.sql
```

Windows PowerShell 中可以使用：

```powershell
Get-Content .\app_demo.sql -TotalCount 30
```

## 备份指定表

如果只需要备份某张表，可以在数据库名后面加表名：

```bash
mysqldump -u root -p app_demo users > app_demo_users.sql
```

含义是：

```text
从 app_demo 数据库中，只导出 users 表
```

如果要备份多张表，可以继续追加表名：

```bash
mysqldump -u root -p app_demo users orders products > selected_tables.sql
```

表级备份适合在只修改某几张关键表前使用。

## 只备份表结构

如果只需要导出建表语句，不需要导出数据，可以使用 `--no-data`。

```bash
mysqldump -u root -p --no-data app_demo > app_demo_schema.sql
```

只备份指定表结构：

```bash
mysqldump -u root -p --no-data app_demo users > users_schema.sql
```

这种备份常用于：

- 查看表结构；
- 对比测试环境和生产环境表结构；
- 初始化一个空数据库结构；
- 保留建表语句。

## 只备份数据

如果只需要数据，不需要 `CREATE TABLE` 语句，可以使用 `--no-create-info`。

```bash
mysqldump -u root -p --no-create-info app_demo users > users_data.sql
```

生成的文件主要包含 `INSERT` 语句。

这种方式适合目标库已经有表结构，只需要导入数据的情况。

## 备份多个数据库

备份多个数据库可以使用 `--databases`。

```bash
mysqldump -u root -p --databases app_demo test_db > multi_db.sql
```

备份全部数据库可以使用：

```bash
mysqldump -u root -p --all-databases > all_databases.sql
```

全库备份文件可能很大，执行前需要确认磁盘空间。

## 恢复 SQL 文件

恢复 SQL 文件通常使用 `mysql` 命令，而不是 `mysqldump`。

基本格式：

```bash
mysql -u 用户名 -p 数据库名 < 备份文件.sql
```

例如把 `app_demo.sql` 恢复到 `app_demo`：

```bash
mysql -u root -p app_demo < app_demo.sql
```

如果 SQL 文件中已经包含 `CREATE DATABASE` 和 `USE 数据库名`，也可以不指定数据库名：

```bash
mysql -u root -p < all_databases.sql
```

Windows PowerShell 示例：

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p app_demo < .\app_demo.sql
```

需要注意，PowerShell 对重定向和路径解析较严格。如果遇到问题，可以切换到 CMD 执行：

```cmd
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p app_demo < app_demo.sql
```

## 导入初始化 SQL

很多系统部署时会提供初始化 SQL 文件，例如：

```text
schema.sql
init.sql
data.sql
```

常见执行顺序是：

```bash
mysql -u root -p app_demo < schema.sql
mysql -u root -p app_demo < data.sql
```

一般先导入表结构，再导入基础数据。

如果 SQL 文件内部包含建库语句：

```sql
CREATE DATABASE app_demo;
USE app_demo;
```

则可以直接执行：

```bash
mysql -u root -p < init.sql
```

## 导出查询结果

有时不需要备份整张表，只需要导出查询结果。

可以在 MySQL 中使用：

```sql
SELECT id, username, email
FROM users;
```

如果需要导出为文件，常见方式包括：

- 使用图形化工具导出结果；
- 在命令行中把查询结果重定向；
- 使用程序脚本读取数据库并写入 CSV；
- 使用 `SELECT ... INTO OUTFILE`。

`SELECT ... INTO OUTFILE` 示例：

```sql
SELECT id, username, email
INTO OUTFILE '/tmp/users.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM users;
```

这类操作受 MySQL 服务端文件权限和 `secure_file_priv` 参数限制。实际使用时，需要先确认数据库允许写入哪个目录。

查看限制目录：

```sql
SHOW VARIABLES LIKE 'secure_file_priv';
```

## 字符集问题

导入导出时如果出现中文乱码，常见原因是字符集不一致。

备份时可以指定字符集：

```bash
mysqldump -u root -p --default-character-set=utf8mb4 app_demo > app_demo.sql
```

导入时也可以指定：

```bash
mysql -u root -p --default-character-set=utf8mb4 app_demo < app_demo.sql
```

表设计时也应优先使用 `utf8mb4`，因为它可以更完整地支持中文和 emoji。

建库时指定字符集：

```sql
CREATE DATABASE app_demo
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

查看数据库字符集：

```sql
SHOW CREATE DATABASE app_demo;
```

查看表字符集：

```sql
SHOW CREATE TABLE users\G
```

## 权限问题

备份和恢复需要相应权限。

如果使用普通业务用户执行备份，可能遇到权限不足。例如：

```text
Access denied
```

常见原因包括：

- 用户没有目标数据库权限；
- 用户没有读取表数据的权限；
- 用户不能创建表；
- 用户不能写入文件；
- 用户只能从指定主机登录。

查看当前用户权限：

```sql
SHOW GRANTS FOR 'app_user'@'localhost';
```

授予查询和写入权限：

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON app_demo.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```

如果需要导入表结构，还可能需要 `CREATE`、`ALTER`、`DROP` 等权限。

```sql
GRANT CREATE, ALTER, DROP ON app_demo.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```

权限应按需授予。日常业务账号不应直接拥有所有数据库的全部权限。

## 表已存在的问题

导入 SQL 文件时，可能出现表已存在：

```text
ERROR 1050 (42S01): Table 'users' already exists
```

常见处理方式：

### 删除后重建

如果确认目标表可以删除，可以先执行：

```sql
DROP TABLE users;
```

再重新导入。

### 使用 IF NOT EXISTS

建表语句可以写成：

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL
);
```

这样表已存在时不会直接报错，但也可能掩盖表结构不一致的问题。

### 导入到新库

更安全的方式是创建一个新数据库，再把 SQL 导入进去：

```sql
CREATE DATABASE app_demo_restore DEFAULT CHARACTER SET utf8mb4;
```

```bash
mysql -u root -p app_demo_restore < app_demo.sql
```

导入完成后再检查数据是否正确。

## 数据库不存在的问题

导入时如果出现：

```text
ERROR 1049 (42000): Unknown database 'app_demo'
```

说明目标数据库不存在。

可以先创建数据库：

```sql
CREATE DATABASE app_demo DEFAULT CHARACTER SET utf8mb4;
```

再导入：

```bash
mysql -u root -p app_demo < app_demo.sql
```

或者检查 SQL 文件中是否已经包含：

```sql
CREATE DATABASE
USE
```

如果文件中已经有建库语句，可以直接不指定数据库导入。

## 备份文件命名

备份文件名应包含数据库名、环境和日期，便于区分。

示例：

```text
app_demo_dev_20260819.sql
app_demo_prod_20260819_2300.sql
app_demo_users_before_update_20260819.sql
```

不建议使用含义不清的文件名，例如：

```text
backup.sql
new.sql
1.sql
```

文件名清晰可以减少恢复时选错文件的风险。

## 备份后的验证

备份完成不代表备份一定可用。至少应做基本验证。

常见检查方式：

```bash
ls -lh app_demo.sql
```

查看文件是否为空：

```bash
head -n 20 app_demo.sql
```

检查是否包含表结构：

```bash
grep "CREATE TABLE" app_demo.sql
```

检查是否包含数据：

```bash
grep "INSERT INTO" app_demo.sql
```

更可靠的方式是导入到临时数据库：

```sql
CREATE DATABASE app_demo_test_restore DEFAULT CHARACTER SET utf8mb4;
```

```bash
mysql -u root -p app_demo_test_restore < app_demo.sql
```

然后检查表和数据：

```sql
USE app_demo_test_restore;
SHOW TABLES;
SELECT COUNT(*) FROM users;
```

## 恢复前的注意事项

恢复操作可能覆盖或改变现有数据，执行前需要确认：

- 当前连接的是哪个数据库；
- SQL 文件来自哪个环境；
- 是否会执行 `DROP TABLE`；
- 是否会执行 `DELETE` 或 `TRUNCATE`；
- 字符集是否一致；
- 是否已经备份当前数据；
- 业务是否可以接受恢复期间的数据变化。

可以先查看当前数据库：

```sql
SELECT DATABASE();
```

查看当前用户：

```sql
SELECT USER();
```

查看当前时间：

```sql
SELECT NOW();
```

这些信息可以帮助确认操作环境，避免把测试数据导入生产库，或把生产备份恢复到错误数据库中。

## 常用命令速查

| 操作 | 命令 |
| --- | --- |
| 备份数据库 | `mysqldump -u root -p app_demo > app_demo.sql` |
| 备份指定表 | `mysqldump -u root -p app_demo users > users.sql` |
| 只备份结构 | `mysqldump -u root -p --no-data app_demo > schema.sql` |
| 只备份数据 | `mysqldump -u root -p --no-create-info app_demo > data.sql` |
| 恢复数据库 | `mysql -u root -p app_demo < app_demo.sql` |
| 查看当前数据库 | `SELECT DATABASE();` |
| 查看所有数据库 | `SHOW DATABASES;` |
| 查看表 | `SHOW TABLES;` |
| 查看建表语句 | `SHOW CREATE TABLE users\G` |
| 查看权限 | `SHOW GRANTS FOR 'app_user'@'localhost';` |
