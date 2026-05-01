import { Layout, Drawer, Button, Grid } from 'antd';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MenuOutlined } from '@ant-design/icons';
import Sidebar from './Sidebar';
import ChatbotWidget from '../common/ChatbotWidget';

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Sidebar desktop */}
      {screens.lg && (
        <Sider
          width={250}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            position: 'fixed',
            left: 0, top: 0, bottom: 0,
            height: '100vh',
            overflow: 'hidden',
            zIndex: 100,
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

      <Layout style={{ marginLeft: screens.lg ? 250 : 0, background: '#f5f7fa' }}>
        {/* Mobile topbar */}
        {!screens.lg && (
          <div style={{
            display: 'flex', alignItems: 'center', padding: '12px 16px',
            background: '#fff', borderBottom: '1px solid #f0f0f0',
            position: 'sticky', top: 0, zIndex: 99,
          }}>
            <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
            <span style={{ fontWeight: 700, fontSize: 15, marginLeft: 8 }}>JAM Construcciones</span>
          </div>
        )}

        <Content style={{ padding: screens.lg ? 28 : 16, minHeight: '100vh' }}>
          <Outlet />
          <div style={{
            textAlign: 'center', padding: '24px 0 8px',
            fontSize: 13, color: '#9ca3af',
          }}>
            Hecho por{' '}
            <a href="https://methodicatechnology.com/" target="_blank" rel="noopener noreferrer"
              style={{ color: '#6b7280', fontWeight: 600, textDecoration: 'none' }}>
              Methodica Technology &amp; Co
            </a>
          </div>
        </Content>
      </Layout>

      <ChatbotWidget />
    </Layout>
  );
};

export default AppLayout;
