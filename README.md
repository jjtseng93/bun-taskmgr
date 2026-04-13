# Bun Task Manager
- Only runs by Bun v1.3.12 or later
- .
- This is a minimal task manager
- Uses ps -eo pid,args to list processes
- Kills a process by clicking on the link
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
  * Requirements same as CachyOS
- Linux x64: CachyOS
  * Alacritty out of the box, just click on the link
  * Konsole requires 
    + "Allow escape sequences for links" 
    + In the Edit Current Profile => Mouse => Miscellaneous (Add a new profile first)
- Windows x64: Windows 11 powershell
  * Click on the link with Ctrl key down

