---
title: "Nginx 日志分析与未知域名访问排查"
published: 2026-07-18
description: "归纳 Nginx access.log 与 error.log 的分析方法，说明如何识别扫描请求、统计状态码、排查异常访问，并通过 Host 限制处理未知域名解析到服务器的问题。"
tags: ["Nginx", "Linux", "日志", "安全", "故障排查"]
category: "Nginx"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

Nginx 日志是 Web 服务排障和安全分析中最直接的信息来源。通过访问日志和错误日志，可以判断请求来源、访问路径、HTTP 状态码、资源加载情况、反向代理错误、权限问题以及自动化扫描行为。

对于公网服务器来说，日志中出现陌生 IP、`.php`、`wp-content`、`.env`、`admin` 等路径并不罕见。重要的不是看到异常路径就立即判断“被入侵”，而是结合请求路径、状态码、User-Agent、Referer、访问频率和错误日志进行分析。

## Nginx 常见日志文件

Ubuntu / Debian 系统中，Nginx 默认日志通常位于：

```text
/var/log/nginx/access.log
/var/log/nginx/error.log
```

查看日志目录：

```bash
ls -lh /var/log/nginx
```

### access.log

`access.log` 记录客户端访问行为，常用于分析：

- 哪些 IP 访问了网站；
- 请求了哪些路径；
- 返回了哪些 HTTP 状态码；
- 是否存在大量 404 / 500；
- 是否存在爬虫或扫描器；
- 静态资源是否正常加载；
- 是否存在外站 Referer 或资源盗链。

### error.log

`error.log` 记录 Nginx 处理请求时遇到的错误，常用于分析：

- 配置错误；
- 文件不存在；
- 权限不足；
- upstream 后端连接失败；
- 请求体过大；
- TLS / 证书问题；
- 反向代理超时。

可以简单理解为：

```text
access.log 看“请求发生了什么”
error.log 看“Nginx 为什么处理失败”
```

## 查看日志的基本方式

日志文件较大时，不建议直接使用 `cat` 输出整个文件。

查看最近访问记录：

```bash
tail -n 20 /var/log/nginx/access.log
```

实时查看访问日志：

```bash
tail -f /var/log/nginx/access.log
```

查看最近错误：

```bash
tail -n 50 /var/log/nginx/error.log
```

搜索错误关键词：

```bash
grep -i "error" /var/log/nginx/error.log | tail -n 50
```

搜索权限问题：

```bash
grep -i "permission" /var/log/nginx/error.log | tail -n 50
```

搜索 upstream 问题：

```bash
grep -i "upstream" /var/log/nginx/error.log | tail -n 50
```

## access.log 字段含义

常见访问日志格式类似：

```text
1.2.3.4 - - [18/Jul/2026:12:30:01 +0800] "GET / HTTP/1.1" 200 615 "-" "Mozilla/5.0"
```

可以拆解为：

| 字段 | 示例 | 含义 |
|---|---|---|
| 客户端 IP | `1.2.3.4` | 发起请求的 IP 地址 |
| 时间 | `[18/Jul/2026:12:30:01 +0800]` | 请求时间 |
| 请求方法和路径 | `"GET / HTTP/1.1"` | 请求方法、路径、协议版本 |
| 状态码 | `200` | HTTP 响应状态码 |
| 响应大小 | `615` | 返回内容大小 |
| Referer | `"-"` | 来源页面 |
| User-Agent | `"Mozilla/5.0"` | 浏览器或客户端信息 |

在默认日志格式中，常见字段位置通常为：

| 字段 | awk 列 |
|---|---|
| IP | `$1` |
| 请求方法 | `$6` |
| 请求路径 | `$7` |
| 协议版本 | `$8` |
| 状态码 | `$9` |
| Referer | `$11` |

具体列号取决于 Nginx 的 `log_format` 配置。如果自定义过日志格式，需要以实际格式为准。

## 统计访问最多的 IP

```bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```

命令含义：

| 片段 | 作用 |
|---|---|
| `awk '{print $1}'` | 提取第一列 IP |
| `sort` | 排序，使相同 IP 相邻 |
| `uniq -c` | 统计重复次数 |
| `sort -nr` | 按数字倒序排序 |
| `head` | 只看前 10 条 |

该命令可用于发现高频访问 IP。如果某个 IP 在短时间内请求大量不存在路径，可能是扫描器或爬虫。

## 统计 HTTP 状态码

```bash
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -nr
```

示例输出：

```text
1200 200
80 404
12 301
3 500
```

含义：

| 状态码 | 常见含义 |
|---|---|
| `200` | 请求成功 |
| `206` | 分段内容，常见于音频、视频、断点续传 |
| `301` / `302` | 重定向 |
| `403` | 禁止访问 |
| `404` | 资源不存在 |
| `500` | 服务端内部错误 |
| `502` | Nginx 无法连接后端服务 |
| `503` | 服务暂不可用 |
| `504` | 后端服务响应超时 |

状态码统计是日志分析的第一步。它可以快速判断网站整体请求是否正常。

## 分析 404 请求

查看最近 404：

```bash
awk '$9 == 404 {print $0}' /var/log/nginx/access.log | tail -n 20
```

统计 404 最多的路径：

```bash
awk '$9 == 404 {print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```

常见 404 来源：

- 用户访问了不存在页面；
- 旧链接未更新；
- 静态资源路径错误；
- 搜索引擎爬取旧路径；
- 自动化扫描器探测漏洞路径。

如果日志中出现大量类似路径：

```text
/wp-admin
/wp-content/plugins/...
/phpmyadmin
/.env
/config.php
/shell.php
/new.php
```

通常说明有扫描器在尝试寻找 WordPress、PHP、数据库管理工具或敏感配置文件。

如果这些请求返回 `404`，通常表示目标文件不存在，并不代表入侵成功。

需要重点关注的是异常路径是否返回了 `200`：

```text
GET /.env HTTP/1.1" 200
GET /config.php HTTP/1.1" 200
```

如果敏感文件返回 `200`，说明文件可能被公开访问，需要立即处理。

## 分析 500 / 502 / 504 错误

查看 500 以上错误：

```bash
awk '$9 >= 500 {print $0}' /var/log/nginx/access.log | tail -n 20
```

常见含义：

| 状态码 | 常见原因 |
|---|---|
| `500` | 后端应用内部错误 |
| `502` | Nginx 无法连接 upstream |
| `503` | 后端服务不可用 |
| `504` | 后端响应超时 |

出现大量 `502` 时，可以继续检查：

```bash
systemctl status 服务名
journalctl -u 服务名 -n 100
tail -n 100 /var/log/nginx/error.log
```

如果是反向代理服务，还应检查：

- upstream 地址是否正确；
- 后端端口是否监听；
- 后端服务是否启动；
- 防火墙是否阻断；
- Nginx 配置是否写错。

## Referer 分析

Referer 表示请求来源页面。

例如：

```text
"https://example.com/"
```

如果某个外部域名频繁出现在 Referer 中，并且请求的是本站图片、音乐、视频等静态资源，可能存在资源盗链或外部页面引用。

搜索指定 Referer：

```bash
grep "example.com" /var/log/nginx/access.log
```

统计某个 Referer 请求了哪些资源：

```bash
grep "example.com" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr | head
```

如果大量请求的是大文件，例如：

```text
/assets/music/track-01.flac
```

可能会消耗服务器流量。静态资源较大时，可以考虑 Nginx 防盗链、限速或 CDN。

## 206 Partial Content

音频、视频或大文件访问时，经常会出现：

```text
206
```

`206 Partial Content` 表示客户端只请求了文件的一部分。

这在以下场景中很常见：

- 浏览器播放音频；
- 视频拖动进度条；
- 断点续传；
- 分段下载。

因此，`206` 本身不是错误。需要结合请求路径和访问频率判断是否正常。

## 未知域名访问的原因

公网服务器可能收到不属于自己域名的请求。常见原因包括：

- 他人域名 DNS 误配置到当前服务器 IP；
- 域名旧记录未清理，而服务器 IP 被重新分配；
- 外部域名临时指向该 IP 做测试；
- 资源盗链；
- 镜像站或 SEO 测试；
- 自动化扫描器探测 Host 配置。

如果 Nginx 没有限制 Host，未知域名可能会命中默认站点，从而显示同一个网站内容。

典型链路：

```text
未知域名解析到服务器 IP
  ↓
请求进入 Nginx
  ↓
Nginx 没有匹配到专门的 server_name
  ↓
使用默认 server
  ↓
返回默认站点内容
```

这类问题不一定代表服务器被入侵，但应该通过 Nginx 配置限制。

## 使用 DNS 和 WHOIS 排查未知域名

查看域名解析：

```bash
nslookup www.example.com
```

如果返回的是当前服务器 IP，说明该域名确实解析到了当前服务器。

查看域名 NS 记录：

```bash
nslookup -type=ns example.com
```

NS 记录可以判断域名使用了哪个 DNS 服务商。

查看 WHOIS 信息：

```bash
whois example.com
```

常见关注字段：

| 字段 | 含义 |
|---|---|
| `Registrar` | 域名注册商 |
| `Registrar URL` | 注册商网站 |
| `Creation Date` | 注册时间 |
| `Registry Expiry Date` | 过期时间 |
| `Name Server` | DNS 服务器 |
| `Registrar Abuse Contact Email` | 滥用投诉邮箱 |

很多域名会隐藏注册人姓名、邮箱和电话，因此 WHOIS 通常只能查到注册商、DNS 服务商和投诉渠道，不能直接查到真实个人身份。

## Nginx 限制未知 Host

可以通过 `server_name` 和 Host 判断，只允许自己的域名访问主站。

HTTP 未知域名可直接拒绝：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 444;
}
```

`444` 是 Nginx 特有状态，表示直接断开连接，不返回响应内容。

主站 HTTP 请求跳转 HTTPS：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    return 301 https://$host$request_uri;
}
```

HTTPS 主站：

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name example.com www.example.com;

    if ($host !~ ^(example\.com|www\.example\.com)$) {
        return 444;
    }

    root /var/www/site;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

需要注意：

- 同一个 IP 和端口只能有一个 `default_server`；
- Certbot 生成的配置不要随意破坏；
- 修改 Nginx 配置后必须先执行 `nginx -t`；
- 只有配置检查成功后再 reload。

检查配置：

```bash
sudo nginx -t
```

重载 Nginx：

```bash
sudo systemctl reload nginx
```

如果出现：

```text
duplicate default server
```

说明同一个端口上配置了多个 `default_server`，需要删除重复项。

查找所有 `default_server`：

```bash
sudo grep -R "default_server" /etc/nginx/sites-enabled /etc/nginx/sites-available
```

## 基础安全建议

公网 Web 服务建议遵循以下原则：

- 只开放必要端口；
- 不部署不需要的 PHP、phpMyAdmin、WordPress；
- 不把 `.env`、私钥、数据库备份放到 Web 根目录；
- 使用 HTTPS；
- SSH 使用密钥登录；
- 禁止 root 远程登录；
- 保持系统和 Nginx 更新；
- 定期查看 `access.log` 和 `error.log`；
- 对异常 IP、异常路径和外部 Referer 保持观察；
- 对大文件资源考虑防盗链或限速。

## 小结

Nginx 日志分析的基本思路是：

```text
先看状态码分布
再看异常路径
再看高频 IP
再看 Referer
再结合 error.log 定位原因
最后通过 Nginx 配置收敛风险
```

对于公网服务器，扫描请求、异常路径和未知域名访问都很常见。判断问题时应避免单看某一条日志，而要结合状态码、访问频率、请求路径、DNS 解析和 Nginx 配置综合判断。
