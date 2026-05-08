# Script simple para limpiar tablas de DynamoDB
# Asume que ya confirmaste que quieres eliminar los datos

$tablas = @(
    'jam-inventario',
    'jam-clientes', 
    'jam-procesos',
    'jam-historial-estatus',
    'jam-historial-bloqueos'
)

Write-Host "Limpiando tablas DynamoDB..." -ForegroundColor Cyan

foreach ($tabla in $tablas) {
    Write-Host "`nLimpiando: $tabla" -ForegroundColor Yellow
    
    # Scan para obtener todos los items
    $items = aws dynamodb scan --table-name $tabla --output json | ConvertFrom-Json
    
    if ($items.Items.Count -eq 0) {
        Write-Host "  Tabla vacia" -ForegroundColor Gray
        continue
    }
    
    # Obtener nombres de las claves
    $tableDesc = aws dynamodb describe-table --table-name $tabla --output json | ConvertFrom-Json
    $keyNames = $tableDesc.Table.KeySchema | ForEach-Object { $_.AttributeName }
    
    Write-Host "  Items encontrados: $($items.Items.Count)" -ForegroundColor Gray
    Write-Host "  Eliminando..." -ForegroundColor Gray
    
    $count = 0
    foreach ($item in $items.Items) {
        # Construir la clave
        $key = @{}
        foreach ($keyName in $keyNames) {
            $key[$keyName] = $item.$keyName
        }
        
        $keyJson = $key | ConvertTo-Json -Compress -Depth 10
        aws dynamodb delete-item --table-name $tabla --key $keyJson 2>&1 | Out-Null
        $count++
        
        if ($count % 10 -eq 0) {
            Write-Host "  Eliminados: $count" -NoNewline -ForegroundColor Gray
            Write-Host "`r" -NoNewline
        }
    }
    
    Write-Host "  Completado: $count items eliminados" -ForegroundColor Green
}

Write-Host "`nLimpieza completada!" -ForegroundColor Green
