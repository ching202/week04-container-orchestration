param([string]$Context = 'kind-week04', [string]$BaseUrl = 'http://127.0.0.1:8080')
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo
New-Item -ItemType Directory -Force -Path evidence | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Start-Transcript -Path "evidence/cluster-$stamp.txt"
function Kube {
    & kubectl --context $Context -n week04 @args
    if ($LASTEXITCODE -ne 0) { throw "kubectl failed: $args" }
}
function Pods {
    return (Kube get pods -l app=web-app -o json | ConvertFrom-Json).items
}
function Wait-Replicas([int]$Count, [string]$AbsentUid = '') {
    $deadline = (Get-Date).AddSeconds(120)
    do {
        $active = @(Pods | Where-Object { -not $_.metadata.deletionTimestamp })
        $ready = @($active | Where-Object {
            @($_.status.conditions | Where-Object { $_.type -eq 'Ready' -and $_.status -eq 'True' }).Count -gt 0
        })
        $old = @($active | Where-Object { $_.metadata.uid -eq $AbsentUid })
        if ($active.Count -eq $Count -and $ready.Count -eq $Count -and $old.Count -eq 0) { return }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "Timed out waiting for $Count ready replacement replicas"
}
try {
    Kube rollout status deployment/web-app --timeout=120s
    & node scripts/smoke.mjs $BaseUrl
    if ($LASTEXITCODE -ne 0) { throw 'Endpoint checks failed' }
    Kube scale deployment/web-app --replicas=3
    Wait-Replicas 3
    Kube get pods -l app=web-app -o wide
    $victim = @(Pods | Where-Object { -not $_.metadata.deletionTimestamp })[0]
    $victimUid = $victim.metadata.uid
    Write-Output "Deleting pod $($victim.metadata.name), UID $victimUid"
    Kube delete pod $victim.metadata.name --wait=true --timeout=60s
    Wait-Replicas 3 $victimUid
    $after = @(Pods)
    if (@($after | Where-Object { $_.metadata.uid -eq $victimUid }).Count -ne 0) { throw 'Deleted UID still present' }
    Write-Output 'PASS: deleted pod UID disappeared and three healthy replicas exist.'
    Kube get pods -l app=web-app -o wide
    $podName = $after[0].metadata.name
    $uid = Kube exec $podName -- id -u
    if ("$uid".Trim() -ne '1000') { throw "Unexpected UID: $uid" }
    Kube exec $podName -- ps -o pid,user,args
    Kube get deployment web-app -o yaml
    Kube get endpointslices -l kubernetes.io/service-name=web-app -o wide
    & node scripts/smoke.mjs $BaseUrl
    if ($LASTEXITCODE -ne 0) { throw 'Endpoint checks after healing failed' }
    Write-Output 'PASS: scaling, pod replacement, UID, and endpoint checks. Rolling update and browser QA remain separate steps.'
} finally {
    Stop-Transcript
}
