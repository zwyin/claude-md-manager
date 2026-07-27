---
id: github-proxy-access
title: GitHub 访问需先开代理
order: 52
---
## GitHub 访问需先开代理

本机访问 GitHub（`git fetch/pull/push/rebase/clone`、`gh` CLI）**前置条件：本地代理必须已开启**
（Clash/goproxy，默认 `127.0.0.1:7897`；`http_proxy`/`https_proxy` env 已设指向它）。

- 直连 `github.com` 被墙，git 报：`LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443`。
- `curl` 默认吃代理 env 能通；但 **git 的 libcurl 不一定吃 env 代理**——若 git 仍 SSL 失败，显式配置一次：
  `git config --global http.proxy http://127.0.0.1:7897`（fetch/push 都生效）。
- 排障顺序：先确认代理进程在跑（`curl -sI --max-time 3 https://github.com` 应 `200`）→ 再跑 git；代理挂了别硬上 fetch/rebase。
- rebase/pull 标准动作：`git fetch origin <branch> && git rebase origin/<branch>`；fetch 失败先查代理，不盲目重试。