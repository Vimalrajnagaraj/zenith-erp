# Register (or re-register) the daily read-only "does the repo still match production?" audit as
# a Windows Task Scheduler task. Runs docs/infra/audit-live-sync.sh once a day; on drift it drops
# a ZENITH-SYNC-DRIFT.txt marker on the Desktop and logs to ~/.zenith-sync-audit.log. It NEVER
# pushes - reconcile with docs/infra/sync-from-live.sh.
#
#   powershell -ExecutionPolicy Bypass -File docs\infra\schedule-audit.ps1
#
# Runs as the current user, only while logged on (no stored password). Adjust -At for the time.
param(
  [string]$TaskName = "ZenithLiveSyncAudit",
  [string]$RepoDir  = "C:\Users\ASUS\zenith-erp",
  [string]$At       = "9:00am"
)

$bash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $bash)) { $bash = "C:\Program Files\Git\usr\bin\bash.exe" }
if (-not (Test-Path $bash)) { Write-Error "git-bash not found - install Git for Windows."; exit 1 }

# POSIX path of the repo for the bash invocation, e.g. C:\Users\ASUS\zenith-erp -> /c/Users/ASUS/zenith-erp
$drive = $RepoDir.Substring(0,1).ToLower()
$posix = "/$drive" + ($RepoDir.Substring(2) -replace '\\','/')
# single-quoted so $HOME stays literal and is expanded by bash (the log lands in the user's home)
$inner = 'bash ' + $posix + '/docs/infra/audit-live-sync.sh >> $HOME/.zenith-sync-audit.log 2>&1'
$arg   = '-lc "' + $inner + '"'

$action    = New-ScheduledTaskAction -Execute $bash -Argument $arg -WorkingDirectory $RepoDir
$trigger   = New-ScheduledTaskTrigger -Daily -At $At
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Force `
  -Description "Daily read-only audit: does the git repo still match the live ZetaERP production container? Alerts on drift (Desktop marker + ~/.zenith-sync-audit.log); never pushes. Reconcile: docs/infra/sync-from-live.sh" | Out-Null

Write-Host "Registered scheduled task '$TaskName' (daily at $At)."
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
