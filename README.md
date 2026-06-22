# Chloe

Chloe 是一个基于 DeepSeek v4 API 的 AI 伴侣应用原型。它使用纯静态前端技术构建，可部署到 GitHub Pages，无后端服务。

## 技术栈

- Vite
- HTML / CSS / 原生 JavaScript
- ES Module
- IndexedDB
- DeepSeek API：`deepseek-v4-flash`
- SSE 流式输出
- Canvas 可视化

## DeepSeek API 备注

DeepSeek 官方 API 使用 OpenAI-compatible Chat Completions 格式，基础地址为 `https://api.deepseek.com`。`deepseek-v4-flash` 支持 Chat Completions、thinking / non-thinking 模式以及 `stream: true` 流式输出。

> 注意：纯静态 GitHub Pages 无后端，生产环境不应在前端直接暴露 API Key。后续批次需要设计安全的密钥输入或用户自带 Key 方案。

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run preview
```
