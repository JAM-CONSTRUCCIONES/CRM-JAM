import { Popconfirm, Switch, Tooltip, Upload, message } from 'antd';
import {
  AppWindow,
  BotMessageSquare,
  Building2,
  CalendarDays,
  Camera,
  Database,
  FileText,
  FileSpreadsheet,
  LayoutDashboard,
  Link,
  LogOut,
  Mail,
  MessageSquareText,
  Moon,
  Settings,
  ScrollText,
  Sun,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import useAuth from '../../hooks/useAuth';
import { useThemeMode } from '../../context/ThemeContext';
import { actualizarFotoPerfil, eliminarFotoPerfil, getPresignedFotoPerfil } from '../../services/auth.service';
import ChatbotWidget from '../common/ChatbotWidget';
import ImageCropModal from '../common/ImageCropModal';

const FOTO_MAX_SIZE = 5 * 1024 * 1024;
const FOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  onSelect: () => void;
  collapsed?: boolean;
}

interface NavItem {
  key: string;
  icon: ReactNode;
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

const Sidebar = ({ onSelect, collapsed = false }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout, refetch } = useAuth();
  const { isDark, toggleMode } = useThemeMode();
  const rol = usuario?.rol;
  const [chatOpen, setChatOpen] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoPendiente, setFotoPendiente] = useState<File | null>(null);

  const isAdminOrCoordinador = rol === 'admin' || rol === 'coordinador';
  const isInterno = rol === 'admin' || rol === 'coordinador' || rol === 'supervisor';

  const validarFoto = (file: File) => {
    if (!FOTO_TYPES.includes(file.type)) {
      message.error('Solo se permiten imagenes JPG, PNG o WEBP');
      return Upload.LIST_IGNORE;
    }
    if (file.size > FOTO_MAX_SIZE) {
      message.error('La foto no puede pesar mas de 5 MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const prepararFoto = (file: File) => {
    const validacion = validarFoto(file);
    if (validacion !== true) return validacion;
    setFotoPendiente(file);
    return Upload.LIST_IGNORE;
  };

  const subirFoto = async (file: File) => {
    setUploadingFoto(true);
    try {
      const { upload_url, public_url } = await getPresignedFotoPerfil(file.type);
      const res = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!res.ok) throw new Error(`Error subiendo foto: ${res.status}`);
      await actualizarFotoPerfil(public_url);
      await refetch();
      setFotoPendiente(null);
      message.success('Foto de perfil actualizada');
    } catch (err: any) {
      message.error(err?.message || 'No se pudo actualizar la foto');
    } finally {
      setUploadingFoto(false);
    }
    return Upload.LIST_IGNORE;
  };

  const borrarFoto = async () => {
    setUploadingFoto(true);
    try {
      await eliminarFotoPerfil();
      await refetch();
      message.success('Foto eliminada');
    } catch (err: any) {
      message.error(err?.message || 'No se pudo eliminar la foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const sections: NavSection[] = [
    {
      items: [
        { key: '/dashboard', icon: <LayoutDashboard />, label: 'Dashboard' },
        { key: '/inventario', icon: <AppWindow />, label: 'Proyectos' },
        ...(isInterno || rol === 'inmobiliaria' ? [{ key: '/clientes', icon: <Users />, label: 'Clientes' }] : []),
      ],
    },
    ...(isInterno ? [{
      title: 'Administracion',
      items: [
        ...(isAdminOrCoordinador ? [
          { key: '/procesos', icon: <Database />, label: 'Procesos' },
          ...(rol === 'admin' ? [{ key: '/auditoria', icon: <ScrollText />, label: 'Auditoría' }] : []),
          { key: '/tareas', icon: <CalendarDays />, label: 'Agenda / Tareas' },
          { key: '/inmobiliarias', icon: <Building2 />, label: 'Inmobiliarias' },
          { key: '/sistema/usuarios', icon: <User />, label: 'Usuarios' },
          { key: '/migracion', icon: <FileSpreadsheet />, label: 'Migracion Excel' },
          { key: '/config', icon: <Settings />, label: 'Notificaciones' },
        ] : []),
        { key: '/meta-inbox', icon: <BotMessageSquare />, label: 'Inbox Meta' },
        { key: '/meta-leads', icon: <MessageSquareText />, label: 'Leads Meta' },
        { key: '/meta-formularios', icon: <FileText />, label: 'Formularios Meta' },
        { key: '/campanias', icon: <Mail />, label: 'Campanas de correo' },
      ],
    }] : []),
    ...(rol === 'inmobiliaria' ? [{
      title: 'Ventas',
      items: [
        { key: '/procesos', icon: <Database />, label: 'Procesos de venta' },
      ],
    }] : []),
  ];

  return (
    <div className={cn('app-navigation flex h-full flex-col bg-card text-card-foreground', collapsed ? 'px-2 py-3' : 'px-4 py-5')}>
      <div className={cn('flex flex-col items-center', collapsed ? 'pb-3' : 'pb-7')}>
        <img
          src="/Jam-Construcciones.png"
          alt="JAM Construcciones"
          className={cn('object-contain transition-all', collapsed ? 'h-9 w-9' : 'h-24 w-24')}
        />
        {!collapsed && <div className="mt-2 text-sm font-semibold text-foreground">JAM Construcciones</div>}
      </div>

      <nav aria-label="Menú principal" className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'pr-0' : 'pr-1')}>
        {sections.map((section, si) => (
          <div key={si} className={cn(collapsed ? 'mb-1.5' : 'mb-4')}>
            {section.title && !collapsed && (
              <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {section.title}
              </div>
            )}
            <div className={cn('grid', collapsed ? 'gap-0.5' : 'gap-1')}>
              {section.items.map(item => {
                const active = location.pathname === item.key;
                const navButton = (
                  <Button
                    key={item.key}
                    type="button"
                    variant={active ? 'default' : 'ghost'}
                    className={cn(
                      'w-full gap-3 text-sm',
                      collapsed ? 'h-9' : 'h-10',
                      collapsed ? 'justify-center px-0' : 'justify-start px-3',
                      !active && 'text-muted-foreground hover:text-primary',
                    )}
                    onClick={() => {
                      navigate(item.key);
                      onSelect();
                    }}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="[&_svg]:size-4">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Button>
                );

                return collapsed ? (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    {navButton}
                  </Tooltip>
                ) : navButton;
              })}
            </div>
          </div>
        ))}
      </nav>

      {rol === 'inmobiliaria' && usuario?.inmobiliaria_id && !collapsed && (
        <Tooltip title="Copia el enlace para que tus clientes se registren" placement="right">
          <Button
            type="button"
            variant="secondary"
            className="mb-2 h-auto justify-start gap-2 border border-dashed border-primary/40 px-3 py-2 text-primary"
            onClick={() => {
              const id = (usuario.inmobiliaria_id ?? '').replace('INMOBILIARIA#', '');
              const url = `${window.location.origin}/captura?inmo=${id}`;
              navigator.clipboard.writeText(url);
              message.success('Enlace copiado');
            }}
          >
            <Link className="size-4" />
            <span className="truncate text-sm font-medium">Copiar enlace de registro</span>
          </Button>
        </Tooltip>
      )}

      {!collapsed && <Card className="mb-2 border-border bg-muted/60 py-0 shadow-none">
        <CardContent className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <span className="truncate">{isDark ? 'Modo oscuro' : 'Modo claro'}</span>
          </span>
          <Switch size="small" checked={isDark} onChange={toggleMode} />
        </CardContent>
      </Card>}

      <Tooltip title={collapsed ? 'Cerrar sesion' : undefined} placement="right">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          collapsed ? 'mb-2 h-9' : 'mb-3 h-10',
          collapsed ? 'justify-center px-0' : 'justify-start px-3',
        )}
        onClick={logout}
        aria-label="Cerrar sesion"
      >
        <LogOut className="size-4" />
        {!collapsed && 'Cerrar sesion'}
      </Button>
      </Tooltip>

      <Separator className={cn(collapsed ? 'mb-2' : 'mb-3')} />

      {!collapsed ? <Card className="border-border bg-muted/60 py-0 shadow-none">
        <CardContent className="flex items-center gap-3 px-3 py-3">
          <div className="relative h-10 w-10 shrink-0">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={usuario?.foto_url} alt={usuario?.nombre ?? 'Usuario'} />
              <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                {usuario?.nombre?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <Upload
              accept="image/jpeg,image/png,image/webp"
              showUploadList={false}
              beforeUpload={prepararFoto}
              disabled={uploadingFoto}
            >
              <Tooltip title="Cambiar foto">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={uploadingFoto}
                  className="absolute -bottom-1 -right-1 size-5 rounded-full border border-border p-0 shadow-sm"
                >
                  <Camera className="size-3" />
                </Button>
              </Tooltip>
            </Upload>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">
              {usuario?.nombre ?? '-'}
            </div>
            <Badge variant="secondary" className="mt-1 max-w-full truncate px-1.5 py-0 text-[10px]">
              {ROL_LABEL[rol ?? ''] ?? rol}
            </Badge>
          </div>
          {usuario?.foto_url && (
            <Popconfirm
              title="Eliminar foto de perfil"
              description="Se volvera a mostrar la inicial del usuario."
              okText="Eliminar"
              cancelText="Cancelar"
              onConfirm={borrarFoto}
            >
              <Tooltip title="Eliminar foto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={uploadingFoto}
                  className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </CardContent>
      </Card> : (
        <div className="mb-2 flex justify-center">
          <Tooltip title={usuario?.nombre ?? 'Usuario'} placement="right">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={usuario?.foto_url} alt={usuario?.nombre ?? 'Usuario'} />
              <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                {usuario?.nombre?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
          </Tooltip>
        </div>
      )}

      {!collapsed ? (
      <Button
        type="button"
        className="mt-3 h-auto justify-start gap-3 px-3 py-3 shadow-[var(--action-shadow)]"
        onClick={() => setChatOpen(true)}
      >
        <BotMessageSquare className="size-4" />
        <span className="min-w-0 text-left">
          <span className="block text-sm font-bold leading-tight">Asistente IA</span>
          <span className="block truncate text-[10px] font-medium opacity-85">Preguntame lo que quieras</span>
        </span>
      </Button>
      ) : (
        <Tooltip title="Asistente IA" placement="right">
          <Button
            type="button"
            size="icon"
            className="mx-auto mt-2 size-9 shadow-[var(--action-shadow)]"
            onClick={() => setChatOpen(true)}
            aria-label="Asistente IA"
          >
            <BotMessageSquare className="size-4" />
          </Button>
        </Tooltip>
      )}

      {chatOpen && <ChatbotWidget onClose={() => setChatOpen(false)} />}

      <ImageCropModal
        open={!!fotoPendiente}
        file={fotoPendiente}
        title="Ajustar foto de perfil"
        shape="circle"
        aspectRatio={1}
        outputWidth={512}
        onCancel={() => setFotoPendiente(null)}
        onConfirm={subirFoto}
      />
    </div>
  );
};

export default Sidebar;
