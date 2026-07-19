export type ProjectStage = {
	name: string;
	items: string[];
};

export type ProjectItem = {
	slug: string;
	name: string;
	subtitle: string;
	status: string;
	progress: number;
	updatedAt: string;
	repositoryUrl?: string;
	description: string;
	projectDescription: string;
	mainWork: string[];
	projectResult: string;
	highlights: string[];
	completedStages: ProjectStage[];
	nextStages: string[];
	skills: string[];
};

export const projects: ProjectItem[] = [
	{
		slug: "server-sentinel",
		name: "ServerSentinel",
		subtitle: "轻量级服务器巡检与 Nginx 日志分析工具",
		status: "进行中",
		progress: 65,
		updatedAt: "2026-07-19",
		repositoryUrl:
			"https://github.com/gaotiancheng1217-netizen/server-sentinel",
		description:
			"这是一个面向 Linux 运维 / SRE 入门方向的实践项目，用 Shell、Python、Nginx 日志分析、定时任务和自动化测试，逐步构建可复用的服务器巡检与日报生成工具。",
		projectDescription:
			"基于 Shell、Python 与 Linux 运维工具链构建一套轻量级服务器巡检与日志分析工具，覆盖网站可用性检查、Nginx 服务状态检查、系统资源巡检、Nginx access.log 分析、异常请求识别、Markdown 巡检日报生成和自动化测试流程，为后续 Docker 化部署和 AI 日志分析打基础。",
		mainWork: [
			"编写 Shell 健康检查脚本，检查网站 HTTP 状态码、Nginx 服务状态、磁盘使用率和内存使用率。",
			"配置 crontab 定时任务，实现巡检脚本按固定周期自动执行，并将结果写入日志文件。",
			"编写 Nginx access.log 分析脚本，统计访问总量、状态码分布、Top IP、404 高频路径和 Referer 来源。",
			"识别 .php、wp-content、admin、.env、.git 等常见扫描特征，用于区分正常访问、失效链接和自动化扫描请求。",
			"编写 Python 报告生成器，读取健康检查日志，统计 OK、WARNING、ERROR 数量，提取异常项并生成按日期命名的 Markdown 日报。",
			"准备固定样本日志和自动测试脚本，验证日志分析结果和报告生成结果是否符合预期，避免后续修改破坏统计逻辑。",
			"接入 GitHub Actions，在每次 push 或 Pull Request 时自动执行 Shell 语法检查、日志分析测试、Python 语法检查和报告生成测试。",
		],
		projectResult:
			"完成一套可持续迭代的服务器巡检、Nginx 日志分析与 Markdown 日报生成工具雏形，掌握 Shell 脚本、Python 标准库、Nginx 日志排查、定时任务、自动化测试和 CI 基础流程，并形成后续扩展 Docker 部署和 AI 异常分析的项目结构。",
		highlights: [
			"Shell 健康检查脚本已完成基础版本",
			"Nginx access.log 分析脚本已完成第一版",
			"Python Markdown 日报生成器已完成第一版",
			"已加入固定样本日志与 Shell / Python 自动测试",
			"已接入 GitHub Actions 自动执行 CI 检查",
		],
		completedStages: [
			{
				name: "v1：Shell 服务器健康检查",
				items: [
					"检查网站 HTTP 状态码",
					"检查 Nginx 服务状态",
					"检查磁盘与内存使用情况",
					"输出巡检日志",
					"通过 crontab 定时执行",
				],
			},
			{
				name: "v2：Nginx 日志分析",
				items: [
					"统计访问总量",
					"统计 HTTP 状态码分布",
					"统计访问最多的 IP",
					"统计 404 高频路径",
					"识别 .php、wp-content、admin、.env、.git 等扫描特征",
					"统计 Referer 来源",
					"使用测试日志验证分析结果",
				],
			},
			{
				name: "v3：Python 巡检日报生成",
				items: [
					"读取健康检查日志",
					"统计 OK、WARNING、ERROR 数量",
					"识别格式异常日志行",
					"单独列出告警和错误项目",
					"生成 reports/daily-report-YYYY-MM-DD.md",
					"使用 unittest 验证报告结构和统计结果",
					"将 Python 语法检查和报告测试加入 GitHub Actions",
				],
			},
		],
		nextStages: [
			"v4：使用 Docker 封装工具运行环境",
			"v5：加入 AI 日志分析助手，生成排障建议",
			"v6：整理 README、示例报告和简历项目描述",
		],
		skills: [
			"Linux",
			"Shell",
			"Nginx",
			"日志分析",
			"crontab",
			"GitHub Actions",
			"Python",
			"Docker",
		],
	},
];
