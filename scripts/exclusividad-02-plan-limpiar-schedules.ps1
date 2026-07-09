param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$Region = 'us-east-1',
  [string]$OutputPath = '',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $InputPath)) {
  throw "No existe el archivo de candidatos: $InputPath"
}

$inputData = Get-Content -Path $InputPath -Raw | ConvertFrom-Json
$Stage = $inputData.stage
$ProjectId = $inputData.proyecto_id

if (-not $OutputPath) {
  $OutputPath = "docs/informes/exclusividad-schedules-plan-$Stage-$ProjectId.json"
}

function Test-ScheduleExists {
  param([string]$Name)
  $result = aws scheduler get-schedule `
    --name $Name `
    --region $Region `
    --output json 2>$null

  if ($LASTEXITCODE -eq 0 -and $result) {
    return $true
  }

  return $false
}

$plan = @()
foreach ($candidate in @($inputData.candidatos)) {
  $scheduleName = [string]$candidate.schedule_exclusividad
  if (-not $scheduleName) { continue }

  $exists = Test-ScheduleExists -Name $scheduleName
  $plan += [pscustomobject]@{
    cedula = $candidate.cedula
    cliente = $candidate.cliente
    inmobiliaria_id = $candidate.inmobiliaria_id
    proyecto_id = $candidate.proyecto_id
    schedule = $scheduleName
    existe = $exists
    accion = if ($exists) { 'eliminar_schedule' } else { 'no_existe_schedule' }
    aplicado = $false
    error = $null
  }
}

if ($Apply) {
  foreach ($item in $plan) {
    if (-not $item.existe) { continue }

    try {
      aws scheduler delete-schedule `
        --name $item.schedule `
        --region $Region | Out-Null
      $item.aplicado = $true
    }
    catch {
      $item.error = $_.Exception.Message
    }
  }
}

$result = [pscustomobject]@{
  stage = $Stage
  proyecto_id = $ProjectId
  input_path = $InputPath
  modo = if ($Apply) { 'apply' } else { 'plan' }
  total_candidatos = @($inputData.candidatos).Count
  schedules_existentes = @($plan | Where-Object { $_.existe }).Count
  schedules_no_encontrados = @($plan | Where-Object { -not $_.existe }).Count
  schedules_eliminados = @($plan | Where-Object { $_.aplicado }).Count
  errores = @($plan | Where-Object { $_.error }).Count
  creado_en = (Get-Date).ToUniversalTime().ToString('o')
  plan = $plan
}

$dir = Split-Path -Parent $OutputPath
if ($dir -and -not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}

$result | ConvertTo-Json -Depth 20 | Set-Content -Path $OutputPath -Encoding utf8

Write-Output "Modo: $($result.modo)"
Write-Output "Schedules existentes: $($result.schedules_existentes)"
Write-Output "Schedules no encontrados: $($result.schedules_no_encontrados)"
Write-Output "Schedules eliminados: $($result.schedules_eliminados)"
Write-Output "Errores: $($result.errores)"
Write-Output "Archivo generado: $OutputPath"
$plan | Select-Object cedula, cliente, inmobiliaria_id, schedule, existe, accion, aplicado, error | Format-Table -AutoSize
