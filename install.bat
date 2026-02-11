@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: Feishu Claude Bridge - Installation Script (Windows)

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "AUTO_YES=0"

:: ── Parse arguments ──────────────────────────────────────
:parse_args
if "%~1"=="" goto :start
if /i "%~1"=="-y"       (set "AUTO_YES=1"   & shift & goto :parse_args)
if /i "%~1"=="--yes"    (set "AUTO_YES=1"   & shift & goto :parse_args)
if /i "%~1"=="-h"       goto :usage
if /i "%~1"=="--help"   goto :usage
echo [ERROR] Unknown option: %~1
goto :usage

:usage
echo Usage: %~nx0 [options]
echo.
echo Options:
echo   -y, --yes       Skip confirmation prompts
echo   -h, --help      Show this help message
echo.
echo Examples:
echo   %~nx0              Interactive install
echo   %~nx0 -y           Non-interactive install with defaults
exit /b 0

:start
echo.
echo ============================================
echo   Feishu Claude Bridge - Installer
echo ============================================
echo.

:: ── Step 1: Check Node.js ────────────────────────────────
echo [INFO] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo   Please install Node.js 18 or later from https://nodejs.org/
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
:: node -v returns "v20.x.x", extract number after v
for /f "tokens=2 delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
:: Actually parse it properly
for /f "delims=" %%v in ('node -e "process.stdout.write(String(process.versions.node.split(\".\")[0]))"') do set "NODE_MAJOR=%%v"

if !NODE_MAJOR! LSS 18 (
    echo [ERROR] Node.js ^>= 18 required. Current:
    node -v
    exit /b 1
)
echo [OK] Node.js detected
node -v

:: ── Step 2: Check Claude CLI ─────────────────────────────
echo [INFO] Checking Claude CLI...
where claude >nul 2>&1
if errorlevel 1 (
    echo [WARN] Claude CLI not found.
    echo   Install it from: https://claude.ai/install.sh
    echo.
    if "!AUTO_YES!"=="1" (
        echo [WARN] Continuing without Claude CLI. Agent service requires it.
    ) else (
        set /p "CONTINUE_NO_CLI=Continue without Claude CLI? [y/N] "
        if /i not "!CONTINUE_NO_CLI!"=="y" exit /b 1
        echo [WARN] Skipping Claude CLI check. Agent service requires it to run.
    )
) else (
    echo [OK] Claude CLI found
)

:: ── Step 3: Install dependencies ─────────────────────────
echo [INFO] Installing dependencies...
cd /d "%SCRIPT_DIR%"
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed
    exit /b 1
)
echo [OK] Dependencies installed

:: ── Step 4: Build project ────────────────────────────────
echo [INFO] Building project...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)
echo [OK] Build complete

:: ── Step 5: Configure .env.agent ─────────────────────────
echo.
echo [INFO] Configuring environment variables...

set "ENV_FILE=%SCRIPT_DIR%\.env.agent"
set "CONFIGURE_ENV=1"
set "FEISHU_APP_ID="
set "FEISHU_APP_SECRET="
set "FEISHU_USER_ID="

if exist "%ENV_FILE%" (
    if "!AUTO_YES!"=="1" (
        echo [OK] Keeping existing .env.agent
        set "CONFIGURE_ENV=0"
    ) else (
        set /p "OVERWRITE_ENV=.env.agent already exists. Overwrite? [y/N] "
        if /i not "!OVERWRITE_ENV!"=="y" (
            echo [OK] Keeping existing .env.agent
            set "CONFIGURE_ENV=0"
        )
    )

    if "!CONFIGURE_ENV!"=="0" (
        :: Read existing values for MCP config
        for /f "tokens=1,* delims==" %%a in ('type "%ENV_FILE%" 2^>nul ^| findstr /b "FEISHU_APP_ID="') do set "FEISHU_APP_ID=%%b"
        for /f "tokens=1,* delims==" %%a in ('type "%ENV_FILE%" 2^>nul ^| findstr /b "FEISHU_APP_SECRET="') do set "FEISHU_APP_SECRET=%%b"
        for /f "tokens=1,* delims==" %%a in ('type "%ENV_FILE%" 2^>nul ^| findstr /b "FEISHU_USER_ID="') do set "FEISHU_USER_ID=%%b"
    )
)

if "!CONFIGURE_ENV!"=="1" (
    echo.
    echo   Enter your Feishu app credentials.
    echo   ^(See README.md for how to create a Feishu app^)
    echo.
    set /p "FEISHU_APP_ID=  FEISHU_APP_ID: "
    set /p "FEISHU_APP_SECRET=  FEISHU_APP_SECRET: "
    set /p "FEISHU_USER_ID=  FEISHU_USER_ID (optional, press Enter to skip): "

    if "!FEISHU_APP_ID!"=="" (
        echo [ERROR] FEISHU_APP_ID is required.
        exit /b 1
    )
    if "!FEISHU_APP_SECRET!"=="" (
        echo [ERROR] FEISHU_APP_SECRET is required.
        exit /b 1
    )

    (
        echo # Feishu credentials
        echo FEISHU_APP_ID=!FEISHU_APP_ID!
        echo FEISHU_APP_SECRET=!FEISHU_APP_SECRET!
        echo FEISHU_USER_ID=!FEISHU_USER_ID!
        echo LOG_LEVEL=info
    ) > "%ENV_FILE%"

    echo [OK] .env.agent created
)

:: ── Step 6: Configure MCP ────────────────────────────────
echo.
set "CONFIGURE_MCP=y"
if "!AUTO_YES!"=="0" (
    set /p "CONFIGURE_MCP=Configure MCP Feishu notification for Claude Code? [Y/n] "
)
if "!CONFIGURE_MCP!"=="" set "CONFIGURE_MCP=y"

if /i "!CONFIGURE_MCP!"=="y" (
    set "CLAUDE_JSON=%USERPROFILE%\.claude.json"
    echo [INFO] MCP config target: %%USERPROFILE%%\.claude.json

    :: Use node to safely merge JSON config
    node -e "const fs=require('fs'),path=require('path');const f='!CLAUDE_JSON!'.replace(/\\/g,'/');const d='!SCRIPT_DIR!'.replace(/\\/g,'/');const id='!FEISHU_APP_ID!',sec='!FEISHU_APP_SECRET!',uid='!FEISHU_USER_ID!';let s={};if(fs.existsSync(f)){try{s=JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){console.error('Warning: Failed to parse existing .claude.json')}}if(!s.mcpServers)s.mcpServers={};const env={FEISHU_APP_ID:id,FEISHU_APP_SECRET:sec};if(uid)env.FEISHU_USER_ID=uid;s.mcpServers['feishu-bridge']={command:'node',args:[path.join(d,'dist','index.js')],env:env};fs.writeFileSync(f,JSON.stringify(s,null,2)+'\n');console.log('MCP configuration written to: '+f)"

    if errorlevel 1 (
        echo [ERROR] Failed to write MCP configuration
        exit /b 1
    )
    set "MCP_CONFIGURED=1"
    echo [OK] MCP Feishu notification configured
) else (
    echo [INFO] Skipped MCP configuration.
    echo   You can configure it later by re-running: %~nx0
)

:: ── Step 7: Configure CLAUDE.md ─────────────────────────
if "!MCP_CONFIGURED!"=="1" (
    echo.
    set "CONFIGURE_CLAUDE_MD=y"
    if "!AUTO_YES!"=="0" (
        set /p "CONFIGURE_CLAUDE_MD=Configure CLAUDE.md to make Claude prefer Feishu for communication? [Y/n] "
    )
    if "!CONFIGURE_CLAUDE_MD!"=="" set "CONFIGURE_CLAUDE_MD=y"

    if /i "!CONFIGURE_CLAUDE_MD!"=="y" (
        set "CLAUDE_MD=%USERPROFILE%\.claude\CLAUDE.md"

        node -e "const fs=require('fs'),p='!CLAUDE_MD!'.replace(/\\/g,'/');const block='<!-- feishu-bridge-begin -->\n## Feishu Communication\n\nWhen the `feishu_ask` and `feishu_notify` MCP tools are available, follow these rules:\n\n- **All confirmations and questions to the user**: Use `feishu_ask` instead of the built-in AskUserQuestion. This sends the question to the user\'s Feishu and waits for their reply.\n- **Progress notifications**: Use `feishu_notify` to inform the user of important milestones (task started, completed, errors encountered).\n- **Fallback**: If `feishu_ask` returns an error (e.g., WebSocket unavailable), fall back to the built-in AskUserQuestion.\n- **Do NOT** use `feishu_ask` for trivial internal decisions — only for questions that genuinely require user input.\n<!-- feishu-bridge-end -->';if(fs.existsSync(p)){let c=fs.readFileSync(p,'utf8');if(c.includes('feishu-bridge-begin')){c=c.replace(/<!-- feishu-bridge-begin -->[\s\S]*?<!-- feishu-bridge-end -->/,block);fs.writeFileSync(p,c);console.log('[OK] CLAUDE.md updated (replaced existing Feishu section)')}else{fs.writeFileSync(p,c+'\n'+block+'\n');console.log('[OK] CLAUDE.md updated (appended Feishu section)')}}else{fs.writeFileSync(p,block+'\n');console.log('[OK] CLAUDE.md created with Feishu communication rules')}"

        if errorlevel 1 (
            echo [ERROR] Failed to write CLAUDE.md
        ) else (
            echo [INFO] CLAUDE.md location: !CLAUDE_MD!
        )
    ) else (
        echo [INFO] Skipped CLAUDE.md configuration.
    )
)

:: ── Done ─────────────────────────────────────────────────
echo.
echo ============================================
echo   Installation complete!
echo ============================================
echo.
echo   Start Agent service:
echo     start.bat
echo.
echo   Start MCP Server:
echo     start.bat mcp
echo.
echo   For more info see README.md
echo.

endlocal
