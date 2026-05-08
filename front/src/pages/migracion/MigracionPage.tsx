import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Tag, Space, Button, Tooltip, Modal, Select, Empty,
} from 'antd';
import { ReloadOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useInventario } from '../../hooks/useInventario';
import MigracionExcel from '../../components/inventario/MigracionExcel';
import { listarReportes, type ReporteMigracion } from '../../services/migracion.service';

const { Title, Text } = Typography;

const MigracionPage = () => {
  const inv = useInventario();
  const [modalProyecto, setModalProyecto] = useState(false);
  const [proyectoId, setProyectoId] = useState('');
  const [proyectoIdTemp, setProyectoIdTemp] = useState('');
  const [reportes, setReportes] = useState<ReporteMigracion[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(false);

  const proyectoSeleccionado = inv.proyectos.find(p => p.proyecto_id === proyectoId);

  const cargarReportes = useCallback(async () => {
    setCargandoReportes(true);
    try { setReportes(await listarReportes()); }
    catch { /* silencioso */ }
    finally { setCargandoReportes(false); }
  }, []);

  useEffect(() => { cargarReportes(); }, [cargarReportes]);

  const nombreProyecto = (pid: string) =>
    inv.proyectos.find(p => p.proyecto_id === pid)?.nombre ?? pid;

  const iniciarMigracion = () => {
    if (!proyectoIdTemp) return;
    setProyectoId(proyectoIdTemp);
    setProyectoIdTemp('');
    setModalProyecto(false);
  };

  const columnas = [
    {
      title: 'Archivo', dataIndex: 'archivo', key: 'archivo',
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1677ff' }} />
          <Text>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Proyecto', dataIndex: 'proyecto_id', key: 'proyecto',
      render: (v: string) => <Tag color="blue">{nombreProyecto(v)}</Tag>,
    },
    {
      title: 'Unidades', dataIndex: 'unidades_cargadas', key: 'unidades',
      render: (v: number) => <Tag color="green">{v}</Tag>,
    },
    {
      title: 'Clientes', dataIndex: 'clientes_creados', key: 'clientes',
      render: (v: number) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: 'Inmobiliarias nuevas', dataIndex: 'inmobiliarias_creadas', key: 'inmos',
      render: (v: number) => v > 0
        ? <Tag color="orange">{v} nuevas</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Advertencias', dataIndex: 'advertencias', key: 'advertencias',
      render: (v: number) => v > 0
        ? <Tag color="warning">{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Fecha', dataIndex: 'completado_en', key: 'fecha',
      render: (v: string) => v ? new Date(v).toLocaleString('es-DO') : '—',
    },
  ];

  // Vista de migración activa
  if (proyectoId && proyectoSeleccionado) {
    return (
      <MigracionExcel
        proyectoId={proyectoId}
        proyectoNombre={proyectoSeleccionado.nombre}
        onCerrar={() => { setProyectoId(''); cargarReportes(); }}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Migraciones</Title>
          <Text type="secondary">Carga masiva de inventario desde Excel</Text>
        </div>
        <Space>
          <Tooltip title="Actualizar historial">
            <Button icon={<ReloadOutlined />} onClick={cargarReportes} loading={cargandoReportes} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalProyecto(true)}>
            Nueva migración
          </Button>
        </Space>
      </div>

      {/* Historial */}
      <Table
        dataSource={reportes}
        columns={columnas}
        rowKey="job_id"
        loading={cargandoReportes}
        size="middle"
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: (
            <Empty
              description="Sin migraciones realizadas"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalProyecto(true)}>
                Crear primera migración
              </Button>
            </Empty>
          ),
        }}
      />

      {/* Modal selección de proyecto */}
      <Modal
        title="Seleccionar proyecto"
        open={modalProyecto}
        onCancel={() => { setModalProyecto(false); setProyectoIdTemp(''); }}
        onOk={iniciarMigracion}
        okText="Continuar"
        okButtonProps={{ disabled: !proyectoIdTemp }}
        cancelText="Cancelar"
        width={420}
      >
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            La migración solo aplica a proyectos sin unidades.
          </Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Seleccionar proyecto destino"
            value={proyectoIdTemp || undefined}
            onChange={setProyectoIdTemp}
            showSearch
            optionFilterProp="label"
            options={inv.proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
          />
        </div>
      </Modal>
    </div>
  );
};

export default MigracionPage;
