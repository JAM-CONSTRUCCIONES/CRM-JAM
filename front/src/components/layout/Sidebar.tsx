import { Avatar, Switch, Typography, Tooltip, message } from 'antd';
import {
  AppstoreOutlined, TeamOutlined, DashboardOutlined,
  BankOutlined, UserOutlined, PoweroffOutlined,
  ApartmentOutlined, LinkOutlined, ImportOutlined,
  MessageOutlined, SettingOutlined, MailOutlined,
  MoonOutlined, SunOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useState } from 'react';
import ChatbotWidget from '../common/ChatbotWidget';
import { useThemeMode } from '../../context/ThemeContext';

const { Text } = Typography;

interface Props {
  onSelect: () => void;
}

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  supervisor: 'Supervisor',
  inmobiliaria: 'Inmobiliaria',
};

const Sidebar = ({ onSelect }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const { isDark, toggleMode } = useThemeMode();
  const rol = usuario?.rol;
  const [chatOpen, setChatOpen] = useState(false);

  const isAdminOrCoordinador = rol === 'admin' || rol === 'coordinador';
  const isInterno = rol === 'admin' || rol === 'coordinador' || rol === 'supervisor';

  const sections: NavSection[] = [
    {
      items: [
        { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/inventario', icon: <AppstoreOutlined />, label: 'Proyectos' },
        ...(isInterno || rol === 'inmobiliaria' ? [{ key: '/clientes', icon: <TeamOutlined />, label: 'Clientes' }] : []),
        // { key: '/reportes', icon: <LinkOutlined />, label: 'Reportes' },
      ],
    },
    ...(isInterno ? [{
      title: 'Administración',
      items: [
        ...(isAdminOrCoordinador ? [
          { key: '/inmobiliarias',    icon: <BankOutlined />,      label: 'Inmobiliarias' },
          { key: '/procesos',         icon: <ApartmentOutlined />, label: 'Procesos' },
          { key: '/migracion',        icon: <ImportOutlined />,    label: 'Migración Excel' },
          { key: '/tareas',           icon: <ScheduleOutlined />,  label: 'Agenda / Tareas' },
          { key: '/sistema/usuarios', icon: <UserOutlined />,      label: 'Usuarios' },
          { key: '/config',           icon: <SettingOutlined />,   label: 'Configuración de notificaciones' },
        ] : []),
        { key: '/campanias', icon: <MailOutlined />, label: 'Campañas de correo' },
      ],
    }] : []),
    ...(rol === 'inmobiliaria' ? [{
      title: 'Ventas',
      items: [
        { key: '/procesos', icon: <ApartmentOutlined />, label: 'Procesos de venta' },
      ],
    }] : []),
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '20px 16px', background: 'var(--sidebar-bg)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 28 }}>
        <img
          src="/Jam-Construcciones.png"
          alt="JAM Construcciones"
          style={{ width: 100, height: 100, objectFit: 'contain' }}
        />
        <Text strong style={{ color: 'var(--text-main)', fontSize: 14, marginTop: 8 }}>JAM Construcciones</Text>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 16 }}>
            {section.title && (
              <Text style={{
                fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600,
                letterSpacing: 1.2, padding: '0 8px 6px',
                display: 'block', textTransform: 'uppercase',
              }}>
                {section.title}
              </Text>
            )}
            {section.items.map(item => {
              const active = location.pathname === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => { navigate(item.key); onSelect(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    marginBottom: 4,
                    background: active ? 'var(--action-bg)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                    fontSize: 14,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--nav-hover-bg)';
                    if (!active) (e.currentTarget as HTMLDivElement).style.color = 'var(--action-bg)';
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    if (!active) (e.currentTarget as HTMLDivElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  <span style={{ fontSize: 17, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                  {item.label}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Enlace de captura — solo inmobiliaria */}
      {rol === 'inmobiliaria' && usuario?.inmobiliaria_id && (
        <Tooltip title="Copia el enlace para que tus clientes se registren" placement="right">
          <div
            onClick={() => {
              const id = (usuario.inmobiliaria_id ?? '').replace('INMOBILIARIA#', '');
              const url = `${window.location.origin}/captura?inmo=${id}`;
              navigator.clipboard.writeText(url);
              message.success('Enlace copiado');
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              color: 'var(--action-bg)', fontSize: 14, marginBottom: 8,
              background: 'var(--nav-hover-bg)', border: '1px dashed var(--action-border)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--action-soft-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--nav-hover-bg)'; }}
          >
            <LinkOutlined style={{ fontSize: 15 }} />
            <span style={{ fontWeight: 500 }}>Copiar enlace de registro</span>
          </div>
        </Tooltip>
      )}

      {/* Theme toggle */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '10px 14px', borderRadius: 10,
          color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8,
          background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDark ? <MoonOutlined /> : <SunOutlined />}
          {isDark ? 'Modo oscuro' : 'Modo claro'}
        </span>
        <Switch size="small" checked={isDark} onChange={toggleMode} />
      </div>

      {/* Logout */}
      <div
        onClick={logout}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 14, marginBottom: 12,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.color = '#ff4d4f';
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,77,79,0.1)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.color = 'var(--text-muted)';
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        <PoweroffOutlined style={{ fontSize: 16 }} />
        Cerrar sesión
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--app-border)', marginBottom: 12 }} />

      {/* User profile */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        background: 'var(--panel-soft-bg)', border: '1px solid var(--app-border)',
      }}>
        <Avatar size={34} style={{ background: 'var(--action-bg)', flexShrink: 0, fontWeight: 700 }}>
          {usuario?.nombre?.charAt(0).toUpperCase() ?? 'U'}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Text strong style={{
            fontSize: 13, color: 'var(--text-main)', display: 'block',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {usuario?.nombre ?? '—'}
          </Text>
          <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {ROL_LABEL[rol ?? ''] ?? rol}
          </Text>
        </div>
      </div>

      {/* Botón Chatbot */}
      <div
        onClick={() => setChatOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          cursor: 'pointer',
          background: 'var(--action-bg)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          marginTop: 12,
          transition: 'all 0.2s',
          boxShadow: 'var(--action-shadow)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--action-hover)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--action-shadow-hover)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--action-bg)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--action-shadow)';
        }}
      >
        <MessageOutlined style={{ fontSize: 16 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Asistente IA</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>Pregúntame lo que quieras</div>
        </div>
      </div>

      {/* ChatbotWidget con diseño completo */}
      {chatOpen && <ChatbotWidget onClose={() => setChatOpen(false)} />}
    </div>
  );
};

export default Sidebar;
