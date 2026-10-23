# Implementación de Exportación de Inventario a Excel

## 📋 Resumen

Se implementó la funcionalidad de exportar el inventario completo de un proyecto a Excel, incluyendo información de unidades, clientes, inmobiliarias y procesos de venta.

## 📊 Estructura del Excel

El archivo Excel generado contiene **29 columnas** con toda la información relevante:

### Información de la Unidad (11 columnas)
1. **ID Unidad** - Identificador único
2. **Etapa** - Nombre de la etapa
3. **Tipo** - Casa, Apartamento, etc.
4. **Manzana** - Ubicación
5. **Piso** - Nivel
6. **Metraje** - Metros cuadrados
7. **Metraje Terraza** - M² de terraza
8. **Metraje Patio** - M² de patio
9. **Cuartos** - Número de habitaciones
10. **Baños** - Número de baños
11. **Parqueos** - Espacios de estacionamiento

### Información Financiera (7 columnas)
12. **Precio** - Precio total
13. **Precio Reserva** - Monto de reserva
14. **Precio Separación** - Monto de separación
15. **Precio Inicial** - Pago inicial
16. **Cuota Monto** - Monto de cuota mensual
17. **Cuota Meses** - Número de cuotas
18. **Contra Entrega** - Pago contra entrega

### Estado y Cliente (7 columnas)
19. **Estado** - Disponible, Bloqueada, Reservada, etc.
20. **Cliente Cédula** - Documento del cliente
21. **Cliente Nombre** - Nombre completo
22. **Cliente Teléfono** - Contacto
23. **Cliente Correo** - Email
24. **Inmobiliaria** - Nombre de la inmobiliaria
25. **Estado Proceso** - Captación, Reserva, Separación, etc.

### Fechas y Seguimiento (4 columnas)
26. **Fecha Bloqueo** - Cuándo se bloqueó
27. **Fecha Liberación** - Cuándo se libera
28. **Días Restantes** - Días hasta liberación
29. **Comentario** - Notas adicionales

## 🔧 Implementación

### Backend

#### 1. Lambda - `lambdas/jam-proyectos/routes/excel.py`

Nueva función `exportar_inventario()`:

**Proceso:**
1. Valida que el proyecto exista
2. Consulta todas las unidades del proyecto (con paginación)
3. Obtiene etapas para nombres legibles
4. Consulta procesos activos del proyecto
5. Obtiene información de clientes asociados
6. Obtiene nombres de inmobiliarias
7. Genera Excel con openpyxl con estilos profesionales
8. Sube el archivo a S3
9. Genera URL de descarga temporal (5 minutos)

**Características:**
- Maneja grandes volúmenes de datos con paginación
- Formatea valores Decimal correctamente
- Calcula días restantes de bloqueo en tiempo real
- Aplica estilos profesionales (headers azules, bordes, alineación)
- Ajusta anchos de columna automáticamente

#### 2. Handler - `lambdas/jam-proyectos/handler.py`

Agregada ruta:
```python
if method == 'GET' and path.endswith('/inventario/exportar'):
    return excel.exportar_inventario(event)
```

### Frontend

#### 1. Servicio - `front/src/services/proyectos.service.ts`

Nueva función:
```typescript
export const exportarInventario = (proyectoId: string): Promise<{
  download_url: string;
  filename: string;
  total_unidades: number;
  proyecto_nombre: string;
}> => apiGet(`/admin/inventario/exportar?proyecto_id=${proyectoId}`);
```

#### 2. Componente - `front/src/pages/inventario/InventarioPage.tsx`

**Cambios:**
- Agregado botón "Exportar" en el header (vista de unidades)
- Estado `exportando` para mostrar loading
- Función `handleExportar()` que:
  - Llama al endpoint
  - Muestra mensaje de éxito con cantidad de unidades
  - Abre automáticamente la descarga en nueva pestaña
- Botón deshabilitado en modo preview

## 🚀 Uso

### Para el usuario

1. Navegar a **Inventario**
2. Seleccionar un proyecto
3. Hacer clic en el botón **"Exportar"** en el header
4. El archivo Excel se descargará automáticamente

### Nombre del archivo

Formato: `inventario_{proyecto_id}_{timestamp}.xlsx`

Ejemplo: `inventario_LOPEZ-VII_2026-05-09T15-30-45-123Z.xlsx`

## 🎨 Características del Excel

### Estilos aplicados

- **Header**: Fondo azul (#1F4E78), texto blanco, negrita
- **Bordes**: Todas las celdas con bordes grises
- **Alineación**: Centrada en headers, vertical en datos
- **Anchos**: Columnas ajustadas automáticamente para legibilidad

### Ordenamiento

Las unidades se ordenan alfabéticamente por `id_unidad` para facilitar la búsqueda.

### Valores vacíos

Los campos sin datos se muestran como celdas vacías (no "null" o "undefined").

## 🔒 Seguridad

- Endpoint protegido con autenticación admin
- URL de descarga temporal (expira en 5 minutos)
- Archivo almacenado en S3 con permisos privados
- Solo accesible mediante URL firmada

## 📊 Rendimiento

- Maneja proyectos con miles de unidades
- Usa paginación para consultas grandes
- Genera el Excel en memoria (no disco)
- Tiempo estimado: ~2-5 segundos para 500 unidades

## 🐛 Manejo de errores

### Frontend
- Muestra mensaje de error si falla la exportación
- Loading state mientras genera el archivo
- Botón deshabilitado durante la exportación

### Backend
- Valida que el proyecto exista
- Valida que tenga unidades
- Captura y registra errores en CloudWatch
- Devuelve mensajes de error descriptivos

## 📝 Casos de uso

1. **Reportes ejecutivos**: Vista completa del inventario
2. **Análisis de ventas**: Estado de procesos y clientes
3. **Seguimiento de bloqueos**: Fechas y días restantes
4. **Auditoría**: Registro completo de unidades y asignaciones
5. **Compartir con stakeholders**: Formato universal (Excel)

## 🔄 Próximas mejoras (opcionales)

- [ ] Filtrar exportación por estado de unidad
- [ ] Filtrar por inmobiliaria
- [ ] Agregar gráficos en el Excel
- [ ] Múltiples hojas (resumen, detalle, estadísticas)
- [ ] Exportar historial de cambios
- [ ] Programar exportaciones automáticas

## 🚀 Despliegue

Para que la funcionalidad esté disponible:

```bash
cd infra
npm run build
cdk deploy
```

Luego desplegar el frontend:

```bash
cd front
npm run build
# Subir a S3/CloudFront según tu proceso
```

## ✅ Verificación

Después del despliegue, verificar:

1. El botón "Exportar" aparece en la vista de unidades
2. Al hacer clic, muestra loading
3. Se descarga un archivo .xlsx
4. El archivo contiene todas las columnas esperadas
5. Los datos son correctos y están formateados

## 📚 Dependencias

- **Backend**: `openpyxl` (ya incluido en layer)
- **Frontend**: Ninguna nueva (usa funciones existentes)

## 🎯 Resultado

Los usuarios ahora pueden exportar todo el inventario de un proyecto a Excel con un solo clic, obteniendo un reporte completo y profesional con toda la información relevante para análisis y toma de decisiones.
