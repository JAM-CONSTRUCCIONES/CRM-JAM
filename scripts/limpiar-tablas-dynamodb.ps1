# Script para limpiar todas las tablas de DynamoDB excepto jam-usuarios
# Requiere AWS CLI configurado

$ErrorActionPreference = "Stop"

# Tablas a limpiar (todas excepto jam-usuarios)
$TablasALimpiar = @(
    'jam-inventario',
    'jam-clientes',
    'jam-procesos',
    'jam-historial-estatus',
    'jam-historial-bloqueos'
)

function Limpiar-Tabla {
    param (
        [string]$NombreTabla
    )
    
    Write-Host "`n🔄 Limpiando tabla: $NombreTabla" -ForegroundColor Cyan
    
    try {
        # Obtener descripción de la tabla para conocer las claves
        $descripcion = aws dynamodb describe-table --table-name $NombreTabla | ConvertFrom-Json
        $keySchema = $descripcion.Table.KeySchema
        
        $keyNames = @()
        foreach ($key in $keySchema) {
            $keyNames += $key.AttributeName
        }
        
        Write-Host "   Claves: $($keyNames -join ', ')" -ForegroundColor Gray
        
        $itemsEliminados = 0
        $lastEvaluatedKey = $null
        
        do {
            # Scan para obtener items (solo las claves)
            $scanParams = @{
                TableName = $NombreTabla
                ProjectionExpression = ($keyNames -join ',')
            }
            
            if ($lastEvaluatedKey) {
                $scanParams['ExclusiveStartKey'] = $lastEvaluatedKey
            }
            
            $scanParamsJson = $scanParams | ConvertTo-Json -Compress
            $response = aws dynamodb scan --cli-input-json $scanParamsJson | ConvertFrom-Json
            
            if ($response.Items.Count -eq 0) {
                break
            }
            
            # Eliminar items en batch
            foreach ($item in $response.Items) {
                $key = @{}
                foreach ($keyName in $keyNames) {
                    $key[$keyName] = $item.$keyName
                }
                
                $keyJson = $key | ConvertTo-Json -Compress
                aws dynamodb delete-item --table-name $NombreTabla --key $keyJson | Out-Null
                $itemsEliminados++
                
                Write-Host "   Eliminados: $itemsEliminados items..." -NoNewline -ForegroundColor Yellow
                Write-Host "`r" -NoNewline
            }
            
            $lastEvaluatedKey = $response.LastEvaluatedKey
            
        } while ($lastEvaluatedKey)
        
        Write-Host "   ✅ Eliminados: $itemsEliminados items en total" -ForegroundColor Green
        return $itemsEliminados
        
    } catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        return 0
    }
}

# Main
Write-Host "=" * 60 -ForegroundColor White
Write-Host "🧹 LIMPIEZA DE TABLAS DYNAMODB" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor White

Write-Host "`n⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de:" -ForegroundColor Yellow
foreach ($tabla in $TablasALimpiar) {
    Write-Host "   - $tabla" -ForegroundColor Yellow
}
Write-Host "`n✅ La tabla 'jam-usuarios' NO será modificada" -ForegroundColor Green

$respuesta = Read-Host "`n¿Continuar? (escribe 'SI' para confirmar)"

if ($respuesta.Trim().ToUpper() -ne 'SI') {
    Write-Host "`n❌ Operación cancelada" -ForegroundColor Red
    exit
}

Write-Host "`n$('=' * 60)" -ForegroundColor White
Write-Host "Iniciando limpieza..." -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor White

$totalEliminados = 0

foreach ($tabla in $TablasALimpiar) {
    $eliminados = Limpiar-Tabla -NombreTabla $tabla
    $totalEliminados += $eliminados
}

Write-Host "`n$('=' * 60)" -ForegroundColor White
Write-Host "✅ LIMPIEZA COMPLETADA" -ForegroundColor Green
Write-Host "   Total de items eliminados: $totalEliminados" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor White

Write-Host "`n📝 Nota: Los usuarios en 'jam-usuarios' se mantienen intactos" -ForegroundColor Cyan
Write-Host "   Recuerda eliminar manualmente los usuarios de inmobiliarias si es necesario" -ForegroundColor Cyan
