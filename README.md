# Bun Task Manager
- Only runs by Bun v1.3.12 or later
- .
- This is a minimal task manager
- uses ps -eo pid,args to list processes
- kills a process by clicking on link
- Powered by Bun.markdown.ansi
- A proof of concept for markdown powered TUI

# Usage
- bun taskmgr.mjs [filter]
- .
- l [filter]
- q quit
- k/i/h: SIGKILL SIGINT SIGHUP

# Works on
- Android arm64: Termux proot
- Windows x64: Windows 11
- Linux x64: CachyOS
