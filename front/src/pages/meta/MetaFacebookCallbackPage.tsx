import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Result, Space, Spin, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { completarFacebookMessengerOAuth } from '../../services/meta.service';

const { Paragraph, Text } = Typography;

const MetaFacebookCallbackPage = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [loading, setLoading] = useState(true);
  const [pageName, setPageName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('code') || '';
    const metaError = params.get('error_description') || params.get('error') || '';
    if (metaError) {
      setError(metaError);
      setLoading(false);
      return;
    }
    if (!code) {
      setError('Meta no devolvio codigo de autorizacion.');
      setLoading(false);
      return;
    }
    completarFacebookMessengerOAuth(code)
      .then((result) => {
        setPageName(result.page_name || result.page_id || 'Facebook');
      })
      .catch((err) => {
        setError(err?.message || 'No se pudo completar la conexion con Facebook.');
      })
      .finally(() => setLoading(false));
  }, [params]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] px-4">
        <Card className="w-full max-w-md text-center">
          <Space direction="vertical" size={16}>
            <Spin />
            <Text>Conectando Facebook Messenger...</Text>
          </Space>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] px-4">
      <Card className="w-full max-w-xl">
        {error ? (
          <Result
            status="error"
            title="No se pudo conectar Facebook"
            subTitle={error}
            extra={[
              <Link to="/meta-inbox" key="inbox">
                <Button type="primary">Volver al Inbox Meta</Button>
              </Link>,
            ]}
          />
        ) : (
          <Result
            status="success"
            title="Facebook Messenger conectado"
            subTitle={pageName ? `Pagina conectada: ${pageName}` : 'La pagina quedo conectada al CRM.'}
            extra={[
              <Link to="/meta-inbox" key="inbox">
                <Button type="primary">Ir al Inbox Meta</Button>
              </Link>,
            ]}
          >
            <Alert
              type="success"
              showIcon
              message="Los mensajes nuevos de Messenger llegaran al CRM mediante el webhook de Meta."
            />
            <Paragraph className="!mt-3 !mb-0 text-center text-sm text-[var(--text-secondary)]">
              Si no ves conversaciones aun, espera a que entre un mensaje nuevo desde Facebook.
            </Paragraph>
          </Result>
        )}
      </Card>
    </main>
  );
};

export default MetaFacebookCallbackPage;
