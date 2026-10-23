param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$TableName = 'jam-inventario-prod'
$Region = 'us-east-1'
$ProjectId = '0E3CF406'
$EtapaId = '1A9E1C7B'
$Bloque = 'D'
$Timestamp = (Get-Date).ToUniversalTime().ToString('o')

$queryValuesPath = Join-Path (Get-Location) '.tmp-query-values-prod.json'
$updateValuesPath = Join-Path (Get-Location) '.tmp-update-values-prod.json'
$keyPath = Join-Path (Get-Location) '.tmp-update-key-prod.json'

try {
  @{
    ':pk' = @{ S = "PROYECTO#$ProjectId" }
    ':u' = @{ S = 'UNIDAD#' }
  } | ConvertTo-Json -Compress -Depth 5 | Set-Content -Path $queryValuesPath -Encoding ascii

  @{
    ':m' = @{ S = $Bloque }
    ':ts' = @{ S = $Timestamp }
    ':e' = @{ S = $EtapaId }
    ':p' = @{ S = "$Bloque-" }
  } | ConvertTo-Json -Compress -Depth 5 | Set-Content -Path $updateValuesPath -Encoding ascii

  $queryJson = aws dynamodb query `
    --table-name $TableName `
    --region $Region `
    --key-condition-expression 'pk = :pk AND begins_with(sk, :u)' `
    --expression-attribute-values "file://$queryValuesPath" `
    --projection-expression 'pk,sk,id_unidad,etapa_id,manzana,actualizado_en,estado' `
    --output json

  $query = $queryJson | ConvertFrom-Json
  $items = @($query.Items)
  $targets = @($items | Where-Object {
    $_.etapa_id.S -eq $EtapaId -and
    -not $_.PSObject.Properties.Name.Contains('manzana') -and
    $_.id_unidad.S -like "$Bloque-*"
  } | Sort-Object { $_.id_unidad.S })

  Write-Output "Proyecto: $ProjectId"
  Write-Output "Etapa: $EtapaId"
  Write-Output "Bloque a asignar: $Bloque"
  Write-Output "Unidades del proyecto leidas: $($items.Count)"
  Write-Output "Unidades objetivo sin bloque/manzana: $($targets.Count)"
  Write-Output ''
  $targets | Select-Object `
    @{Name='id_unidad'; Expression={$_.id_unidad.S}},
    @{Name='sk'; Expression={$_.sk.S}},
    @{Name='estado'; Expression={$_.estado.S}},
    @{Name='actualizado_en'; Expression={$_.actualizado_en.S}} |
    Format-Table -AutoSize

  if ($DryRun) {
    Write-Output 'DRY-RUN: no se aplicaron cambios.'
    exit 0
  }

  $updated = 0
  foreach ($item in $targets) {
    @{
      pk = @{ S = $item.pk.S }
      sk = @{ S = $item.sk.S }
    } | ConvertTo-Json -Compress -Depth 5 | Set-Content -Path $keyPath -Encoding ascii

    aws dynamodb update-item `
      --table-name $TableName `
      --region $Region `
      --key "file://$keyPath" `
      --update-expression 'SET manzana = :m, actualizado_en = :ts' `
      --condition-expression 'attribute_not_exists(manzana) AND etapa_id = :e AND begins_with(id_unidad, :p)' `
      --expression-attribute-values "file://$updateValuesPath" `
      --output json | Out-Null

    $updated += 1
  }

  Write-Output "Actualizadas: $updated"
}
finally {
  Remove-Item -Path $queryValuesPath, $updateValuesPath, $keyPath -Force -ErrorAction SilentlyContinue
}
