#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path $PSScriptRoot -Parent
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path $repo 'evidence'
$originalPath = $env:Path
$originalDockerContext = $env:DOCKER_CONTEXT
$transcribing = $false
$clusterReachable = $false
$exitCode = 0

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    Write-Host ('> ' + $Program + ' ' + ($Arguments -join ' '))
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. See the output above."
    }
}

function Invoke-Kube {
    param([string[]]$Arguments)
    Invoke-Checked 'kubectl' (@('--context', 'kind-week04') + $Arguments)
}

Push-Location -LiteralPath $repo
try {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
    Start-Transcript -Path (Join-Path $evidenceDir "deployment-$stamp.txt") | Out-Null
    $transcribing = $true

    # Discover the portable kind installation made for this assignment.
    $kindDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Codex\tools\kind'
    $portableKindDir = Join-Path $env:USERPROFILE 'Documents\Codex\tools\kind'
    $dockerDir = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
    foreach ($directory in @($kindDir, $portableKindDir, $dockerDir)) {
        if (Test-Path -LiteralPath $directory) { $env:Path = $directory + ';' + $env:Path }
    }
    foreach ($program in @('docker', 'kind', 'kubectl')) {
        if (-not (Get-Command $program -ErrorAction SilentlyContinue)) {
            throw "$program is not on PATH. Install it or add its directory, then run this launcher again."
        }
    }

    # Limit this launcher to this machine's Docker Desktop Linux engine.
    $env:DOCKER_CONTEXT = 'desktop-linux'
    $osType = Invoke-Checked 'docker' @('info', '--format', '{{.OSType}}')
    if (("$osType").Trim() -ne 'linux') { throw 'Docker Desktop must be running its Linux engine.' }
    Invoke-Checked 'kind' @('version')
    $clusters = @(Invoke-Checked 'kind' @('get', 'clusters'))
    $clusterExists = $clusters -contains 'week04'

    if ($clusterExists) {
        # Never silently delete or replace an existing cluster with different ports.
        $bindingsJson = Invoke-Checked 'docker' @('inspect', 'week04-control-plane', '--format', '{{json .HostConfig.PortBindings}}')
        $bindings = $bindingsJson | ConvertFrom-Json
        $mapping = @($bindings.'30080/tcp' | Where-Object {
            $_.HostPort -eq '8080' -and $_.HostIp -eq '127.0.0.1'
        })
        if ($mapping.Count -eq 0) {
            throw 'The existing week04 cluster has different port mappings. No cluster was removed. Resolve the name conflict before retrying.'
        }
    } else {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8080)
        try { $listener.Start() }
        catch { throw 'Local port 8080 is occupied. Stop the application using it, then rerun. This launcher will not stop unrelated services.' }
        finally { $listener.Stop() }
    }

    Invoke-Checked 'docker' @('build', '--progress=plain', '-t', 'week04-web:1.0.0', '.')
    $imageJson = Invoke-Checked 'docker' @('image', 'inspect', 'week04-web:1.0.0')
    $imageInfo = @($imageJson | ConvertFrom-Json)[0]
    $imageEvidence = [ordered]@{
        tag = 'week04-web:1.0.0'
        id = $imageInfo.Id
        sizeBytes = $imageInfo.Size
        sizeMiB = [math]::Round($imageInfo.Size / 1MB, 2)
        configuredUser = $imageInfo.Config.User
    }
    $imageEvidence | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceDir "image-$stamp.json") -Encoding UTF8
    Write-Host ("Built image: {0} MiB; user {1}" -f $imageEvidence.sizeMiB, $imageEvidence.configuredUser)
    $containerUid = Invoke-Checked 'docker' @('run', '--rm', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--entrypoint', 'id', 'week04-web:1.0.0', '-u')
    if (("$containerUid").Trim() -ne '1000') { throw "Container UID was $containerUid instead of 1000." }

    if (-not $clusterExists) {
        Invoke-Checked 'kind' @('create', 'cluster', '--name', 'week04', '--config', 'kind.yaml', '--wait', '180s')
    } else {
        Invoke-Checked 'kind' @('export', 'kubeconfig', '--name', 'week04')
    }
    Invoke-Kube @('cluster-info')
    $clusterReachable = $true
    Invoke-Checked 'kind' @('load', 'docker-image', 'week04-web:1.0.0', '--name', 'week04')
    Invoke-Kube @('apply', '-f', 'k8s/namespace.yaml')
    Invoke-Kube @('apply', '--dry-run=server', '-f', 'k8s/deployment.yaml', '-f', 'k8s/service.yaml')
    Invoke-Kube @('apply', '-f', 'k8s/deployment.yaml', '-f', 'k8s/service.yaml')
    if ($clusterExists) {
        # An existing pod could otherwise keep using the previous build of this tag.
        Invoke-Kube @('-n', 'week04', 'rollout', 'restart', 'deployment/web-app')
    }
    Invoke-Kube @('-n', 'week04', 'rollout', 'status', 'deployment/web-app', '--timeout=180s')
    $podsJson = Invoke-Kube @('-n', 'week04', 'get', 'pods', '-l', 'app=web-app', '-o', 'json')
    $pods = ($podsJson | ConvertFrom-Json).items
    $readyPods = @($pods | Where-Object {
        $pod = $_
        $terminating = $null -ne $pod.metadata.PSObject.Properties['deletionTimestamp']
        -not $terminating -and @($pod.status.conditions | Where-Object {
            $_.type -eq 'Ready' -and $_.status -eq 'True'
        }).Count -gt 0
    })
    if ($readyPods.Count -ne 2) { throw "Expected two active Ready pods; found $($readyPods.Count)." }
    $podsJson | Set-Content -LiteralPath (Join-Path $evidenceDir "pods-$stamp.json") -Encoding UTF8
    Invoke-Kube @('-n', 'week04', 'get', 'pods', '-o', 'wide')
    Invoke-Kube @('-n', 'week04', 'get', 'svc', 'web-app')
    foreach ($pod in $readyPods) {
        $uid = Invoke-Kube @('-n', 'week04', 'exec', $pod.metadata.name, '--', 'id', '-u')
        if (("$uid").Trim() -ne '1000') { throw "Pod $($pod.metadata.name) has unexpected UID $uid." }
        Invoke-Kube @('-n', 'week04', 'exec', $pod.metadata.name, '--', 'ps', '-o', 'pid,user,args')
    }

    $endpointChecks = @()
    foreach ($path in @('/', '/healthz', '/readyz', '/metadata', '/style.css', '/app.js', '/favicon.svg')) {
        $response = $null
        for ($attempt = 0; $attempt -lt 15; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri ('http://127.0.0.1:8080' + $path) -UseBasicParsing -TimeoutSec 5
                break
            } catch {
                if ($attempt -eq 14) { throw }
                Start-Sleep -Seconds 2
            }
        }
        if ($response.StatusCode -ne 200) { throw "Endpoint $path returned HTTP $($response.StatusCode)." }
        if ($path -eq '/healthz' -and ($response.Content | ConvertFrom-Json).status -ne 'ok') { throw 'Health payload was not ok.' }
        if ($path -eq '/readyz' -and ($response.Content | ConvertFrom-Json).status -ne 'ready') { throw 'Readiness payload was not ready.' }
        if ($path -eq '/metadata') {
            $metadata = $response.Content | ConvertFrom-Json
            if ($metadata.uid -ne 1000 -or $metadata.version -ne '1.0.0' -or $metadata.pod -notin @($readyPods.metadata.name)) {
                throw 'The local URL did not return metadata from the expected release and pods.'
            }
        }
        $endpointChecks += [ordered]@{ path = $path; status = $response.StatusCode; contentType = $response.Headers['Content-Type'] }
        Write-Host "PASS $path HTTP $($response.StatusCode)"
    }
    $result = [ordered]@{
        completedAt = (Get-Date).ToUniversalTime().ToString('o')
        status = 'PASS'
        context = 'kind-week04'
        namespace = 'week04'
        readyReplicas = $readyPods.Count
        url = 'http://127.0.0.1:8080'
        image = $imageEvidence
        endpoints = $endpointChecks
        remainingAssignmentChecks = @('Scale to three', 'Delete and replace a pod', 'Rolling image update', 'Browser DevTools QA', 'Webcam video')
    }
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidenceDir "deployment-result-$stamp.json") -Encoding UTF8
    Write-Host 'SUCCESS: two healthy replicas are deployed at http://127.0.0.1:8080' -ForegroundColor Green
    Write-Host "Evidence saved in $evidenceDir"
} catch {
    $exitCode = 1
    Write-Host ('DEPLOYMENT FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    if ($clusterReachable) {
        & kubectl --context kind-week04 --request-timeout=10s -n week04 get pods -o wide
        & kubectl --context kind-week04 --request-timeout=10s -n week04 get events --sort-by=.lastTimestamp
    }
    Write-Host 'No existing cluster, image, or unrelated service was deleted. Review the transcript before retrying.'
} finally {
    if ($transcribing) { Stop-Transcript | Out-Null }
    $env:Path = $originalPath
    $env:DOCKER_CONTEXT = $originalDockerContext
    Pop-Location
}
exit $exitCode
