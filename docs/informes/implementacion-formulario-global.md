# Implementación de Formulario Global de Registro

## 📋 Resumen

Se implementó un formulario público global que permite a los clientes registrarse seleccionando cualquier inmobiliaria activa del sistema, en lugar de requerir un enlace específico por inmobiliaria.

## 🎯 Funcionalidad

### Formularios disponibles

1. **Formulario por inmobiliaria** (existente)
   - URL: `/captura?inmo={id}`
   - Requiere ID de inmobiliaria en la URL
   - Muestra solo proyectos de esa inmobiliaria

2. **Formulario global** (nuevo)
   - URL: `/captura-global`
   - Permite seleccionar cualquier inmobiliaria activa
   - Carga proyectos dinámicamente según la inmobiliaria seleccionada
   - Mantiene todas las validaciones (exclusividad, etc.)

## 🔧 Cambios implementados

### Backend

#### 1. Lambda - `lambdas/jam-captacion/routes/clientes.py`

Nueva función para listar inmobiliarias públicas:

```python
def listar_inmobiliarias_publico(event):
    """GET /publico/inmobiliarias — lista todas las inmobiliarias activas (sin auth)."""
    try:
        inmo_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
        response = inmo_table.query(
            IndexName='sk-pk-index',
            KeyConditionExpression='sk = :sk',
            FilterExpression='begins_with(pk, :prefix) AND activo = :activo',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':prefix': 'INMOBILIARIA#',
                ':activo': True
            }
        )
        
        result = []
        for item in response.get('Items', []):
            inmo_id = item['pk'].replace('INMOBILIARIA#', '')
            result.append({
                'id': inmo_id,
                'nombre': item.get('nombre', inmo_id),
                'imagen_url': item.get('imagen_url')
            })
        
        result.sort(key=lambda x: x['nombre'].lower())
        return ok(result)
    except Exception as e:
        print(f'ERROR listar_inmobiliarias_publico: {type(e).__name__}: {e}')
        return bad_request('Error al obtener inmobiliarias')
```

#### 2. Lambda - `lambdas/jam-captacion/handler.py`

Agregada ruta pública:

```python
if method == 'GET' and path == '/publico/inmobiliarias':
    return clientes.listar_inmobiliarias_publico(event)
```

#### 3. Infraestructura - `infra/lib/jam-stack.ts`

Agregada ruta en API Gateway:

```typescript
const publicoInmobiliariasResource = publicoResource.addResource('inmobiliarias');
publicoInmobiliariasResource.addMethod('GET', captacionLambdaIntegration);
```

### Frontend

#### 1. Servicio - `front/src/services/clientes.service.ts`

Nueva función para obtener inmobiliarias:

```typescript
export const getInmobiliariasPublico = async (): Promise<{ id: string; nombre: string; imagen_url?: string }[]> => {
  const res = await fetch(`${(await import('../config')).default.apiUrl}/publico/inmobiliarias`);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Error'), { response: { status: res.status, data } });
  return data;
};
```

#### 2. Componente - `front/src/pages/captura/CapturaGlobalPage.tsx`

Nuevo formulario con:
- Selector visual de inmobiliarias con imágenes/avatares
- Carga dinámica de proyectos
- Mismas validaciones que el formulario original
- Mismo diseño y UX

#### 3. Rutas - `front/src/App.tsx`

```typescript
<Route path="/captura-global" element={<CapturaGlobalPage />} />
```

#### 4. UI - `front/src/pages/inmobiliarias/InmobiliariasPage.tsx`

Agregado botón "Enlace global" en el header para copiar fácilmente el enlace del formulario global.

## 🚀 Despliegue

### Requisitos previos

- AWS CLI configurado
- Credenciales con permisos de despliegue
- Node.js instalado

### Pasos para desplegar

1. **Navegar a la carpeta de infraestructura:**
   ```bash
   cd infra
   ```

2. **Instalar dependencias (si es necesario):**
   ```bash
   npm install
   ```

3. **Compilar el código TypeScript:**
   ```bash
   npm run build
   ```

4. **Desplegar con CDK:**
   ```bash
   cdk deploy
   ```

   O si tienes múltiples stacks:
   ```bash
   cdk deploy JamStack
   ```

5. **Confirmar el despliegue:**
   - Revisar los cambios que se mostrarán
   - Escribir `y` para confirmar

### Verificación del despliegue

Una vez desplegado, verificar que el endpoint funcione:

```bash
curl https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/publico/inmobiliarias
```

Debería devolver un array JSON con las inmobiliarias activas:

```json
[
  {
    "id": "inmo-123",
    "nombre": "Inmobiliaria XYZ",
    "imagen_url": "https://..."
  }
]
```

### Despliegue del frontend

Si el frontend está en S3/CloudFront:

```bash
cd front
npm run build
aws s3 sync dist/ s3://tu-bucket-frontend --delete
aws cloudfront create-invalidation --distribution-id TU_DISTRIBUTION_ID --paths "/*"
```

O usar el script de despliegue si existe:

```bash
./deploy-frontend.sh
```

## 📱 URLs finales

- **Formulario global**: `https://tu-dominio.com/captura-global`
- **Formulario por inmobiliaria**: `https://tu-dominio.com/captura?inmo={id}`

## 🔒 Seguridad

- El endpoint `/publico/inmobiliarias` es público (sin autenticación)
- Solo devuelve inmobiliarias activas
- No expone información sensible (solo id, nombre e imagen)
- Mantiene todas las validaciones de exclusividad en el registro

## ✅ Validaciones

El formulario global mantiene todas las validaciones del formulario original:

1. **Exclusividad**: Valida que el cliente no tenga exclusividad con otra inmobiliaria
2. **Campos requeridos**: Nombres, apellidos, cédula, proyecto
3. **Formato de datos**: Email, teléfono, fecha de nacimiento
4. **Inmobiliaria activa**: Solo muestra inmobiliarias activas
5. **Proyectos activos**: Solo muestra proyectos activos asignados a la inmobiliaria

## 🎨 Características UX

- Selector visual de inmobiliarias con imágenes
- Carga dinámica de proyectos al seleccionar inmobiliaria
- Mensajes de error claros
- Pantalla de éxito después del registro
- Diseño responsive
- Mismo estilo visual que el formulario original

## 📊 Flujo de usuario

1. Usuario accede a `/captura-global`
2. Sistema carga todas las inmobiliarias activas
3. Usuario selecciona una inmobiliaria
4. Sistema carga los proyectos de esa inmobiliaria
5. Usuario selecciona un proyecto
6. Usuario completa sus datos personales
7. Sistema valida exclusividad y otros requisitos
8. Sistema registra al cliente
9. Usuario ve pantalla de confirmación

## 🐛 Troubleshooting

### Error 403 Forbidden en `/publico/inmobiliarias`

**Causa**: El endpoint no está desplegado en API Gateway

**Solución**: 
1. Verificar que el cambio esté en `infra/lib/jam-stack.ts`
2. Ejecutar `cdk deploy` para desplegar la infraestructura
3. Esperar a que el despliegue termine completamente

### No se cargan las inmobiliarias

**Causa**: Puede ser un problema de CORS o el endpoint no está disponible

**Solución**:
1. Verificar en la consola del navegador el error exacto
2. Verificar que el endpoint responda correctamente con curl
3. Verificar que las inmobiliarias tengan `activo: true` en DynamoDB

### No se cargan los proyectos

**Causa**: La inmobiliaria no tiene proyectos asignados

**Solución**:
1. Ir a la página de inmobiliarias en el admin
2. Editar la inmobiliaria y asignar proyectos
3. Verificar que los proyectos estén activos

## 📝 Notas adicionales

- El formulario global usa el mismo endpoint de registro que el formulario por inmobiliaria
- Las validaciones de exclusividad se mantienen intactas
- El sistema de notificaciones por correo funciona igual
- Los registros se almacenan de la misma forma en DynamoDB
