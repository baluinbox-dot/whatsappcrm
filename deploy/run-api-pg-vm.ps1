# Runs api-pg on this PC against the PostgreSQL on the VM through an SSH tunnel (local port 5433).
# The database password is read from the VM each time, so it is never stored on this PC.
$ErrorActionPreference = "Stop"
$sshHost = "finops-new"
$localPort = 5433

$pw = (ssh -o BatchMode=yes $sshHost "cat ~/.istreams_db_pass").Trim()
if (-not $pw) { throw "Could not read the database password from $sshHost." }

$tunnel = Start-Process ssh -WindowStyle Hidden -PassThru -ArgumentList @(
    "-N", "-L", "${localPort}:127.0.0.1:5432", "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30", "-o", "BatchMode=yes", $sshHost)
try {
    for ($i = 0; $i -lt 20 -and -not (Test-NetConnection 127.0.0.1 -Port $localPort -WarningAction SilentlyContinue).TcpTestSucceeded; $i++) { Start-Sleep -Seconds 1 }
    $env:ConnectionStrings__DefaultConnection = "Host=127.0.0.1;Port=$localPort;Database=istreams_crm;Username=istreams;Password=$pw"
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    Set-Location (Join-Path $PSScriptRoot "..\api-pg")
    dotnet run --no-launch-profile --urls http://localhost:5101
}
finally {
    Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
}
