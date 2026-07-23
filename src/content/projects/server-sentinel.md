---
name: "ServerSentinel"
subtitle: "轻量级服务器巡检与 Nginx 日志分析工具"
status: "进行中"
progress: 82
updated: 2026-07-23
repositoryUrl: "https://github.com/gaotiancheng1217-netizen/server-sentinel"
description: "基于 Shell、Python、Nginx 日志分析、定时任务、Docker 和自动化测试构建的轻量级服务器巡检、日报生成与异常结构化分析工具。"
projectDescription: "基于 Shell、Python、Docker 与 Linux 运维工具链构建一套轻量级服务器巡检与日志分析工具，覆盖网站可用性检查、Nginx 服务状态检查、系统资源巡检、Nginx access.log 分析、异常请求识别、Markdown 巡检日报生成、容器化运行和结构化异常提取，为后续接入 AI 日志分析助手准备稳定的数据层。"
mainWork:
  - "编写 Shell 健康检查脚本，检查网站 HTTP 状态码、Nginx 服务状态、磁盘使用率和内存使用率。"
  - "配置 crontab 定时任务，实现巡检脚本按固定周期自动执行，并将结果写入日志文件。"
  - "编写 Nginx access.log 分析脚本，统计访问总量、状态码分布、Top IP、404 高频路径和 Referer 来源。"
  - "识别 .php、wp-content、admin、.env、.git 等常见扫描特征，用于区分正常访问、失效链接和自动化扫描请求。"
  - "编写 Python 报告生成器，读取健康检查日志，统计 OK、WARNING、ERROR 数量，提取异常项并生成按日期命名的 Markdown 日报。"
  - "准备固定样本日志和自动测试脚本，验证日志分析结果和报告生成结果是否符合预期，避免后续修改破坏统计逻辑。"
  - "接入 GitHub Actions，在每次 push 或 Pull Request 时自动执行 Shell 语法检查、日志分析测试、Python 语法检查和报告生成测试。"
  - "编写 Dockerfile 与 compose.yaml，将 Python 日报生成器封装为一次性运行的容器任务，并通过挂载 logs 与 reports 目录读写运行数据。"
  - "补充 Docker 自动测试，验证镜像构建、容器运行、报告生成、挂载目录和时区配置是否符合预期。"
  - "编写结构化异常提取脚本，从健康检查日志中提取 WARNING / ERROR，按磁盘、内存、服务状态、可用性和未知类型进行分类，并输出 provider-neutral JSON。"
projectResult: "完成一套可持续迭代的服务器巡检、Nginx 日志分析、Markdown 日报生成、Docker 化运行与结构化异常提取工具雏形。当前项目已经具备 Shell 巡检、日志分析、Python 报告、容器化任务、固定样本测试和 GitHub Actions 自动验证能力，并为后续 AI 日志分析预留了稳定的 JSON 数据接口。"
highlights:
  - "Shell 健康检查脚本已完成基础版本"
  - "Nginx access.log 分析脚本已完成第一版"
  - "Python Markdown 日报生成器已完成第一版"
  - "Docker 化报告生成器已完成基础版本"
  - "结构化异常提取脚本已完成第一版"
  - "已加入固定样本日志与 Shell / Python 自动测试"
  - "已接入 GitHub Actions 自动执行 Shell、Python 与 Docker 检查"
completedStages:
  - name: "v1：Shell 服务器健康检查"
    items:
      - "检查网站 HTTP 状态码"
      - "检查 Nginx 服务状态"
      - "检查磁盘与内存使用情况"
      - "输出巡检日志"
      - "通过 crontab 定时执行"
  - name: "v2：Nginx 日志分析"
    items:
      - "统计访问总量"
      - "统计 HTTP 状态码分布"
      - "统计访问最多的 IP"
      - "统计 404 高频路径"
      - "识别 .php、wp-content、admin、.env、.git 等扫描特征"
      - "统计 Referer 来源"
      - "使用测试日志验证分析结果"
  - name: "v3：Python 巡检日报生成"
    items:
      - "读取健康检查日志"
      - "统计 OK、WARNING、ERROR 数量"
      - "识别格式异常日志行"
      - "单独列出告警和错误项目"
      - "生成 reports/daily-report-YYYY-MM-DD.md"
      - "使用 unittest 验证报告结构和统计结果"
      - "将 Python 语法检查和报告测试加入 GitHub Actions"
  - name: "v4：Docker 化部署"
    items:
      - "编写 Dockerfile，基于 python:3.12-slim 封装日报生成器"
      - "使用非 root 用户运行容器任务"
      - "通过 .dockerignore 排除真实日志、报告、Git 元数据和本地环境文件"
      - "编写 compose.yaml，挂载 logs 只读目录和 reports 输出目录"
      - "支持通过 Docker Compose 生成当天或指定日期的巡检日报"
      - "编写 tests/test-docker.sh 验证镜像构建和容器报告生成结果"
      - "将 Docker Compose 配置验证和 Docker 测试加入 GitHub Actions"
  - name: "v5：AI 日志分析数据准备"
    items:
      - "编写 src/extract_anomalies.py，从健康检查日志中提取 WARNING 和 ERROR"
      - "按照 disk、memory、service、availability、unknown 对异常进行基础分类"
      - "生成 reports/anomalies-YYYY-MM-DD.json 结构化异常文件"
      - "输出 schema_version、report_date、summary、anomalies 等字段，为后续 AI 分析提供稳定输入"
      - "补充单元测试，覆盖异常分类、汇总字段、JSON 数据契约、无异常场景和未知异常类型"
      - "当前版本不向外部 AI 服务发送真实数据，先完成本地数据整理和接口边界设计"
nextStages:
  - "设计 AI Prompt 与响应 JSON Schema"
  - "使用本地模拟响应验证 AI 分析流程"
  - "接入可替换的 AI API，基于结构化异常生成排障建议"
  - "整理 README、示例报告和项目演示说明"
skills:
  - "Linux"
  - "Shell"
  - "Nginx"
  - "日志分析"
  - "crontab"
  - "GitHub Actions"
  - "Python"
  - "Docker"
  - "Docker Compose"
  - "JSON"
  - "unittest"
---

ServerSentinel 是一套轻量级服务器巡检与 Nginx 日志分析工具，主要用于检查网站可用性、服务运行状态、系统资源使用情况，并对 Nginx 访问日志中的异常请求进行基础识别。

项目由 Shell 巡检脚本、Nginx 日志分析脚本、Python 报告生成器、Docker 运行环境和自动化测试流程组成。Shell 脚本负责采集运行状态，日志分析脚本负责提取访问统计与异常特征，Python 模块负责生成 Markdown 日报与结构化 JSON 数据。

当前版本已覆盖 HTTP 状态检查、Nginx 服务检查、磁盘与内存巡检、访问日志统计、扫描请求识别、巡检日报生成、容器化运行和 GitHub Actions 自动验证等功能。
