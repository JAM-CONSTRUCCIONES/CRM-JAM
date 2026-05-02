import { useState } from 'react';
import { Button, Modal, Form, Input, Space, Tooltip, Row, Col, Popconfirm, Upload, Select, Typography, Grid, Alert } from 'antd';
import { PlusOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined, SettingOutlined, ArrowLeftOutlined, ReloadOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useInventario } from '../../hooks/useInventario';
import TablaUnidades from '../../components/inventario/TablaUnidades';
import DrawerEtapas from '../../components/inventario/DrawerEtapas';
import ModalUnidad from '../../components/inventario/ModalUnidad';
import ModalBloqueo from '../../components/inventario/ModalBloqueo';
import { ESTADO_UNIDAD_CONFIG, projectGradient } from '../../constants/estados';
import { eliminarProyecto } from '../../services/proyectos.service';
import { bloquearUnidad } from '../../services/bloqueos.service';
import { buscarClientePorCedula } from '../../services/clientes.service';
import type { Cliente, Unidad } from '../../types';
import { message } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const InventarioPage = () => {
  const inv = useInventario();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Modo preview: ver como inmobiliaria
  const previewInmoId = searchParams.get('preview_inmo');
  const previewInmoNombre = previewInmoId
    ? inv.inmobiliarias.find(i => i.pk.replace('INMOBILIARIA#', '') === previewInmoId)?.nombre ?? previewInmoId
    : null;
  const isPreview = !!previewInmoId;
  // En preview: comportarse como inmobiliaria (sin acciones de edición)
  const canEditEffective = isPreview ? false : inv.canEdit;
  const isInmobiliariaEffective = isPreview ? true : inv.isInmobiliaria;
  // Filtrar proyectos asignados a la inmobiliaria en preview
  const proyectosPreview = isPreview
    ? inv.proyectos.filter(p => {
        const inmo = inv.inmobiliarias.find(i => i.pk.replace('INMOBILIARIA#', '') === previewInmoId);
        return inmo?.proyectos?.includes(p.proyecto_id);
      })
    : inv.proyectos;

  // Estado local solo para bloqueo (no pertenece al hook de inventario)
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [unidadABloquear, setUnidadABloquear] = useState<Unidad | null>(null);
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  // Form refs para modales que necesitan reset externo
  const [formProyecto] = Form.useForm();
  const [imagenFile, setImagenFile] = useState<UploadFile | null>(null);

  const abrirEditarUnidad = (u: Unidad) => {
    inv.setModoUnidad('editar');
    inv.setUnidadEditando(u);
    inv.setModalUnidad(true);
  };

  const buscarCliente = async (cedula: string) => {
    if (!cedula?.trim()) return;
    setBuscandoCliente(true);
    try {
      const result = await buscarClientePorCedula(cedula.trim(), inv.proyectoId);
      const cliente = Array.isArray(result) ? result[0] : result;
      setClienteEncontrado(cliente || null);
    } catch { setClienteEncontrado(null); }
    finally { setBuscandoCliente(false); }
  };

  const handleBloquear = async (omitir: boolean, values?: any) => {
    if (!unidadABloquear) return;
    setGuardandoBloqueo(true);
    try {
      const payload: any = { proyecto_id: inv.proyectoId, unidad_id: unidadABloquear.unidad_id, ...(!omitir ? values : {}) };
      let intentos = 0;
      while (intentos < 2) {
        try { await bloquearUnidad(payload); break; }
        catch (err: any) {
          const s = err?.response?.statusCode ?? err?.response?.status;
          if ((s === 502 || s === 503) && intentos === 0) { intentos++; await new Promise(r => setTimeout(r, 1500)); continue; }
          throw err;
        }
      }
      message.success(omitir ? `Unidad ${unidadABloquear.id_unidad} bloqueada` : `Unidad ${unidadABloquear.id_unidad} bloqueada y cliente registrado`);
      setModalBloqueo(false); setClienteEncontrado(null);
      await inv.cargarUnidades();
    } catch (err: any) {
      const s = err?.response?.statusCode ?? err?.response?.status;
      if (s === 409) message.error('La unidad ya no está disponible o el cliente tiene exclusividad con otra inmobiliaria');
      else if (s === 429) message.warning('No puedes re-bloquear esta unidad antes de 24h');
      else message.error('Error al procesar la operación');
    } finally { setGuardandoBloqueo(false); }
  };

  return (
    <div>
      {/* Banner modo preview */}
      {isPreview && (
        <Alert
          type="info"
          icon={<EyeOutlined />}
          showIcon
          style={{ marginBottom: 16, borderRadius: 10 }}
          message={
            <span>
              Viendo como inmobiliaria: <strong>{previewInmoNombre}</strong> — solo lectura
            </span>
          }
          action={
            <Button size="small" onClick={() => navigate('/inmobiliarias')}>
              Salir del preview
            </Button>
          }
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {inv.vista === 'unidades' && (
              <Button icon={<ArrowLeftOutlined />} onClick={inv.volverAProyectos} type="text" style={{ flexShrink: 0 }} />
            )}
            <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 160 : 'none' }}>
              {inv.vista === 'proyectos' ? 'Proyectos' : inv.proyectoActual?.nombre ?? 'Inventario'}
            </Title>
          </div>
          <Space wrap>
            {inv.vista === 'unidades' && (
              <Tooltip title="Actualizar">
                <Button icon={<ReloadOutlined />} onClick={() => inv.cargarUnidades()} loading={inv.loading} />
              </Tooltip>
            )}
            {canEditEffective && inv.vista === 'proyectos' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { inv.setModoProyecto('crear'); inv.setProyectoEditando(null); setImagenFile(null); formProyecto.resetFields(); inv.setModalProyecto(true); }}>
                {isMobile ? 'Nuevo' : 'Nuevo proyecto'}
              </Button>
            )}
            {canEditEffective && inv.vista === 'unidades' && (
              <>
                <Button icon={<SettingOutlined />} onClick={() => inv.setDrawerEtapas(true)}>
                  {isMobile ? '' : 'Etapas'}
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { inv.setModoUnidad('crear'); inv.setUnidadEditando(null); inv.setModalUnidad(true); }}>
                  {isMobile ? '' : 'Nueva unidad'}
                </Button>
              </>
            )}
          </Space>
        </div>
      </div>

      {/* Vista proyectos */}
      {inv.vista === 'proyectos' && (
        <Row gutter={[20, 20]}>
          {proyectosPreview.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <div style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: '#fff', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s, transform 0.2s' }}
                onClick={() => inv.seleccionarProyecto(p.proyecto_id)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{ height: 160, background: p.imagen_url ? undefined : projectGradient(p.nombre), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <AppstoreOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />}
                  {canEditEffective && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
                      <Space>
                        <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}
                          onClick={() => { inv.setModoProyecto('editar'); inv.setProyectoEditando(p); setImagenFile(null); formProyecto.setFieldsValue({ nombre: p.nombre, descripcion: p.descripcion }); inv.setModalProyecto(true); }} />
                        <Popconfirm title="¿Desactivar proyecto?" okText="Sí" cancelText="No" onConfirm={async () => {
                            try {
                              await eliminarProyecto(p.proyecto_id);
                              inv.cargarProyectos();
                            } catch (err: any) {
                              const status = err?.response?.status ?? err?.response?.statusCode;
                              if (status === 409) {
                                try {
                                  const body = await err?.response?.body?.json?.();
                                  message.error(body?.message || 'El proyecto tiene unidades registradas y no puede eliminarse.');
                                } catch {
                                  message.error('El proyecto tiene unidades registradas y no puede eliminarse.');
                                }
                              } else {
                                message.error('Error al eliminar el proyecto.');
                              }
                            }
                          }}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6 }} />
                        </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion ? <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: p.descripcion }}>{p.descripcion}</Text>
                    : <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Sin descripción</Text>}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Vista unidades */}
      {inv.vista === 'unidades' && (
        <>
          {/* Barra de filtros */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
            padding: '16px 20px', marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 12,
              alignItems: 'end',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Etapa</span>
                <Select allowClear placeholder="Todas" style={{ width: '100%' }}
                  value={inv.filtroEtapa || undefined} onChange={v => inv.setFiltroEtapa(v || '')}>
                  {inv.etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</span>
                <Select allowClear placeholder="Todos" style={{ width: '100%' }}
                  value={inv.filtroEstado || undefined} onChange={v => inv.setFiltroEstado(v || '')}>
                  {Object.entries(ESTADO_UNIDAD_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</span>
                <Input placeholder="Ej: D" style={{ width: '100%' }} value={inv.filtroTipo} onChange={e => inv.setFiltroTipo(e.target.value)} allowClear />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Manzana</span>
                <Input placeholder="Ej: A" style={{ width: '100%' }} value={inv.filtroManzana} onChange={e => inv.setFiltroManzana(e.target.value)} allowClear />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Piso</span>
                <Input placeholder="Ej: 3" style={{ width: '100%' }} value={inv.filtroPiso} onChange={e => inv.setFiltroPiso(e.target.value)} allowClear />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'transparent', userSelect: 'none' }}>_</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" onClick={() => inv.cargarUnidades()} loading={inv.loading} style={{ flex: 1 }}>
                    Aplicar
                  </Button>
                  {(inv.filtroEtapa || inv.filtroEstado || inv.filtroTipo || inv.filtroManzana || inv.filtroPiso) && (
                    <Button onClick={() => { inv.setFiltroEtapa(''); inv.setFiltroEstado(''); inv.setFiltroTipo(''); inv.setFiltroManzana(''); inv.setFiltroPiso(''); inv.cargarUnidades(); }}>
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <TablaUnidades
            unidades={inv.unidades} etapas={inv.etapas} loading={inv.loading}
            isAdmin={isPreview ? false : inv.isAdmin} isInmobiliaria={isInmobiliariaEffective}
            canEdit={canEditEffective}
            inmoNombre={inv.inmoNombre}
            onEditar={abrirEditarUnidad}
            onEliminar={inv.handleEliminarUnidad}
            onBloquear={isPreview ? undefined : (u => { setUnidadABloquear(u); setClienteEncontrado(null); setModalBloqueo(true); })}
          />
        </>
      )}

      {/* Modal proyecto */}
      <Modal title={inv.modoProyecto === 'crear' ? 'Nuevo proyecto' : 'Editar proyecto'} open={inv.modalProyecto}
        onCancel={() => { inv.setModalProyecto(false); setImagenFile(null); }}
        onOk={() => formProyecto.submit()} okText="Guardar" cancelText="Cancelar" confirmLoading={inv.uploadingImagen}>
        <Form form={formProyecto} layout="vertical" onFinish={values => inv.handleGuardarProyecto(values, imagenFile?.originFileObj)}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="descripcion" label="Descripción"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Imagen (opcional)">
            {inv.proyectoEditando?.imagen_url && !imagenFile && (
              <img src={inv.proyectoEditando.imagen_url} alt="portada actual"
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
            )}
            <Upload onChange={({ fileList }) => setImagenFile(fileList[0] ?? null)} maxCount={1} accept="image/jpeg,image/png,image/webp"
              beforeUpload={() => false} fileList={imagenFile ? [imagenFile] : []} listType="picture">
              <Button icon={<UploadOutlined />}>{inv.proyectoEditando?.imagen_url && !imagenFile ? 'Cambiar imagen' : 'Seleccionar imagen'}</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <DrawerEtapas
        open={inv.drawerEtapas} etapas={inv.etapas} etapaEditando={inv.etapaEditando}
        onClose={() => inv.setDrawerEtapas(false)}
        onGuardar={inv.handleGuardarEtapa}
        onEliminar={inv.handleEliminarEtapa}
        onEditar={e => inv.setEtapaEditando(e)}
        onCancelarEdicion={() => inv.setEtapaEditando(null)}
      />

      <ModalUnidad
        open={inv.modalUnidad} modo={inv.modoUnidad} etapas={inv.etapas} unidadEditando={inv.unidadEditando}
        onCancel={() => inv.setModalUnidad(false)}
        onFinish={inv.handleGuardarUnidad}
      />

      <ModalBloqueo
        open={modalBloqueo} unidad={unidadABloquear}
        clienteEncontrado={clienteEncontrado} buscandoCliente={buscandoCliente} guardando={guardandoBloqueo}
        onCancel={() => { setModalBloqueo(false); setClienteEncontrado(null); }}
        onBuscar={buscarCliente}
        onBloquear={handleBloquear}
      />
    </div>
  );
};

export default InventarioPage;
