param(
  [ValidateSet('dev', 'prod')]
  [string]$Stage = 'prod',
  [string]$ProjectId = '',
  [ValidateSet('Discover', 'DeleteSchedules', 'ExpireClients')]
  [string]$Phase = 'Discover',
  [switch]$DryRun,
  [switch]$Apply,
  [string]$Region = 'us-east-1'
)

$ErrorActionPreference = 'Stop'

$Suffix = if ($Stage -eq 'prod') { '-prod' } else { '' }
$ClientesTable = "jam-clientes$Suffix"
$ProcesosTable = "jam-procesos$Suffix"
$AdvancedStates = @('reserva', 'separacion', 'inicial', 'pagos_atrasados', 'contra_entrega', 'vendido', 'vendida')
$Timestamp = (Get-Date).ToUniversalTime().ToString('o')
$TmpFiles = New-Object System.Collections.Generic.List[string]

function New-TempJsonFile {
  param([object]$Content)
  $path = Join-Path (Get-Location) (".tmp-exclusividad-" + [guid]::NewGuid().ToString('N') + ".json")
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

function Get-ExclusividadScheduleName {
  param([string]$Cedula, [string]$InmobiliariaId, [string]$ProyectoId)
  $safeCedula = $Cedula.Replace('/', '-').Replace('#', '-')
  $safeInmo = $InmobiliariaId.Replace('/', '-').Replace('#', '-').Replace('INMOBILIARIA', 'I')
  $safeProy = $ProyectoId.Replace('/', '-').Replace('#', '-').Replace('PROYECTO', 'P')
  return "exclusividad-$safeCedula-$safeInmo-$safeProy"
}

function Test-ScheduleExists {
  param([string]$Name)
  try {
    aws scheduler get-schedule --name $Name --region $Region --output json 2>$null | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

function Get-ClientesActivos {
  $items = @()
  $lastKeyPath = $null

  do {
    if ($ProjectId) {
      $values = @{
        ':p' = @{ S = $ProjectId }
        ':t' = @{ BOOL = $true }
      }
      $valuesPath = New-TempJsonFile $values
      $args = @(
        'dynamodb', 'query',
        '--table-name', $ClientesTable,
        '--region', $Region,
        '--index-name', 'gsi-proyecto-clientes',
        '--key-condition-expression', 'proyecto_id = :p',
        '--filter-expression', 'exclusividad_activa = :t',
        '--expression-attribute-values', "file://$valuesPath",
        '--output', 'json'
      )
    }
    else {
      $values = @{ ':t' = @{ BOOL = $true } }
      $valuesPath = New-TempJsonFile $values
      $args = @(
        'dynamodb', 'scan',
        '--table-name', $ClientesTable,
        '--region', $Region,
        '--filter-expression', 'exclusividad_activa = :t',
        '--expression-attribute-values', "file://$valuesPath",
        '--output', 'json'
      )
    }

    if ($lastKeyPath) {
      $args += @('--exclusive-start-key', "file://$lastKeyPath")
    }

    $json = & aws @args
    $result = $json | ConvertFrom-Json
    $items += @($result.Items)

    if ($result.LastEvaluatedKey) {
      $lastKeyPath = New-TempJsonFile $result.LastEvaluatedKey
    }
    else {
      $lastKeyPath = $null
    }
  } while ($lastKeyPath)

  return $items
}

function Get-ProcesosCliente {
  param([string]$Cedula, [string]$InmobiliariaId)
  $pk = "PROCESO#$Cedula#$InmobiliariaId"
  $items = @()
  $lastKeyPath = $null

  do {
    $values = @{ ':pk' = @{ S = $pk } }
    $valuesPath = New-TempJsonFile $values
    $args = @(
      'dynamodb', 'query',
      '--table-name', $ProcesosTable,
      '--region', $Region,
      '--key-condition-expression', 'pk = :pk',
      '--expression-attribute-values', "file://$valuesPath",
      '--output', 'json'
    )
    if ($lastKeyPath) {
      $args += @('--exclusive-start-key', "file://$lastKeyPath")
    }

    $json = & aws @args
    $result = $json | ConvertFrom-Json
    $items += @($result.Items)

    if ($result.LastEvaluatedKey) {
      $lastKeyPath = New-TempJsonFile $result.LastEvaluatedKey
    }
    else {
      $lastKeyPath = $null
    }
  } while ($lastKeyPath)

  return $items
}

function Get-ProcesosAvanzadosProyecto {
  param([string]$ProyectoId)
  $items = @()

  foreach ($estado in $AdvancedStates) {
    $lastKeyPath = $null
    do {
      $values = @{
        ':p' = @{ S = $ProyectoId }
        ':e' = @{ S = $estado }
      }
      $names = @{ '#estado' = 'estado' }
      $valuesPath = New-TempJsonFile $values
      $namesPath = New-TempJsonFile $names
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

      $json = & aws @args
      $result = $json | ConvertFrom-Json
      $items += @($result.Items)

      if ($result.LastEvaluatedKey) {
        $lastKeyPath = New-TempJsonFile $result.LastEvaluatedKey
      }
      else {
        $lastKeyPath = $null
      }
    } while ($lastKeyPath)
  }

  return $items
}

function Get-ClientePorProceso {
  param([string]$Cedula, [string]$InmobiliariaId, [string]$ProyectoId)
  $key = @{
    pk = @{ S = "CLIENTE#$Cedula#$InmobiliariaId" }
    sk = @{ S = "PROYECTO#$ProyectoId" }
  }
  $keyPath = New-TempJsonFile $key
  $json = aws dynamodb get-item `
    --table-name $ClientesTable `
    --region $Region `
    --key "file://$keyPath" `
    --output json
  $result = $json | ConvertFrom-Json
  return $result.Item
}

function Update-ClienteExclusividad {
  param($Cliente)
  $key = @{
    pk = @{ S = (Get-AttrString $Cliente 'pk') }
    sk = @{ S = (Get-AttrString $Cliente 'sk') }
  }
  $values = @{
    ':false' = @{ BOOL = $false }
    ':ts' = @{ S = $Timestamp }
  }
  $keyPath = New-TempJsonFile $key
  $valuesPath = New-TempJsonFile $values

  aws dynamodb update-item `
    --table-name $ClientesTable `
    --region $Region `
    --key "file://$keyPath" `
    --update-expression 'SET exclusividad_activa = :false, actualizado_en = :ts' `
    --condition-expression 'attribute_exists(pk)' `
    --expression-attribute-values "file://$valuesPath" `
    --output json | Out-Null
}

function Remove-ExclusividadSchedule {
  param([string]$Name)
  try {
    aws scheduler delete-schedule --name $Name --region $Region --output json | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

try {
  Write-Output "Ambiente: $Stage"
  Write-Output "Clientes table: $ClientesTable"
  Write-Output "Procesos table: $ProcesosTable"
  Write-Output "Proyecto filtro: $(if ($ProjectId) { $ProjectId } else { 'TODOS' })"
  Write-Output "Fase: $Phase"
  Write-Output "Modo: $(if ($Apply) { 'APLICAR CAMBIOS' } else { 'SOLO LECTURA' })"
  Write-Output ''

  $clientes = @()
  $targets = @()

  if ($ProjectId) {
    $procesosProyecto = @(Get-ProcesosAvanzadosProyecto -ProyectoId $ProjectId)
    $procesosPorCliente = @{}
    foreach ($proceso in $procesosProyecto) {
      $cedulaProc = Get-AttrString $proceso 'cedula'
      $inmoProc = Get-AttrString $proceso 'inmobiliaria_id'
      if (-not $cedulaProc -or -not $inmoProc) { continue }
      $key = "$cedulaProc|$inmoProc|$ProjectId"
      if (-not $procesosPorCliente.ContainsKey($key)) {
        $procesosPorCliente[$key] = New-Object System.Collections.Generic.List[object]
      }
      $procesosPorCliente[$key].Add($proceso)
    }

    foreach ($entry in $procesosPorCliente.GetEnumerator()) {
      $parts = $entry.Key.Split('|')
      $cedula = $parts[0]
      $inmo = $parts[1]
      $proyecto = $parts[2]
      $procesosAvanzados = @($entry.Value.ToArray())
      $cliente = Get-ClientePorProceso -Cedula $cedula -InmobiliariaId $inmo -ProyectoId $proyecto
      if (-not $cliente) { continue }
      $clientes += $cliente
      if (-not (Get-AttrBool $cliente 'exclusividad_activa')) { continue }

      $scheduleName = Get-ExclusividadScheduleName -Cedula $cedula -InmobiliariaId $inmo -ProyectoId $proyecto
      $scheduleExists = if ($Phase -eq 'Discover') { $null } else { Test-ScheduleExists -Name $scheduleName }

      $targets += [pscustomobject]@{
        Cedula = $cedula
        Cliente = ((Get-AttrString $cliente 'nombres') + ' ' + (Get-AttrString $cliente 'apellidos')).Trim()
        Inmobiliaria = $inmo
        Proyecto = $proyecto
        FechaCaptacion = Get-AttrString $cliente 'fecha_captacion'
        FechaVencimiento = Get-AttrString $cliente 'fecha_vencimiento'
        EstadosProceso = (($procesosAvanzados | ForEach-Object { Get-AttrString $_ 'estado' } | Sort-Object -Unique) -join ',')
        Schedule = $scheduleName
        ScheduleExiste = $scheduleExists
        ClienteItem = $cliente
      }
    }
  }
  else {
    $clientes = @(Get-ClientesActivos)
    foreach ($cliente in $clientes) {
      $cedula = Get-AttrString $cliente 'cedula'
      $inmo = Get-AttrString $cliente 'inmobiliaria_id'
      $proyecto = (Get-AttrString $cliente 'proyecto_id').Replace('PROYECTO#', '')
      if (-not $cedula -or -not $inmo -or -not $proyecto) { continue }

      $procesos = @(Get-ProcesosCliente -Cedula $cedula -InmobiliariaId $inmo)
      $procesosAvanzados = @($procesos | Where-Object {
        (Get-AttrString $_ 'proyecto_id') -eq $proyecto -and
        $AdvancedStates -contains (Get-AttrString $_ 'estado')
      })

      if ($procesosAvanzados.Count -eq 0) { continue }

      $scheduleName = Get-ExclusividadScheduleName -Cedula $cedula -InmobiliariaId $inmo -ProyectoId $proyecto
      $scheduleExists = if ($Phase -eq 'Discover') { $null } else { Test-ScheduleExists -Name $scheduleName }

      $targets += [pscustomobject]@{
        Cedula = $cedula
        Cliente = ((Get-AttrString $cliente 'nombres') + ' ' + (Get-AttrString $cliente 'apellidos')).Trim()
        Inmobiliaria = $inmo
        Proyecto = $proyecto
        FechaCaptacion = Get-AttrString $cliente 'fecha_captacion'
        FechaVencimiento = Get-AttrString $cliente 'fecha_vencimiento'
        EstadosProceso = (($procesosAvanzados | ForEach-Object { Get-AttrString $_ 'estado' } | Sort-Object -Unique) -join ',')
        Schedule = $scheduleName
        ScheduleExiste = $scheduleExists
        ClienteItem = $cliente
      }
    }
  }

  Write-Output "Clientes revisados: $($clientes.Count)"
  Write-Output "Clientes con proceso avanzado y exclusividad activa: $($targets.Count)"
  Write-Output ''

  $targets |
    Select-Object Cedula, Cliente, Inmobiliaria, Proyecto, EstadosProceso, FechaVencimiento, ScheduleExiste, Schedule |
    Format-Table -AutoSize

  if ($Phase -eq 'Discover') {
    Write-Output ''
    Write-Output 'DISCOVER: no se cambiaron clientes ni schedules.'
    Write-Output 'Siguiente paso recomendado: revisar esta lista antes de borrar schedules o vencer exclusividades.'
    exit 0
  }

  if (-not $Apply) {
    Write-Output ''
    Write-Output "SOLO LECTURA: fase $Phase sin -Apply, no se aplicaron cambios."
    exit 0
  }

  $clientesActualizados = 0
  $schedulesEliminados = 0
  foreach ($target in $targets) {
    if ($Phase -eq 'DeleteSchedules' -and $target.ScheduleExiste) {
      if (Remove-ExclusividadSchedule -Name $target.Schedule) {
        $schedulesEliminados += 1
      }
    }
    if ($Phase -eq 'ExpireClients') {
      Update-ClienteExclusividad -Cliente $target.ClienteItem
      $clientesActualizados += 1
    }
  }

  Write-Output ''
  Write-Output "Clientes actualizados exclusividad_activa=false: $clientesActualizados"
  Write-Output "Schedules eliminados: $schedulesEliminados"
}
finally {
  foreach ($file in $TmpFiles) {
    Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
  }
}
