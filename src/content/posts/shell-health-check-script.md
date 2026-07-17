---
title: "Shell 脚本基础与服务器健康检查实践"
published: 2026-07-17
description: "归纳 Shell 脚本在自动化运维中的基础用法，并以网站健康检查脚本为例，覆盖 HTTP 状态码、Nginx 服务状态、磁盘空间、内存使用率、日志记录和 crontab 定时任务。"
tags: ["Linux", "Shell", "自动化运维", "crontab", "Nginx"]
category: "Linux"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

Shell 脚本是 Linux 运维自动化中最基础、最常用的工具之一。服务器巡检、日志分析、定时备份、服务重启、部署发布、磁盘清理等重复性操作，都可以通过 Shell 脚本固化为可重复执行的流程。

在运维场景中，Shell 脚本的价值不在于语法复杂，而在于把人工操作变成：

```text
可重复执行
可记录结果
可定时运行
可扩展告警
可用于排障
```

本文以一个网站健康检查脚本为例，归纳 Shell 脚本的基础语法和常见运维用法。

## Shell 脚本的基本结构

一个最简单的 Shell 脚本通常以解释器声明开头：

```bash
#!/bin/bash
```

这行称为 shebang，表示该脚本使用 `bash` 解释执行。

脚本文件通常以 `.sh` 作为后缀，例如：

```text
health-check.sh
backup-site.sh
nginx-log-summary.sh
```

创建脚本后，需要赋予执行权限：

```bash
chmod +x health-check.sh
```

然后可以直接执行：

```bash
./health-check.sh
```

如果没有执行权限，也可以通过 `bash` 调用：

```bash
bash health-check.sh
```

## 变量

Shell 中可以使用变量保存路径、网址、状态码等信息。

```bash
URL="https://tiancheng-blog.com"
LOG_FILE="$HOME/health-check.log"
```

变量赋值时，等号两边不能有空格。

正确写法：

```bash
URL="https://tiancheng-blog.com"
```

错误写法：

```bash
URL = "https://tiancheng-blog.com"
```

使用变量时，需要在变量名前加 `$`：

```bash
echo "$URL"
```

为了避免变量中包含空格或特殊字符导致解析错误，实际脚本中建议始终给变量加双引号：

```bash
echo "$LOG_FILE"
```

## 命令替换

Shell 可以把一条命令的输出保存到变量中。

```bash
TIME=$(date "+%Y-%m-%d %H:%M:%S")
```

其中：

```bash
$(...)
```

表示先执行括号内的命令，再把输出结果作为变量值。

例如：

```bash
STATUS_CODE=$(curl -o /dev/null -s -w "%{http_code}" "$URL")
```

这行命令会访问指定 URL，并把 HTTP 状态码保存到 `STATUS_CODE` 变量中。

## if 判断

Shell 中可以使用 `if` 对条件进行判断。

```bash
if [ "$STATUS_CODE" = "200" ]; then
  echo "网站正常"
else
  echo "网站异常"
fi
```

需要注意：

- `[` 和 `]` 两边必须有空格；
- 字符串比较常用 `=`；
- `fi` 表示 `if` 语句结束。

多个条件可以使用 `&&` 连接：

```bash
if [ "$STATUS_CODE" = "200" ] && [ "$NGINX_STATUS" = "active" ]; then
  echo "网站和 Nginx 都正常"
fi
```

`&&` 表示“并且”，只有两个条件都成立时，整体条件才成立。

## HTTP 状态码检查

网站是否可用，最直接的检查方式是访问网站并读取 HTTP 状态码。

```bash
STATUS_CODE=$(curl \
  --connect-timeout 5 \
  --max-time 10 \
  -o /dev/null \
  -s \
  -w "%{http_code}" \
  "$URL")
```

参数说明：

| 参数 | 作用 |
|---|---|
| `--connect-timeout 5` | 连接最多等待 5 秒 |
| `--max-time 10` | 整个请求最多执行 10 秒 |
| `-o /dev/null` | 不保存网页内容 |
| `-s` | 静默模式，不输出进度 |
| `-w "%{http_code}"` | 只输出 HTTP 状态码 |

常见状态码：

| 状态码 | 含义 |
|---|---|
| `200` | 请求成功 |
| `301` / `302` | 重定向 |
| `403` | 禁止访问 |
| `404` | 页面不存在 |
| `500` | 服务端错误 |
| `502` | 网关错误 |
| `000` | 没有拿到 HTTP 响应，常见于 DNS 失败、连接失败、超时 |

## Nginx 服务状态检查

如果网站无法访问，除了页面本身的问题，也可能是 Nginx 服务异常。

可以使用：

```bash
systemctl is-active nginx
```

如果 Nginx 正常运行，输出通常是：

```text
active
```

脚本中可以写成：

```bash
NGINX_STATUS=$(systemctl is-active nginx)
```

然后判断：

```bash
if [ "$NGINX_STATUS" = "active" ]; then
  echo "Nginx 正常"
else
  echo "Nginx 异常"
fi
```

## 磁盘空间检查

服务器磁盘空间不足是常见故障原因。磁盘满了可能导致：

- 日志无法写入；
- 数据库无法正常工作；
- 部署失败；
- 服务启动异常；
- 临时文件无法创建。

检查根目录 `/` 的磁盘使用率：

```bash
df /
```

示例输出：

```text
Filesystem     1K-blocks    Used Available Use% Mounted on
/dev/vda1       41151808 8150000  33001808  20% /
```

取出使用率：

```bash
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
```

拆解：

| 片段 | 作用 |
|---|---|
| `df /` | 查看根目录所在磁盘 |
| `awk 'NR==2 {print $5}'` | 取第二行第五列，即 `Use%` |
| `tr -d '%'` | 删除百分号，保留数字 |

数字比较使用：

```bash
[ "$DISK_USAGE" -lt 80 ]
```

其中 `-lt` 表示小于。

常见数字比较符号：

| 写法 | 含义 |
|---|---|
| `-lt` | 小于 |
| `-le` | 小于等于 |
| `-gt` | 大于 |
| `-ge` | 大于等于 |
| `-eq` | 等于 |
| `-ne` | 不等于 |

## 内存使用率检查

查看内存：

```bash
free -m
```

示例输出：

```text
               total        used        free      shared  buff/cache   available
Mem:            1968         500         300          20        1168        1300
Swap:              0           0           0
```

计算内存使用率：

```bash
MEM_USAGE=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
```

含义：

| 片段 | 作用 |
|---|---|
| `/Mem:/` | 找到包含 `Mem:` 的行 |
| `$2` | 总内存 |
| `$3` | 已使用内存 |
| `$3/$2 * 100` | 计算使用率 |
| `printf("%.0f", ...)` | 输出整数，不带小数 |

需要注意，Linux 会把部分空闲内存用于缓存，因此在更严谨的监控中，也可以结合 `available` 字段判断内存压力。入门阶段使用 `used / total` 计算即可理解基本逻辑。

## 日志记录

运维脚本应当记录执行结果。否则脚本即使定时运行，也很难追踪历史状态。

可以使用：

```bash
echo "内容" >> "$LOG_FILE"
```

其中：

| 符号 | 作用 |
|---|---|
| `>` | 覆盖写入 |
| `>>` | 追加写入 |

巡检日志通常使用追加写入，避免覆盖历史记录。

建议区分普通日志和错误日志：

```bash
LOG_FILE="$HOME/health-check.log"
ERROR_LOG_FILE="$HOME/health-check-error.log"
```

普通日志记录所有检查结果，错误日志只记录异常，便于排查。

## 完整健康检查脚本

```bash
#!/bin/bash

URL="https://tiancheng-blog.com"
LOG_FILE="$HOME/health-check.log"
ERROR_LOG_FILE="$HOME/health-check-error.log"

TIME=$(date "+%Y-%m-%d %H:%M:%S")

STATUS_CODE=$(curl \
  --connect-timeout 5 \
  --max-time 10 \
  -o /dev/null \
  -s \
  -w "%{http_code}" \
  "$URL")

NGINX_STATUS=$(systemctl is-active nginx)
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
MEM_USAGE=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')

if [ "$STATUS_CODE" = "200" ] && [ "$NGINX_STATUS" = "active" ] && [ "$DISK_USAGE" -lt 80 ] && [ "$MEM_USAGE" -lt 80 ]; then
  echo "[$TIME] OK: $URL status=$STATUS_CODE nginx=$NGINX_STATUS disk=${DISK_USAGE}% mem=${MEM_USAGE}%" >> "$LOG_FILE"
  echo "网站、Nginx、磁盘、内存都正常"
else
  echo "[$TIME] ERROR: $URL status=$STATUS_CODE nginx=$NGINX_STATUS disk=${DISK_USAGE}% mem=${MEM_USAGE}%" >> "$LOG_FILE"
  echo "[$TIME] ERROR: $URL status=$STATUS_CODE nginx=$NGINX_STATUS disk=${DISK_USAGE}% mem=${MEM_USAGE}%" >> "$ERROR_LOG_FILE"
  echo "发现异常：status=$STATUS_CODE nginx=$NGINX_STATUS disk=${DISK_USAGE}% mem=${MEM_USAGE}%"
fi
```

该脚本完成了四类检查：

| 检查项 | 判断标准 |
|---|---|
| 网站状态 | HTTP 状态码为 `200` |
| Nginx 服务 | `systemctl is-active nginx` 输出 `active` |
| 磁盘空间 | 根目录使用率小于 `80%` |
| 内存使用 | 内存使用率小于 `80%` |

## crontab 定时执行

手动运行脚本只能检查一次。要实现自动巡检，可以使用 `crontab`。

编辑当前用户的定时任务：

```bash
crontab -e
```

添加：

```bash
*/5 * * * * /home/ubuntu/health-check.sh
```

表示每 5 分钟执行一次脚本。

crontab 的时间格式：

```text
分钟 小时 日期 月份 星期 命令
```

常见示例：

| 表达式 | 含义 |
|---|---|
| `*/5 * * * *` | 每 5 分钟执行一次 |
| `0 * * * *` | 每小时整点执行一次 |
| `0 2 * * *` | 每天凌晨 2 点执行一次 |
| `0 2 * * 0` | 每周日凌晨 2 点执行一次 |
| `30 23 * * *` | 每天 23:30 执行一次 |

查看当前定时任务：

```bash
crontab -l
```

查看巡检日志：

```bash
tail -f /home/ubuntu/health-check.log
```

如果每 5 分钟出现一条新记录，说明定时任务已经正常运行。

## nano 中删除多行

在服务器上编辑脚本时，常用 `nano`。

删除当前行：

```text
Ctrl + K
```

连续按多次可以删除多行。

选中一段再删除：

```text
Ctrl + 6
方向键选择多行
Ctrl + K
```

部分终端中也可以使用：

```text
Alt + A
```

开始标记选择范围。

## 运维场景中的扩展方向

当前脚本已经具备基础巡检能力，后续可以继续扩展：

- 检查 CPU 使用率；
- 检查指定端口是否监听；
- 检查证书过期时间；
- 检查 Docker 容器状态；
- 检查数据库连接；
- 异常时发送邮件、企业微信、Telegram 或其他通知；
- 将日志按日期切分；
- 接入 Prometheus Node Exporter；
- 使用 Python 对日志做进一步分析；
- 接入 AI API 分析异常日志并生成排查建议。

## 小结

一个基础运维巡检脚本通常包含以下部分：

```text
定义检查目标
获取当前时间
执行检查命令
保存检查结果
判断是否异常
写入日志
定时执行
持续改进
```

Shell 脚本的核心价值不是写复杂语法，而是把日常运维操作标准化、自动化。通过健康检查脚本，可以初步建立自动化运维思维：先明确检查目标，再设计判断条件，最后把结果记录下来并定期执行。

