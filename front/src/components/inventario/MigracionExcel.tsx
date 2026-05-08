import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, Button, Table, Tag, Input, InputNumber, Select, Space,
  Alert, Typography, Steps, Spin, Result, Tooltip, Badge, Popover,
} from 'antd';
import {
  UploadOutlined, RobotOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined, InfoCircleOutlined,
  ThunderboltOutlined, PlusOutlined,
} from '@ant-design/icons';
import {
  getUploadUrl, uploadExcel, getPreview, confirmarMigracion,
  type FilaMigracion, type ReporteMigracion,
} from '../../services/migracion.service';
import { getInmobiliarias, type Inmobiliaria } from '../../services/inmobiliarias.service';

const { Title, Text } = Typography;
const { Option } = Select;

const ESTADOS_VALIDOS = ['disponible', 'bloqueada', 'no_disponible'];

interface Props {
  proyectoId: string;
  proyectoNombre: string;
  onCerrar: () => void;
}

type Paso = 'upload' | 'revision' | 'resultado';

// Genera cédula fantasma única por proyecto + índice
const cedulaFantasma = (proyectoId: string, idx: number) =>
  `MIGP-${proyectoId}-${String(idx).padStart(3, '0')}`;

export default function MigracionExcel({ proyectoId, proyectoNombre, onCerrar }: Props) {
  const [paso, setPaso] = useState<Paso>('upload');
  const [cargando, setCargando] = useState(false);
  const [jobId, setJobId] = useState('');
  const [filas, setFilas] = useState<FilaMigracion[]>([]);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [reporte, setReporte] = useState<ReporteMigracion | null>(null);
  const [error, setError] = useState('');
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  // Cargar inmobiliarias al montar
  useEffect(() => {
    getInmobiliarias().then(setInmobiliarias).catch(() => {});
  }, []);

  // ── Scroll horizontal con Shift+Scroll ───────────────────────────────────
  useEffect(() => {
    const el = tableRef.current?.querySelector('.ant-table-body') as HTMLElement | null;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [paso]);

  // ── Validar fila ─────────────────────────────────────────────────────────
  const validarFila = (f: FilaMigracion) => {
    const errores: string[] = [];
    const advertencias: string[] = [];
    if (!f.id_unidad) errores.push('id_unidad vacío');
    if (f.precio === null || f.precio === undefined) errores.push('precio inválido o vacío');
    if (f.metraje === null || f.metraje === undefined) errores.push('metraje inválido o vacío');
    if (!ESTADOS_VALIDOS.includes(f.estado)) errores.push('estado inválido');
    if (f.estado !== 'disponible' && !f.inmobiliaria_nombre_sugerido)
      errores.push('inmobiliaria requerida para este estado');
    if (f.cliente_nombre_excel && !f.cedula)
      errores.push('cédula obligatoria cuando hay cliente');
    if (f.cedula) {
      if (!f.nombres_sugerido) errores.push('nombres requeridos si hay cédula');
      if (!f.apellidos_sugerido) errores.push('apellidos requeridos si hay cédula');
      if (!f.inmobiliaria_nombre_sugerido) errores.push('inmobiliaria requerida si hay cédula');
    }
    if (f.cliente_nombre_excel && !f.cedula) {
      if (!f.nombres_sugerido || !f.apellidos_sugerido)
        advertencias.push('Completa nombres y apellidos para registrar el cliente');
      if (!f.inmobiliaria_nombre_sugerido)
        advertencias.push('Sin inmobiliaria, el cliente no se registrará');
    }
    return { errores, advertencias };
  };

  // ── Subir Excel ──────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setCargando(true);
    setError('');
    try {
      const { upload_url, job_id } = await getUploadUrl(proyectoId);
      await uploadExcel(upload_url, file);
      setJobId(job_id);
      setArchivoNombre(file.name);

      let preview = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try { preview = await getPreview(job_id); break; } catch { /* sigue */ }
      }
      if (!preview) throw new Error('El procesamiento tardó demasiado. Intenta de nuevo.');
      setFilas(preview.filas);
      setPaso('revision');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo');
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  // ── Edición inline ───────────────────────────────────────────────────────
  const actualizarFila = useCallback((idUnidad: string, campo: keyof FilaMigracion, valor: unknown) => {
    setFilas(prev => prev.map(f => {
      if (f.id_unidad !== idUnidad) return f;
      let updated = { ...f, [campo]: valor };
      // Si el admin cambia la inmobiliaria manualmente, limpiar el ID sugerido
      // para que el writer haga lookup por nombre
      if (campo === 'inmobiliaria_nombre_sugerido') {
        updated = { ...updated, inmobiliaria_id_sugerido: null };
      }
      const { errores, advertencias } = validarFila(updated);
      return { ...updated, errores, advertencias };
    }));
  }, []);

  // ── Rellenar vacíos ──────────────────────────────────────────────────────
  const rellenarVacios = useCallback((campo: keyof FilaMigracion, valor: unknown) => {
    setFilas(prev => prev.map(f => {
      const vacio = f[campo] === null || f[campo] === undefined || f[campo] === '';
      if (!vacio) return f;
      const updated = { ...f, [campo]: valor };
      const { errores, advertencias } = validarFila(updated);
      return { ...updated, errores, advertencias };
    }));
  }, []);

  // ── Cédulas fantasma ─────────────────────────────────────────────────────
  const asignarCedulasFantasma = useCallback(() => {
    let contador = 1;
    setFilas(prev => prev.map(f => {
      if (!f.cliente_nombre_excel || f.cedula) return f;
      const cedula = cedulaFantasma(proyectoId, contador++);
      const updated = { ...f, cedula, cedula_es_fantasma: true } as FilaMigracion & { cedula_es_fantasma?: boolean };
      const { errores, advertencias } = validarFila(updated);
      return { ...updated, errores, advertencias };
    }));
  }, [proyectoId]);

  // ── Confirmar ────────────────────────────────────────────────────────────
  const handleConfirmar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const result = await confirmarMigracion(jobId, filas);
      setReporte(result);
      setPaso('resultado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar la migración');
    } finally {
      setCargando(false);
    }
  }, [jobId, filas]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const filasConError = filas.filter(f => f.errores.length > 0);
  const filasConAdvertencia = filas.filter(f => f.advertencias.length > 0 && f.errores.length === 0);
  const filasOk = filas.filter(f => f.errores.length === 0 && f.advertencias.length === 0);
  const puedeConfirmar = filasConError.length === 0 && filas.length > 0;
  const filasConClienteSinCedula = filas.filter(f => f.cliente_nombre_excel && !f.cedula).length;

  // ── Columnas ─────────────────────────────────────────────────────────────
  const columnas = [
    {
      title: 'Unidad', dataIndex: 'id_unidad', width: 100, fixed: 'left' as const,
      render: (v: string, r: FilaMigracion) => (
        <Space>
          {r.errores.length > 0 && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
          {r.errores.length === 0 && r.advertencias.length > 0 && <WarningOutlined style={{ color: '#faad14' }} />}
          {r.errores.length === 0 && r.advertencias.length === 0 && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Precio *', dataIndex: 'precio', width: 130,
      render: (v: number | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('precio'))}>
          <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }}
            formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            onChange={val => actualizarFila(r.id_unidad, 'precio', val)} />
        </CeldaRequerida>
      ),
    },
    {
      title: 'Metraje *', dataIndex: 'metraje', width: 90,
      render: (v: number | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('metraje'))}>
          <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }}
            onChange={val => actualizarFila(r.id_unidad, 'metraje', val)} />
        </CeldaRequerida>
      ),
    },
    {
      title: 'Estado *', dataIndex: 'estado', width: 140,
      render: (v: string, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('estado'))}>
          <Select value={v} style={{ width: '100%' }} onChange={val => actualizarFila(r.id_unidad, 'estado', val)}>
            <Option value="disponible"><Tag color="green">Disponible</Tag></Option>
            <Option value="bloqueada"><Tag color="orange">Bloqueada</Tag></Option>
            <Option value="no_disponible"><Tag color="red">No disponible</Tag></Option>
          </Select>
        </CeldaRequerida>
      ),
    },
    {
      title: 'Nombres', dataIndex: 'nombres_sugerido', width: 140,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaIA sugerido={r.ia_sugerido && !!v}>
          <Input value={v ?? ''} placeholder="Nombres"
            onChange={e => actualizarFila(r.id_unidad, 'nombres_sugerido', e.target.value)} />
        </CeldaIA>
      ),
    },
    {
      title: 'Apellidos', dataIndex: 'apellidos_sugerido', width: 140,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaIA sugerido={r.ia_sugerido && !!v}>
          <Input value={v ?? ''} placeholder="Apellidos"
            onChange={e => actualizarFila(r.id_unidad, 'apellidos_sugerido', e.target.value)} />
        </CeldaIA>
      ),
    },
    {
      title: 'Cédula', dataIndex: 'cedula', width: 140,
      render: (v: string | null, r: FilaMigracion & { cedula_es_fantasma?: boolean }) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('cédula'))}>
          <Tooltip title={r.cedula_es_fantasma ? 'Cédula temporal — completa la real después' : undefined}>
            <Input
              value={v ?? ''}
              placeholder="Cédula"
              style={r.cedula_es_fantasma ? { borderColor: '#faad14', background: '#fffbe6' } : undefined}
              onChange={e => actualizarFila(r.id_unidad, 'cedula', e.target.value)}
            />
          </Tooltip>
        </CeldaRequerida>
      ),
    },
    {
      title: 'Inmobiliaria', dataIndex: 'inmobiliaria_nombre_sugerido', width: 180,
      render: (v: string | null, r: FilaMigracion) => {
        const esNueva = !inmobiliarias.some(
          i => i.nombre.trim().toLowerCase() === (v ?? '').trim().toLowerCase()
        ) && !!v;
        return (
          <Tooltip title={esNueva ? 'Inmobiliaria nueva — se creará al confirmar' : r.ia_sugerido && !!v ? `Sugerido por IA` : undefined}>
            <Select
              value={v ?? undefined}
              placeholder="Seleccionar..."
              style={{ width: '100%', borderColor: esNueva ? '#faad14' : undefined }}
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={val => actualizarFila(r.id_unidad, 'inmobiliaria_nombre_sugerido', val ?? null)}
              dropdownRender={menu => (
                <>
                  {menu}
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <PlusOutlined /> Escribe un nombre nuevo para crear una inmobiliaria
                    </Text>
                  </div>
                </>
              )}
            >
              {inmobiliarias.filter(i => i.activo).map(i => (
                <Select.Option key={i.pk} value={i.nombre} label={i.nombre}>
                  {i.nombre}
                  {i.pk.includes('migracion') && <Tag style={{ marginLeft: 6 }} color="orange">borrador</Tag>}
                </Select.Option>
              ))}
            </Select>
          </Tooltip>
        );
      },
    },
    { title: 'Tipo', dataIndex: 'tipo', width: 70,
      render: (v: string | null, r: FilaMigracion) => <Input value={v ?? ''} onChange={e => actualizarFila(r.id_unidad, 'tipo', e.target.value)} /> },
    { title: 'Piso', dataIndex: 'piso', width: 65,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} onChange={val => actualizarFila(r.id_unidad, 'piso', val)} /> },
    { title: 'Manzana', dataIndex: 'manzana', width: 85,
      render: (v: string | null, r: FilaMigracion) => <Input value={v ?? ''} onChange={e => actualizarFila(r.id_unidad, 'manzana', e.target.value)} /> },
    { title: 'Parqueos', dataIndex: 'parqueos', width: 85,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} onChange={val => actualizarFila(r.id_unidad, 'parqueos', val)} /> },
    { title: 'Cuartos', dataIndex: 'num_cuartos', width: 75,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} onChange={val => actualizarFila(r.id_unidad, 'num_cuartos', val)} /> },
    { title: 'Baños', dataIndex: 'num_banos', width: 70,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} onChange={val => actualizarFila(r.id_unidad, 'num_banos', val)} /> },
    { title: 'P. Reserva', dataIndex: 'precio_reserva', width: 110,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'precio_reserva', val)} /> },
    { title: 'P. Separación', dataIndex: 'precio_separacion', width: 120,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'precio_separacion', val)} /> },
    { title: 'P. Inicial', dataIndex: 'precio_inicial', width: 110,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'precio_inicial', val)} /> },
    { title: 'Cuota', dataIndex: 'cuota_monto', width: 100,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'cuota_monto', val)} /> },
    { title: 'Contra entrega', dataIndex: 'contra_entrega', width: 120,
      render: (v: number | null, r: FilaMigracion) => <InputNumber value={v ?? undefined} min={0} style={{ width: '100%' }} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'contra_entrega', val)} /> },
    { title: 'Comentario', dataIndex: 'comentario', width: 150,
      render: (v: string | null, r: FilaMigracion) => <Input value={v ?? ''} placeholder="Opcional" onChange={e => actualizarFila(r.id_unidad, 'comentario', e.target.value)} /> },
    {
      title: 'Errores / Advertencias', width: 200, fixed: 'right' as const,
      render: (_: unknown, r: FilaMigracion) => (
        <Space direction="vertical" size={2}>
          {r.errores.map((e, i) => <Tag key={i} color="red">{e}</Tag>)}
          {r.advertencias.map((a, i) => <Tag key={i} color="orange">{a}</Tag>)}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Steps
        current={paso === 'upload' ? 0 : paso === 'revision' ? 1 : 2}
        items={[{ title: 'Subir Excel' }, { title: 'Revisar datos' }, { title: 'Resultado' }]}
        style={{ marginBottom: 32 }}
      />

      {/* PASO 1 */}
      {paso === 'upload' && (
        <div>
          {/* Guía de formato */}
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 20 }}
            message="Antes de subir, asegúrate que tu Excel tenga estas columnas"
            description={
              <div style={{ marginTop: 8, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: '#e6f4ff' }}>
                      {[
                        'unidad','Area','No Cuartos','No. baños','Tipo','Piso','Parqueos',
                        'NOMBRE CLIENTE','Precios US$','RESERVA','SEPARACION','INICIAL',
                        'CUOTAS 24','CONTRA ENTREGA','ESTATUS','INMOBILIARIA',
                        'FECHA BLOQUEO','FECHA FIN BLOQUEO/ PAGO SEPARACION','COMENTARIO',
                      ].map(h => (
                        <th key={h} style={{ border: '1px solid #91caff', padding: '4px 8px', color: '#1677ff', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                    <tr style={{ background: '#fafafa' }}>
                      {[
                        'B-A-101','76.34','3','2','D','1','1',
                        'JOSE MIGUEL BARRERA','75958.30','500','3297.91','11393.74',
                        '474.73','60766.64','CONTRATO FIRMADO','Plusval',
                        '2026-02-21','2026-03-21','',
                      ].map((v, i) => (
                        <td key={i} style={{ border: '1px solid #d9d9d9', padding: '4px 8px', color: '#555' }}>{v || <span style={{ color: '#bbb' }}>vacío</span>}</td>
                      ))}
                    </tr>
                  </thead>
                </table>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Tag color="blue">unidad — obligatorio</Tag>
                  <Tag color="blue">Precios US$ — obligatorio</Tag>
                  <Tag color="blue">Area — obligatorio</Tag>
                  <Tag color="blue">ESTATUS — obligatorio</Tag>
                  <Tag color="default">El resto es opcional</Tag>
                  <Tag color="orange">Si hay cliente, INMOBILIARIA también es obligatoria</Tag>
                </div>
                <div style={{ marginTop: 6, color: '#888', fontSize: 11 }}>
                  💡 Los nombres de columna no tienen que ser exactos — la IA intenta mapearlos automáticamente. Pero si coinciden, el resultado es más preciso.
                </div>
              </div>
            }
          />

          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Title level={4}>Migración de inventario — {proyectoNombre}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
              Sube el archivo Excel con el inventario. Solo aplica a proyectos sin unidades.
            </Text>
            {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
            <Spin spinning={cargando} tip="Procesando con IA...">
              <Upload accept=".xlsx" showUploadList={false} beforeUpload={file => { handleUpload(file); return false; }}>
                <Button icon={<UploadOutlined />} size="large" type="primary">Seleccionar archivo .xlsx</Button>
              </Upload>
            </Spin>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {paso === 'revision' && (
        <>
          {/* Barra superior */}
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <Text strong>{archivoNombre}</Text>
            <Badge count={filasOk.length} color="green" overflowCount={9999}><Tag color="green">Listas</Tag></Badge>
            <Badge count={filasConAdvertencia.length} color="orange" overflowCount={9999}><Tag color="orange">Advertencias</Tag></Badge>
            <Badge count={filasConError.length} color="red" overflowCount={9999}><Tag color="red">Errores</Tag></Badge>
            <Tooltip title="Sugerido por IA — editable"><Tag icon={<RobotOutlined />} color="purple">IA</Tag></Tooltip>
          </Space>

          {/* Botones de relleno */}
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            {filasConClienteSinCedula > 0 && (
              <Tooltip title={`Asigna cédulas temporales (MIGP-${proyectoId}-001...) a ${filasConClienteSinCedula} clientes sin cédula. Puedes completar las reales después.`}>
                <Button icon={<ThunderboltOutlined />} onClick={asignarCedulasFantasma}>
                  Cédulas temporales ({filasConClienteSinCedula})
                </Button>
              </Tooltip>
            )}
            <RellenarVaciosBtn campo="metraje" label="Rellenar metraje vacío" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="precio" label="Rellenar precio vacío" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="num_cuartos" label="Rellenar cuartos vacíos" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="num_banos" label="Rellenar baños vacíos" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="parqueos" label="Rellenar parqueos vacíos" tipo="numero" onRellenar={rellenarVacios} />
          </Space>

          {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
          <Alert type="info" icon={<InfoCircleOutlined />}
            message="Shift + scroll para moverse horizontalmente. Celdas rojas son obligatorias. Las marcadas con IA son sugerencias editables."
            style={{ marginBottom: 12 }} />

          <div ref={tableRef}>
            <Table
              dataSource={filas} columns={columnas} rowKey="id_unidad"
              scroll={{ x: 2800 }} size="small" pagination={{ pageSize: 50 }}
              rowClassName={r => r.errores.length > 0 ? 'fila-error' : r.advertencias.length > 0 ? 'fila-advertencia' : ''}
            />
          </div>

          <Space style={{ marginTop: 16 }}>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button type="primary" disabled={!puedeConfirmar} loading={cargando} onClick={handleConfirmar}>
              {filasConError.length > 0
                ? `Corrige ${filasConError.length} error(es) para continuar`
                : `Confirmar carga (${filas.length} unidades)`}
            </Button>
          </Space>
        </>
      )}

      {/* PASO 3 */}
      {paso === 'resultado' && reporte && (
        <Result
          status="success"
          title="Migración completada"
          subTitle={`${reporte.unidades_cargadas} unidades cargadas en ${proyectoNombre}`}
          extra={[
            <Space key="stats" direction="vertical" style={{ textAlign: 'left' }}>
              <Text>✅ Unidades cargadas: <strong>{reporte.unidades_cargadas}</strong></Text>
              <Text>👤 Clientes creados: <strong>{reporte.clientes_creados}</strong></Text>
              <Text>🏢 Inmobiliarias creadas: <strong>{reporte.inmobiliarias_creadas}</strong></Text>
              {reporte.advertencias > 0 && <Text>⚠️ Advertencias: <strong>{reporte.advertencias}</strong></Text>}
              {reporte.inmobiliarias_creadas > 0 && (
                <Alert type="warning" style={{ marginTop: 8 }}
                  message={`${reporte.inmobiliarias_creadas} inmobiliaria(s) creadas como borrador. Completa su configuración en Gestión de Inmobiliarias.`} />
              )}
            </Space>,
            <Button key="cerrar" type="primary" onClick={onCerrar}>Ir al inventario</Button>,
          ]}
        />
      )}
    </div>
  );
}

// ── Botón rellenar vacíos ─────────────────────────────────────────────────────
function RellenarVaciosBtn({ campo, label, tipo, onRellenar }: {
  campo: keyof FilaMigracion;
  label: string;
  tipo: 'numero' | 'texto';
  onRellenar: (campo: keyof FilaMigracion, valor: unknown) => void;
}) {
  const [valor, setValor] = useState<number | string | null>(null);
  const [open, setOpen] = useState(false);

  const content = (
    <Space direction="vertical" size={8} style={{ width: 200 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Valor para celdas vacías:</Text>
      {tipo === 'numero'
        ? <InputNumber style={{ width: '100%' }} min={0} value={valor as number ?? undefined}
            onChange={v => setValor(v)} />
        : <Input value={valor as string ?? ''} onChange={e => setValor(e.target.value)} />
      }
      <Button type="primary" size="small" block
        disabled={valor === null || valor === ''}
        onClick={() => { onRellenar(campo, valor); setOpen(false); setValor(null); }}>
        Aplicar a vacíos
      </Button>
    </Space>
  );

  return (
    <Popover content={content} title={label} trigger="click" open={open} onOpenChange={setOpen}>
      <Button size="small" icon={<ThunderboltOutlined />}>{label}</Button>
    </Popover>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function CeldaRequerida({ children, error }: { children: React.ReactNode; error: boolean }) {
  return <div style={{ border: error ? '1px solid #ff4d4f' : undefined, borderRadius: 4 }}>{children}</div>;
}

function CeldaIA({ children, sugerido, confianza, esNueva }: {
  children: React.ReactNode; sugerido?: boolean; confianza?: number; esNueva?: boolean;
}) {
  if (!sugerido) return <>{children}</>;
  const baja = confianza !== undefined && confianza < 80;
  return (
    <Tooltip title={esNueva ? 'Inmobiliaria nueva — se creará al confirmar'
      : baja ? `Sugerencia IA con baja confianza (${confianza}%) — verifica`
      : `Sugerido por IA (${confianza ?? ''}%)`}>
      <div style={{ border: `1px solid ${baja ? '#faad14' : '#722ed1'}`, borderRadius: 4, position: 'relative' }}>
        <RobotOutlined style={{ position: 'absolute', top: -8, right: 2, fontSize: 10,
          color: baja ? '#faad14' : '#722ed1', background: 'white', padding: '0 2px' }} />
        {children}
      </div>
    </Tooltip>
  );
}
