# InfoSky 功能路线图

本文档列出了 InfoSky 知识图谱系统可以增加的新功能，按优先级和实现难度分类。

---

## 📊 现有功能概览

| 模块 | 现有功能 |
|------|----------|
| 知识采集 | URL 爬取、文本/Markdown 输入、浏览器插件采集 |
| 知识图谱 | 3D 星空视图、2D 关系视图、列表视图、节点/边 CRUD |
| AI 问答 | RAG/关键词检索、流式对话响应 |
| 知识库 | 原始内容存储、全文搜索、知识库对话 |
| 浏览器插件 | 一键采集、选中文字创建节点、右键菜单、相关知识侧边栏 |
| 复盘模式 | 随机知识点复习 |

---

## 🎯 优先级 1：高价值、易实现

### 1.1 知识标签系统 (Tags)

**描述**：为知识节点添加多标签分类能力，提升知识组织效率。

**功能点**：
- 节点支持添加多个标签
- 标签自动补全（基于已有标签）
- 按标签筛选节点
- 标签云可视化展示
- AI 自动推荐标签

**技术实现**：
```
数据库变更：
- 新建 Tag 表 (id, name, color, created_at)
- 新建 NodeTag 关联表 (node_id, tag_id)

API 端点：
- GET /api/tags - 获取所有标签
- POST /api/tags - 创建标签
- POST /api/graph/nodes/{id}/tags - 为节点添加标签
- DELETE /api/graph/nodes/{id}/tags/{tag_id} - 移除标签
- GET /api/graph?tags=tag1,tag2 - 按标签筛选

前端组件：
- TagSelector.tsx - 标签选择/创建组件
- TagCloud.tsx - 标签云展示
- 修改 NodeEditor.tsx 支持标签编辑
```

---

### 1.2 知识导入/导出

**描述**：支持数据的导入导出，确保知识可移植性和备份能力。

**功能点**：
- 导出为 JSON（完整备份）
- 导出为 Markdown 文件夹（每个节点一个 .md 文件）
- 导出为 Obsidian 兼容格式（支持双向链接）
- 从 JSON 导入恢复
- 从 Markdown 文件夹批量导入

**技术实现**：
```
API 端点：
- GET /api/export/json - 导出 JSON
- GET /api/export/markdown - 导出 Markdown ZIP
- GET /api/export/obsidian - 导出 Obsidian 格式
- POST /api/import/json - 从 JSON 导入
- POST /api/import/markdown - 从 Markdown 导入

导出格式示例 (Obsidian)：
---
tags: [概念, AI]
source: https://example.com
created: 2024-12-29
---
# 机器学习

机器学习是人工智能的一个分支...

## 相关知识
- [[深度学习]]
- [[神经网络]]
```

---

### 1.3 间隔复习系统 (Spaced Repetition)

**描述**：基于艾宾浩斯遗忘曲线，智能安排知识复习时间。

**功能点**：
- 记录每个节点的复习历史
- 根据复习表现计算下次复习时间
- "今日待复习" 列表
- 复习提醒通知
- 掌握程度可视化

**技术实现**：
```
数据库变更：
- 新建 ReviewRecord 表
  - id, node_id, reviewed_at, difficulty (1-5), next_review_at

核心算法 (SM-2 简化版)：
- 初次复习间隔：1天
- 每次成功复习后间隔翻倍
- 失败则重置为1天
- 难度因子影响间隔计算

API 端点：
- GET /api/review/due - 获取待复习节点
- POST /api/review/record - 记录复习结果
- GET /api/review/stats - 复习统计

前端组件：
- ReviewDashboard.tsx - 复习主界面
- ReviewCard.tsx - 卡片式复习
- ReviewStats.tsx - 复习统计图表
```

---

### 1.4 时间线视图

**描述**：按时间顺序展示知识积累过程，可视化学习历程。

**功能点**：
- 日/周/月时间轴展示
- 按日期筛选知识
- 每日新增节点数统计
- 知识增长趋势图
- 快速跳转到特定日期

**技术实现**：
```
API 端点：
- GET /api/graph/timeline?start=&end= - 按时间范围获取节点
- GET /api/stats/daily - 每日统计

前端组件：
- TimelineView.tsx - 时间线主视图
- DateRangePicker.tsx - 日期范围选择
- GrowthChart.tsx - 增长趋势图 (使用 recharts)
```

---

## 🎯 优先级 2：中等价值、中等难度

### 2.1 全功能 Markdown 编辑器

**描述**：提供富文本 Markdown 编辑体验，支持所见即所得。

**功能点**：
- WYSIWYG 编辑模式
- 代码块语法高亮
- 图片上传/粘贴
- 表格编辑支持
- 双向链接语法 `[[节点名]]`
- 实时预览

**技术方案**：
- 使用 [Milkdown](https://milkdown.dev/) 或 [Tiptap](https://tiptap.dev/)
- 自定义双向链接插件
- 图片上传到本地存储

---

### 2.2 知识地图 / 思维导图视图

**描述**：以树形结构展示知识层级关系。

**功能点**：
- 从任意节点展开树形结构
- 折叠/展开子节点
- 拖拽调整层级
- 缩放与平移
- 导出为图片

**技术方案**：
- 使用 [React Flow](https://reactflow.dev/) 或 [D3.js](https://d3js.org/)
- 自动布局算法 (dagre)

---

### 2.3 智能推荐系统

**描述**：基于用户行为和知识关联，推荐相关内容。

**功能点**：
- "相关知识" 推荐
- "你可能遗漏的知识" 提示
- 基于浏览历史的个性化推荐
- 知识空白区域提示

**技术方案**：
```
推荐算法：
1. 内容相似度 (向量余弦相似度)
2. 图结构相似度 (共同邻居、路径分析)
3. 协同过滤 (多用户场景)

API 端点：
- GET /api/recommend/related/{node_id} - 相关知识推荐
- GET /api/recommend/discover - 发现新知识
```

---
---

### 2.4 定时采集与 RSS 订阅

**描述**：自动化采集特定来源的新内容。

**功能点**：
- RSS 源订阅管理
- 定时爬取规则配置
- 新内容通知
- 自动分类与标签

**技术方案**：
```
后台任务：
- 使用 APScheduler 或 Celery
- RSS 解析使用 feedparser

数据库变更：
- 新建 Subscription 表 (id, url, type, schedule, last_fetched)

API 端点：
- POST /api/subscriptions - 创建订阅
- GET /api/subscriptions - 列出订阅
- PUT /api/subscriptions/{id}/toggle - 启用/禁用
```

---
---

## 🎯 优先级 3：高价值、高难度

### 3.1 多用户认证系统

**描述**：支持多用户注册登录，实现知识隔离与共享。

**功能点**：
- 用户注册/登录
- JWT 认证
- 个人知识库隔离
- 公开知识分享
- 协作编辑（可选）

**技术方案**：
```
后端：
- 使用 fastapi-users 或自定义
- JWT Token 认证
- 用户-节点关联关系

数据库变更：
- 新建 User 表 (id, email, hashed_password, created_at)
- KnowledgeNode 添加 user_id 字段
- RawInput 添加 user_id 字段

前端：
- 登录/注册页面
- 用户状态管理 (Context/Zustand)
- 受保护路由
```

---
---

### 3.2 语音输入与转写

**描述**：通过语音快速采集知识。

**功能点**：
- 实时语音转文字
- 上传音频文件转写
- 自动总结提取要点
- 多语言支持

**技术方案**：
```
方案 A：本地模型
- 使用 Whisper (openai-whisper)
- 需要 GPU 或较长处理时间

方案 B：云端 API
- 使用 OpenAI Whisper API
- 或其他语音服务 (Azure, 讯飞)

前端：
- MediaRecorder API 录音
- 上传或实时流式传输
```

---
---

### 3.3 移动端 App

**描述**：开发移动应用，支持随时随地采集和查看知识。

**功能点**：
- 知识浏览与搜索
- 快速采集（分享 → InfoSky）
- 离线访问缓存
- 推送通知（复习提醒）
- 简化版知识图谱

**技术方案**：
```
框架选择：
- React Native (可复用 Web 组件)
- Flutter (更好的性能和原生体验)

核心功能优先级：
1. 分享采集
2. 搜索与浏览
3. AI 对话
4. 复习卡片
```

---
---

### 3.4 知识问答 Bot (微信/Telegram)

**描述**：通过即时通讯工具与知识库交互。

**功能点**：
- 发送消息即可提问
- 返回相关知识摘要
- 支持添加新知识
- 定时推送复习内容

**技术方案**：
```
微信：
- 使用 itchat 或企业微信 API

Telegram：
- 使用 python-telegram-bot

功能模式：
- /ask <问题> - 提问
- /add <内容> - 添加知识
- /review - 开始复习
```

---
---

## 🎯 优先级 4：探索性功能

### 4.1 知识图谱自动扩展

**描述**：基于现有知识，自动搜索和补充相关内容。

**功能点**：
- 识别知识空白
- 自动搜索补充材料
- 用户确认后入库
- 来源可追溯

---

### 4.2 多模态知识采集

**描述**：支持图片、PDF、视频等多种格式。

**功能点**：
- PDF 解析与提取
- 图片 OCR
- 视频字幕提取
- 网页截图存档

---

### 4.3 知识对比与合并

**描述**：发现重复或相似知识，支持合并整理。

**功能点**：
- 相似节点检测
- 对比视图
- 一键合并
- 冲突解决

---

### 4.4 学习路径生成

**描述**：基于知识图谱，生成最优学习路线。

**功能点**：
- 设定学习目标
- 自动规划先修知识
- 进度追踪
- 学习报告

---

## 💡 快速开始建议

如果希望快速增强 InfoSky 的功能，建议按以下顺序实施：

1. **标签系统** - 最基础的组织能力
2. **时间线视图** - 可视化学习历程
3. **导入/导出** - 数据安全保障
4. **间隔复习** - 提升知识留存率

这四个功能能显著提升产品使用体验。

---

## 📝 贡献指南

如果您想为 InfoSky 贡献代码，请：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

---

*最后更新：2024-12-29*
