import { CheckCircleOutlined, FileTextOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';

const { Paragraph, Text, Title } = Typography;

const CONTACT_EMAIL = 'alvarez@methodicatechnology.com';

const pageContent = {
  callback: {
    icon: <CheckCircleOutlined />,
    title: 'Conexion de Instagram recibida',
    status: 'El proceso de autorizacion de Instagram fue recibido por el CRM.',
    body: [
      'Esta pagina confirma la recepcion del retorno de autorizacion de Instagram Business Login.',
      'El CRM JAM Construcciones utiliza esta conexion para integrar mensajes e interacciones de cuentas autorizadas de Instagram con el seguimiento comercial interno.',
    ],
  },
  cancelled: {
    icon: <SafetyCertificateOutlined />,
    title: 'Autorizacion cancelada',
    status: 'La autorizacion de Instagram fue cancelada o no se completo.',
    body: [
      'No se realizara ninguna conexion adicional si el usuario o negocio cancela el proceso de autorizacion.',
      'Puede iniciar nuevamente el proceso desde la configuracion de integraciones del CRM cuando sea necesario.',
    ],
  },
  deletion: {
    icon: <FileTextOutlined />,
    title: 'Solicitud de eliminacion de datos',
    status: 'Los usuarios pueden solicitar la eliminacion de datos asociados a integraciones Meta.',
    body: [
      `Para solicitar eliminacion de datos relacionados con Instagram, Facebook Messenger o WhatsApp dentro del CRM, escriba a ${CONTACT_EMAIL}.`,
      'La solicitud debe incluir el nombre del negocio, canal asociado y una forma de contacto para validar la titularidad antes de procesar la eliminacion.',
      'Una vez validada la solicitud, se eliminara o desasociara la informacion almacenada conforme a las politicas internas y obligaciones aplicables.',
    ],
  },
  privacy: {
    icon: <SafetyCertificateOutlined />,
    title: 'Politica de privacidad',
    status: 'Uso de datos para integraciones del CRM JAM Construcciones con Meta.',
    body: [
      'El CRM JAM Construcciones procesa informacion de contacto, mensajes e interacciones provenientes de canales autorizados de Meta con fines de gestion comercial y seguimiento de prospectos.',
      'La informacion puede incluir identificadores de usuario de Meta, contenido de mensajes, fecha y hora de interacciones, canal de origen y estado de seguimiento comercial.',
      'Estos datos se utilizan para registrar conversaciones, evitar duplicados, mantener historial del lead y permitir que el equipo comercial atienda las solicitudes recibidas.',
      `Para consultas de privacidad o solicitudes relacionadas con datos, escriba a ${CONTACT_EMAIL}.`,
    ],
  },
};

type PageKey = keyof typeof pageContent;

const pathToPage: Record<string, PageKey> = {
  '/instagram/callback': 'callback',
  '/instagram/auth/cancelled': 'cancelled',
  '/instagram/data-deletion': 'deletion',
  '/privacidad': 'privacy',
  '/politica-privacidad': 'privacy',
};

const MetaCompliancePages = () => {
  const location = useLocation();
  const content = pageContent[pathToPage[location.pathname] ?? 'privacy'];

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-4 py-10 text-[var(--text-main)]">
      <section className="mx-auto max-w-3xl">
        <Card className="border border-[var(--app-border)] shadow-[var(--panel-shadow)]">
          <Space direction="vertical" size={20} className="w-full">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-[var(--action-soft-hover)] text-2xl text-[var(--action-bg)]">
                {content.icon}
              </span>
              <div>
                <Text className="text-sm uppercase tracking-wide text-[var(--text-secondary)]">
                  JAM Construcciones CRM
                </Text>
                <Title level={2} className="!mb-0 !mt-1">
                  {content.title}
                </Title>
              </div>
            </div>

            <Alert type="info" showIcon message={content.status} />

            <div className="space-y-3">
              {content.body.map((paragraph) => (
                <Paragraph key={paragraph} className="!mb-0 text-base leading-7">
                  {paragraph}
                </Paragraph>
              ))}
            </div>

            <div className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-4">
              <Text strong>Contacto:</Text>
              <Paragraph className="!mb-0 !mt-1">
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </Paragraph>
            </div>

            <Space wrap>
              <Button type="primary" href={`mailto:${CONTACT_EMAIL}`}>
                Contactar soporte
              </Button>
              <Link to="/login">
                <Button>Ir al CRM</Button>
              </Link>
            </Space>
          </Space>
        </Card>
      </section>
    </main>
  );
};

export default MetaCompliancePages;
