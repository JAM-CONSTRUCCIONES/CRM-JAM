param(
  [ValidateSet('dev', 'prod')]
  [string]$Stage = 'prod',
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [string]$Region = 'us-east-1',
  [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

$Suffix = if ($Stage -eq 'prod') { '-prod' } else { '' }
$ClientesTable = "jam-clientes$Suffix"
$ProcesosTable = "jam-procesos$Suffix"
$AdvancedStates = @('reserva', 'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendido', 'vendida')
$TmpFiles = New-Object System.Collections.Generic.List[string]

if (-not $OutputPath) {
  $OutputPath = "docs/informes/exclusividad-candidatos-$Stage-$ProjectId.json"
}

function New-TempJsonFile {
  param([object]$Content)
  $path = Join-Path (Get-Location) (".tmp-exclusividad-discover-" + [guid]::NewGuid().ToString('N') + ".json")
  $Content | ConvertTo-Json -Compress -Depth 20 | Set-Content -Path $path -Encoding ascii
  $TmpFiles.Add($path) | Out-Null
  return $path
}

function Get-AttrString {
  param($Item, [string]$Name)
  if ($null -eq $Item -or -not $Item.PSObject.Properties.Name.Contains($Name)) { return '' }
  $attr = $Item.$Name
  if ($null -eq $attr) { return '' }
  if ($attr.PSObject.Properties.Name.Contains('S')) { return [string]$attr.S }
  if ($attr.PSObject.Properties.Name.Contains('BOOL')) { return [string]$attr.BOOL }
  return ''
}

function Get-AttrBool {
  param($Item, [string]$Name)
  if ($null -eq $Item -or -not $Item.PSObject.Properties.Name.Contains($Name)) { return $false }
  $attr = $Item.$Name
  if ($null -eq $attr) { return $false }
  if ($attr.PSObject.Properties.Name.Contains('BOOL')) { return [bool]$attr.BOOL }
  if ($attr.PSObject.Properties.Name.Contains('S')) { return ([string]$attr.S).ToLowerInvariant() -eq 'true' }
  return $false
}

function Get-ScheduleName {
  param([string]$Cedula, [string]$InmobiliariaId, [string]$ProyectoId)
  $safeCedula = $Cedula.Replace('/', '-').Replace('#', '-')
  $safeInmo = $InmobiliariaId.Replace('/', '-').Replace('#', '-').Replace('INMOBILIARIA', 'I')
  $safeProy = $ProyectoId.Replace('/', '-').Replace('#', '-').Replace('PROYECTO', 'P')
  return "exclusividad-$safeCedula-$safeInmo-$safeProy"
}

function Get-ProcesosAvanzadosProyecto {
  $items = @()
  foreach ($estado in $AdvancedStates) {
    $lastKeyPath = $null
    do {
      $valuesPath = New-TempJsonFile @{
        ':p' = @{ S = $ProjectId }
        ':e' = @{ S = $estado }
      }
      $namesPath = New-TempJsonFile @{ '#estado' = 'estado' }
      $args = @(
        'dynamodb', 'query',
        '--table-name', $ProcesosTable,
        '--region', $Region,
        '--index-name', 'gsi-proyecto-procesos',
        '--key-condition-expression', 'proyecto_id = :p AND #estado = :e',
        '--expression-attribute-values', "file://$valuesPath",
        '--expression-attribute-names', "file://$namesPath",
        '--output', 'json'
      )
      if ($lastKeyPath) {
        $args += @('--exclusive-start-key', "file://$lastKeyPath")
      }
      $result = (& aws @args) | ConvertFrom-Json
      $items += @($result.Items)
      $lastKeyPath = if ($result.LastEvaluatedKey) { New-TempJsonFile $result.LastEvaluatedKey } else { $null }
    } while ($lastKeyPath)
  }
  return $items
}

function Get-Cliente {
  param([string]$Cedula, [string]$InmobiliariaId)
  $keyPath = New-TempJsonFile @{
    pk = @{ S = "CLIENTE#$Cedula#$InmobiliariaId" }
    sk = @{ S = "PROYECTO#$ProjectId" }
  }
  $result = aws dynamodb get-item `
    --table-name $ClientesTable `
    --region $Region `
    --key "file://$keyPath" `
    --output json | ConvertFrom-Json
  return $result.Item
}

try {
  $procesos = @(Get-ProcesosAvanzadosProyecto)
  $agrupados = @{}
  foreach ($p in $procesos) {
    $cedula = Get-AttrString $p 'cedula'
    $inmo = Get-AttrString $p 'inmobiliaria_id'
    if (-not $cedula -or -not $inmo) { continue }
    $key = "$cedula|$inmo"
    if (-not $agrupados.ContainsKey($key)) {
      $agrupados[$key] = New-Object System.Collections.Generic.List[object]
    }
    $agrupados[$key].Add($p)
  }

  $candidatos = @()
  foreach ($entry in $agrupados.GetEnumerator()) {
    $parts = $entry.Key.Split('|')
    $cedula = $parts[0]
    $inmo = $parts[1]
    $cliente = Get-Cliente -Cedula $cedula -InmobiliariaId $inmo
    if (-not $cliente) { continue }
    if (-not (Get-AttrBool $cliente 'exclusividad_activa')) { continue }

    $procesosCliente = @($entry.Value.ToArray())
    $candidatos += [pscustomobject]@{
      cedula = $cedula
      cliente = ((Get-AttrString $cliente 'nombres') + ' ' + (Get-AttrString $cliente 'apellidos')).Trim()
      inmobiliaria_id = $inmo
      proyecto_id = $ProjectId
      fecha_captacion = Get-AttrString $cliente 'fecha_captacion'
      fecha_vencimiento = Get-AttrString $cliente 'fecha_vencimiento'
      estados_proceso = @($procesosCliente | ForEach-Object { Get-AttrString $_ 'estado' } | Sort-Object -Unique)
      unidades = @($procesosCliente | ForEach-Object { Get-AttrString $_ 'unidad_nombre' } | Sort-Object -Unique)
      schedule_exclusividad = Get-ScheduleName -Cedula $cedula -InmobiliariaId $inmo -ProyectoId $ProjectId
      cliente_pk = Get-AttrString $cliente 'pk'
      cliente_sk = Get-AttrString $cliente 'sk'
    }
  }

  $resultado = [pscustomobject]@{
    stage = $Stage
    proyecto_id = $ProjectId
    clientes_table = $ClientesTable
    procesos_table = $ProcesosTable
    total_procesos_avanzados = $procesos.Count
    total_candidatos = $candidatos.Count
    creado_en = (Get-Date).ToUniversalTime().ToString('o')
    candidatos = $candidatos
  }

  $dir = Split-Path -Parent $OutputPath
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $resultado | ConvertTo-Json -Depth 20 | Set-Content -Path $OutputPath -Encoding utf8

  Write-Output "Procesos avanzados encontrados: $($procesos.Count)"
  Write-Output "Clientes candidatos encontrados: $($candidatos.Count)"
  Write-Output "Archivo generado: $OutputPath"
  $candidatos | Select-Object cedula, cliente, inmobiliaria_id, proyecto_id, estados_proceso, schedule_exclusividad | Format-Table -AutoSize
}
finally {
  foreach ($file in $TmpFiles) {
    Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
  }
}
