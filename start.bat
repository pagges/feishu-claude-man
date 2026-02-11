@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: Feishu Claude Bridge - Startup Script (Windows)

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "MODE=agent"
set "MCP_NOTIFY=0"

:: ── Parse arguments ──────────────────────────────────────
:parse_args
if "%~1"=="" goto :start
if /i "%~1"=="agent"        (set "MODE=agent"    & shift & goto :parse_args)
if /i "%~1"=="mcp"          (set "MODE=mcp"      & shift & goto :parse_args)
if /i "%~1"=="--mcp-notify" (set "MCP_NOTIFY=1"  & shift & goto :parse_args)
if /i "%~1"=="-h"           goto :usage
if /i "%~1"=="--help"       goto :usage
echo [ERROR] Unknown option: %~1
goto :usage

:usage
echo Usage: %~nx0 [command] [options]
echo.
echo Commands:
echo   agent (default)   Start the Agent service (Feishu -^> Claude)
echo   mcp               Start the MCP Server (Claude -^> Feishu)
echo.
echo Options:
echo   --mcp-notify      Ensure MCP notification is configured before starting agent
echo   -h, --help        Show this help message
echo.
echo Examples:
echo   %~nx0                Start Agent service
echo   %~nx0 mcp            Start MCP Server
echo   %~nx0 --mcp-notify   Start Agent and ensure MCP is configured
exit /b 0

:start
cd /d "%SCRIPT_DIR%"

:: ── Pre-flight checks ────────────────────────────────────

:: Check if dist\ exists
if not exist "%SCRIPT_DIR%\dist" (
    echo [WARN] dist\ not found. Building project...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed
        exit /b 1
    )
    echo [OK] Build complete
)

:: Check .env.agent for agent mode
if "!MODE!"=="agent" (
    if not exist "%SCRIPT_DIR%\.env.agent" (
        echo [ERROR] .env.agent not found. Run install.bat first.
        exit /b 1
    )
)

:: ── MCP notify check ─────────────────────────────────────
if "!MCP_NOTIFY!"=="1" (
    echo [INFO] Checking MCP Feishu notification configuration...

    set "MCP_FOUND=0"

    :: Check project-level
    if exist "%SCRIPT_DIR%\.claude\settings.json" (
        node -e "const s=JSON.parse(require('fs').readFileSync('%SCRIPT_DIR:\=/%/.claude/settings.json','utf8'));process.exit(s.mcpServers&&s.mcpServers['feishu-bridge']?0:1)" >nul 2>&1
        if not errorlevel 1 (
            echo [OK] MCP Feishu notification configured in: .claude\settings.json
            set "MCP_FOUND=1"
        )
    )

    :: Check global
    if "!MCP_FOUND!"=="0" (
        if exist "%USERPROFILE%\.claude\settings.json" (
            node -e "const s=JSON.parse(require('fs').readFileSync('%USERPROFILE:\=/%/.claude/settings.json','utf8'));process.exit(s.mcpServers&&s.mcpServers['feishu-bridge']?0:1)" >nul 2>&1
            if not errorlevel 1 (
                echo [OK] MCP Feishu notification configured in: %%USERPROFILE%%\.claude\settings.json
                set "MCP_FOUND=1"
            )
        )
    )

    if "!MCP_FOUND!"=="0" (
        echo [WARN] MCP Feishu notification not configured.
        echo   Run install.bat to configure it, or use install.bat -g for global config.
        echo.
    )
)

:: ── Start service ────────────────────────────────────────
if "!MODE!"=="agent" (
    echo.
    echo [INFO] Starting Agent service ^(Feishu -^> Claude^)...
    echo   Working directory: %SCRIPT_DIR%
    echo   Press Ctrl+C to stop
    echo.
    node --env-file=.env.agent dist/agent/index.js
    goto :eof
)

if "!MODE!"=="mcp" (
    echo.
    echo [INFO] Starting MCP Server ^(Claude -^> Feishu^)...
    echo   This is typically started by Claude Code automatically.
    echo   Press Ctrl+C to stop
    echo.
    node dist/index.js
    goto :eof
)

endlocal
