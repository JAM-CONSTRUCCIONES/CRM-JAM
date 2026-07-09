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
$ClientesTable = $inputData.clientes_table
$TmpFiles = New-Object System.Collections.Generic.List[string]

if (-not $OutputPath) {
  $OutputPath = "docs/informes/exclusividad-dynamo-plan-$Stage-$ProjectId.json"
}

function New-TempJsonFile {
  param([object]$Content)
  $path = Join-Path (Get-Location) (".tmp-exclusividad-dynamo-" + [guid]::NewGuid().ToString('N') + ".json")
  $Content | ConvertTo-Json -Compress -Depth 20 | Set-Content -Path $path -Encoding ascii
  $TmpFiles.Add($path) | Out-Null
  return $path
}

$plan = @()
$now = (Get-Date).ToUniversalTime().ToString('o')

try {
  foreach ($candidate in @($inputData.candidatos)) {
    $pk = [string]$candidate.cliente_pk
    $sk = [string]$candidate.cliente_sk
    if (-not $pk -or -not $sk) {
      $plan += [pscustomobject]@{
        cedula = $candidate.cedula
        cliente = $candidate.cliente
        inmobiliaria_id = $candidate.inmobiliaria_id
        proyecto_id = $candidate.proyecto_id
        cliente_pk = $pk
        cliente_sk = $sk
        accion = 'sin_key_cliente'
        aplicado = $false
        error = 'El candidato no trae cliente_pk o cliente_sk'
      }
      continue
    }

    $itemPlan = [pscustomobject]@{
      cedula = $candidate.cedula
      cliente = $candidate.cliente
      inmobiliaria_id = $candidate.inmobiliaria_id
      proyecto_id = $candidate.proyecto_id
      cliente_pk = $pk
      cliente_sk = $sk
      accion = 'marcar_exclusividad_vencida'
      aplicado = $false
      error = $null
    }

    if ($Apply) {
      try {
        $keyPath = New-TempJsonFile @{
          pk = @{ S = $pk }
          sk = @{ S = $sk }
        }
        $valuesPath = New-TempJsonFile @{
          ':false' = @{ BOOL = $false }
          ':true' = @{ BOOL = $true }
          ':now' = @{ S = $now }
        }

        aws dynamodb update-item `
          --table-name $ClientesTable `
          --region $Region `
          --key "file://$keyPath" `
          --update-expression 'SET exclusividad_activa = :false, actualizado_en = :now' `
          --condition-expression 'attribute_exists(pk) AND exclusividad_activa = :true' `
          --expression-attribute-values "file://$valuesPath" `
          --output json | Out-Null

        $itemPlan.aplicado = $true
      }
      catch {
        $itemPlan.error = $_.Exception.Message
      }
    }

    $plan += $itemPlan
  }

  $result = [pscustomobject]@{
    stage = $Stage
    proyecto_id = $ProjectId
    clientes_table = $ClientesTable
    input_path = $InputPath
    modo = if ($Apply) { 'apply' } else { 'plan' }
    total_candidatos = @($inputData.candidatos).Count
    cambios_aplicados = @($plan | Where-Object { $_.aplicado }).Count
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
  Write-Output "Clientes candidatos: $($result.total_candidatos)"
  Write-Output "Cambios aplicados: $($result.cambios_aplicados)"
  Write-Output "Errores: $($result.errores)"
  Write-Output "Archivo generado: $OutputPath"
  $plan | Select-Object cedula, cliente, inmobiliaria_id, accion, aplicado, error | Format-Table -AutoSize
}
finally {
  foreach ($file in $TmpFiles) {
    Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
  }
}
