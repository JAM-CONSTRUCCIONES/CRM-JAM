import { Drawer, Grid } from 'antd';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';

const { useBreakpoint } = Grid;

const AppLayout = () => {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const screens = useBreakpoint();
  const isDesktop = !!screens.lg;
  const sidebarWidth = sidebarOpen ? 250 : 64;

  const handleMenuClick = () => {
    if (isDesktop) {
      setSidebarOpen(open => !open);
      return;
    }
    setDrawerOpen(true);
  };

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <a className="skip-navigation" href="#main-content">Ir al contenido</a>
      {isDesktop && (
        <aside
          className="fixed inset-y-0 left-0 z-[100] h-screen overflow-hidden border-r border-border bg-card transition-[width] duration-200"
          style={{ width: sidebarWidth }}
        >
          <Sidebar onSelect={() => {}} collapsed={!sidebarOpen} />
        </aside>
      )}

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
        width="min(320px, 90vw)"
        title="Navegación"
        closable
      >
        <Sidebar onSelect={() => setDrawerOpen(false)} />
      </Drawer>

      <div
        className="min-h-screen transition-[margin-left] duration-200"
        style={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
      >
        <header className="app-shell-topbar sticky top-0 z-[99]">
          <div className="flex items-center justify-between px-4 py-2.5 lg:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleMenuClick}
                aria-label={isDesktop ? 'Alternar menu lateral' : 'Abrir menu'}
                aria-expanded={isDesktop ? sidebarOpen : drawerOpen}
              >
                <Menu className="size-5" />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight text-foreground">
                  JAM Construcciones
                </div>
                {isDesktop && (
                  <div className="truncate text-[11px] leading-tight text-muted-foreground">
                    Gestion comercial e inventario
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="app-main px-3 py-3 text-foreground lg:px-7 lg:py-4">
          <div className={`app-content-frame ${pathname === '/migracion' ? 'migration-content' : 'responsive-content'}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
