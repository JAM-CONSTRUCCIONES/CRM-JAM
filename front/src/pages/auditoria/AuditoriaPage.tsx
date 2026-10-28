import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, DatePicker, Descriptions, Drawer, Empty, Flex,
  Input, Select, Space, Spin, Table, Tag, Typography,
} from 'antd';
import type { TableProps } from 'antd';
import {
  CheckCircle2, Clock3, FileSearch, RefreshCw, Search, ShieldAlert,
  UserRound, XCircle,
} from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { listarAuditoria, obtenerOpcionesAuditoria, type AuditoriaItem, type AuditoriaUsuarioOption } from '../../services/auditoria.service';

const { Title, Text } = Typography;

const ACCIONES: Record<string, string> = {
  cliente_creado: 'Cliente creado',
  cliente_actualizado: 'Cliente actualizado',
  cliente_eliminado: 'Cliente eliminado',
  clientes_exportados: 'Clientes exportados',
  clientes_exportacion_fallida: 'Exportación de clientes fallida',
  usuario_creado: 'Usuario creado',
  usuario_actualizado: 'Usuario actualizado',
  usuario_eliminado: 'Usuario eliminado',
  usuario_habilitado: 'Usuario habilitado',
  usuario_deshabilitado: 'Usuario deshabilitado',
  foto_perfil_actualizada: 'Foto de perfil actualizada',
  foto_perfil_eliminada: 'Foto de perfil eliminada',
  login_exitoso: 'Inicio de sesión exitoso',
  login_mfa_requerido: 'MFA requerido',
  login_mfa_setup_requerido: 'Configuración MFA requerida',
  login_mfa_exitoso: 'MFA verificado',
  bloqueo_creado: 'Bloqueo creado',
  cliente_asignado_bloqueo: 'Cliente asignado a bloqueo',
  bloqueo_liberado: 'Bloqueo liberado',
  bloqueo_liberado_automatico: 'Bloqueo liberado automáticamente',
  bloqueo_extendido: 'Bloqueo extendido',
  exclusividad_vencida: 'Exclusividad vencida',
  proceso_creado: 'Proceso creado',
  proceso_estado_cambiado: 'Estado de proceso cambiado',
  proceso_estado_cambiado_automatico: 'Estado cambiado automáticamente',
  proyecto_eliminado: 'Proyecto eliminado',
  proyecto_eliminacion_iniciada: 'Eliminación de proyecto iniciada',
  inventario_exportado: 'Inventario exportado',
  inventario_exportacion_fallida: 'Exportación de inventario fallida',
  migracion_completada: 'Migración completada',
  migracion_fallida: 'Migración fallida',
  trabajador_creado: 'Trabajador creado',
  trabajador_actualizado: 'Trabajador actualizado',
  trabajador_habilitado: 'Trabajador habilitado',
  trabajador_deshabilitado: 'Trabajador deshabilitado',
  mensaje_crm_enviado: 'Mensaje CRM enviado',
  mensaje_crm_fallido: 'Mensaje CRM fallido',
  cliente_traspaso_iniciado: 'Traspaso iniciado',
  cliente_traspaso_completado: 'Traspaso completado',
  cambio_cedula_iniciado: 'Cambio de cédula iniciado',
  cambio_cedula_completado: 'Cambio de cédula completado',
};

const formatAction = (action: string) => {
  if (action.startsWith('notificacion_')) {
    return `Notificación: ${action.slice('notificacion_'.length).replaceAll('_', ' ')}`;
  }
  return ACCIONES[action] || action.replaceAll('_', ' ');
};
const formatDate = (value?: string) => value ? dayjs(value).format('DD/MM/YYYY HH:mm:ss') : '—';

const AuditoriaPage = () => {
  const [fecha, setFecha] = useState<Dayjs>(dayjs());
  const [items, setItems] = useState<AuditoriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [actorTipo, setActorTipo] = useState<'usuario' | 'sistema' | undefined>();
  const [usuarios, setUsuarios] = useState<AuditoriaUsuarioOption[]>([]);
  const [usuarioSub, setUsuarioSub] = useState('');
  const [accion, setAccion] = useState<string>();
  const [modulo, setModulo] = useState<string>();
  const [resultado, setResultado] = useState<string>();
  const [pagina, setPagina] = useState(1);
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined]);
  const [siguienteToken, setSiguienteToken] = useState<string>();
  const [seleccionado, setSeleccionado] = useState<AuditoriaItem | null>(null);

  const cargar = useCallback(async (token?: string, numeroPagina = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await listarAuditoria({
        fecha: fecha.format('YYYY-MM-DD'), actor_tipo: actorTipo,
        usuario_sub: usuarioSub.trim(), accion, modulo, resultado,
        limit: 50, next_token: token,
      });
      setItems(response.items || []);
      setSiguienteToken(response.next_token || undefined);
      if (response.next_token) {
        setTokens(prev => {
          const next = [...prev];
          next[numeroPagina] = response.next_token || undefined;
          return next;
        });
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la auditoría');
    } finally {
      setLoading(false);
    }
  }, [fecha, actorTipo, usuarioSub, accion, modulo, resultado]);

  useEffect(() => {
    void obtenerOpcionesAuditoria()
      .then(response => setUsuarios(response.usuarios || []))
      .catch(() => setUsuarios([]));
  }, []);

  useEffect(() => {
    setPagina(1);
    setTokens([undefined]);
    void cargar(undefined, 1);
  }, [cargar]);

  const acciones = useMemo(() => [...new Set(items.map(item => item.accion))], [items]);
  const modulos = useMemo(() => [...new Set(items.map(item => item.modulo).filter(Boolean))], [items]);
  const visibles = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return items;
    return items.filter(item => JSON.stringify(item).toLowerCase().includes(term));
  }, [items, busqueda]);

  const columns: TableProps<AuditoriaItem>['columns'] = [
    {
      title: 'Fecha', dataIndex: 'fecha', width: 170, sorter: (a, b) => a.fecha.localeCompare(b.fecha),
      render: (value: string) => <Text className="tabular-nums" type="secondary">{formatDate(value)}</Text>,
    },
    {
      title: 'Movimiento', dataIndex: 'accion', width: 230,
      render: (value: string, item) => (
        <Space direction="vertical" size={1}>
          <Text strong>{formatAction(value)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{item.modulo}</Text>
        </Space>
      ),
    },
    {
      title: 'Usuario', dataIndex: 'usuario_nombre', width: 190,
      render: (value: string, item) => (
        <Space size={8}><UserRound size={16} strokeWidth={1.8} /><span>{value || item.usuario_sub || 'Sistema'}</span></Space>
      ),
    },
    {
      title: 'Entidad', key: 'entidad', width: 220,
      render: (_, item) => (
        <Space direction="vertical" size={1}>
          <Text strong>{item.entidad_nombre || item.entidad_tipo || 'general'}</Text>
          {item.entidad_nombre && item.entidad_id && item.entidad_id !== 'general' && <Text type="secondary" style={{ fontSize: 11 }}>{item.entidad_tipo} · {item.entidad_id}</Text>}
        </Space>
      ),
    },
    {
      title: 'Resultado', dataIndex: 'resultado', width: 130,
      render: (value: string) => value === 'completado' || value === 'enviada'
        ? <Tag color="success" icon={<CheckCircle2 size={12} />}>{value === 'enviada' ? 'Enviada' : 'Completado'}</Tag>
        : value === 'omitida'
          ? <Tag color="warning" icon={<Clock3 size={12} />}>Omitida</Tag>
          : <Tag color="error" icon={<XCircle size={12} />}>Fallida</Tag>,
    },
    {
      title: '', key: 'detail', width: 76, align: 'right',
      render: (_, item) => <Button type="text" icon={<FileSearch size={17} />} aria-label="Ver detalles" onClick={() => setSeleccionado(item)} />,
    },
  ];

  return (
    <div className="page-shell">
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <div>
          <Title level={2} style={{ margin: 0 }}>Auditoría</Title>
          <Text type="secondary">Movimientos administrativos y operativos del sistema</Text>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={() => void cargar(tokens[pagina - 1], pagina)} loading={loading}>Actualizar</Button>
      </Flex>

      <Card className="audit-toolbar" style={{ marginTop: 24 }}>
        <Flex gap={12} wrap align="center">
          <DatePicker value={fecha} onChange={value => value && setFecha(value)} allowClear={false} format="DD/MM/YYYY" />
          <Input allowClear prefix={<Search size={16} />} placeholder="Buscar en movimientos" value={busqueda} onChange={event => setBusqueda(event.target.value)} style={{ width: 250 }} />
          <Select
            allowClear
            placeholder="Actor"
            value={actorTipo}
            onChange={(value: 'usuario' | 'sistema' | undefined) => {
              setActorTipo(value);
              if (value === 'sistema') setUsuarioSub('');
            }}
            style={{ width: 145 }}
            options={[{ value: 'usuario', label: 'Usuarios' }, { value: 'sistema', label: 'Sistema' }]}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Usuario"
            value={usuarioSub || undefined}
            onChange={(value?: string) => {
              setUsuarioSub(value || '');
              if (value) setActorTipo('usuario');
            }}
            disabled={actorTipo === 'sistema'}
            style={{ width: 220 }}
            options={usuarios.map(usuario => ({
              value: usuario.value,
              label: `${usuario.label}${usuario.activo ? '' : ' (inactivo)'}`,
            }))}
          />
          <Select allowClear placeholder="Movimiento" value={accion} onChange={setAccion} style={{ width: 210 }} options={acciones.map(value => ({ value, label: formatAction(value) }))} />
          <Select allowClear placeholder="Módulo" value={modulo} onChange={setModulo} style={{ width: 150 }} options={modulos.map(value => ({ value, label: value }))} />
          <Select allowClear placeholder="Resultado" value={resultado} onChange={setResultado} style={{ width: 145 }} options={[{ value: 'completado', label: 'Completado' }, { value: 'enviada', label: 'Enviada' }, { value: 'omitida', label: 'Omitida' }, { value: 'fallido', label: 'Fallido' }, { value: 'fallida', label: 'Fallida' }]} />
        </Flex>
      </Card>

      {error && <Alert style={{ marginTop: 16 }} type="error" showIcon icon={<ShieldAlert size={18} />} message={error} action={<Button size="small" onClick={() => void cargar()}>Reintentar</Button>} />}

      <Card style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
        {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div> : visibles.length === 0 ? <Empty description={`Sin movimientos el ${fecha.format('DD/MM/YYYY')}`} style={{ padding: 64 }} /> : (
          <Table<AuditoriaItem>
            rowKey="evento_id" columns={columns} dataSource={visibles}
            pagination={{
              current: pagina,
              pageSize: 50,
              showSizeChanger: false,
              total: siguienteToken ? pagina * 50 + 1 : (pagina - 1) * 50 + items.length,
              showTotal: () => `Página ${pagina}`,
              onChange: (nextPage) => {
                const token = tokens[nextPage - 1];
                setPagina(nextPage);
                void cargar(token, nextPage);
              },
            }}
            scroll={{ x: 900 }} onRow={item => ({ onClick: () => setSeleccionado(item), style: { cursor: 'pointer' } })}
          />
        )}
      </Card>

      <Drawer title="Detalle del movimiento" width={460} open={Boolean(seleccionado)} onClose={() => setSeleccionado(null)}>
        {seleccionado && <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div><Text type="secondary">Movimiento</Text><Title level={4} style={{ marginTop: 4 }}>{formatAction(seleccionado.accion)}</Title><Text type="secondary"><Clock3 size={14} style={{ verticalAlign: -2 }} /> {formatDate(seleccionado.fecha)}</Text></div>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Usuario">{seleccionado.usuario_nombre || seleccionado.usuario_sub || 'Sistema'}</Descriptions.Item>
            <Descriptions.Item label="Rol">{seleccionado.usuario_rol || seleccionado.rol || '—'}</Descriptions.Item>
            <Descriptions.Item label="Módulo">{seleccionado.modulo}</Descriptions.Item>
            <Descriptions.Item label="Entidad">{seleccionado.entidad_nombre || seleccionado.entidad_tipo} {seleccionado.entidad_nombre && seleccionado.entidad_id ? `· ${seleccionado.entidad_id}` : ''}</Descriptions.Item>
            <Descriptions.Item label="Resultado">{seleccionado.resultado}</Descriptions.Item>
          </Descriptions>
          <div><Text strong>Datos registrados</Text><pre className="audit-json">{JSON.stringify(seleccionado.detalles || {}, null, 2)}</pre></div>
          {seleccionado.datos_anteriores && <div><Text strong>Datos anteriores</Text><pre className="audit-json">{JSON.stringify(seleccionado.datos_anteriores, null, 2)}</pre></div>}
          {seleccionado.datos_nuevos && <div><Text strong>Datos nuevos</Text><pre className="audit-json">{JSON.stringify(seleccionado.datos_nuevos, null, 2)}</pre></div>}
        </Space>}
      </Drawer>
    </div>
  );
};

export default AuditoriaPage;
