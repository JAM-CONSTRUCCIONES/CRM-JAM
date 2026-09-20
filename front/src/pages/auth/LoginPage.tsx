import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { login, confirmMfaCode, forgotPassword, confirmForgotPassword } from '../../services/auth.service';
import useAuth from '../../hooks/useAuth';

// Imagen de construcción/arquitectura desde Unsplash (libre de uso)
const BG_IMAGE = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80&auto=format&fit=crop';

type Step = 'login' | 'mfa_code' | 'mfa_setup' | 'forgot' | 'forgot_confirm';

export default function LoginPage() {
  const navigate = useNavigate();
  const { usuario, loading: authLoading, refetch } = useAuth();

  const [step, setStep] = useState<Step>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [forgotUser, setForgotUser] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const setErr = (msg: string) => { setError(msg); setLoading(false); };

  useEffect(() => {
    if (authLoading || !usuario) return;
    navigate(usuario.mfa_required ? '/mfa-setup' : '/dashboard', { replace: true });
  }, [authLoading, navigate, usuario]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await login(username, password);
      if (result.type === 'mfa_code') {
        setStep('mfa_code'); setLoading(false);
      } else if (result.type === 'mfa_setup') {
        setSecret(result.secret);
        const uri = `otpauth://totp/JAM:${encodeURIComponent(username)}?secret=${result.secret}&issuer=JAM%20Construcciones`;
        setQrUrl(await QRCode.toDataURL(uri));
        setStep('mfa_setup'); setLoading(false);
      } else {
        // Login exitoso sin MFA o con MFA ya completado
        await refetch();
        navigate('/dashboard');
      }
    } catch (e: unknown) {
      console.error('LOGIN ERROR:', e);
      // El trigger Pre-Authentication lanza este mensaje cuando el usuario
      // interno no tiene MFA configurado aún
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('MFA_SETUP_REQUIRED')) {
        setErr('Tu cuenta requiere configurar MFA antes de continuar. Contacta al administrador para que active tu configuración inicial.');
      } else {
        setErr('Usuario o contraseña incorrectos');
      }
    }
  };

  const handleMfaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await confirmMfaCode(mfaCode);
      await refetch();
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expiró')) {
        setErr('La sesión expiró. Vuelve a ingresar tus credenciales.');
        setStep('login');
      } else {
        setErr('Código incorrecto o expirado');
      }
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await confirmMfaCode(setupCode);
      await refetch();
      navigate('/dashboard');
    } catch { setErr('Código incorrecto. Verifica tu autenticador.'); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await forgotPassword(forgotUser);
      setStep('forgot_confirm'); setLoading(false);
    } catch { setErr('No se pudo enviar el código. Verifica el usuario.'); }
  };

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await confirmForgotPassword(forgotUser, forgotCode, newPassword);
      setStep('login'); setLoading(false);
    } catch { setErr('Código incorrecto o contraseña inválida.'); }
  };

  const stepTitles: Record<Step, string> = {
    login: 'Bienvenido',
    mfa_code: 'Verificación',
    mfa_setup: 'Configura tu autenticador',
    forgot: 'Recuperar acceso',
    forgot_confirm: 'Nueva contraseña',
  };

  const stepSubtitles: Record<Step, string> = {
    login: 'Ingresa tus credenciales para continuar',
    mfa_code: 'Ingresa el código de 6 dígitos de tu autenticador',
    mfa_setup: 'Escanea el QR con Google Authenticator o Authy',
    forgot: 'Te enviaremos un código a tu correo registrado',
    forgot_confirm: 'Ingresa el código recibido y tu nueva contraseña',
  };

  if (authLoading || usuario) {
    return (
      <div style={s.loadingScreen}>
        <div style={s.spinnerDark} />
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* Panel izquierdo — imagen */}
      <div style={s.hero} className="login-hero">
        <img src={BG_IMAGE} alt="Construcción" style={s.heroImg} />
        <div style={s.heroOverlay} />
        <div style={s.heroContent}>
          <div style={s.heroBadge}>Sistema de Gestión</div>
          <h1 style={s.heroTitle}>Construyendo el futuro,<br />gestionando el presente</h1>
          <p style={s.heroSub}>Plataforma integral de inventario y ventas para proyectos inmobiliarios</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={s.panel}>
        <div style={s.form}>
          {/* Logo */}
          <div style={s.logoWrap}>
            <img
              src="/Jam-Construcciones.png"
              alt="JAM Construcciones"
              style={s.logo}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span style={s.logoFallback}>JAM Construcciones</span>
          </div>

          <h2 style={s.title}>{stepTitles[step]}</h2>
          <p style={s.subtitle}>{stepSubtitles[step]}</p>

          {error && <div style={s.error}>{error}</div>}

          {step === 'login' && (
            <form onSubmit={handleLogin}>
              <label style={s.label}>Usuario</label>
              <input style={s.input} placeholder="Tu nombre de usuario" value={username}
                onChange={e => setUsername(e.target.value)} autoComplete="username" required />
              <label style={s.label}>Contraseña</label>
              <div style={s.inputWrap}>
                <input style={{ ...s.input, marginBottom: 0, paddingRight: 42 }} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? <span style={s.spinner} /> : null}
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <button style={s.link} type="button" onClick={() => { setError(''); setStep('forgot'); }}>
                Olvidé mi contraseña
              </button>
            </form>
          )}

          {step === 'mfa_code' && (
            <form onSubmit={handleMfaCode}>
              <div style={s.mfaIcon}>🔐</div>
              <input style={{ ...s.input, letterSpacing: 10, textAlign: 'center', fontSize: 22 }}
                placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value)}
                maxLength={6} autoFocus required />
              <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? 'Verificando...' : 'Verificar código'}
              </button>
              <button style={s.link} type="button" onClick={() => { setError(''); setStep('login'); }}>← Volver</button>
            </form>
          )}

          {step === 'mfa_setup' && (
            <form onSubmit={handleSetup}>
              {qrUrl && (
                <div style={s.qrWrap}>
                  <img src={qrUrl} alt="QR MFA" style={s.qr} />
                </div>
              )}
              <div style={s.secretBox}>
                <span style={s.secretLabel}>Clave manual</span>
                <code style={s.secretCode}>{secret}</code>
              </div>
              <input style={{ ...s.input, letterSpacing: 8, textAlign: 'center' }}
                placeholder="Código del autenticador" value={setupCode}
                onChange={e => setSetupCode(e.target.value)} maxLength={6} autoFocus required />
              <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? 'Activando...' : 'Activar MFA y entrar'}
              </button>
            </form>
          )}

          {step === 'forgot' && (
            <form onSubmit={handleForgot}>
              <label style={s.label}>Usuario</label>
              <input style={s.input} placeholder="Tu nombre de usuario" value={forgotUser}
                onChange={e => setForgotUser(e.target.value)} required />
              <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar código'}
              </button>
              <button style={s.link} type="button" onClick={() => { setError(''); setStep('login'); }}>← Volver al login</button>
            </form>
          )}

          {step === 'forgot_confirm' && (
            <form onSubmit={handleForgotConfirm}>
              <label style={s.label}>Código de verificación</label>
              <input style={s.input} placeholder="Código recibido por correo" value={forgotCode}
                onChange={e => setForgotCode(e.target.value)} maxLength={6} required />
              <label style={s.label}>Nueva contraseña</label>
              <div style={s.inputWrap}>
                <input style={{ ...s.input, marginBottom: 0, paddingRight: 42 }} type={showNewPassword ? 'text' : 'password'} placeholder="••••••••" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required />
                <button type="button" style={s.eyeBtn} onClick={() => setShowNewPassword(v => !v)} tabIndex={-1} aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showNewPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
              <button style={s.link} type="button" onClick={() => { setError(''); setStep('login'); }}>← Volver al login</button>
            </form>
          )}

          {/* Footer */}
          <p style={s.footer}>
            Hecho por{' '}
            <a href="https://methodicatechnology.com/" target="_blank" rel="noopener noreferrer" style={s.footerBrand}>
              Methodica Technology &amp; Co
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif",
  },
  // Hero
  hero: {
    flex: 1, position: 'relative', overflow: 'hidden',
    display: 'none',
    // visible en desktop via media query — se maneja con CSS en index.css
  },
  heroImg: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
  },
  heroOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(135deg, rgba(10,30,60,0.85) 0%, rgba(20,80,40,0.7) 100%)',
  },
  heroContent: {
    position: 'relative', zIndex: 1, padding: '48px 40px',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%',
  },
  heroBadge: {
    display: 'inline-block', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
    color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: 2,
    textTransform: 'uppercase', padding: '6px 14px', borderRadius: 20, marginBottom: 20,
    width: 'fit-content',
  },
  heroTitle: {
    color: '#fff', fontSize: 32, fontWeight: 700, lineHeight: 1.3, margin: '0 0 16px',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.6, margin: 0,
  },
  // Panel
  panel: {
    width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '40px 24px', background: '#fff',
  },
  form: { width: '100%', maxWidth: 380 },
  // Logo
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 },
  logo: { height: 40, objectFit: 'contain' },
  logoFallback: { fontSize: 18, fontWeight: 700, color: '#1a1a2e' },
  // Títulos
  title: { fontSize: 26, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: '0 0 28px' },
  // Inputs
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 },
  input: {
    display: 'block', width: '100%', padding: '11px 14px', marginBottom: 16,
    borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 15,
    boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s',
    background: '#f9fafb', color: '#1a1a2e',
  },
  // Botón
  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', padding: '12px 0', marginTop: 4, marginBottom: 4,
    background: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a4f 100%)',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 15,
    fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
  },
  btnDisabled: { opacity: 0.7, cursor: 'not-allowed' },
  link: {
    display: 'block', width: '100%', marginTop: 12, background: 'none',
    border: 'none', color: '#2d6a4f', cursor: 'pointer', fontSize: 14,
    fontWeight: 500, textAlign: 'center' as const,
  },
  // Error
  error: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 14,
  },
  // MFA
  mfaIcon: { textAlign: 'center' as const, fontSize: 40, marginBottom: 16 },
  // QR setup
  qrWrap: {
    display: 'flex', justifyContent: 'center', marginBottom: 16,
    padding: 12, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb',
  },
  qr: { width: 160, height: 160 },
  secretBox: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
    padding: '10px 14px', marginBottom: 16,
  },
  secretLabel: { display: 'block', fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4, letterSpacing: 1 },
  secretCode: { display: 'block', wordBreak: 'break-all', fontSize: 13, color: '#1a1a2e', fontFamily: 'monospace' },
  spinner: {
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
  inputWrap: {
    position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 16,
  },
  eyeBtn: {
    position: 'absolute', right: 10, background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
    color: '#6b7280', display: 'flex', alignItems: 'center',
  },
  footer: {
    marginTop: 32, textAlign: 'center' as const,
    fontSize: 13, color: '#9ca3af',
  },
  footerBrand: {
    color: '#6b7280', fontWeight: 600, textDecoration: 'none',
  },
  loadingScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
  },
  spinnerDark: {
    width: 28,
    height: 28,
    border: '3px solid #e5e7eb',
    borderTopColor: '#2d6a4f',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
