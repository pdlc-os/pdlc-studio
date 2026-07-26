<#
.SYNOPSIS
    Installs the prerequisites for PDLC Studio on Windows.

.DESCRIPTION
    Installs:
      - Claude CLI   required by every install method
      - dotenvx      optional, only for loading .env in development

    Verifies but does not install:
      - Node.js >= 20 and Deno, needed only for development mode

    Runtimes are checked rather than installed on purpose. Most developers
    manage Node through nvm-windows, fnm or volta, and having this script drop
    another copy in front of that is how you end up with the "Claude CLI not
    found" class of problem the README's Troubleshooting section exists for.
    The exact command to install one is printed instead.

    Safe to re-run: anything already present is left alone.

.EXAMPLE
    irm https://raw.githubusercontent.com/pdlc-os/pdlc-studio/main/scripts/install-prerequisites.ps1 | iex

.EXAMPLE
    .\scripts\install-prerequisites.ps1
#>

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RequiredNodeMajor = 20

function Write-Step { param([string]$Text) Write-Host "`n==> $Text" -ForegroundColor White }
function Write-Ok   { param([string]$Text) Write-Host "  ok      $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "  warn    $Text" -ForegroundColor Yellow }
function Write-Fail { param([string]$Text) Write-Host "  error   $Text" -ForegroundColor Red }
function Write-Info { param([string]$Text) Write-Host "  $Text" -ForegroundColor DarkGray }

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "PDLC Studio prerequisites  (windows)" -ForegroundColor White

# ---------------------------------------------------------------- Claude CLI

Write-Step 'Claude CLI'
if (Test-Command 'claude') {
    Write-Ok "already installed — $((claude --version 2>$null) | Select-Object -First 1)"
} else {
    Write-Info 'installing from https://claude.ai/install.ps1'
    Invoke-RestMethod -Uri 'https://claude.ai/install.ps1' | Invoke-Expression

    # The installer may add to PATH only for future sessions, so refresh the
    # current process from the persisted machine and user values.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')

    if (Test-Command 'claude') {
        Write-Ok "installed — $((claude --version 2>$null) | Select-Object -First 1)"
    } else {
        Write-Fail "install completed but 'claude' is still not on PATH"
        Write-Info 'open a new terminal and re-run this script to verify'
        exit 1
    }
}

Write-Info "run 'claude' once to authenticate if you have not already"

# -------------------------------------------------------------------- dotenvx

Write-Step 'dotenvx (optional — only for .env in development)'
if (Test-Command 'dotenvx') {
    Write-Ok "already installed — $((dotenvx --version 2>$null) | Select-Object -First 1)"
} elseif (Test-Command 'winget') {
    Write-Info 'installing via winget package dotenvx.dotenvx'
    # --accept-*-agreements keeps this non-interactive when piped.
    winget install --id dotenvx.dotenvx --exact --silent `
        --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) { Write-Ok 'installed' } else { Write-Warn "winget exited with $LASTEXITCODE" }
} else {
    # dotenvx publishes no PowerShell installer; its shell script needs a POSIX
    # shell, so there is nothing sensible to fall back to here.
    Write-Warn 'winget not available — skipping dotenvx'
    Write-Info 'dotenvx is optional. Install winget (App Installer) and re-run, or'
    Write-Info 'set PORT directly instead of using a .env file.'
}

# ------------------------------------------------------- runtimes (dev only)

Write-Step 'Development runtimes (skip if you only run the release binary)'

if (Test-Command 'node') {
    $nodeVersion = (node -v)
    $nodeMajor = [int]($nodeVersion -replace '^v(\d+).*', '$1')
    if ($nodeMajor -ge $RequiredNodeMajor) {
        Write-Ok "Node.js $nodeVersion"
    } else {
        Write-Warn "Node.js $nodeVersion is older than the required v$RequiredNodeMajor"
        Write-Info 'upgrade with: winget install OpenJS.NodeJS.LTS'
    }
} else {
    Write-Warn 'Node.js not found (needed for development mode only)'
    Write-Info 'install with: winget install OpenJS.NodeJS.LTS'
}

if (Test-Command 'deno') {
    Write-Ok "Deno $(((deno --version) | Select-Object -First 1) -split ' ' | Select-Object -Index 1)"
} else {
    Write-Info 'Deno not found — optional, the backend also runs on Node.js'
    Write-Info 'install with: winget install DenoLand.Deno'
}

Write-Step 'Done'
Write-Info 'Binary release:    .\pdlc-studio-windows-x64.exe   then open http://localhost:8080'
Write-Info 'Development mode:  make dev-backend  and  make dev-frontend'
