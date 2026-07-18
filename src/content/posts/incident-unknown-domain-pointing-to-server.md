---
title: "一次未知域名解析到服务器的排查记录"
published: 2026-07-18
description: "记录一次陌生域名解析到个人服务器并显示站点内容的排查过程，包括日志发现、DNS 查询、WHOIS 查询、Nginx 配置调整和验证结果。"
tags: ["Nginx", "DNS", "安全", "事件记录", "故障排查"]
category: "运维记录"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

这是一篇事件记录。主要记录一次公网服务器上遇到的异常访问现象，以及从日志、DNS、WHOIS、Nginx 配置几个角度逐步确认和处理问题的过程。

## 事件起因

在查看 Nginx `access.log` 时，发现日志中出现了一个陌生 Referer：

```text
https://www.xinlanting.com/
```

同时，该 Referer 对站点中的多个静态资源发起了请求，例如：

```text
GET /_astro/...webp HTTP/1.1" 200
GET /pagefind/pagefind.js HTTP/1.1" 200
GET /_astro/client.svelte...js HTTP/1.1" 200
GET /assets/music/track-01.flac HTTP/1.1" 206
```

这些请求有几个特点：

- 请求路径不是随机扫描路径，而是站点真实存在的静态资源；
- `/_astro/` 是 Astro 构建生成的资源目录；
- `/pagefind/pagefind.js` 是站内搜索相关资源；
- `/assets/music/track-01.flac` 是音乐文件；
- 状态码 `200` 表示资源成功返回；
- 状态码 `206` 表示音频文件被分段请求。

这说明该域名并不是单纯扫了一个不存在路径，而是成功加载了站点资源。

## 初步判断

最开始需要区分两种情况：

```text
1. 对方网站盗链了本站资源
2. 对方域名直接解析到了当前服务器
```

如果只是盗链，通常表现为外站页面引用图片、音频、视频等资源。

如果是域名解析到了服务器，则访问对方域名时，可能会直接显示当前服务器上的默认站点。

实际访问：

```text
https://www.xinlanting.com/
```

发现该地址能够显示当前博客页面。因此问题更像是：

```text
对方域名解析到了当前服务器 IP
Nginx 未限制未知 Host
未知域名命中了默认站点
```

## DNS 查询

使用 `nslookup` 查询该域名：

```bash
nslookup www.xinlanting.com
```

结果显示：

```text
Name:    www.xinlanting.com
Address: 119.28.14.125
```

`119.28.14.125` 正是当前服务器的公网 IP。

这一步确认了：

```text
www.xinlanting.com 的 DNS A 记录指向了当前服务器
```

也就是说，不是 Nginx 主动绑定了这个域名，而是对方域名在 DNS 层面指向了当前服务器。

## NS 记录查询

继续查询该域名的 NS 记录：

```bash
nslookup -type=ns xinlanting.com
```

结果显示：

```text
xinlanting.com nameserver = dns13.hichina.com.
xinlanting.com nameserver = dns14.hichina.com.
```

这说明该域名使用的是阿里云万网的 DNS 服务。

## WHOIS 查询

继续查询 WHOIS：

```bash
whois xinlanting.com
```

关键信息如下：

```text
Domain Name: XINLANTING.COM
Registrar: Alibaba Cloud Computing Ltd. d/b/a HiChina (www.net.cn)
Registrar WHOIS Server: grs-whois.hichina.com
Registrar URL: http://wanwang.aliyun.com
Creation Date: 2026-03-24T02:48:15Z
Registry Expiry Date: 2027-03-24T02:48:15Z
Name Server: DNS13.HICHINA.COM
Name Server: DNS14.HICHINA.COM
Registrar Abuse Contact Email: DomainAbuse@service.aliyun.com
Registrant State/Province: shan dong
Registrant Country: CN
```

WHOIS 能确认注册商、DNS 服务商、注册时间、过期时间和滥用投诉邮箱，但没有公开注册人姓名、电话和邮箱。

因此，这一步只能确认：

```text
域名注册商是阿里云万网 / HiChina
DNS 也托管在阿里云万网
注册地区显示为山东，中国
普通查询无法确认真实注册人身份
```

## 可能原因

这类情况不一定是明确攻击，常见原因包括：

- DNS A 记录误配置；
- 域名旧记录未清理，而服务器 IP 被云厂商重新分配；
- 对方临时将域名指向某个公网 IP 做测试；
- 外站试图借用当前服务器内容做展示；
- 资源盗链或镜像站测试；
- 自动化扫描器探测 Host 配置。

从日志看，请求路径包含真实静态资源，并且返回了 `200` / `206`。这说明未知域名确实能够触达站点资源。

但没有发现它能修改服务器内容，也没有发现敏感文件返回 `200`，因此不能直接判断为服务器被入侵。

更准确的结论是：

```text
未知域名解析到了服务器 IP
Nginx 对未知 Host 没有拦截
导致未知域名可以显示默认站点内容
```

## Nginx 配置问题

Nginx 根据 `server_name` 匹配请求 Host。

如果没有匹配到对应的 `server_name`，请求可能落到默认 `server` 块。

因此，当一个陌生域名解析到服务器 IP 时，如果 Nginx 没有显式拒绝未知 Host，就可能出现：

```text
陌生域名访问服务器
  ↓
Nginx 找不到专门匹配项
  ↓
使用默认站点
  ↓
返回博客页面
```

这就是本次事件的核心原因。

## 处理方式

处理目标是：

```text
只允许 tiancheng-blog.com 和 www.tiancheng-blog.com 正常访问
其他 Host 直接拒绝
```

Nginx 配置中增加未知 Host 限制。

HTTP 未知 Host：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 444;
}
```

主域名 HTTP 跳转 HTTPS：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name tiancheng-blog.com www.tiancheng-blog.com;

    return 301 https://$host$request_uri;
}
```

HTTPS 主站中增加 Host 判断：

```nginx
if ($host !~ ^(tiancheng-blog\.com|www\.tiancheng-blog\.com)$) {
    return 444;
}
```

`444` 是 Nginx 特有状态，表示直接断开连接，不返回响应内容。

## 配置过程中遇到的问题

修改配置时曾遇到：

```text
a duplicate default server for 0.0.0.0:80
```

原因是同一个 IP 和端口上出现了多个：

```nginx
listen 80 default_server;
```

Nginx 不允许同一个地址和端口存在多个默认 server。

解决方式是移除重复的 `default_server`，并用：

```bash
sudo grep -R "default_server" /etc/nginx/sites-enabled /etc/nginx/sites-available
```

检查是否还有重复配置。

这也说明，修改 Nginx 配置后不能直接 reload，必须先执行：

```bash
sudo nginx -t
```

只有配置检查通过后，才能执行：

```bash
sudo systemctl reload nginx
```

## 验证结果

验证主域名：

```bash
curl -I https://tiancheng-blog.com
```

返回：

```text
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
```

说明主站访问正常。

验证未知域名：

```bash
curl -I https://www.xinlanting.com
```

返回：

```text
curl: (60) SSL: no alternative certificate subject name matches target host name 'www.xinlanting.com'
```

这说明该域名无法通过正常 HTTPS 校验访问站点。

继续使用忽略证书校验的方式测试：

```bash
curl -k -I https://www.xinlanting.com
```

如果得到空响应、连接断开或无法正常显示站点内容，就说明 Nginx 对未知 Host 的限制已经生效。

最终结果：

```text
tiancheng-blog.com 正常访问
www.xinlanting.com 仍然解析到服务器 IP
但无法正常显示博客内容
```

## 事件结论

这次事件的关键点是：

```text
未知域名解析到服务器 IP
不等于服务器被入侵
但如果 Nginx 没有限制 Host
未知域名可能显示默认站点
```

真正需要处理的是 Nginx 的访问边界：

```text
允许自己的域名
拒绝未知 Host
```

有效的做法是在服务器侧关闭这个入口。

## 后续观察

后续可以继续观察：

```bash
grep "xinlanting.com" /var/log/nginx/access.log
```

以及统计未知 Referer：

```bash
awk '{print $11}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```

如果仍有大量异常请求，可以进一步考虑：

- 防盗链；
- Nginx rate limit；
- fail2ban；
- CDN / WAF；
- 向域名注册商或 DNS 服务商提交滥用投诉；
- 向云服务商提交工单说明未知域名恶意解析到服务器。

## 复盘

这次事件有几个值得保留的经验：

1. 公网服务器暴露后，被扫描和被异常域名访问是常见现象。
2. 日志分析不能只看路径是否奇怪，还要看状态码、Referer 和请求频率。
3. `404` 通常表示扫描未命中，`200` 才需要重点关注。
4. `206` 常见于音频、视频和大文件分段请求，不一定是错误。
5. `nslookup` 可以确认域名是否真的解析到当前服务器。
6. WHOIS 可以查注册商和投诉邮箱，但通常查不到真实注册人。
7. Nginx 应该限制 Host，避免未知域名命中默认站点。
8. 修改 Nginx 配置后必须先 `nginx -t`，再 reload。

