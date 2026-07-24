# 🌙 月光酒馆 - 个人博客

一个酒馆主题的个人博客，通过「调酒」来解锁文章，配有信箱和评论区。

## 特性

- 🍸 **调酒阅读** — 选择基酒调配出对应心情的文章
- 📜 **酒单菜单** — 所有文章按分类列出，标注配方
- 🌿 **吧台绿植** — 预留图片位，可替换为自己的绿植照片
- ✉️ **酒馆信箱** — 访客可以寄信，也可以阅读公开的信件
- 💬 **评论区** — 每篇文章和信件都支持评论
- 🌙 **酒馆氛围** — 暖色调、木质纹理、烛光 flicker 效果

## 快速开始

### 1. 创建 GitHub 仓库

1. 打开 [github.com/new](https://github.com/new)
2. 仓库名填：**`你的用户名.github.io`**（比如 `zhangsan.github.io`）
3. 设为 **Public**，点击创建

### 2. 上传代码

```bash
# 克隆刚刚创建的仓库
git clone https://github.com/你的用户名/你的用户名.github.io.git
cd 你的用户名.github.io

# 把 tavern-blog 里的所有文件复制进去
# （把桌面 tavern-blog 文件夹里的所有内容复制到仓库目录）

# 提交并推送
git add .
git commit -m "🎉 初始化月光酒馆博客"
git push origin master
```

### 3. 配置个人信息

编辑 `config.toml`，修改以下内容：

```toml
baseURL = "https://你的用户名.github.io"
title = "月光酒馆"

[params]
  tavernName = "月光酒馆"
  tavernSubtitle = "每种心情，都有一杯酒"
```

### 4. 配置评论系统 (giscus)

1. 打开 [github.com/apps/giscus](https://github.com/apps/giscus) 安装
2. 访问 [giscus.app](https://giscus.app) 生成配置
3. 在 `config.toml` 中填写：
   - `repo` — 你的仓库名
   - `repoId` — 从 giscus.app 获取
   - `categoryId` — 从 giscus.app 获取

### 5. 配置信箱

信箱功能支持**寄信**和**读信**两部分：

#### 寄信（访客 → 你的邮箱）

1. 打开 [formspree.io](https://formspree.io) 注册
2. 创建一个新表单，获取 endpoint URL
3. 在 `config.toml` 中填写 `formspreeEndpoint`
4. 访客提交的信件会发送到你的邮箱，页面不跳转

#### 读信（GitHub Issues 公开展示）

信件会通过 GitHub Issues API 展示在信箱页面，无需额外配置。

### 6. 启用 GitHub Pages

1. 仓库 → **Settings** → **Pages**
2. Source 选 **GitHub Actions**
3. 推送代码后，Actions 会自动构建部署
4. 访问 `https://你的用户名.github.io`

## 写文章

在 `content/posts/` 目录下创建 Markdown 文件，文件名格式：`YYYY-MM-DD-标题.md`

文件头示例：

```markdown
---
title: "文章标题"
date: 2026-07-24
description: "文章描述"
categories: ["旅行"]
tags: ["标签1", "标签2"]
moods: ["whisky", "sake"]
draft: false
---

文章内容...
```

### 基酒 (moods) 对照表

| id | 名称 | 心情 |
|-----|------|------|
| whisky | 威士忌 🥃 | 沉稳·思考 |
| gin | 金酒 🍸 | 清新·明快 |
| rum | 朗姆酒 🍹 | 热情·奔放 |
| wine | 红酒 🍷 | 浪漫·温柔 |
| champagne | 香槟 🥂 | 庆祝·欢乐 |
| sake | 清酒 🍶 | 宁静·治愈 |

每篇文章选择 **2-3 种** 基酒作为配方。

## 管理公开信件

访客寄信后，信件会发送到你的邮箱。如果你想公开某封信，有两种方式：

### 方式一：直接在 GitHub 上创建 Issue

1. 打开仓库的 [Issues](https://github.com/你的用户名/你的用户名.github.io/issues) 页面
2. 点击 **"New Issue"**
3. 标题 = 信件标题，正文 = 信件内容
4. 添加标签：`酒馆来信` 和 `来自-寄信人名字`
5. 提交后自动显示在信箱页面

### 方式二：使用 GitHub Actions 工作流

1. 打开仓库的 **Actions** → **创建酒馆来信**
2. 点击 **"Run workflow"**，填入寄信人、标题、内容
3. 运行后自动创建 Issue

## 替换绿植图片

把你自己的绿植照片保存为 `static/images/plant.png`，然后在 `config.toml` 中或直接修改 `layouts/index.html` 中的图片路径。

## 目录结构

```
├── content/
│   ├── posts/          # 博客文章
│   └── letters/        # 公开信件（旧方案，现改用 GitHub Issues）
├── layouts/
│   ├── _default/       # 默认模板
│   ├── partials/       # 局部模板
│   ├── index.html      # 首页（酒馆主界面）
│   ├── posts/          # 文章页面模板
│   ├── letters/        # 信件页面模板
│   └── mailbox/        # 信箱页面模板
├── static/
│   ├── css/style.css   # 样式
│   ├── js/
│   │   ├── script.js   # 调酒交互逻辑
│   │   └── mailbox.js  # 信箱功能（寄信 + 读信）
│   └── images/         # 图片
├── config.toml         # 配置文件
└── .github/workflows/
    ├── hugo.yml        # Hugo 自动构建部署
    └── create-letter.yml  # 创建公开信件的 GitHub Actions 工作流
```

## 技术栈

- [Hugo](https://gohugo.io) — 静态站点生成器
- [GitHub Pages](https://pages.github.com) — 免费托管
- [GitHub Issues API](https://docs.github.com/rest/issues) — 信件存储与展示
- [giscus](https://giscus.app) — 评论系统
- [Formspree](https://formspree.io) — 表单提交