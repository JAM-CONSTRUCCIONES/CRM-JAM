import { useEffect, useState } from 'react';
import { Card, Typography, Input, Button, Alert, Steps, Form, Spin } from 'antd';
import { initMfaSetup, completeMfaSetup } from '../../services/auth.service';
import QRCode from 'qrcode';

const { Title, Text, Paragraph } = Typography;

const MfaSetupPage = () => {
  const [secretCode, setSecretCode] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { secret, qrUri } = await initMfaSetup();
        setSecretCode(secret);
        const qr = await QRCode.toDataURL(qrUri);
        setQrUrl(qr);
      } catch {
        setError('Error al iniciar la configuración de MFA. Intenta cerrar sesión e ingresar de nuevo.');
      } finally {
        setLoadingSetup(false);
      }
    };
    init();
  }, []);

  const onVerify = async (values: { code: string }) => {
    setError('');
    setLoading(true);
    try {
      await completeMfaSetup(values.code);
      // Recargar sesión completa para que AuthContext detecte MFA configurado
      window.location.href = '/dashboard';
    } catch {
      setError('Código incorrecto. Verifica que el autenticador esté sincronizado.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 460, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>JAM Construcciones</Title>

        <Steps
          size="small"
          current={1}
          items={[{ title: 'Login' }, { title: 'Configurar MFA' }, { title: 'Listo' }]}
          style={{ marginBottom: 24 }}
        />

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        {loadingSetup ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 12 }}>Preparando configuración...</Paragraph>
          </div>
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              message="MFA obligatorio"
              description="Tu cuenta requiere autenticación de dos factores. Escanea el QR con Google Authenticator o Authy."
              style={{ marginBottom: 20 }}
            />

            {qrUrl && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={qrUrl} alt="QR para configurar MFA" style={{ width: 180, height: 180 }} />
              </div>
            )}

            <div style={{ background: '#f5f5f5', borderRadius: 6, padding: '10px 14px', marginBottom: 20 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Clave manual:</Text>
              <div style={{ marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, userSelect: 'all' }}>
                {secretCode}
              </div>
            </div>

            <Form layout="vertical" onFinish={onVerify}>
              <Form.Item
                name="code"
                label="Código del autenticador"
                rules={[{ required: true, message: 'Requerido' }, { len: 6, message: '6 dígitos' }]}
              >
                <Input
                  placeholder="000000"
                  size="large"
                  maxLength={6}
                  autoFocus
                  style={{ letterSpacing: 8, textAlign: 'center' }}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  Activar MFA y continuar
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default MfaSetupPage;
