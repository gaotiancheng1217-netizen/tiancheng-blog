---
title: "数据仓库桥接表：多对多关系与指标分摊"
published: 2026-08-19
description: "介绍数据仓库中的事实表、维度表、数据粒度和桥接表，说明如何使用权重因子处理多对多关系并避免指标重复统计。"
tags: ["SQL", "数据仓库", "桥接表", "维度建模", "多对多关系"]
category: "数据库"
lang: "zh_CN"
author: "TianCheng"
draft: false
---

关系型业务数据库通常按照业务实体保存数据，而数据仓库更关注统计分析。例如，运输系统需要记录车辆、行程、仓库和门店；分析系统则需要回答每辆车产生了多少配送成本、每个门店应分摊多少成本等问题。

当一个业务事件同时关联多个分析对象时，直接连接事实表与维度表可能造成指标重复计算。桥接表用于表达这种多对多关系，并可配合权重因子完成指标分摊。

## 业务数据库与数据仓库

业务数据库通常服务于实时新增、修改和查询，常称为 OLTP。数据仓库主要服务于历史统计、聚合和报表分析，常称为 OLAP。

| 对比项 | 业务数据库 | 数据仓库 |
| --- | --- | --- |
| 主要目标 | 支撑业务操作 | 支撑分析与决策 |
| 常见操作 | `INSERT`、`UPDATE`、单条查询 | 聚合、分组、多表分析 |
| 数据结构 | 按业务实体规范化 | 按事实和维度组织 |
| 数据范围 | 当前业务数据 | 历史和汇总数据 |
| 查询特点 | 范围较小、频率较高 | 扫描范围较大、聚合较多 |

数据仓库不是简单复制业务表，而是根据分析目标重新组织数据。

## 事实表、维度表与度量值

### 事实表

事实表记录可被统计的业务事件。每一行代表一个明确粒度的事实，并包含外键和数值型指标。

配送场景中的事实表可以包含：

```text
行程键
车辆键
日期键
总里程
每公里成本
总配送成本
```

其中总配送成本可以按照下面的规则计算：

```text
总配送成本 = 总里程 × 每公里成本
```

### 维度表

维度表保存分析事实时使用的描述性信息，例如：

- 车辆维度：车辆编号、容量、载重类别；
- 行程维度：行程日期、季节、路线；
- 门店维度：门店名称、地址；
- 日期维度：年、季度、月份、星期。

### 数据粒度

粒度表示事实表中一行数据具体代表什么。建立事实表之前必须先确定粒度。

例如：

```text
一行代表一次行程
一行代表一次行程到达一个门店
一行代表某辆车每天的汇总数据
```

不同粒度不能随意混合，否则聚合结果容易出现重复统计。

## 为什么需要桥接表

假设一次行程可以向多个门店配送，同时一个门店也会接收多次行程。行程和门店之间就是多对多关系：

```text
Trip 1 ── Store A
       ├─ Store B
       └─ Store C

Trip 2 ── Store A
       └─ Store D
```

如果在行程事实表中直接保存单个 `store_id`，一行就只能表示一个门店。若为了保存多个门店而复制行程记录，行程成本也会被重复复制。

桥接表将多对多关系拆成两组一对多关系：

```text
行程事实表 1 ── N 桥接表 N ── 1 门店维度表
```

桥接表的基本结构如下：

```sql
CREATE TABLE bridge_trip_store (
  trip_id VARCHAR(20) NOT NULL,
  store_id VARCHAR(20) NOT NULL,
  weight_factor DECIMAL(10, 6),
  PRIMARY KEY (trip_id, store_id)
);
```

`trip_id` 和 `store_id` 组成复合主键，防止相同的行程与门店关系重复出现。

## 不使用权重时的重复统计

假设一次行程总成本为 900 元，并配送到三个门店。直接把事实表与桥接表连接后，会得到三行：

| 行程 | 门店 | 行程成本 |
| --- | --- | ---: |
| T1 | S1 | 900 |
| T1 | S2 | 900 |
| T1 | S3 | 900 |

如果直接执行 `SUM(total_cost)`，结果会变成 2700 元，而实际成本只有 900 元。这类问题通常称为重复计数或事实膨胀。

## 使用权重因子分摊指标

一种常见处理方法是给桥接表增加权重：

```text
weight_factor = 1 / 当前行程关联的门店数量
```

如果某次行程关联三个门店，每个门店的权重是：

```text
1 / 3 = 0.333333
```

分摊后的成本为：

```text
门店分摊成本 = 行程总成本 × weight_factor
```

| 行程 | 门店 | 总成本 | 权重 | 分摊成本 |
| --- | --- | ---: | ---: | ---: |
| T1 | S1 | 900 | 0.333333 | 300 |
| T1 | S2 | 900 | 0.333333 | 300 |
| T1 | S3 | 900 | 0.333333 | 300 |

所有门店的分摊成本相加后仍然等于原始行程成本。

## 计算每个行程关联的门店数量

可以先通过聚合查询统计每个行程的门店数量：

```sql
SELECT
  t.trip_id,
  t.trip_date,
  t.total_km,
  COUNT(d.store_id) AS store_count
FROM trip AS t
LEFT JOIN destination AS d
  ON d.trip_id = t.trip_id
GROUP BY
  t.trip_id,
  t.trip_date,
  t.total_km;
```

这里使用 `LEFT JOIN`，目的是保留尚未关联任何门店的行程。

需要注意：

```sql
COUNT(*)
```

会计算外连接产生的占位行，而：

```sql
COUNT(d.store_id)
```

只统计实际存在的门店编号，因此更适合这个场景。

## 生成桥接表权重

MySQL 8 可以使用窗口函数计算同一行程中的门店数量：

```sql
INSERT INTO bridge_trip_store (trip_id, store_id, weight_factor)
SELECT
  d.trip_id,
  d.store_id,
  1.0 / COUNT(*) OVER (PARTITION BY d.trip_id) AS weight_factor
FROM destination AS d;
```

`PARTITION BY d.trip_id` 会按照行程划分计算范围。每个行程有多少条门店记录，`COUNT(*)` 就返回多少。

也可以先聚合，再与原始关系表连接：

```sql
WITH store_counts AS (
  SELECT
    trip_id,
    COUNT(*) AS store_count
  FROM destination
  GROUP BY trip_id
)
INSERT INTO bridge_trip_store (trip_id, store_id, weight_factor)
SELECT
  d.trip_id,
  d.store_id,
  1.0 / sc.store_count
FROM destination AS d
JOIN store_counts AS sc
  ON sc.trip_id = d.trip_id;
```

## 按门店统计分摊成本

假设事实表的粒度是“一行代表一次行程”，可以这样计算每个门店应承担的配送成本：

```sql
SELECT
  s.store_id,
  s.store_name,
  SUM(f.total_delivery_cost * b.weight_factor) AS allocated_cost
FROM fact_delivery AS f
JOIN bridge_trip_store AS b
  ON b.trip_id = f.trip_id
JOIN dim_store AS s
  ON s.store_id = b.store_id
GROUP BY
  s.store_id,
  s.store_name
ORDER BY allocated_cost DESC;
```

如果业务规则不是平均分摊，也可以按照货物重量、体积、数量或实际服务时间计算权重。

## 权重数据的校验

每个行程对应的权重总和通常应该等于 1：

```sql
SELECT
  trip_id,
  SUM(weight_factor) AS total_weight
FROM bridge_trip_store
GROUP BY trip_id
HAVING ABS(SUM(weight_factor) - 1) > 0.000001;
```

正常情况下，这条查询应返回空结果。由于小数运算可能产生精度差异，因此使用允许误差，而不是直接判断是否等于 1。

还应比较原始事实总额与分摊后总额：

```sql
SELECT SUM(total_delivery_cost) AS original_total
FROM fact_delivery;

SELECT SUM(f.total_delivery_cost * b.weight_factor) AS allocated_total
FROM fact_delivery AS f
JOIN bridge_trip_store AS b
  ON b.trip_id = f.trip_id;
```

两项结果应在允许的精度范围内一致。

## 星型模型与雪花模型

### 星型模型

事实表直接连接各个维度表，查询路径较短，结构容易理解：

```text
        日期维度
           │
车辆维度 ─ 事实表 ─ 门店维度
           │
        行程维度
```

### 雪花模型

维度表继续拆分为更细的子维度。例如行程维度再关联季节维度。结构更加规范化，但查询需要更多连接：

```text
事实表 ─ 行程维度 ─ 季节维度
```

选择哪一种模型需要平衡查询复杂度、数据冗余和维护成本。

## CTAS：根据查询结果创建表

数据仓库装载过程中经常先验证查询结果，再使用 CTAS 创建中间表或维度表：

```sql
CREATE TABLE dim_trip AS
SELECT
  t.trip_id,
  t.trip_date,
  t.total_km,
  COUNT(d.store_id) AS store_count
FROM trip AS t
LEFT JOIN destination AS d
  ON d.trip_id = t.trip_id
GROUP BY
  t.trip_id,
  t.trip_date,
  t.total_km;
```

CTAS 会根据查询结果生成表和数据，但主键、外键、默认值、索引等约束通常需要另行补充。

## 将一组明细聚合成字符串

Oracle 可以使用 `LISTAGG()` 将同一行程的多个门店编号拼接成一个字符串：

```sql
LISTAGG(store_id, '_')
  WITHIN GROUP (ORDER BY store_id)
```

MySQL 中通常使用 `GROUP_CONCAT()`：

```sql
SELECT
  trip_id,
  GROUP_CONCAT(
    store_id
    ORDER BY store_id
    SEPARATOR '_'
  ) AS store_group_list
FROM destination
GROUP BY trip_id;
```

结果可能为：

```text
T1  M1_M2_M3_M4
T2  M1_M5
```

这种字段适合展示、审计或辅助查询，但不应替代规范化的桥接表。将多个编号存入一个字符串后，很难进行外键约束、精确连接和单项更新。

## 常见设计问题

### 事实表粒度不明确

如果同一张事实表中部分记录代表行程，部分记录代表行程与门店组合，聚合时容易出现错误。事实表设计时应明确写出“一行代表什么”。

### 指标被桥接关系放大

事实表与多对多关系连接后，原始事实可能被复制多次。统计前应判断指标是可重复聚合，还是需要按权重分摊。

### 使用普通连接遗漏无关联记录

如果需要检查没有门店的行程，应使用 `LEFT JOIN`。普通 `JOIN` 只保留两边都匹配的记录。

### 权重总和不等于 1

关系数据发生新增或删除后，原有权重可能失效。桥接表刷新时应重新计算权重，并执行总和校验。

### 使用浮点类型保存精确金额

金额和权重通常应使用 `DECIMAL`，避免二进制浮点数造成不必要的累计误差。

### 把聚合字符串当作关系数据

`LISTAGG()` 或 `GROUP_CONCAT()` 的结果适合输出，不适合代替多对多关系表。正式关系仍应保存在一行一条关联记录的桥接表中。
