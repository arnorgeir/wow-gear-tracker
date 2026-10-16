# Nightly repo scan: refreshes a detached worktree at origin/main and runs
# Claude Code headless on prompt.md. Files at most 5 issues; never pushes.
# -DryRun prints what it would file. Logs land beside the running copy.
# Registered as task "WGT nightly scan", daily 03:00, from a copy of this
# file at C:\workspace\wgt-nightly-runner\run.ps1 so main checkout state
# never matters. Not under AppData: the desktop app's shell sees a private
# copy of AppData\Local that Task Scheduler can't.
#   $d = 'C:\workspace\wgt-nightly-runner'
#   $a = New-ScheduledTaskAction -Execute cmd.exe -WorkingDirectory $d `
#     -Argument "/c `"`"$env:USERPROFILE\.dotnet\tools\pwsh.exe`" -NoProfile -File `"$d\run.ps1`" >> `"$d\task.out`" 2>&1`""
#   Register-ScheduledTask 'WGT nightly scan' -Action $a -Trigger (New-ScheduledTaskTrigger -Daily -At 3am) `
#     -Settings (New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4))
param(
  [switch]$DryRun,
  [string]$Ref = 'origin/main',
  [string]$Repo = 'C:\workspace\wow-gear-tracker',
  [string]$Worktree = 'C:\workspace\wgt-nightly-scan'
)
$ErrorActionPreference = 'Stop'
# Task Scheduler's PATH can miss the per-user claude install.
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
$logDir = $PSScriptRoot
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ((Get-Date -Format 'yyyy-MM-dd_HHmm') + $(if ($DryRun) { '-dry' } else { '' }) + '.log')
Start-Transcript -Path $log | Out-Null
try {
  git -C $Repo fetch --quiet origin
  # Until the prompt is merged, the scan has nothing to run.
  git -C $Repo cat-file -e "${Ref}:scripts/nightly-scan/prompt.md" 2>$null
  if ($LASTEXITCODE -ne 0) { Write-Output "No prompt at $Ref, skipping."; return }

  if (-not (Test-Path $Worktree)) { git -C $Repo worktree add --detach $Worktree $Ref }
  git -C $Worktree checkout --quiet --detach --force $Ref
  git -C $Worktree clean -fdxq

  $prompt = Get-Content (Join-Path $Worktree 'scripts\nightly-scan\prompt.md') -Raw
  if ($DryRun) { $prompt = "DRY RUN`n`n" + $prompt }

  $allowed = @(
    'Read', 'Grep', 'Glob', 'Write',
    'Bash(gh issue list:*)', 'Bash(gh issue view:*)', 'Bash(gh issue create:*)',
    'Bash(gh project item-add:*)', 'Bash(gh project item-edit:*)', 'Bash(gh project field-list:*)',
    'Bash(gh label list:*)',
    'Bash(git log:*)', 'Bash(git grep:*)', 'Bash(git blame:*)', 'Bash(git show:*)'
  )
  $denied = @('Edit', 'NotebookEdit', 'Bash(git push:*)', 'Bash(git commit:*)', 'Bash(gh pr:*)')
  if ($DryRun) { $denied += @('Bash(gh issue create:*)', 'Bash(gh project item-add:*)', 'Bash(gh project item-edit:*)') }

  Push-Location $Worktree
  try {
    # Usage limits reset on a rolling window: wait it out once, then retry.
    # ponytail: one fixed 90-minute wait, parse the reset time if this misses.
    foreach ($attempt in 1, 2) {
      $out = $prompt | claude -p --model opus --permission-mode dontAsk `
        --allowedTools @allowed --disallowedTools @denied
      $out
      if ($attempt -eq 2 -or "$out" -notmatch 'hit your .*limit') { break }
      Start-Sleep -Seconds 5400
    }
  } finally { Pop-Location }
} finally {
  Stop-Transcript | Out-Null
}
