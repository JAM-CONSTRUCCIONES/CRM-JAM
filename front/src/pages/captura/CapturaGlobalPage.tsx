import { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Typography, Result, Spin, Alert, Avatar } from 'antd';
import { UserOutlined, CheckCircleFilled, BankOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getInmobiliariasPublico, getProyectosPublico, registrarClientePublico } from '../../services/clientes.service';

const { Title, Text } = Typography;
const { Option } = Select;

const CapturaGlobalPage = () => {
  const [inmobiliarias, setInmobiliarias] = useState<{ id: string; nombre: string; imagen_url?: string }[]>([]);
  const [proyectos, setProyectos] = useState<{ proyecto_id: string; nombre: string }[]>([]);
  const [loadingInmobiliarias, setLoadingInmobiliarias] = useState(true);
  const [loadingProyectos, setLoadingProyectos] = useState(false);
  const [inmobiliariaSeleccionada, setInmobiliariaSeleccionada] = useState<string>('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    cargarInmobiliarias();
  }, []);

  const cargarInmobiliarias = async () => {
    setLoadingInmobiliarias(true);
    try {
      const data = await getInmobiliariasPublico();
      setInmobiliarias(data);
    } catch (err: any) {
      console.error('Error al cargar inmobiliarias:', err);
      setErrorMsg('No se pudieron cargar las inmobiliarias. Intenta de nuevo.');
    } finally {
      setLoadingInmobiliarias(false);
    }
  };

  const handleInmobiliariaChange = async (inmoId: string) => {
    setInmobiliariaSeleccionada(inmoId);
    form.setFieldsValue({ proyecto_id: undefined });
    setProyectos([]);
    
    if (!inmoId) return;

    setLoadingProyectos(true);
    try {
      const data = await getProyectosPublico(inmoId);
      setProyectos(data);
      if (data.length === 0) {
        setErrorMsg('Esta inmobiliaria no tiene proyectos asignados aún.');
      } else {
        setErrorMsg('');
      }
    } catch (err: any) {
      console.error('Error al cargar proyectos:', err);
      setErrorMsg(err?.message || 'No se pudieron cargar los proyectos.');
      setProyectos([]);
    } finally {
      setLoadingProyectos(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setEnviando(true);
    setErrorMsg('');
    try {
      await registrarClientePublico({
        ...values,
        inmobiliaria_id: inmobiliariaSeleccionada,
        fecha_nacimiento: values.fecha_nacimiento
          ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD')
          : undefined,
      });
      setEnviado(true);
    } catch (err: any) {
      console.error('Error al registrar cliente:', err);
      const errorMessage = err?.message || 'Ocurrió un error al registrar. Intenta de nuevo.';
      setErrorMsg(errorMessage);
    } finally {
      setEnviando(false);
    }
  };

  // Éxito
  if (enviado) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircleFilled style={{ fontSize: 56, color: '#52c41a', marginBottom: 16 }} />
            <Title level={3} style={{ margin: '0 0 8px', color: '#fff' }}>¡Registro exitoso!</Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 16 }}>
              Tus datos han sido registrados correctamente. Tu asesor se pondrá en contacto contigo pronto.
            </Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <style>{`
        .captura-form .ant-form-item-label > label {
          color: #fff !important;
          font-weight: 500;
        }
        .captura-form .ant-form-item-label > label.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
          color: #ff4d4f !important;
        }
        .captura-global-select .ant-select-item-option-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
      `}</style>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <img
            src="/Jam-Construcciones.png"
            alt="JAM Construcciones"
            style={{ height: 40, objectFit: 'contain', marginBottom: 12 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <Title level={3} style={{ margin: '0 0 4px', color: '#fff' }}>Registro de interés</Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Completa el formulario y un asesor se comunicará contigo</Text>
        </div>

        {loadingInmobiliarias ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={handleSubmit} 
            style={{ marginTop: 24 }}
            className="captura-form"
          >
            {/* Selector de Inmobiliaria */}
            <Form.Item 
              name="inmobiliaria_id" 
              label="Inmobiliaria" 
              rules={[{ required: true, message: 'Selecciona una inmobiliaria' }]}
            >
              <Select 
                placeholder="Selecciona la inmobiliaria"
                onChange={handleInmobiliariaChange}
                className="captura-global-select"
                size="large"
                optionLabelProp="label"
              >
                {inmobiliarias.map(inmo => (
                  <Option 
                    key={inmo.id} 
                    value={inmo.id}
                    label={inmo.nombre}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {inmo.imagen_url ? (
                        <img 
                          src={inmo.imagen_url} 
                          alt={inmo.nombre}
                          style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                        />
                      ) : (
                        <Avatar 
                          size={32} 
                          icon={<BankOutlined />}
                          style={{ background: '#1677ff' }}
                        />
                      )}
                      <span>{inmo.nombre}</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Selector de Proyecto */}
            <Form.Item 
              name="proyecto_id" 
              label="Proyecto de interés" 
              rules={[{ required: true, message: 'Selecciona un proyecto' }]}
            >
              <Select 
                placeholder={inmobiliariaSeleccionada ? "Selecciona el proyecto" : "Primero selecciona una inmobiliaria"}
                disabled={!inmobiliariaSeleccionada || loadingProyectos}
                loading={loadingProyectos}
                size="large"
              >
                {proyectos.map(p => (
                  <Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Option>
                ))}
              </Select>
            </Form.Item>

            {errorMsg && (
              <Alert type="warning" title={errorMsg} showIcon style={{ marginBottom: 16 }} />
            )}

            {/* Datos personales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="nombres" label="Nombres" rules={[{ required: true, message: 'Ingresa tus nombres' }]}>
                <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Juan" />
              </Form.Item>
              <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true, message: 'Ingresa tus apellidos' }]}>
                <Input placeholder="Pérez" />
              </Form.Item>
            </div>

            <Form.Item name="cedula" label="Cédula / Pasaporte" rules={[{ required: true, message: 'Ingresa tu cédula o pasaporte' }]}>
              <Input placeholder="V-12345678" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="correo" label="Correo electrónico">
                <Input type="email" placeholder="correo@ejemplo.com" />
              </Form.Item>
              <Form.Item name="telefono" label="Teléfono / WhatsApp">
                <Input placeholder="+58 412 0000000" />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/AAAA" />
              </Form.Item>
              <Form.Item name="estado_civil" label="Estado civil">
                <Select allowClear placeholder="Selecciona">
                  <Option value="soltero">Soltero/a</Option>
                  <Option value="casado">Casado/a</Option>
                  <Option value="divorciado">Divorciado/a</Option>
                  <Option value="viudo">Viudo/a</Option>
                  <Option value="union_libre">Unión libre</Option>
                </Select>
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Form.Item name="nacionalidad" label="Nacionalidad">
                <Input placeholder="Venezolano/a" />
              </Form.Item>
              <Form.Item name="pais_residencia" label="País de residencia">
                <Input placeholder="Venezuela" />
              </Form.Item>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={enviando}
              block
              size="large"
              style={{ marginTop: 4 }}
              disabled={!inmobiliariaSeleccionada || proyectos.length === 0}
            >
              Enviar registro
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: '#0a1929',
    backgroundImage: `
      linear-gradient(135deg, rgba(10, 25, 41, 0.95) 0%, rgba(16, 54, 95, 0.92) 100%),
      url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')
    `,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: 'rgba(16, 35, 58, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.24), 0 0 0 1px rgba(255,255,255,0.1)',
    padding: '32px 36px',
    width: '100%',
    maxWidth: 560,
  },
  header: {
    textAlign: 'center',
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
    marginBottom: 4,
  },
};

export default CapturaGlobalPage;
