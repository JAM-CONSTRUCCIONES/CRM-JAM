import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import {
  Upload, Button, Table, Tag, Input, InputNumber, Select, Space,
  Alert, Typography, Steps, Spin, Result, Tooltip, Badge, Popover, Modal,
} from 'antd';
import {
  UploadOutlined, RobotOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined, InfoCircleOutlined,
  ThunderboltOutlined, PlusOutlined,
} from '@ant-design/icons';
import {
  getUploadUrl, uploadExcel, getPreview, confirmarMigracion,
  type FilaMigracion, type ReporteMigracion,
} from '../../services/migracion.service';
import { getInmobiliarias, type Inmobiliaria } from '../../services/inmobiliarias.service';
import { getEtapas } from '../../services/proyectos.service';
import type { Etapa } from '../../types';
import {
  PAISES_OPTIONS,
  NACIONALIDADES_OPTIONS,
  isNacionalidadValida,
  isPaisValido,
} from '../../constants/catalogosCliente';
import { clienteFieldNormalizers } from '../../utils/clientesValidation';

const { Title, Text } = Typography;
const { Option } = Select;

const ESTADOS_VALIDOS = ['disponible', 'bloqueada', 'no_disponible'];
const DOCUMENTO_REGEX = /^[A-Z0-9]+$/;
const NOMBRE_REGEX = /^[\p{L}\s]+$/u;
const TELEFONO_REGEX = /^\d+$/;
const EMAIL_REGEX = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const fechaValida = (value?: string | null) => {
  if (!value) return true;
  return !Number.isNaN(Date.parse(value));
};

const cleanSpaces = (value?: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeDocumentoInput = (value?: unknown) => String(value ?? '').trim().toLocaleUpperCase('es-VE');
const documentoTemporal = (proyectoId: string, idx: number) => {
  const proyectoSeguro = normalizeDocumentoInput(proyectoId).replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PROYECTO';
  return `MIGP${proyectoSeguro}${String(idx).padStart(3, '0')}`;
};

const validarDatosClienteMigracion = (f: FilaMigracion) => {
  const errores: string[] = [];
  const documento = normalizeDocumentoInput(f.cedula);
  const nombres = cleanSpaces(f.nombres_sugerido);
  const apellidos = cleanSpaces(f.apellidos_sugerido);
  const telefono = cleanSpaces(f.cliente_telefono);
  const correo = cleanSpaces(f.cliente_correo).toLowerCase();

  if (!documento) errores.push('documento de identidad obligatorio cuando hay cliente');
  else if (!DOCUMENTO_REGEX.test(documento)) errores.push('documento solo debe contener letras y numeros');

  if (!nombres) errores.push('nombres requeridos si hay documento');
  else if (!NOMBRE_REGEX.test(nombres)) errores.push('nombres solo deben contener letras y espacios');

  if (!apellidos) errores.push('apellidos requeridos si hay documento');
  else if (!NOMBRE_REGEX.test(apellidos)) errores.push('apellidos solo deben contener letras y espacios');

  if (telefono && !TELEFONO_REGEX.test(telefono)) errores.push('telefono solo debe contener numeros');
  if (correo && !EMAIL_REGEX.test(correo)) errores.push('correo invalido con dominio requerido');
  if (!isNacionalidadValida(f.nacionalidad)) errores.push('selecciona una nacionalidad valida');
  if (!isPaisValido(f.pais_residencia)) errores.push('selecciona un pais de residencia valido');

  return errores;
};

// ── Local-state input cells — only call parent on blur, not on every keystroke ──
const CeldaInputLocal = memo(({ value, placeholder, onChange, style }: {
  value: string; placeholder?: string; onChange: (v: string) => void; style?: React.CSSProperties;
}) => {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      value={local}
      placeholder={placeholder}
      style={style}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
    />
  );
});

const CeldaNumberLocal = memo(({ value, min, onChange, formatter }: {
  value: number | null; min?: number;
  onChange: (v: number | null) => void;
  formatter?: (v: number | undefined) => string;
}) => {
  const [local, setLocal] = useState<number | null>(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <InputNumber
      value={local ?? undefined}
      min={min}
      style={{ width: '100%' }}
      formatter={formatter}
      onChange={v => setLocal(v)}
      onBlur={() => onChange(local)}
    />
  );
});

interface Props {
  proyectoId: string;
  proyectoNombre: string;
  onCerrar: () => void;
}

type Paso = 'upload' | 'revision' | 'resultado';

export default function MigracionExcel({ proyectoId, proyectoNombre, onCerrar }: Props) {
  const [paso, setPaso] = useState<Paso>('upload');
  const [cargando, setCargando] = useState(false);
  const [jobId, setJobId] = useState('');
  const [filas, setFilas] = useState<FilaMigracion[]>([]);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [reporte, setReporte] = useState<ReporteMigracion | null>(null);
  const [error, setError] = useState('');
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  // Cargar inmobiliarias al montar
  useEffect(() => {
    getInmobiliarias().then(setInmobiliarias).catch(() => {});
    getEtapas(proyectoId).then(setEtapas).catch(() => {});
  }, [proyectoId]);

  // ── Scroll horizontal con Shift+Scroll ───────────────────────────────────
  useEffect(() => {
    const el = tableRef.current?.querySelector('.ant-table-body') as HTMLElement | null;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [paso]);

  // ── Validar fila ─────────────────────────────────────────────────────────
  const validarFila = (f: FilaMigracion) => {
    const erroresPersistentes = (f.errores ?? []).filter(e =>
      e.includes('ya existe en este proyecto') || e.includes('duplicado') || e.includes('duplicada')
    );
    const errores: string[] = [...erroresPersistentes];
    const advertencias: string[] = [];
    if (!f.id_unidad) errores.push('id_unidad vacío');
    if (f.precio === null || f.precio === undefined) errores.push('precio inválido o vacío');
    if (f.metraje === null || f.metraje === undefined) errores.push('metraje inválido o vacío');
    if (!ESTADOS_VALIDOS.includes(f.estado)) errores.push('estado inválido');
    if (f.estado !== 'disponible' && !f.inmobiliaria_nombre_sugerido)
      errores.push('inmobiliaria requerida para este estado');

    const tieneDatosCliente = [
      f.cliente_nombre_excel,
      f.cedula,
      f.nombres_sugerido,
      f.apellidos_sugerido,
      f.cliente_correo,
      f.cliente_telefono,
      f.fecha_nacimiento,
      f.pais_residencia,
      f.nacionalidad,
    ].some(value => String(value ?? '').trim());

    if (tieneDatosCliente) {
      errores.push(...validarDatosClienteMigracion(f));
      if (!f.inmobiliaria_nombre_sugerido) errores.push('inmobiliaria requerida si hay documento');
    }
    if (!fechaValida(f.fecha_nacimiento)) errores.push('fecha de nacimiento invalida');
    if (!fechaValida(f.fecha_bloqueo)) errores.push('Fecha Bloqueo invalida');
    if (f.cliente_nombre_excel && !f.cedula) {
      if (!f.nombres_sugerido || !f.apellidos_sugerido)
        advertencias.push('Completa nombres y apellidos para registrar el cliente');
      if (!f.inmobiliaria_nombre_sugerido)
        advertencias.push('Sin inmobiliaria, el cliente no se registrará');
    }
    return { errores, advertencias };
  };

  // ── Subir Excel ──────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setCargando(true);
    setError('');
    try {
      const { upload_url, job_id } = await getUploadUrl(proyectoId);
      await uploadExcel(upload_url, file);
      setJobId(job_id);
      setArchivoNombre(file.name);

      let preview = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 4000));
        try { preview = await getPreview(job_id); break; } catch { /* sigue */ }
      }
      if (!preview) throw new Error('El procesamiento tardó demasiado. Intenta de nuevo.');
      setFilas(preview.filas.map((fila: FilaMigracion) => {
        const updated = {
          ...fila,
          cedula: fila.cedula ? normalizeDocumentoInput(fila.cedula) : fila.cedula,
          nombres_sugerido: fila.nombres_sugerido ? clienteFieldNormalizers.nombre(fila.nombres_sugerido) : fila.nombres_sugerido,
          apellidos_sugerido: fila.apellidos_sugerido ? clienteFieldNormalizers.nombre(fila.apellidos_sugerido) : fila.apellidos_sugerido,
          cliente_correo: fila.cliente_correo ? clienteFieldNormalizers.correo(fila.cliente_correo) : fila.cliente_correo,
        };
        const { errores, advertencias } = validarFila(updated);
        return { ...updated, errores, advertencias };
      }));
      setPaso('revision');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo');
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  // ── Edición inline ───────────────────────────────────────────────────────
  const actualizarFila = useCallback((idUnidad: string, campo: keyof FilaMigracion, valor: unknown) => {
    setFilas(prev => prev.map(f => {
      if (f.id_unidad !== idUnidad) return f;
      let valorNormalizado = valor;
      if (campo === 'nombres_sugerido' || campo === 'apellidos_sugerido') {
        valorNormalizado = clienteFieldNormalizers.nombre(valor);
      }
      if (campo === 'cliente_correo') {
        valorNormalizado = clienteFieldNormalizers.correo(valor);
      }
      if (campo === 'cedula') {
        valorNormalizado = normalizeDocumentoInput(valor);
      }
      if (campo === 'cliente_telefono') {
        valorNormalizado = String(valor ?? '').trim();
      }
      let updated = { ...f, [campo]: valorNormalizado };
      // Si el admin cambia la inmobiliaria manualmente, limpiar el ID sugerido
      // para que el writer haga lookup por nombre
      if (campo === 'inmobiliaria_nombre_sugerido') {
        updated = { ...updated, inmobiliaria_id_sugerido: null };
      }
      const { errores, advertencias } = validarFila(updated);
      return { ...updated, errores, advertencias };
    }));
  }, []);

  // ── Rellenar vacíos ──────────────────────────────────────────────────────
  const rellenarVacios = useCallback((campo: keyof FilaMigracion, valor: unknown) => {
    setFilas(prev => prev.map(f => {
      const vacio = f[campo] === null || f[campo] === undefined || f[campo] === '';
      if (!vacio) return f;
      const updated = { ...f, [campo]: valor };
      const { errores, advertencias } = validarFila(updated);
      return { ...updated, errores, advertencias };
    }));
  }, []);

  // ── Documentos temporales ────────────────────────────────────────────────
  const asignarDocumentosTemporales = useCallback(() => {
    let contador = 1;
    setFilas(prev => prev.map(f => {
      if (!f.cliente_nombre_excel || f.cedula) return f;
      const updated = { ...f, cedula: documentoTemporal(proyectoId, contador++) };
      const { errores, advertencias } = validarFila(updated);
      return { ...updated, errores, advertencias };
    }));
  }, [proyectoId]);

  // ── Nueva etapa ───────────────────────────────────────────────────────────
  const [nuevaEtapaModal, setNuevaEtapaModal] = useState(false);
  const [nuevaEtapaNombre, setNuevaEtapaNombre] = useState('');
  const [nuevaEtapaAplicar, setNuevaEtapaAplicar] = useState<'todos' | 'vacios' | 'ninguna'>('vacios');

  const aplicarNuevaEtapa = useCallback(() => {
    const nombre = nuevaEtapaNombre.trim();
    if (!nombre) return;
    if (nuevaEtapaAplicar !== 'ninguna') {
      setFilas(prev => prev.map(f => {
        if (nuevaEtapaAplicar === 'vacios' && f.etapa_nombre) return f;
        return { ...f, etapa_nombre: nombre };
      }));
    }
    setEtapas(prev => prev.some(e => e.nombre === nombre) ? prev : [
      ...prev,
      { pk: '', sk: '', etapa_id: `NEW-${nombre}`, nombre, activo: true, creado_en: '' },
    ]);
    setNuevaEtapaModal(false);
    setNuevaEtapaNombre('');
  }, [nuevaEtapaNombre, nuevaEtapaAplicar]);

  // ── Nueva inmobiliaria ────────────────────────────────────────────────────
  const [nuevaInmoModal, setNuevaInmoModal] = useState(false);
  const [nuevaInmoNombre, setNuevaInmoNombre] = useState('');
  const [nuevaInmoAplicar, setNuevaInmoAplicar] = useState<'todos' | 'vacios' | 'ninguna'>('vacios');

  const aplicarNuevaInmo = useCallback(() => {
    const nombre = nuevaInmoNombre.trim();
    if (!nombre) return;
    if (nuevaInmoAplicar !== 'ninguna') {
      setFilas(prev => prev.map(f => {
        if (nuevaInmoAplicar === 'vacios' && f.inmobiliaria_nombre_sugerido) return f;
        return { ...f, inmobiliaria_nombre_sugerido: nombre, inmobiliaria_id_sugerido: null };
      }));
    }
    setNuevaInmoModal(false);
    setNuevaInmoNombre('');
  }, [nuevaInmoNombre, nuevaInmoAplicar]);

  // ── Confirmar ────────────────────────────────────────────────────────────
  const handleConfirmar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const result = await confirmarMigracion(jobId, filas);
      setReporte(result);
      setPaso('resultado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar la migración');
    } finally {
      setCargando(false);
    }
  }, [jobId, filas]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const filasConError = filas.filter(f => f.errores.length > 0);
  const filasConAdvertencia = filas.filter(f => f.advertencias.length > 0 && f.errores.length === 0);
  const filasOk = filas.filter(f => f.errores.length === 0 && f.advertencias.length === 0);
  const puedeConfirmar = filasConError.length === 0 && filas.length > 0;
  const filasConClienteSinDocumento = filas.filter(f => f.cliente_nombre_excel && !f.cedula).length;

  // ── Columnas ─────────────────────────────────────────────────────────────
  const columnas = useMemo(() => [
    {
      title: 'Unidad', dataIndex: 'id_unidad', width: 100, fixed: 'left' as const,
      render: (v: string, r: FilaMigracion) => (
        <Space>
          {r.errores.length > 0 && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
          {r.errores.length === 0 && r.advertencias.length > 0 && <WarningOutlined style={{ color: '#faad14' }} />}
          {r.errores.length === 0 && r.advertencias.length === 0 && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Precio *', dataIndex: 'precio', width: 130,
      render: (v: number | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('precio'))}>
          <CeldaNumberLocal value={v} min={0}
            formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            onChange={val => actualizarFila(r.id_unidad, 'precio', val)} />
        </CeldaRequerida>
      ),
    },
    {
      title: 'Metraje *', dataIndex: 'metraje', width: 90,
      render: (v: number | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('metraje'))}>
          <CeldaNumberLocal value={v} min={0}
            onChange={val => actualizarFila(r.id_unidad, 'metraje', val)} />
        </CeldaRequerida>
      ),
    },
    {
      title: 'Estado *', dataIndex: 'estado', width: 140,
      render: (v: string, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('estado'))}>
          <Select value={v} style={{ width: '100%' }} onChange={val => actualizarFila(r.id_unidad, 'estado', val)}>
            <Option value="disponible"><Tag color="green">Disponible</Tag></Option>
            <Option value="bloqueada"><Tag color="orange">Bloqueada</Tag></Option>
            <Option value="no_disponible"><Tag color="red">No disponible</Tag></Option>
          </Select>
        </CeldaRequerida>
      ),
    },
    {
      title: 'Etapa', dataIndex: 'etapa_nombre', width: 150,
      render: (v: string | null, r: FilaMigracion) => (
        <Select
          value={v ?? undefined}
          placeholder="Sin etapa"
          style={{ width: '100%' }}
          allowClear
          onChange={val => actualizarFila(r.id_unidad, 'etapa_nombre', val ?? null)}
        >
          {etapas.map(e => (
            <Select.Option key={e.etapa_id} value={e.nombre} label={e.nombre}>
              {e.nombre}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Nombres', dataIndex: 'nombres_sugerido', width: 140,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaIA sugerido={r.ia_sugerido && !!v}>
          <CeldaInputLocal value={v ?? ''} placeholder="Nombres" onChange={val => actualizarFila(r.id_unidad, 'nombres_sugerido', val)} />
        </CeldaIA>
      ),
    },
    {
      title: 'Apellidos', dataIndex: 'apellidos_sugerido', width: 140,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaIA sugerido={r.ia_sugerido && !!v}>
          <CeldaInputLocal value={v ?? ''} placeholder="Apellidos" onChange={val => actualizarFila(r.id_unidad, 'apellidos_sugerido', val)} />
        </CeldaIA>
      ),
    },
    {
      title: 'Documento', dataIndex: 'cedula', width: 140,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('documento') || e.includes('cédula'))}>
          <CeldaInputLocal
            value={v ?? ''}
            placeholder="Letras y números"
            onChange={val => actualizarFila(r.id_unidad, 'cedula', val)}
          />
        </CeldaRequerida>
      ),
    },
    {
      title: 'Inmobiliaria', dataIndex: 'inmobiliaria_nombre_sugerido', width: 180,
      render: (v: string | null, r: FilaMigracion) => {
        const esNueva = !inmobiliarias.some(
          i => i.nombre.trim().toLowerCase() === (v ?? '').trim().toLowerCase()
        ) && !!v;
        return (
          <Tooltip title={esNueva ? 'Inmobiliaria nueva — se creará al confirmar' : r.ia_sugerido && !!v ? `Sugerido por IA` : undefined}>
            <Select
              value={v ?? undefined}
              placeholder="Seleccionar..."
              style={{ width: '100%', borderColor: esNueva ? '#faad14' : undefined }}
              allowClear
              onChange={val => actualizarFila(r.id_unidad, 'inmobiliaria_nombre_sugerido', val ?? null)}
            >
              {inmobiliarias.filter(i => i.activo).map(i => (
                <Select.Option key={i.pk} value={i.nombre} label={i.nombre}>
                  {i.nombre}
                </Select.Option>
              ))}
            </Select>
          </Tooltip>
        );
      },
    },
    { title: 'Tipo', dataIndex: 'tipo', width: 70,
      render: (v: string | null, r: FilaMigracion) => <CeldaInputLocal value={v ?? ''} onChange={val => actualizarFila(r.id_unidad, 'tipo', val)} /> },
    { title: 'Piso', dataIndex: 'piso', width: 65,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'piso', val)} /> },
    { title: 'Bloque', dataIndex: 'manzana', width: 85,
      render: (v: string | null, r: FilaMigracion) => <CeldaInputLocal value={v ?? ''} onChange={val => actualizarFila(r.id_unidad, 'manzana', val)} /> },
    { title: 'Parqueos', dataIndex: 'parqueos', width: 85,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'parqueos', val)} /> },
    { title: 'Habitaciones', dataIndex: 'num_cuartos', width: 100,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'num_cuartos', val)} /> },
    { title: 'Baños', dataIndex: 'num_banos', width: 70,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'num_banos', val)} /> },
    { title: 'M. Terraza', dataIndex: 'metraje_terraza', width: 95,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'metraje_terraza', val)} /> },
    { title: 'M. Patio', dataIndex: 'metraje_patio', width: 85,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'metraje_patio', val)} /> },
    { title: 'P. Reserva', dataIndex: 'precio_reserva', width: 110,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'precio_reserva', val)} /> },
    { title: 'P. Separación', dataIndex: 'precio_separacion', width: 120,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'precio_separacion', val)} /> },
    { title: 'P. Inicial', dataIndex: 'precio_inicial', width: 110,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'precio_inicial', val)} /> },
    { title: 'Cuota', dataIndex: 'cuota_monto', width: 100,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'cuota_monto', val)} /> },
    { title: 'Meses', dataIndex: 'cuota_meses', width: 70,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} onChange={val => actualizarFila(r.id_unidad, 'cuota_meses', val)} /> },
    { title: 'Contra entrega', dataIndex: 'contra_entrega', width: 120,
      render: (v: number | null, r: FilaMigracion) => <CeldaNumberLocal value={v} min={0} formatter={val => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={val => actualizarFila(r.id_unidad, 'contra_entrega', val)} /> },
    { title: 'Teléfono', dataIndex: 'cliente_telefono', width: 120,
      render: (v: string | null, r: FilaMigracion) => <CeldaInputLocal value={v ?? ''} placeholder="Opcional" onChange={val => actualizarFila(r.id_unidad, 'cliente_telefono', val)} /> },
    { title: 'Correo', dataIndex: 'cliente_correo', width: 160,
      render: (v: string | null, r: FilaMigracion) => <CeldaInputLocal value={v ?? ''} placeholder="Opcional" onChange={val => actualizarFila(r.id_unidad, 'cliente_correo', val)} /> },
    { title: 'Fecha nac.', dataIndex: 'fecha_nacimiento', width: 130,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('fecha de nacimiento'))}>
          <CeldaInputLocal value={v ?? ''} placeholder="YYYY-MM-DD" onChange={val => actualizarFila(r.id_unidad, 'fecha_nacimiento', val)} />
        </CeldaRequerida>
      ) },
    { title: 'Pais residencia', dataIndex: 'pais_residencia', width: 150,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('pais de residencia'))}>
          <Select
            value={v ?? undefined}
            placeholder="Opcional"
            style={{ width: '100%' }}
            showSearch
            allowClear
            optionFilterProp="label"
            options={PAISES_OPTIONS}
            onChange={val => actualizarFila(r.id_unidad, 'pais_residencia', val ?? null)}
          />
        </CeldaRequerida>
      ) },
    { title: 'Nacionalidad', dataIndex: 'nacionalidad', width: 150,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('nacionalidad'))}>
          <Select
            value={v ?? undefined}
            placeholder="Opcional"
            style={{ width: '100%' }}
            showSearch
            allowClear
            optionFilterProp="label"
            options={NACIONALIDADES_OPTIONS}
            onChange={val => actualizarFila(r.id_unidad, 'nacionalidad', val ?? null)}
          />
        </CeldaRequerida>
      ) },
    { title: 'Fecha Bloqueo', dataIndex: 'fecha_bloqueo', width: 140,
      render: (v: string | null, r: FilaMigracion) => (
        <CeldaRequerida error={r.errores.some(e => e.includes('Fecha Bloqueo'))}>
          <CeldaInputLocal value={v ?? ''} placeholder="YYYY-MM-DD" onChange={val => actualizarFila(r.id_unidad, 'fecha_bloqueo', val)} />
        </CeldaRequerida>
      ) },
    { title: 'Comentario', dataIndex: 'comentario', width: 150,
      render: (v: string | null, r: FilaMigracion) => <CeldaInputLocal value={v ?? ''} placeholder="Opcional" onChange={val => actualizarFila(r.id_unidad, 'comentario', val)} /> },
    {
      title: 'Errores / Advertencias', width: 200, fixed: 'right' as const,
      render: (_: unknown, r: FilaMigracion) => (
        <Space direction="vertical" size={2}>
          {r.errores.map((e, i) => <Tag key={i} color="red">{e}</Tag>)}
          {r.advertencias.map((a, i) => <Tag key={i} color="orange">{a}</Tag>)}
        </Space>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [etapas, inmobiliarias, actualizarFila]);

  return (
    <div style={{ padding: 24 }}>
      <Steps
        current={paso === 'upload' ? 0 : paso === 'revision' ? 1 : 2}
        items={[{ title: 'Subir Excel' }, { title: 'Revisar datos' }, { title: 'Resultado' }]}
        style={{ marginBottom: 32 }}
      />

      {/* PASO 1 */}
      {paso === 'upload' && (
        <div>
          {/* Guía de formato */}
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 20 }}
            message="Antes de subir, asegúrate que tu Excel tenga estas columnas"
            description={
              <div style={{ marginTop: 8, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: '#e6f4ff' }}>
                      {[
                        'unidad','Area','Metraje Terraza','Metraje Patio','No Cuartos','No. baños','Tipo','Piso','Parqueos',
                        'NOMBRE CLIENTE','DOCUMENTO','TELEFONO','CORREO',
                        'FECHA NACIMIENTO','PAIS RESIDENCIA','NACIONALIDAD',
                        'Precios US$','RESERVA','SEPARACION','INICIAL',
                        'CUOTAS 24','Cuota Meses','CONTRA ENTREGA','ESTATUS','INMOBILIARIA',
                        'FECHA BLOQUEO','FECHA FIN BLOQUEO/ PAGO SEPARACION','COMENTARIO',
                      ].map(h => (
                        <th key={h} style={{ border: '1px solid #91caff', padding: '4px 8px', color: '#1677ff', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                    <tr style={{ background: '#fafafa' }}>
                      {[
                        'B-A-101','76.34','12.5','8.0','3','2','D','1','1',
                        'JOSE MIGUEL BARRERA','A1234567','0991234567','jose@email.com',
                        '1995-04-15','Republica Dominicana','Dominicana',
                        '75958.30','500','3297.91','11393.74',
                        '474.73','24','60766.64','CONTRATO FIRMADO','Plusval',
                        '2026-02-21','2026-03-21','',
                      ].map((v, i) => (
                        <td key={i} style={{ border: '1px solid #d9d9d9', padding: '4px 8px', color: '#555' }}>{v || <span style={{ color: '#bbb' }}>vacío</span>}</td>
                      ))}
                    </tr>
                  </thead>
                </table>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Tag color="blue">unidad — obligatorio</Tag>
                  <Tag color="blue">Precios US$ — obligatorio</Tag>
                  <Tag color="blue">Area — obligatorio</Tag>
                  <Tag color="blue">ESTATUS — obligatorio</Tag>
                  <Tag color="default">El resto es opcional</Tag>
                  <Tag color="orange">Si hay cliente, NOMBRES, APELLIDOS, DOCUMENTO e INMOBILIARIA son obligatorias</Tag>
                </div>
                <div style={{ marginTop: 6, color: '#888', fontSize: 11 }}>
                  💡 Los nombres de columna no tienen que ser exactos — la IA intenta mapearlos automáticamente. Pero si coinciden, el resultado es más preciso.
                </div>
              </div>
            }
          />

          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Title level={4}>Migración de inventario — {proyectoNombre}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
              Sube el archivo Excel con inventario nuevo. Las unidades que ya existan en el proyecto seran rechazadas.
            </Text>
            {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
            <Spin spinning={cargando} tip="Procesando con IA...">
              <Upload accept=".xlsx" showUploadList={false} beforeUpload={file => { handleUpload(file); return false; }}>
                <Button icon={<UploadOutlined />} size="large" type="primary">Seleccionar archivo .xlsx</Button>
              </Upload>
            </Spin>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {paso === 'revision' && (
        <>
          {/* Barra superior */}
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <Text strong>{archivoNombre}</Text>
            <Badge count={filasOk.length} color="green" overflowCount={9999}><Tag color="green">Listas</Tag></Badge>
            <Badge count={filasConAdvertencia.length} color="orange" overflowCount={9999}><Tag color="orange">Advertencias</Tag></Badge>
            <Badge count={filasConError.length} color="red" overflowCount={9999}><Tag color="red">Errores</Tag></Badge>
            <Tooltip title="Sugerido por IA — editable"><Tag icon={<RobotOutlined />} color="purple">IA</Tag></Tooltip>
          </Space>

          {/* Botones de relleno */}
          <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            {filasConClienteSinDocumento > 0 && (
              <Tooltip title={`Asigna documentos temporales sin guiones ni símbolos a ${filasConClienteSinDocumento} clientes sin documento.`}>
                <Button icon={<ThunderboltOutlined />} onClick={asignarDocumentosTemporales}>
                  Cédulas identidad ({filasConClienteSinDocumento})
                </Button>
              </Tooltip>
            )}
            <RellenarVaciosBtn campo="metraje" label="Rellenar metraje vacío" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="metraje_terraza" label="Rellenar terraza vacía" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="metraje_patio" label="Rellenar patio vacío" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="precio" label="Rellenar precio vacío" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="num_cuartos" label="Rellenar habitaciones vacías" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="num_banos" label="Rellenar baños vacíos" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="parqueos" label="Rellenar parqueos vacíos" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarVaciosBtn campo="cuota_meses" label="Rellenar meses cuota" tipo="numero" onRellenar={rellenarVacios} />
            <RellenarEtapaBtn etapas={etapas} onRellenar={rellenarVacios} />
            <Button size="small" icon={<PlusOutlined />} onClick={() => { setNuevaEtapaNombre(''); setNuevaEtapaAplicar('vacios'); setNuevaEtapaModal(true); }}>
              Nueva etapa
            </Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => { setNuevaInmoNombre(''); setNuevaInmoAplicar('vacios'); setNuevaInmoModal(true); }}>
              Nueva inmobiliaria
            </Button>          </Space>

          {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
          <Alert type="info" icon={<InfoCircleOutlined />}
            message="Shift + scroll para moverse horizontalmente. Celdas rojas son obligatorias. Las marcadas con IA son sugerencias editables."
            style={{ marginBottom: 12 }} />

          <div ref={tableRef}>
            <Table
              dataSource={filas} columns={columnas} rowKey="fila_excel"
              scroll={{ x: 4200 }} size="small" pagination={{ pageSize: 50 }}
              rowClassName={r => r.errores.length > 0 ? 'fila-error' : r.advertencias.length > 0 ? 'fila-advertencia' : ''}
            />
          </div>

          <Space style={{ marginTop: 16 }}>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button type="primary" disabled={!puedeConfirmar} loading={cargando} onClick={handleConfirmar}>
              {filasConError.length > 0
                ? `Corrige ${filasConError.length} error(es) para continuar`
                : `Confirmar carga (${filas.length} unidades)`}
            </Button>
          </Space>

          {/* Modal nueva etapa */}
          <Modal
            title="Nueva etapa"
            open={nuevaEtapaModal}
            onCancel={() => setNuevaEtapaModal(false)}
            onOk={aplicarNuevaEtapa}
            okText="Aplicar"
            okButtonProps={{ disabled: !nuevaEtapaNombre.trim() }}
            cancelText="Cancelar"
            width={380}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Nombre de la etapa:</Text>
                <Input
                  autoFocus
                  placeholder="Ej: Etapa 1, Fase A..."
                  value={nuevaEtapaNombre}
                  onChange={e => setNuevaEtapaNombre(e.target.value)}
                  onPressEnter={aplicarNuevaEtapa}
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Aplicar a:</Text>
                <Select value={nuevaEtapaAplicar} onChange={setNuevaEtapaAplicar} style={{ width: '100%' }}>
                  <Option value="vacios">Solo unidades sin etapa</Option>
                  <Option value="todos">Todas las unidades</Option>
                  <Option value="ninguna">Ninguna — solo crear la etapa</Option>
                </Select>
              </div>
            </Space>
          </Modal>

          {/* Modal nueva inmobiliaria */}
          <Modal
            title="Nueva inmobiliaria"
            open={nuevaInmoModal}
            onCancel={() => setNuevaInmoModal(false)}
            onOk={aplicarNuevaInmo}
            okText="Aplicar"
            okButtonProps={{ disabled: !nuevaInmoNombre.trim() }}
            cancelText="Cancelar"
            width={380}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Nombre de la inmobiliaria:</Text>
                <Input
                  autoFocus
                  placeholder="Ej: Oferta Inmobiliaria..."
                  value={nuevaInmoNombre}
                  onChange={e => setNuevaInmoNombre(e.target.value)}
                  onPressEnter={aplicarNuevaInmo}
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Aplicar a:</Text>
                <Select value={nuevaInmoAplicar} onChange={setNuevaInmoAplicar} style={{ width: '100%' }}>
                  <Option value="vacios">Solo unidades sin inmobiliaria</Option>
                  <Option value="todos">Todas las unidades</Option>
                  <Option value="ninguna">Ninguna — solo registrar el nombre</Option>
                </Select>
              </div>
              <Alert type="info" showIcon message="La inmobiliaria se creará automáticamente al confirmar la migración." />
            </Space>
          </Modal>
        </>
      )}

      {/* PASO 3 */}
      {paso === 'resultado' && reporte && (
        <Result
          status="success"
          title="Migración completada"
          subTitle={`${reporte.unidades_cargadas} unidades cargadas en ${proyectoNombre}`}
          extra={[
            <Space key="stats" direction="vertical" style={{ textAlign: 'left' }}>
              <Text>✅ Unidades cargadas: <strong>{reporte.unidades_cargadas}</strong></Text>
              <Text>👤 Clientes creados: <strong>{reporte.clientes_creados}</strong></Text>
              <Text>🏢 Inmobiliarias creadas: <strong>{reporte.inmobiliarias_creadas}</strong></Text>
              {reporte.advertencias > 0 && <Text>⚠️ Advertencias: <strong>{reporte.advertencias}</strong></Text>}
              {reporte.inmobiliarias_creadas > 0 && (
                <Alert type="warning" style={{ marginTop: 8 }}
                  message={`${reporte.inmobiliarias_creadas} inmobiliaria(s) creadas como borrador. Completa su configuración en Gestión de Inmobiliarias.`} />
              )}
            </Space>,
            <Button key="cerrar" type="primary" onClick={onCerrar}>Ir al inventario</Button>,
          ]}
        />
      )}
    </div>
  );
}

// ── Botón rellenar vacíos ─────────────────────────────────────────────────────
function RellenarVaciosBtn({ campo, label, tipo, onRellenar }: {
  campo: keyof FilaMigracion;
  label: string;
  tipo: 'numero' | 'texto';
  onRellenar: (campo: keyof FilaMigracion, valor: unknown) => void;
}) {
  const [valor, setValor] = useState<number | string | null>(null);
  const [open, setOpen] = useState(false);

  const content = (
    <Space direction="vertical" size={8} style={{ width: 200 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Valor para celdas vacías:</Text>
      {tipo === 'numero'
        ? <InputNumber style={{ width: '100%' }} min={0} value={valor as number ?? undefined}
            onChange={v => setValor(v)} />
        : <Input value={valor as string ?? ''} onChange={e => setValor(e.target.value)} />
      }
      <Button type="primary" size="small" block
        disabled={valor === null || valor === ''}
        onClick={() => { onRellenar(campo, valor); setOpen(false); setValor(null); }}>
        Aplicar a vacíos
      </Button>
    </Space>
  );

  return (
    <Popover content={content} title={label} trigger="click" open={open} onOpenChange={setOpen}>
      <Button size="small" icon={<ThunderboltOutlined />}>{label}</Button>
    </Popover>
  );
}

// ── Botón rellenar etapa vacía ────────────────────────────────────────────────
function RellenarEtapaBtn({ etapas, onRellenar }: {
  etapas: Etapa[];
  onRellenar: (campo: keyof FilaMigracion, valor: unknown) => void;
}) {
  const [valor, setValor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const content = (
    <Space direction="vertical" size={8} style={{ width: 220 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Etapa para unidades sin etapa:</Text>
      <Select
        style={{ width: '100%' }}
        placeholder="Seleccionar etapa..."
        value={valor ?? undefined}
        allowClear
        onChange={v => setValor(v ?? null)}
      >
        {etapas.map(e => (
          <Select.Option key={e.etapa_id} value={e.nombre}>{e.nombre}</Select.Option>
        ))}
      </Select>
      <Button type="primary" size="small" block
        disabled={!valor}
        onClick={() => { onRellenar('etapa_nombre', valor); setOpen(false); setValor(null); }}>
        Aplicar a vacíos
      </Button>
    </Space>
  );

  return (
    <Popover content={content} title="Rellenar etapa vacía" trigger="click" open={open} onOpenChange={setOpen}>
      <Button size="small" icon={<ThunderboltOutlined />}>Rellenar etapa vacía</Button>
    </Popover>
  );
}
function CeldaRequerida({ children, error }: { children: React.ReactNode; error: boolean }) {
  return <div style={{ border: error ? '1px solid #ff4d4f' : undefined, borderRadius: 4 }}>{children}</div>;
}

function CeldaIA({ children, sugerido, confianza, esNueva }: {
  children: React.ReactNode; sugerido?: boolean; confianza?: number; esNueva?: boolean;
}) {
  if (!sugerido) return <>{children}</>;
  const baja = confianza !== undefined && confianza < 80;
  return (
    <Tooltip title={esNueva ? 'Inmobiliaria nueva — se creará al confirmar'
      : baja ? `Sugerencia IA con baja confianza (${confianza}%) — verifica`
      : `Sugerido por IA (${confianza ?? ''}%)`}>
      <div style={{ border: `1px solid ${baja ? '#faad14' : '#722ed1'}`, borderRadius: 4, position: 'relative' }}>
        <RobotOutlined style={{ position: 'absolute', top: -8, right: 2, fontSize: 10,
          color: baja ? '#faad14' : '#722ed1', background: 'white', padding: '0 2px' }} />
        {children}
      </div>
    </Tooltip>
  );
}
