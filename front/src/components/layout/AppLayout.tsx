import { Layout, Drawer, Button, Grid, Space, Typography } from 'antd';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MenuOutlined } from '@ant-design/icons';
import Sidebar from './Sidebar';

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const screens = useBreakpoint();
  const isDesktop = !!screens.lg;

  const handleMenuClick = () => {
    if (isDesktop) {
      setSidebarOpen(open => !open);
    } else {
      setDrawerOpen(true);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
      {/* Sidebar desktop */}
      {isDesktop && sidebarOpen && (
        <Sider
          width={250}
          style={{
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--app-border)',
            position: 'fixed',
            left: 0, top: 0, bottom: 0,
            height: '100vh',
            overflow: 'hidden',
            zIndex: 100,
            transition: 'all 0.2s ease',
          }}
          trigger={null}
        >
          <Sidebar onSelect={() => {}} />
        </Sider>
      )}

      {/* Drawer móvil */}
      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
        width={220}
        title={null}
        closable={false}
      >
        <Sidebar onSelect={() => setDrawerOpen(false)} />
      </Drawer>

      <Layout style={{
        marginLeft: isDesktop && sidebarOpen ? 250 : 0,
        background: 'var(--app-bg)',
        transition: 'margin-left 0.2s ease',
      }}>
        <div
          className="app-shell-topbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isDesktop ? '10px 28px' : '10px 16px',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Space size={10}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={handleMenuClick}
              aria-label={isDesktop ? 'Alternar menu lateral' : 'Abrir menu'}
            />
            <div>
              <Text strong style={{ fontSize: 15, color: 'var(--text-main)', display: 'block', lineHeight: 1.15 }}>
                JAM Construcciones
              </Text>
              {isDesktop && (
                <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.1 }}>
                  Gestion comercial e inventario
                </Text>
              )}
            </div>
          </Space>
        </div>

        <Content style={{ padding: isDesktop ? '28px 28px 20px' : '16px 12px 18px', minHeight: '100vh', color: 'var(--text-main)' }}>
          <div className="app-content-frame">
            <Outlet />
          </div>
          <div style={{
            textAlign: isDesktop ? 'right' : 'center',
            padding: '24px 0 8px',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            Hecho por{' '}
            <a href="https://methodicatechnology.com/" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
              Methodica Technology &amp; Co
            </a>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
