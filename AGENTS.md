# Chloe Agent Instructions

## 项目简介
Chloe 是一个基于 DeepSeek v4 API 的 AI 伴侣应用，使用 `deepseek-v4-flash`，通过 OpenAI-compatible Chat Completions API 与 SSE 流式输出提供对话能力。核心特色是一套完整的记忆系统：记忆随时间演化，并通过 Canvas 从白色迷雾逐渐成长为神经网络进行可视化。项目为纯静态应用，部署在 GitHub Pages，无后端。

## 技术栈
- 纯 HTML / CSS / 原生 JavaScript
- ES Module 规范
- Vite 构建
- IndexedDB 持久化
- DeepSeek API（`deepseek-v4-flash`，SSE 流式输出）
- Canvas 可视化

## 文件结构
```text
chloe/
  index.html
  vite.config.js
  package.json
  AGENTS.md
  README.md
  .github/workflows/deploy.yml
  src/
    main.js
    styles/
      tokens.css
      app.css
    features/
      memory/
        memoryStore.js
        memoryWeightEngine.js
        memoryQuota.js
        index.js
```

## 开发规范
- 禁止新增未说明的文件，除非后续任务明确要求。
- 修改前先读取当前内容和 SHA。
- 每次改完执行 `git add && git commit`，不要 push。
- JavaScript 必须使用 ES Module。
- 记忆系统是核心，不得破坏其数据结构。
- 不要在 import 外层包裹 try/catch。
