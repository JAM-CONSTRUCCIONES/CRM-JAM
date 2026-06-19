import { useState } from 'react';
import { Button, Modal, Form, Input, Space, Tooltip, Row, Col, Popconfirm, Upload, Select, Typography, Grid, Alert } from 'antd';
import { PlusOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined, SettingOutlined, ArrowLeftOutlined, ReloadOutlined, UploadOutlined, EyeOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useInventario } from '../../hooks/useInventario';
import TablaUnidades from '../../components/inventario/TablaUnidades';
import DrawerEtapas from '../../components/inventario/DrawerEtapas';
import ModalUnidad from '../../components/inventario/ModalUnidad';
import ModalBloqueo from '../../components/inventario/ModalBloqueo';
import ModalCrearBloqueoAdmin from '../../components/inventario/ModalCrearBloqueoAdmin';
import { ESTADO_UNIDAD_CONFIG, projectGradient } from '../../constants/estados';
import { eliminarProyecto, getProyecto, exportarInventario } from '../../services/proyectos.service';
import { bloquearUnidad } from '../../services/bloqueos.service';
import { buscarClientePorCedula } from '../../services/clientes.service';
import type { Cliente, Unidad } from '../../types';
import { message } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

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

  // Modal crear bloqueo admin (manual)
  const [modalCrearBloqueoAdmin, setModalCrearBloqueoAdmin] = useState(false);
  const [unidadParaBloqueoAdmin, setUnidadParaBloqueoAdmin] = useState<Unidad | null>(null);

  // Exportación
  const [exportando, setExportando] = useState(false);

  // Proyecto siendo eliminado (muestra spinner y bloquea otros botones de eliminar)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  // Modal detalles de proyecto (descripción larga)
  const [proyectoDetalle, setProyectoDetalle] = useState<typeof inv.proyectos[0] | null>(null);

  // Form refs para modales que necesitan reset externo
  const [formProyecto] = Form.useForm();
  const [imagenFile, setImagenFile] = useState<UploadFile | null>(null);

  // Ref para debounce consolidado de filtros de texto
  const debounceTimerFiltros = useRef<NodeJS.Timeout | null>(null);

  // Refs para siempre tener los valores más recientes sin stale closure
  const filtroUnidadRef = useRef(inv.filtroUnidad);
  const filtroTipoRef = useRef(inv.filtroTipo);
  const filtroManzanaRef = useRef(inv.filtroManzana);
  const filtroPisoRef = useRef(inv.filtroPiso);
  const cargarUnidadesRef = useRef(inv.cargarUnidades);

  // Mantener refs sincronizados en cada render
  filtroUnidadRef.current = inv.filtroUnidad;
  filtroTipoRef.current = inv.filtroTipo;
  filtroManzanaRef.current = inv.filtroManzana;
  filtroPisoRef.current = inv.filtroPiso;
  cargarUnidadesRef.current = inv.cargarUnidades;

  // Un único debounce consolidado para todos los filtros de texto
  useEffect(() => {
    if (inv.vista !== 'unidades') return;

    if (debounceTimerFiltros.current) {
      clearTimeout(debounceTimerFiltros.current);
    }

    debounceTimerFiltros.current = setTimeout(() => {
      // Usa siempre los valores más recientes via refs, sin stale closure
      cargarUnidadesRef.current(undefined, {
        id_unidad: filtroUnidadRef.current,
        tipo: filtroTipoRef.current,
        manzana: filtroManzanaRef.current,
        piso: filtroPisoRef.current,
      });
    }, 400);

    return () => {
      if (debounceTimerFiltros.current) {
        clearTimeout(debounceTimerFiltros.current);
      }
    };
  }, [inv.filtroUnidad, inv.filtroTipo, inv.filtroManzana, inv.filtroPiso, inv.vista]);

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
      const msg = err?.response?.data?.message || err?.message;
      if (s === 409) message.error(msg || 'La unidad ya no está disponible o el cliente tiene exclusividad con otra inmobiliaria');
      else if (s === 429) message.warning(msg || 'No puedes re-bloquear esta unidad antes de 24h');
      else message.error(msg || 'Error al procesar la operación');
    } finally { setGuardandoBloqueo(false); }
  };

  const handleCrearBloqueoAdmin = async (values: any) => {
    if (!unidadParaBloqueoAdmin) return;
    setGuardandoBloqueo(true);
    try {
      const payload: any = {
        proyecto_id: inv.proyectoId,
        unidad_id: unidadParaBloqueoAdmin.unidad_id,
        forzar_admin: true, // El admin puede saltarse validaciones de exclusividad
        ...values,
      };
      
      let intentos = 0;
      while (intentos < 2) {
        try { await bloquearUnidad(payload); break; }
        catch (err: any) {
          const s = err?.response?.statusCode ?? err?.response?.status;
          if ((s === 502 || s === 503) && intentos === 0) { intentos++; await new Promise(r => setTimeout(r, 1500)); continue; }
          throw err;
        }
      }
      
      const tieneCliente = values.cedula;
      message.success(
        tieneCliente 
          ? `Unidad ${unidadParaBloqueoAdmin.id_unidad} bloqueada y cliente asignado`
          : `Unidad ${unidadParaBloqueoAdmin.id_unidad} bloqueada sin cliente`
      );
      
      setModalCrearBloqueoAdmin(false);
      setUnidadParaBloqueoAdmin(null);
      await inv.cargarUnidades();
    } catch (err: any) {
      const s = err?.response?.statusCode ?? err?.response?.status;
      const msg = err?.response?.data?.message || err?.message;
      if (s === 409) message.error(msg || 'La unidad ya no está disponible');
      else if (s === 429) message.warning(msg || 'No puedes re-bloquear esta unidad antes de 24h');
      else message.error(msg || 'Error al procesar la operación');
    } finally { setGuardandoBloqueo(false); }
  };

  const handleExportar = async () => {
    if (!inv.proyectoId) return;
    setExportando(true);
    try {
      const result = await exportarInventario(inv.proyectoId);
      message.success(`Descargando ${result.total_unidades} unidades...`);
      
      // Crear un elemento <a> temporal para forzar la descarga
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      const msg = err?.message || 'Error al exportar inventario';
      message.error(msg);
    } finally {
      setExportando(false);
    }
  };

  const copiarLinkPublico = async (proyectoId: string) => {
    const url = `${window.location.origin}/inventario-publico/${proyectoId}`;
    try {
      await navigator.clipboard.writeText(url);
      message.success('Link publico copiado');
    } catch {
      message.info(url);
    }
  };

  return (
    <div>
      {/* Banner modo preview */}
      {isPreview && (
        <Alert
          type="info"
          icon={<EyeOutlined />}
          showIcon
          style={{ marginBottom: 16, borderRadius: 10, border: '2px solid #1677ff' }}
          message={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <strong>Modo vista previa:</strong> Viendo como <strong>{previewInmoNombre}</strong> — Solo lectura, sin acciones de edición
              </span>
              <Button size="small" type="primary" onClick={() => navigate('/inmobiliarias')}>
                Salir del preview
              </Button>
            </div>
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
              <>
                <Tooltip title={isPreview ? "No disponible en modo preview" : "Exportar a Excel"}>
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={handleExportar} 
                    loading={exportando}
                    disabled={isPreview}
                  >
                    {isMobile ? '' : 'Exportar'}
                  </Button>
                </Tooltip>
                <Tooltip title={isPreview ? "No disponible en modo preview" : "Actualizar"}>
                  <Button icon={<ReloadOutlined />} onClick={() => inv.cargarUnidades()} loading={inv.loading} />
                </Tooltip>
              </>
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
            {isPreview && inv.vista === 'unidades' && (
              <Tooltip title="Acciones de edición deshabilitadas en modo preview">
                <Button icon={<SettingOutlined />} disabled style={{ cursor: 'not-allowed' }}>
                  {isMobile ? '' : 'Etapas'}
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>
      </div>

      {/* Vista proyectos */}
      {inv.vista === 'proyectos' && (
        <Row gutter={[20, 20]}>
          {proyectosPreview.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <div style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: 'var(--panel-bg)', border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.16)', transition: 'box-shadow 0.2s, transform 0.2s' }}
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
                        <Popconfirm
                          title="¿Eliminar proyecto?"
                          description="Se eliminarán inventario, procesos e historiales del proyecto. Los clientes se conservarán como desvinculados."
                          okText="Sí, eliminar"
                          cancelText="Cancelar"
                          okButtonProps={{ danger: true }}
                          disabled={!!eliminandoId}
                          onConfirm={async () => {
                            setEliminandoId(p.proyecto_id);
                            const hide = message.loading(`Eliminando proyecto "${p.nombre}"...`, 0);
                            try {
                              await eliminarProyecto(p.proyecto_id);
                              // Polling hasta que el proyecto desaparezca (SF async)
                              let intentos = 0;
                              while (intentos < 40) {
                                await new Promise(r => setTimeout(r, 2000));
                                try {
                                  const actual = await getProyecto(p.proyecto_id);
                                  if (!actual || actual.activo === false) break;
                                } catch {
                                  break; // 404 = ya eliminado
                                }
                                intentos++;
                              }
                              hide();
                              message.success('Proyecto eliminado correctamente');
                              inv.cargarProyectos();
                            } catch (err: any) {
                              hide();
                              const status = err?.response?.status ?? err?.response?.statusCode;
                              const msg = err?.response?.data?.message || err?.message;
                              if (status === 409) {
                                message.error(msg || 'El proyecto ya tiene una eliminación en curso.');
                              } else {
                                message.error(msg || 'Error al eliminar el proyecto.');
                              }
                            } finally {
                              setEliminandoId(null);
                            }
                          }}>
                          <Button
                            size="small" type="text" danger icon={<DeleteOutlined />}
                            style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}
                            loading={eliminandoId === p.proyecto_id}
                            disabled={!!eliminandoId && eliminandoId !== p.proyecto_id}
                          />
                        </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{p.descripcion}</Text>
                      </div>
                      {p.descripcion.length > 80 && (
                        <Button type="link" size="small"
                          style={{ padding: 0, fontSize: 12, flexShrink: 0, marginTop: 1 }}
                          onClick={e => { e.stopPropagation(); setProyectoDetalle(p); }}>
                          Ver más
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Sin descripción</Text>
                  )}
                  <Button
                    icon={<CopyOutlined />}
                    size="small"
                    style={{ marginTop: 12 }}
                    onClick={e => {
                      e.stopPropagation();
                      copiarLinkPublico(p.proyecto_id);
                    }}
                  >
                    Copiar link de inventario
                  </Button>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Select allowClear placeholder="Etapa" style={{ width: isMobile ? '100%' : 150 }}
              value={inv.filtroEtapa || undefined} 
              onChange={v => { 
                const nuevoValor = v || '';
                inv.setFiltroEtapa(nuevoValor); 
                inv.cargarUnidades(undefined, { etapa_id: nuevoValor });
              }}>
              {inv.etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
            </Select>
            <Select allowClear placeholder="Estado" style={{ width: isMobile ? '100%' : 180 }}
              value={inv.filtroEstado || undefined} 
              onChange={v => { 
                const nuevoValor = v || '';
                inv.setFiltroEstado(nuevoValor); 
                inv.cargarUnidades(undefined, { estado: nuevoValor });
              }}>
              {Object.entries(ESTADO_UNIDAD_CONFIG)
                .filter(([k]) => k !== 'desvinculada')
                .filter(([k]) => !isInmobiliariaEffective || k === 'disponible' || k === 'bloqueada')
                .map(([k, v]) => (
                  <Option key={k} value={k}>
                    <Tooltip title={v.descripcion} placement="right">
                      <span>{v.label}</span>
                    </Tooltip>
                  </Option>
                ))}
            </Select>
            <Input placeholder="Unidad (ej: 101)" style={{ width: isMobile ? '100%' : 140 }} 
              value={inv.filtroUnidad} 
              onChange={e => inv.setFiltroUnidad(e.target.value)} 
              allowClear 
              onClear={() => { inv.setFiltroUnidad(''); }} />
            <Input placeholder="Tipo (ej: D)" style={{ width: isMobile ? '100%' : 120 }} 
              value={inv.filtroTipo} 
              onChange={e => inv.setFiltroTipo(e.target.value)} 
              allowClear 
              onClear={() => { inv.setFiltroTipo(''); }} />
            <Input placeholder="Bloque (ej: A)" style={{ width: isMobile ? '100%' : 140 }}
              value={inv.filtroManzana} 
              onChange={e => inv.setFiltroManzana(e.target.value)} 
              allowClear 
              onClear={() => { inv.setFiltroManzana(''); }} />
            <Input placeholder="Piso (ej: 3)" style={{ width: isMobile ? '100%' : 120 }} 
              value={inv.filtroPiso} 
              onChange={e => inv.setFiltroPiso(e.target.value)} 
              allowClear 
              onClear={() => { inv.setFiltroPiso(''); }} />
            {(inv.filtroEtapa || inv.filtroEstado || inv.filtroUnidad || inv.filtroTipo || inv.filtroManzana || inv.filtroPiso) && (
              <Button onClick={() => { 
                inv.setFiltroEtapa(''); 
                inv.setFiltroEstado(''); 
                inv.setFiltroUnidad(''); 
                inv.setFiltroTipo(''); 
                inv.setFiltroManzana(''); 
                inv.setFiltroPiso(''); 
                inv.cargarUnidades(undefined, { 
                  etapa_id: '', 
                  estado: '', 
                  id_unidad: '', 
                  tipo: '', 
                  manzana: '', 
                  piso: '' 
                }); 
              }}>
                Limpiar
              </Button>
            )}
          </div>

          <TablaUnidades
            unidades={inv.unidades} etapas={inv.etapas} loading={inv.loading}
            isAdmin={isPreview ? false : inv.isAdmin} isInmobiliaria={isInmobiliariaEffective}
            canEdit={canEditEffective}
            inmoNombre={inv.inmoNombre}
            onEditar={abrirEditarUnidad}
            onEliminar={inv.handleEliminarUnidad}
            onBloquear={isPreview ? undefined : (u => { setUnidadABloquear(u); setClienteEncontrado(null); setModalBloqueo(true); })}
            onCrearBloqueoAdmin={isPreview || !inv.isAdmin ? undefined : (u => { setUnidadParaBloqueoAdmin(u); setModalCrearBloqueoAdmin(true); })}
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

      <ModalCrearBloqueoAdmin
        open={modalCrearBloqueoAdmin}
        unidad={unidadParaBloqueoAdmin}
        proyectoId={inv.proyectoId}
        inmobiliarias={inv.inmobiliarias}
        onCancel={() => { setModalCrearBloqueoAdmin(false); setUnidadParaBloqueoAdmin(null); }}
        onBloquear={handleCrearBloqueoAdmin}
        guardando={guardandoBloqueo}
      />

      {/* ── Modal: detalles del proyecto ────────────────────────────────── */}
      <Modal
        open={!!proyectoDetalle}
        onCancel={() => setProyectoDetalle(null)}
        footer={<Button onClick={() => setProyectoDetalle(null)}>Cerrar</Button>}
        title={proyectoDetalle?.nombre}
        width={560}
      >
        {proyectoDetalle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {proyectoDetalle.imagen_url && (
              <img
                src={proyectoDetalle.imagen_url}
                alt={proyectoDetalle.nombre}
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>
              {proyectoDetalle.descripcion}
            </Typography.Paragraph>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default InventarioPage;
