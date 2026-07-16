---
title: "GitHub Actions 自动部署与 CI/CD 入门"
published: 2026-07-16
description: "归纳 GitHub Actions 自动部署静态网站的基本流程，包括 workflow、job、step、Secrets、SSH 密钥、构建、上传、服务器部署和常见故障排查。"
tags: ["GitHub Actions", "CI/CD", "自动化部署", "Linux", "运维"]
category: "DevOps"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

CI/CD 是运维、DevOps 和 SRE 工作中非常重要的一类自动化流程。它的核心目标是减少重复手动操作，让代码从提交到构建、测试、部署尽可能自动完成。

对于静态网站部署场景，传统流程通常是：

```text
本地修改文章或代码
  ↓
本地执行 pnpm build
  ↓
压缩 dist 目录
  ↓
手动上传服务器
  ↓
服务器手动解压
  ↓
修复权限
  ↓
reload Nginx
```

GitHub Actions 可以将这条流程自动化：

```text
git push
  ↓
GitHub Actions 自动构建
  ↓
上传构建产物到服务器
  ↓
服务器自动替换旧版本
  ↓
Nginx 重新加载
  ↓
网站完成更新
```

本文整理 GitHub Actions 自动部署的核心概念、配置结构和常见排障方法。

## CI/CD 是什么

CI/CD 通常包含两个部分：

| 名称 | 含义 | 作用 |
| --- | --- | --- |
| CI | Continuous Integration，持续集成 | 自动安装依赖、检查、测试、构建 |
| CD | Continuous Deployment / Delivery，持续部署或持续交付 | 自动发布构建产物到目标环境 |

在个人静态网站场景中，可以简单理解为：

```text
CI：自动 pnpm install 和 pnpm build
CD：自动上传 dist 并部署到服务器
```

CI/CD 的价值在于：

- 减少手动部署步骤；
- 降低操作失误概率；
- 每次发布流程一致；
- 构建失败时能及时发现；
- 部署过程有日志可追踪。

## GitHub Actions 的核心概念

### Workflow

Workflow 是一整套自动化流程，通常写在：

```text
.github/workflows/deploy.yml
```

一个仓库可以有多个 workflow，例如：

```text
build.yml     用于检查和构建
deploy.yml    用于部署
```

### Event

Event 是触发 workflow 的事件。

例如：

```yaml
on:
  push:
    branches: [master]
```

表示当代码 push 到 `master` 分支时，自动触发该 workflow。

也可以添加：

```yaml
workflow_dispatch:
```

表示允许在 GitHub 页面手动点击运行。

### Job

Job 是 workflow 里的一个任务。

例如：

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
```

表示定义一个名为 `deploy` 的任务，并在 GitHub 提供的 Ubuntu 环境中运行。

### Step

Step 是 job 中按顺序执行的具体步骤。

例如：

```yaml
- name: Build site
  run: pnpm build
```

表示执行一次构建命令。

## Secrets 的作用

自动部署通常需要连接服务器，这会涉及敏感信息：

- 服务器 IP；
- 服务器用户名；
- SSH 私钥；
- 访问令牌；
- 密码。

这些内容不能直接写进代码仓库，否则会产生安全风险。

GitHub 提供 Secrets 用于保存敏感信息：

```text
Settings
  ↓
Secrets and variables
  ↓
Actions
  ↓
Repository secrets
```

常见配置：

| Secret 名称 | 作用 |
| --- | --- |
| `SERVER_HOST` | 服务器 IP 或域名 |
| `SERVER_USER` | SSH 登录用户 |
| `SERVER_SSH_KEY` | SSH 私钥内容 |

在 workflow 中使用：

```yaml
host: ${{ secrets.SERVER_HOST }}
username: ${{ secrets.SERVER_USER }}
key: ${{ secrets.SERVER_SSH_KEY }}
```

这样既能让 Actions 使用这些信息，又不会把敏感内容暴露在仓库文件里。

## SSH 密钥登录原理

GitHub Actions 需要通过 SSH 登录服务器。

SSH 密钥通常包含两个文件：

```text
私钥：github_actions_deploy
公钥：github_actions_deploy.pub
```

它们的用途不同：

| 文件 | 放置位置 | 说明 |
| --- | --- | --- |
| 私钥 | GitHub Secrets | GitHub Actions 用它证明身份 |
| 公钥 | 服务器 `~/.ssh/authorized_keys` | 服务器用它判断是否允许登录 |

生成密钥示例：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
```

将公钥写入服务器：

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

本地测试：

```bash
ssh -i ~/.ssh/github_actions_deploy ubuntu@服务器IP
```

如果本地测试成功，说明服务器已经信任这把公钥。

## 自动部署 workflow 示例

下面是一个静态网站部署到云服务器的 workflow 结构：

```yaml
name: Deploy to Tencent Cloud

on:
  push:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.14.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Build site
        run: pnpm build

      - name: Pack dist
        run: tar -czf firefly-dist.tar.gz -C dist .

      - name: Upload package to server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          source: firefly-dist.tar.gz
          target: /tmp

      - name: Deploy on server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            set -e
            WEB_DIR="/var/www/firefly"
            PACKAGE="/tmp/firefly-dist.tar.gz"
            RELEASE_DIR="/tmp/firefly-release"

            rm -rf "$RELEASE_DIR"
            mkdir -p "$RELEASE_DIR"
            tar -xzf "$PACKAGE" -C "$RELEASE_DIR"

            sudo mkdir -p "$WEB_DIR"
            sudo rm -rf "$WEB_DIR"/*
            sudo cp -r "$RELEASE_DIR"/. "$WEB_DIR"/

            sudo find "$WEB_DIR" -type d -exec chmod 755 {} \;
            sudo find "$WEB_DIR" -type f -exec chmod 644 {} \;

            sudo nginx -t
            sudo systemctl reload nginx
            curl -I https://example.com

            rm -rf "$RELEASE_DIR" "$PACKAGE"
```

## 部署流程拆解

### 拉取代码

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```

GitHub Actions 运行时会创建一个临时环境。这个步骤负责把仓库代码拉到临时环境中。

### 安装 pnpm 和 Node.js

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4

- name: Setup Node.js
  uses: actions/setup-node@v4
```

静态网站通常需要 Node.js 和 pnpm 才能安装依赖、执行构建。

### 安装依赖

```yaml
run: pnpm install --no-frozen-lockfile
```

安装 `package.json` 中声明的依赖。

如果项目的 lockfile 与 package 配置不一致，`--no-frozen-lockfile` 可以避免构建直接失败，但长期更推荐保持 lockfile 同步。

### 构建网站

```yaml
run: pnpm build
```

构建完成后会生成：

```text
dist/
```

这是最终需要部署到服务器的静态网站文件。

### 打包构建产物

```yaml
run: tar -czf firefly-dist.tar.gz -C dist .
```

将 `dist` 目录内容打包成：

```text
firefly-dist.tar.gz
```

这里使用 `-C dist .` 的原因是只打包 `dist` 里面的内容，而不是把整个 `dist` 文件夹套进去。

### 上传服务器

```yaml
uses: appleboy/scp-action@v0.1.7
```

这个步骤通过 SSH/SCP 将压缩包上传到服务器：

```text
/tmp/firefly-dist.tar.gz
```

### 服务器部署

```yaml
uses: appleboy/ssh-action@v1.0.3
```

这个步骤通过 SSH 登录服务器，执行部署脚本。

核心流程：

```bash
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$PACKAGE" -C "$RELEASE_DIR"

sudo mkdir -p "$WEB_DIR"
sudo rm -rf "$WEB_DIR"/*
sudo cp -r "$RELEASE_DIR"/. "$WEB_DIR"/

sudo nginx -t
sudo systemctl reload nginx
curl -I https://example.com
```

含义：

1. 清理临时发布目录；
2. 解压新构建产物；
3. 清空旧网站文件；
4. 复制新文件到 Web 目录；
5. 修复权限；
6. 检查 Nginx 配置；
7. 重新加载 Nginx；
8. 发起 HTTP 检查。

## 常见错误与排查

### ssh: no key found

常见报错：

```text
ssh.ParsePrivateKey: ssh: no key found
```

通常表示 GitHub Secrets 中的私钥内容不正确。

常见原因：

- 将 `.pub` 公钥误填到了 `SERVER_SSH_KEY`；
- 私钥没有从 `BEGIN` 复制到 `END`；
- 私钥内容换行丢失；
- Secret 名称写错。

正确的 `SERVER_SSH_KEY` 应该包含：

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

而服务器的 `authorized_keys` 中应放置公钥：

```text
ssh-ed25519 AAAA... github-actions-deploy
```

### Permission denied

常见原因：

- 公钥没有写入服务器 `~/.ssh/authorized_keys`；
- `authorized_keys` 权限不正确；
- SSH 用户名写错；
- Secret 中的私钥和服务器上的公钥不是一对；
- 服务器安全策略禁止该用户登录。

排查：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

本地测试：

```bash
ssh -i ~/.ssh/github_actions_deploy ubuntu@服务器IP
```

本地能登录后，再检查 GitHub Secrets。

### sudo 需要密码

部署脚本中常见命令：

```bash
sudo rm -rf /var/www/firefly/*
sudo systemctl reload nginx
```

如果服务器要求输入 sudo 密码，GitHub Actions 无法交互输入，部署会失败。

解决方向：

- 给部署用户配置必要的免密 sudo 权限；
- 将 Web 目录权限调整为部署用户可写；
- 将需要 sudo 的操作封装到服务器本地脚本中，并为特定脚本配置免密执行。

权限配置应遵循最小权限原则，不应随意给所有命令无限制免密 sudo。

### 构建失败

如果失败发生在：

```text
pnpm install
pnpm build
```

需要查看 Actions 日志。

常见原因：

- 依赖安装失败；
- Node.js 版本不匹配；
- lockfile 不一致；
- Markdown frontmatter 格式错误；
- 构建时访问外部资源失败。

排查顺序：

```text
本地 pnpm build 是否成功
Actions 中 Node/pnpm 版本是否一致
报错发生在哪一步
是否是网络资源请求失败
```

### 部署成功但网站没更新

常见原因：

- push 的不是触发分支；
- Workflow 没有运行；
- 构建产物没有复制到正确目录；
- Nginx root 指向的目录不是部署目录；
- 浏览器缓存旧页面；
- CDN 或代理缓存。

排查：

```bash
ls -lah /var/www/firefly
curl -I https://example.com
sudo nginx -T | grep -n "root"
```

## 自动部署的安全注意事项

自动部署涉及服务器权限，应注意：

- 私钥只放在 GitHub Secrets 中；
- 不要把私钥提交到仓库；
- 为 GitHub Actions 使用单独 SSH key；
- 不建议使用 root 用户部署；
- 服务器上只开放必要端口；
- sudo 权限尽量限制到必要命令；
- 定期检查 GitHub Secrets 和服务器 `authorized_keys`。

## 运维视角下的意义

GitHub Actions 自动部署不仅是“省事”，更重要的是建立标准化发布流程。

手动部署的问题在于：

```text
容易漏步骤
容易复制错路径
难以追踪每次发布内容
失败后不知道卡在哪一步
```

自动部署的优势在于：

```text
每次流程一致
每一步都有日志
失败点清晰
可以回溯提交记录
可以逐步加入检查和测试
```

这也是 DevOps 和 SRE 的核心思想之一：把重复、容易出错的人工操作变成可追踪、可复现、可自动执行的流程。

## 小结

GitHub Actions 自动部署静态网站的核心链路是：

```text
push 代码
  ↓
触发 workflow
  ↓
安装依赖
  ↓
构建 dist
  ↓
打包构建产物
  ↓
通过 SSH 上传服务器
  ↓
服务器替换旧文件
  ↓
检查 Nginx
  ↓
重载服务
  ↓
健康检查
```

掌握这条链路后，可以继续扩展：

- 部署前运行 `pnpm check`；
- 部署失败时发送通知；
- 增加回滚机制；
- 使用独立发布目录和软链接切换版本；
- 将部署流程封装成服务器本地 `deploy.sh`；
- 扩展到 Docker Compose 或 Kubernetes 部署。

CI/CD 的关键不是记住某个 YAML 写法，而是理解每一步在替代哪一个手动操作。只要能把手动部署链路拆开，再逐步写进 workflow，就能完成可靠的自动化部署。
