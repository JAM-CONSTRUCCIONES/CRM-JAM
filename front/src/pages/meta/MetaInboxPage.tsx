import { useEffect, useMemo, useRef, useState } from 'react';
import OpusMediaRecorder from 'opus-media-recorder';
import encoderWorkerUrl from 'opus-media-recorder/encoderWorker.umd.js?url';
import oggOpusWasmUrl from 'opus-media-recorder/OggOpusEncoder.wasm?url';
import webmOpusWasmUrl from 'opus-media-recorder/WebMOpusEncoder.wasm?url';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, AudioOutlined, DeleteOutlined, EditOutlined, FileOutlined, LinkOutlined, PauseOutlined, PaperClipOutlined, PlayCircleFilled, ReloadOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import {
  convertirMetaLead,
  enviarMetaMensaje,
  getMetaMediaUploadUrl,
  subirArchivoAS3,
  renombrarMetaContacto,
  gestionarMetaLead,
  getMetaConversacion,
  listarMetaLeads,
  asociarMetaLeadCliente,
  type MetaLead,
  type MetaMensaje,
} from '../../services/meta.service';
import { buscarClientesAdmin } from '../../services/clientes.service';
import { getInmobiliarias, type Inmobiliaria } from '../../services/inmobiliarias.service';
import { getProyectos, getUnidades } from '../../services/proyectos.service';
import { getUsuariosSistema, type UsuarioSistema } from '../../services/sistema.service';
import type { Cliente, Proyecto, Unidad } from '../../types';
import { EstadoCivilSelect, NacionalidadSelect, PaisResidenciaSelect } from '../../components/common/CatalogoClienteFields';
import { clienteFieldNormalizers, clienteFormRules, validateAndNormalizeClientePayload } from '../../utils/clientesValidation';

const { Paragraph, Text } = Typography;
const { Search, TextArea } = Input;

const canalLabel: Record<string, string> = {
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
};

const canalColor: Record<string, string> = {
  instagram: 'magenta',
  messenger: 'blue',
  whatsapp: 'green',
};

const CANALES_CON_RESPUESTA_CITADA = new Set(['whatsapp']);

const estadoColor: Record<string, string> = {
  nuevo: 'blue',
  en_seguimiento: 'gold',
  convertido: 'green',
  cerrado: 'default',
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

// Solo la hora para mostrar dentro de cada burbuja (mas discreto).
const formatHora = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
};

const formatDuracionAudio = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatDuracionCorta = (seconds?: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Texto del separador de fecha (Hoy / Ayer / fecha corta).
const formatDiaSeparador = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismaFecha = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mismaFecha(date, hoy)) return 'Hoy';
  if (mismaFecha(date, ayer)) return 'Ayer';
  return date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const diaKey = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const toNumber = (value: unknown) => Number(value || 0);

const motivosCierre = [
  'No interesado',
  'No responde',
  'Presupuesto insuficiente',
  'Contacto incorrecto',
  'Duplicado',
  'Compra pospuesta',
  'Otro',
];

const METHODICA_WHATSAPP_ONBOARDING_URL = 'https://methodicatechnology.com/whatsapp/onboarding';
const CRM_API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const JAM_WHATSAPP_WEBHOOK_URL = `${CRM_API_URL}/webhooks/whatsapp`;
const JAM_META_INBOX_URL =
  typeof window !== 'undefined' ? `${window.location.origin}/meta-inbox` : '/meta-inbox';
const LEADS_PAGE_SIZE = 50;
const MAX_REENVIO_MENSAJES = 10;
const MAX_REENVIO_DESTINOS = 5;

const attachmentsOf = (mensaje: MetaMensaje) => {
  if (mensaje.attachments?.length) return mensaje.attachments;
  if (mensaje.media) {
    return [{
      type: mensaje.media.type,
      id: mensaje.media.id,
      mime_type: mensaje.media.mime_type,
      filename: mensaje.media.filename,
      caption: mensaje.media.caption,
      public_url: mensaje.media.public_url,
      storage_status: mensaje.media.storage_status,
    }];
  }
  return [];
};

const whatsappReplyId = (mensaje?: MetaMensaje | null) => {
  const externalId = String(mensaje?.external_event_id || '').trim();
  if (externalId && !externalId.startsWith('local#')) return externalId;
  const metaId = String(mensaje?.meta_response?.messages?.[0]?.id || '').trim();
  if (metaId) return metaId;
  return '';
};

const firmaAdjuntoMensaje = (mensaje: MetaMensaje) => {
  const adjuntos = attachmentsOf(mensaje);
  if (!adjuntos.length) return '';
  return adjuntos.map((adjunto) => [
    adjunto.public_url || adjunto.url || '',
    adjunto.filename || '',
    adjunto.mime_type || '',
    adjunto.type || '',
    adjunto.id || '',
  ].join('|')).join('||');
};

// Firma de la lista de mensajes: id + estado de cada uno. Permite detectar
// tanto mensajes nuevos como cambios de estado (sent/delivered/read).
const mensajesSignature = (mensajes: MetaMensaje[]) =>
  mensajes.map((m) => [
    m.sk,
    m.external_event_id || '',
    m.message_status || '',
    m.text || '',
    m.quoted_message_id || '',
    m.quoted_text || '',
    m.quoted_sender || '',
    m.edited ? 'edited' : '',
    m.revoked ? 'revoked' : '',
    (m.reactions || []).map((reaction) => `${reaction.sender_id || ''}:${reaction.emoji || ''}`).join(','),
  ].join(':')).join('|');

const mergeMensajePreservandoContexto = (base: MetaMensaje, nuevo: MetaMensaje): MetaMensaje => ({
  ...base,
  ...nuevo,
  quoted_message_id: nuevo.quoted_message_id || base.quoted_message_id,
  quoted_text: nuevo.quoted_text || base.quoted_text,
  quoted_sender: nuevo.quoted_sender || base.quoted_sender,
  reactions: nuevo.reactions || base.reactions,
});

const mensajesMismoEnvio = (a: MetaMensaje, b: MetaMensaje) => {
  if (a.external_event_id && b.external_event_id && a.external_event_id === b.external_event_id) return true;
  if (a.direction !== b.direction || a.direction !== 'outgoing') return false;

  const timeA = new Date(a.event_timestamp || a.created_at || 0).getTime();
  const timeB = new Date(b.event_timestamp || b.created_at || 0).getTime();
  if (Math.abs(timeA - timeB) >= 120000) return false;

  if (Boolean(a.text || b.text) && (a.text || '') === (b.text || '')) return true;

  const firmaA = firmaAdjuntoMensaje(a);
  const firmaB = firmaAdjuntoMensaje(b);
  return Boolean(firmaA && firmaB && firmaA === firmaB);
};

const mergeMensajesMeta = (actuales: MetaMensaje[], nuevos: MetaMensaje[]) => {
  const fusion = [...actuales];
  nuevos.forEach((nuevo) => {
    const index = fusion.findIndex((actual) => mensajesMismoEnvio(actual, nuevo));
    if (index >= 0) {
      fusion[index] = mergeMensajePreservandoContexto(fusion[index], nuevo);
    } else {
      fusion.push(nuevo);
    }
  });
  return fusion;
};

// Nombre a mostrar del contacto: nombre editado por el agente > alias de perfil
// (WhatsApp/Meta) > numero/id. Asi los numeros de WhatsApp muestran algo util.
const nombreContacto = (lead: MetaLead) =>
  (lead.nombre_manual || '').trim()
  || (lead.contact_profile_name || '').trim()
  || (lead.contact_username ? `@${lead.contact_username}` : '')
  || lead.external_contact_id;

const mergeRecentLeadsByPk = (actuales: MetaLead[], nuevos: MetaLead[]) => {
  const map = new Map<string, MetaLead>();
  [...actuales, ...nuevos].forEach((lead) => map.set(lead.pk, lead));
  return Array.from(map.values()).sort((a, b) =>
    String(b.ultimo_mensaje_en || '').localeCompare(String(a.ultimo_mensaje_en || '')),
  );
};

const appendLeadsByPk = (actuales: MetaLead[], nuevos: MetaLead[]) => {
  const map = new Map<string, MetaLead>();
  [...actuales, ...nuevos].forEach((lead) => map.set(lead.pk, lead));
  return Array.from(map.values());
};

const getProyectoLabel = (proyectos: Proyecto[], proyectoId?: string) => (
  proyectos.find((proyecto) => proyecto.proyecto_id === proyectoId)?.nombre || proyectoId || '-'
);

const getInmobiliariaLabel = (inmobiliarias: Inmobiliaria[], inmobiliariaId?: string) => (
  inmobiliarias.find((item) => item.pk === inmobiliariaId || item.pk === `INMOBILIARIA#${inmobiliariaId}`)?.nombre
  || inmobiliariaId
  || '-'
);

type ClienteGrupo = {
  cedula: string;
  nombre: string;
  variantes: string[];
  registros: Cliente[];
  inmobiliarias: string[];
  proyectos: string[];
  contactos: string[];
};

type MetaAttachment = NonNullable<MetaMensaje['attachments']>[number];

type ReenvioAdjunto = {
  attachment: MetaAttachment;
  sourceMessage: MetaMensaje;
};

type RecorderLike = {
  state: RecordingState;
  ondataavailable: ((event: BlobEvent) => void) | null;
  onstop: ((event: Event) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
};

const nombreCliente = (cliente: Cliente) =>
  `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim() || cliente.cedula;

const textoMensaje = (mensaje: MetaMensaje) => {
  const raw = (mensaje.text || '').trim();
  if (mensaje.revoked) return 'Mensaje eliminado en WhatsApp';
  if (mensaje.event_type === 'edit' || raw === '[edit]') {
    return mensaje.edited_text || 'Mensaje editado en WhatsApp';
  }
  if (mensaje.event_type === 'reaction' || raw === '[reaction]') {
    return mensaje.reaction_emoji
      ? `Reacciono ${mensaje.reaction_emoji} a un mensaje`
      : 'Reacciono a un mensaje';
  }
  if (mensaje.event_type === 'unsupported' || raw === '[unsupported]') {
    return 'Tipo de mensaje no soportado por WhatsApp API';
  }
  if (mensaje.event_type === 'revoke' || raw === '[revoke]') {
    return mensaje.revoked_message_id ? 'Mensaje eliminado en WhatsApp' : 'Se elimino un mensaje';
  }
  return raw;
};

const resumenMensajeCitado = (mensaje?: MetaMensaje | null) => {
  if (!mensaje) return 'Mensaje citado';
  const text = textoMensaje(mensaje);
  if (text) return text;
  const attachment = attachmentsOf(mensaje)[0];
  if (attachment?.type) return `Adjunto: ${attachment.type}`;
  return 'Mensaje citado';
};

const normalizarTipoMedia = (attachment: MetaAttachment) => {
  if (esSticker(attachment)) return '';
  const type = String(attachment.type || '').toLowerCase();
  const mime = String(attachment.mime_type || '').toLowerCase();
  if (type === 'image' || mime.startsWith('image/')) return 'image';
  if (type === 'video' || mime.startsWith('video/')) return 'video';
  if (type === 'audio' || type === 'voice_note' || mime.startsWith('audio/')) return 'audio';
  if (type === 'document' || mime === 'application/pdf') return 'document';
  return '';
};

const etiquetaAdjunto = (attachment: MetaAttachment) =>
  attachment.filename || attachment.caption || attachment.title || attachment.type || 'Archivo';

const esSticker = (attachment: MetaAttachment) =>
  String(attachment.type || '').toLowerCase() === 'sticker'
  || String(attachment.mime_type || '').toLowerCase() === 'image/webp'
  || /\.webp($|\?)/i.test(String(attachment.filename || attachment.title || attachment.caption || attachment.public_url || attachment.url || ''))
  || /sticker/i.test(String(attachment.filename || attachment.title || attachment.caption || attachment.type || ''));

const esPng = (attachment: MetaAttachment) =>
  String(attachment.mime_type || '').toLowerCase() === 'image/png'
  || /\.png($|\?)/i.test(String(attachment.filename || attachment.title || attachment.caption || attachment.public_url || attachment.url || ''));

const esNotaVoz = (attachment: MetaAttachment) =>
  Boolean(attachment.voice)
  || String(attachment.type || '').toLowerCase() === 'voice_note'
  || /^nota-voz-/i.test(String(attachment.filename || ''))
  || String(attachment.mime_type || '').toLowerCase().includes('opus');

const esMensajeAudio = (mensaje: MetaMensaje) =>
  String(mensaje.event_type || '').toLowerCase() === 'audio'
  || ['[audio]', '[voice_note]'].includes((mensaje.text || '').trim().toLowerCase())
  || attachmentsOf(mensaje).some((attachment) => normalizarTipoMedia(attachment) === 'audio');

const mensajePermiteRespuestaCitada = (mensaje: MetaMensaje, channel?: string) =>
  CANALES_CON_RESPUESTA_CITADA.has(channel || mensaje.channel)
  && Boolean(whatsappReplyId(mensaje))
  && !esMensajeAudio(mensaje);

const mensajeKey = (mensaje: MetaMensaje) => `${mensaje.pk}::${mensaje.sk}`;

const adjuntosReenviables = (mensaje: MetaMensaje) =>
  attachmentsOf(mensaje).filter((attachment) => attachment.public_url && normalizarTipoMedia(attachment));

const mensajeReenviableWhatsapp = (mensaje: MetaMensaje) => {
  if (mensaje.channel !== 'whatsapp' || mensaje.revoked) return false;
  const attachments = attachmentsOf(mensaje);
  const text = textoMensaje(mensaje);
  if (attachments.length && attachments.every(esSticker)) return false;
  if (adjuntosReenviables(mensaje).length) return true;
  return Boolean(text && !isPlaceholderConAdjunto(mensaje, attachments.length));
};

const esEventoAuxiliarWhatsapp = (mensaje: MetaMensaje) =>
  mensaje.channel === 'whatsapp'
  && (
    (mensaje.event_type === 'edit' && Boolean(mensaje.edited_message_id))
    || (mensaje.event_type === 'reaction' && Boolean(mensaje.reaction_message_id))
    || (mensaje.event_type === 'revoke' && Boolean(mensaje.revoked_message_id))
  );

const esEventoControlWhatsapp = (mensaje: MetaMensaje) =>
  mensaje.channel === 'whatsapp' && ['edit', 'reaction', 'revoke'].includes(mensaje.event_type);

const isPlaceholderConAdjunto = (mensaje: MetaMensaje, attachmentsLength: number) =>
  attachmentsLength > 0
  && /^\[(audio|video|image|sticker|document|voice_note)\]$/i.test((mensaje.text || '').trim());

const resumenUltimoMensaje = (value?: string) => {
  const text = (value || '').trim();
  if (text === '[edit]') return 'Mensaje editado en WhatsApp';
  if (text === '[reaction]') return 'Reaccion a un mensaje';
  if (text === '[unsupported]') return 'Tipo de mensaje no soportado';
  if (text === '[revoke]') return 'Mensaje eliminado en WhatsApp';
  return text || 'Sin mensaje de texto';
};

const mensajeErrorMeta = (value?: string) => {
  const text = (value || '').trim();
  if (!text) return '';
  if (
    /outside of allowed window/i.test(text)
    || /24\s*hours?/i.test(text)
    || /131047/.test(text)
    || /470/.test(text)
    || /ventana/i.test(text)
  ) {
    return 'No se pudo enviar: este mensaje esta fuera de la ventana de atencion permitida. Debes responder dentro de las 24 horas desde el ultimo mensaje del cliente; despues de ese tiempo el cliente debe escribir nuevamente para reabrir la conversacion.';
  }
  return text;
};

const estadoMensajeMeta = (value?: string) => {
  const status = String(value || '').trim().toLowerCase();
  if (!status) return '';
  return ({
    pending: 'pendiente',
    pendiente: 'pendiente',
    sending: 'enviando',
    enviando: 'enviando',
    sent: 'enviado',
    enviado: 'enviado',
    delivered: 'entregado',
    read: 'leido',
    failed: 'fallido',
    fallido: 'fallido',
    pendiente_configuracion: 'pendiente',
  } as Record<string, string>)[status] || status;
};

const esMensajeFallidoMeta = (mensaje: MetaMensaje) =>
  ['failed', 'fallido'].includes(String(mensaje.message_status || '').toLowerCase());

const errorVisibleMensajeMeta = (mensaje: MetaMensaje) => {
  const error = mensajeErrorMeta(mensaje.meta_error || mensaje.error_message);
  if (error) return error;
  if (esMensajeFallidoMeta(mensaje)) {
    return 'No se pudo enviar el mensaje. Revisa el detalle del envio o intenta nuevamente.';
  }
  return '';
};

export default function MetaInboxPage() {
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [leadsCursor, setLeadsCursor] = useState('');
  const [hasMoreLeads, setHasMoreLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [mensajes, setMensajes] = useState<MetaMensaje[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [canal, setCanal] = useState<string>();
  const [busqueda, setBusqueda] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [hasMoreMensajes, setHasMoreMensajes] = useState(false);
  const [loadingMoreMensajes, setLoadingMoreMensajes] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [procesandoAudio, setProcesandoAudio] = useState(false);
  const [duracionAudio, setDuracionAudio] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRecorderRef = useRef<RecorderLike | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<number | null>(null);
  const audioPlayerRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [audioReproduciendo, setAudioReproduciendo] = useState('');
  const [audioProgreso, setAudioProgreso] = useState<Record<string, { current: number; duration: number }>>({});
  const [editNombreOpen, setEditNombreOpen] = useState(false);
  const [nombreEditando, setNombreEditando] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const CONVERSATION_PAGE_SIZE = 50;
  const MAX_MEDIA_MB = 16;
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [savingConversion, setSavingConversion] = useState(false);
  const [sending, setSending] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [asociarOpen, setAsociarOpen] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [tipoBusquedaCliente, setTipoBusquedaCliente] = useState<'cedula' | 'nombre'>('cedula');
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [asociandoCliente, setAsociandoCliente] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [mensajeCitado, setMensajeCitado] = useState<MetaMensaje | null>(null);
  const [reenvioAdjunto, setReenvioAdjunto] = useState<ReenvioAdjunto | null>(null);
  const [reenvioDestinoPk, setReenvioDestinoPk] = useState('');
  const [reenvioCaption, setReenvioCaption] = useState('');
  const [reenvioOpciones, setReenvioOpciones] = useState<MetaLead[]>([]);
  const [buscandoDestinoReenvio, setBuscandoDestinoReenvio] = useState(false);
  const [reenviandoAdjunto, setReenviandoAdjunto] = useState(false);
  const [seleccionReenvioActiva, setSeleccionReenvioActiva] = useState(false);
  const [mensajesSeleccionadosReenvio, setMensajesSeleccionadosReenvio] = useState<string[]>([]);
  const [reenvioSeleccionOpen, setReenvioSeleccionOpen] = useState(false);
  const [reenvioDestinoPks, setReenvioDestinoPks] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();
  const mensajesPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Indica si el usuario esta cerca del fondo (para auto-scroll no intrusivo).
  const nearBottomRef = useRef(true);
  const prevSelectedPkRef = useRef<string | undefined>(undefined);
  // Evita que el auto-scroll interfiera durante la carga de mensajes anteriores.
  const loadingPrevRef = useRef(false);
  const estadoGestion = Form.useWatch('estado', form);

  // Refs para el polling: evitan closures obsoletos y permiten
  // pausar el refresco automatico mientras el usuario esta trabajando.
  const selectedLeadRef = useRef<MetaLead | null>(null);
  const mensajesRef = useRef<MetaMensaje[]>([]);
  const busquedaRef = useRef('');
  const canalRef = useRef<string | undefined>(undefined);
  const convCycleRef = useRef(0);
  const busyRef = useRef(false);
  const LEADS_POLL_MS = 3000;
  const CONVERSATION_POLL_MS = 3000;
  // #4 Backoff: cuando la API falla, se saltan ciclos de forma progresiva
  // (1, 2, 4... hasta un tope) y se vuelve al ritmo normal al recuperarse.
  const MAX_BACKOFF_STEPS = 6;
  const leadsFailRef = useRef(0);
  const leadsSkipRef = useRef(0);
  const convFailRef = useRef(0);
  const convSkipRef = useRef(0);

  const conversaciones = useMemo(() => {
    return leads;
  }, [leads]);

  const clientesAgrupados = useMemo<ClienteGrupo[]>(() => {
    const groups = new Map<string, ClienteGrupo>();
    clientesEncontrados.forEach((cliente) => {
      const cedula = cliente.cedula || '';
      if (!cedula) return;
      const current = groups.get(cedula) || {
        cedula,
        nombre: nombreCliente(cliente),
        variantes: [],
        registros: [],
        inmobiliarias: [],
        proyectos: [],
        contactos: [],
      };
      current.registros.push(cliente);
      const nombre = nombreCliente(cliente);
      if (nombre && !current.variantes.includes(nombre)) current.variantes.push(nombre);
      const inmo = String(cliente.inmobiliaria_id || '').replace('INMOBILIARIA#', '');
      if (inmo && !current.inmobiliarias.includes(inmo)) current.inmobiliarias.push(inmo);
      if (cliente.proyecto_id && !current.proyectos.includes(cliente.proyecto_id)) current.proyectos.push(cliente.proyecto_id);
      const contacto = cliente.telefono || cliente.correo;
      if (contacto && !current.contactos.includes(contacto)) current.contactos.push(contacto);
      current.registros.sort((a, b) => String(b.fecha_captacion || '').localeCompare(String(a.fecha_captacion || '')));
      current.nombre = nombreCliente(current.registros[0]);
      groups.set(cedula, current);
    });
    return Array.from(groups.values());
  }, [clientesEncontrados]);

  const mensajesVisibles = useMemo(
    () => mensajes.filter((mensaje) => !esEventoAuxiliarWhatsapp(mensaje)),
    [mensajes],
  );

  const mensajesPorExternalId = useMemo(() => {
    const map = new Map<string, MetaMensaje>();
    mensajes.forEach((mensaje) => {
      if (mensaje.external_event_id) map.set(mensaje.external_event_id, mensaje);
    });
    return map;
  }, [mensajes]);

  const mensajesSeleccionadosParaReenvio = useMemo(() => {
    const keys = new Set(mensajesSeleccionadosReenvio);
    return mensajesVisibles.filter((mensaje) => keys.has(mensajeKey(mensaje)) && mensajeReenviableWhatsapp(mensaje));
  }, [mensajesSeleccionadosReenvio, mensajesVisibles]);

  // WhatsApp se considera conectado si ya existe al menos una conversacion
  // de ese canal. Si es asi, ocultamos el boton "Conectar WhatsApp".
  const whatsappConectado = useMemo(
    () => leads.some((lead) => lead.channel === 'whatsapp'),
    [leads],
  );
  const whatsappOnboardingUrl = useMemo(() => {
    const params = new URLSearchParams({
      tenant: 'jam',
      clientName: 'JAM Construcciones',
      targetWebhookUrl: JAM_WHATSAPP_WEBHOOK_URL,
      returnUrl: JAM_META_INBOX_URL,
    });
    return `${METHODICA_WHATSAPP_ONBOARDING_URL}?${params.toString()}`;
  }, []);

  useEffect(() => {
    cargarAsignables();
  }, []);

  useEffect(() => {
    busquedaRef.current = busqueda;
    canalRef.current = canal;
    const timer = window.setTimeout(() => {
      cargarLeads();
    }, busqueda.trim() ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [busqueda, canal]);

  // Mantiene el ref sincronizado con el lead seleccionado para el polling.
  useEffect(() => {
    selectedLeadRef.current = selectedLead;
  }, [selectedLead]);

  // Ref con los mensajes actuales para que el polling no use closures obsoletos.
  useEffect(() => {
    mensajesRef.current = mensajes;
  }, [mensajes]);

  // Auto-scroll al ultimo mensaje: siempre al cambiar de chat; y al llegar
  // mensajes nuevos solo si el usuario ya estaba cerca del fondo (no interrumpe
  // si esta leyendo mensajes anteriores mas arriba).
  useEffect(() => {
    // No interrumpir cuando estamos cargando mensajes anteriores (prepend).
    if (loadingPrevRef.current) return;
    const cambioDeChat = prevSelectedPkRef.current !== selectedLead?.pk;
    prevSelectedPkRef.current = selectedLead?.pk;
    if (!mensajes.length) return;
    if (cambioDeChat || nearBottomRef.current) {
      // Sin animacion al abrir el chat; suave al llegar mensajes nuevos.
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: cambioDeChat ? 'auto' : 'smooth',
          block: 'end',
        });
      });
    }
  }, [mensajes, selectedLead?.pk]);

  // Detecta si el usuario esta cerca del fondo del panel de mensajes.
  const onMensajesScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanciaAlFondo = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distanciaAlFondo < 120;
  };

  // Marca actividad del usuario (enviando/guardando) para pausar el polling.
  useEffect(() => {
    busyRef.current = sending || savingLead || savingConversion;
  }, [sending, savingLead, savingConversion]);

  // Refresco automatico silencioso de la lista de conversaciones.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || busyRef.current) return;
      // #4 backoff: si venimos fallando, saltamos ciclos antes de reintentar.
      if (leadsSkipRef.current > 0) {
        leadsSkipRef.current -= 1;
        return;
      }
      refrescarLeadsSilencioso();
    }, LEADS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Refresco automatico silencioso de la conversacion abierta.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || busyRef.current) return;
      if (convSkipRef.current > 0) {
        convSkipRef.current -= 1;
        return;
      }
      const lead = selectedLeadRef.current;
      if (lead) refrescarConversacionSilencioso(lead);
    }, CONVERSATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Programa el proximo intento tras un fallo, saltando ciclos de forma
  // progresiva (backoff exponencial con tope). Devuelve la cuenta de fallos.
  const scheduleBackoff = (failRef: React.MutableRefObject<number>, skipRef: React.MutableRefObject<number>) => {
    failRef.current = Math.min(failRef.current + 1, MAX_BACKOFF_STEPS);
    // fallos 1->salta 1 ciclo, 2->2, 3->4, 4->8... (2^(fallos-1)), con tope.
    skipRef.current = Math.min(2 ** (failRef.current - 1), 2 ** (MAX_BACKOFF_STEPS - 1));
  };

  const leadsParams = (cursor?: string) => {
    const text = busqueda.trim();
    const filtrosActivos = Boolean(text || canal);
    return {
      ...(canal ? { canal } : {}),
      ...(text ? { q: text } : {}),
      ...(filtrosActivos ? {} : { limit: LEADS_PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    };
  };

  const leadsParamsRef = (cursor?: string) => {
    const text = busquedaRef.current.trim();
    const activeCanal = canalRef.current;
    const filtrosActivos = Boolean(text || activeCanal);
    return {
      ...(activeCanal ? { canal: activeCanal } : {}),
      ...(text ? { q: text } : {}),
      ...(filtrosActivos ? {} : { limit: LEADS_PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    };
  };

  // Actualiza la lista de leads sin spinner ni abrir conversacion.
  const refrescarLeadsSilencioso = async () => {
    try {
      const data = await listarMetaLeads(leadsParamsRef());
      setLeads((prev) => mergeRecentLeadsByPk(prev, data.items || []));
      setSelectedLead((prev) => {
        if (!prev) return prev;
        return data.items?.find((lead) => lead.pk === prev.pk) || prev;
      });
      setLeadsCursor(data.next_cursor || '');
      setHasMoreLeads(Boolean(data.has_more));
      leadsFailRef.current = 0; // exito: se resetea el backoff
    } catch {
      // Silencioso: no interrumpimos al usuario. Aplicamos backoff.
      scheduleBackoff(leadsFailRef, leadsSkipRef);
    }
  };

  // Refresco incremental de la conversacion abierta: solo pide los mensajes
  // MAS NUEVOS que el ultimo que ya tenemos (parametro 'after'), en vez de
  // releer toda la conversacion. Barato aunque el chat sea muy largo.
  const refrescarConversacionSilencioso = async (lead: MetaLead) => {
    try {
      const lastSk = mensajesRef.current[mensajesRef.current.length - 1]?.sk;
      // Cada 4 ciclos (o si no hay mensajes) refrescamos la ultima pagina para
      // captar cambios de estado (entregado/leido). El resto: incremental barato.
      convCycleRef.current = (convCycleRef.current + 1) % 4;
      const doStatusRefresh = !lastSk || convCycleRef.current === 0;
      const data = await getMetaConversacion(
        lead.pk,
        doStatusRefresh ? { limit: CONVERSATION_PAGE_SIZE } : { after: lastSk },
      );
      // Si el usuario cambio de conversacion mientras cargaba, descartamos.
      if (selectedLeadRef.current?.pk !== lead.pk) return;
      convFailRef.current = 0; // exito: se resetea el backoff
      if (data.lead) {
        const refreshedLead = data.lead;
        setSelectedLead(refreshedLead);
        setLeads((prev) => mergeRecentLeadsByPk(prev, [refreshedLead]));
      }
      const traidos = data.mensajes || [];
      if (data.incremental) {
        if (!traidos.length) return;
        if (traidos.some(esEventoControlWhatsapp)) {
          const latest = await getMetaConversacion(lead.pk, { limit: CONVERSATION_PAGE_SIZE });
          if (selectedLeadRef.current?.pk !== lead.pk) return;
          if (latest.lead) {
            const refreshedLead = latest.lead;
            setSelectedLead(refreshedLead);
            setLeads((prev) => mergeRecentLeadsByPk(prev, [refreshedLead]));
          }
          const latestMensajes = latest.mensajes || [];
          setMensajes((prev) => {
            const fusion = mergeMensajesMeta(prev, latestMensajes);
            return mensajesSignature(prev) !== mensajesSignature(fusion) ? fusion : prev;
          });
          setHasMoreMensajes(Boolean(latest.has_more));
          return;
        }
        // Append de los nuevos, evitando duplicados por sk.
        setMensajes((prev) => {
          const fusion = mergeMensajesMeta(prev, traidos);
          return mensajesSignature(prev) !== mensajesSignature(fusion) ? fusion : prev;
        });
      } else {
        // Refresh de estado: fusiona la ultima pagina con el historial ya cargado
        // (que puede tener mensajes mas antiguos por "cargar anteriores").
        setMensajes((prev) => {
          const fusion = mergeMensajesMeta(prev, traidos);
          return mensajesSignature(prev) !== mensajesSignature(fusion) ? fusion : prev;
        });
      }
    } catch {
      // Silencioso. Aplicamos backoff.
      scheduleBackoff(convFailRef, convSkipRef);
    }
  };

  const cargarLeads = async () => {
    setLoadingLeads(true);
    try {
      const data = await listarMetaLeads(leadsParams());
      setLeads(data.items || []);
      setLeadsCursor(data.next_cursor || '');
      setHasMoreLeads(Boolean(data.has_more));
      if (!selectedLead && data.items?.length) {
        // Si hay un query param ?lead=pk, abre ese lead especifico.
        // En entrada normal al inbox no se selecciona nada hasta que el usuario elija.
        const params = new URLSearchParams(window.location.search);
        const targetPk = params.get('lead');
        const target = targetPk
          ? data.items.find((l) => l.pk === targetPk)
          : null;
        if (target) {
          await abrirConversacion(target, false);
        } else {
          setMensajes([]);
          setHasMoreMensajes(false);
        }
      }
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar las conversaciones Meta');
    } finally {
      setLoadingLeads(false);
    }
  };

  const cargarMasLeads = async () => {
    if (!leadsCursor || loadingMoreLeads) return;
    setLoadingMoreLeads(true);
    try {
      const data = await listarMetaLeads(leadsParams(leadsCursor));
      setLeads((prev) => appendLeadsByPk(prev, data.items || []));
      setLeadsCursor(data.next_cursor || '');
      setHasMoreLeads(Boolean(data.has_more));
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar mas conversaciones');
    } finally {
      setLoadingMoreLeads(false);
    }
  };

  const cargarAsignables = async () => {
    try {
      const [usuariosData, inmobiliariasData, proyectosData] = await Promise.all([
        getUsuariosSistema(),
        getInmobiliarias(),
        getProyectos(),
      ]);
      setUsuarios((usuariosData || []).filter((usuario) => usuario.activo));
      setInmobiliarias((inmobiliariasData || []).filter((item) => item.activo));
      setProyectos((proyectosData || []).filter((proyecto) => proyecto.activo));
    } catch {
      message.warning('No se pudieron cargar responsables, inmobiliarias o proyectos');
    }
  };

  const abrirConversacion = async (lead: MetaLead, clearText = true) => {
    setSelectedLead(lead);
    if (clearText) setRespuesta('');
    setMensajeCitado(null);
    setSeleccionReenvioActiva(false);
    setMensajesSeleccionadosReenvio([]);
    setLoadingConversation(true);
    try {
      // Solo cargamos la ultima pagina (mensajes mas recientes). Los anteriores
      // se cargan bajo demanda con "cargar mensajes anteriores".
      const data = await getMetaConversacion(lead.pk, { limit: CONVERSATION_PAGE_SIZE });
      const currentLead = data.lead || lead;
      setSelectedLead(currentLead);
      setMensajes(data.mensajes || []);
      setHasMoreMensajes(Boolean(data.has_more));
      form.setFieldsValue({
        estado: currentLead.estado || 'nuevo',
        responsable_id: currentLead.responsable_id,
        inmobiliaria_id: currentLead.inmobiliaria_id,
        motivo_cierre: currentLead.motivo_cierre,
      });
    } catch (error: any) {
      setMensajes([]);
      setHasMoreMensajes(false);
      message.error(error?.message || 'No se pudo abrir la conversacion');
    } finally {
      setLoadingConversation(false);
    }
  };

  // Carga mensajes anteriores (historial hacia arriba) usando el sk mas antiguo.
  // Preserva la posicion del scroll: guarda scrollHeight antes del prepend y la
  // restaura despues para que el usuario siga viendo el mismo mensaje.
  const cargarMensajesAnteriores = async () => {
    const lead = selectedLeadRef.current;
    if (!lead || loadingMoreMensajes) return;
    const oldest = mensajes[0]?.sk;
    if (!oldest) return;
    // Guardar scrollHeight antes del prepend para restaurar la posicion.
    const container = scrollContainerRef.current;
    const scrollHeightAntes = container?.scrollHeight ?? 0;
    loadingPrevRef.current = true;
    setLoadingMoreMensajes(true);
    try {
      const data = await getMetaConversacion(lead.pk, {
        limit: CONVERSATION_PAGE_SIZE,
        before: oldest,
      });
      const previos = data.mensajes || [];
      if (previos.length) {
        setMensajes((prev) => {
          const existentes = new Set(prev.map((m) => m.sk));
          const nuevos = previos.filter((m) => !existentes.has(m.sk));
          return [...nuevos, ...prev];
        });
        // Restaurar posicion: el scroll sube exactamente lo que creció el contenido.
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - scrollHeightAntes;
          }
          loadingPrevRef.current = false;
        });
      } else {
        loadingPrevRef.current = false;
      }
      setHasMoreMensajes(Boolean(data.has_more));
    } catch (error: any) {
      loadingPrevRef.current = false;
      message.error(error?.message || 'No se pudieron cargar mensajes anteriores');
    } finally {
      setLoadingMoreMensajes(false);
    }
  };

  const guardarGestionRapida = async () => {
    if (!selectedLead) return;
    const values = form.getFieldsValue();
    if (values.estado === 'cerrado' && !values.motivo_cierre) {
      message.warning('Selecciona el motivo de cierre');
      return;
    }
    const responsable = usuarios.find((usuario) => usuario.pk === values.responsable_id);
    const inmobiliaria = inmobiliarias.find((item) => item.pk === values.inmobiliaria_id);
    setSavingLead(true);
    try {
      const result = await gestionarMetaLead(selectedLead.pk, {
        estado: values.estado,
        responsable_id: values.responsable_id || '',
        responsable_nombre: responsable?.nombre || '',
        inmobiliaria_id: values.inmobiliaria_id || '',
        inmobiliaria_nombre: inmobiliaria?.nombre || '',
        motivo_cierre: values.estado === 'cerrado' ? values.motivo_cierre : undefined,
      });
      setSelectedLead(result.lead);
      await cargarLeads();
      message.success('Lead actualizado');
    } catch (error: any) {
      message.error(error?.message || 'No se pudo actualizar el lead');
    } finally {
      setSavingLead(false);
    }
  };

  const enviarRespuesta = async () => {
    if (!selectedLead) return;
    const texto = respuesta.trim();
    if (!texto) {
      message.warning('Escribe una respuesta');
      return;
    }
    const lead = selectedLead;
    const quoted = mensajeCitado;
    const quotedMessageId = whatsappReplyId(quoted);
    // UI optimista: mostramos el mensaje al instante y limpiamos el input,
    // sin recargar todo el chat ni bloquear con spinner.
    const tempSk = `MENSAJE#pending#${Date.now()}`;
    const optimista = {
      pk: lead.pk,
      sk: tempSk,
      tipo: 'META_MENSAJE',
      channel: lead.channel,
      text: texto,
      direction: 'outgoing',
      message_status: 'enviando',
      quoted_message_id: quotedMessageId,
      quoted_text: quoted ? resumenMensajeCitado(quoted) : undefined,
      quoted_sender: quoted ? (quoted.direction === 'incoming' ? nombreContacto(lead) : 'Tu') : undefined,
      creado_en: new Date().toISOString(),
    } as unknown as MetaMensaje;
    setMensajes((prev) => [...prev, optimista]);
    setRespuesta('');
    setMensajeCitado(null);
    setSending(true);
    try {
      const result = await enviarMetaMensaje(lead.pk, {
        texto,
        quoted_message_id: quotedMessageId,
        quoted_text: quoted ? resumenMensajeCitado(quoted) : undefined,
        quoted_sender: quoted ? (quoted.direction === 'incoming' ? nombreContacto(lead) : 'Tu') : undefined,
      });
      // Reemplazamos la burbuja temporal por el mensaje real devuelto.
      setMensajes((prev) => {
        const actualTemp = prev.find((m) => m.sk === tempSk);
        const sinTemp = prev.filter((m) => m.sk !== tempSk);
        if (result.item) {
          const real = actualTemp
            ? mergeMensajePreservandoContexto(actualTemp, result.item as MetaMensaje)
            : result.item as MetaMensaje;
          return mergeMensajesMeta(sinTemp, [real]);
        }
        return sinTemp.length !== prev.length ? sinTemp : prev;
      });
      // Sin toast en exito: el mensaje ya se ve en el chat. Solo avisamos si algo falla.
      if (!result.sent) {
        if (result.status === 'pendiente_configuracion') {
          message.warning('Mensaje registrado. Falta token o aprobacion de Meta para enviarlo real.');
        } else {
          message.warning('Mensaje registrado, pero Meta rechazo el envio real.');
        }
      }
      // Refresco en segundo plano, sin spinner ni recarga completa.
      refrescarConversacionSilencioso(lead);
      cargarLeads();
    } catch (error: any) {
      // Quitamos la burbuja optimista si fallo el envio.
      setMensajes((prev) => prev.filter((m) => m.sk !== tempSk));
      message.error(error?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const esArchivoPng = (file: File) =>
    /image\/png/i.test(file.type) || /\.png$/i.test(file.name);

  const normalizarImagenParaWhatsapp = async (file: File) => {
    const isWebp = /image\/webp/i.test(file.type) || /\.webp$/i.test(file.name);
    if (!isWebp) return file;

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width || !canvas.height) return file;
      ctx.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('No se pudo normalizar la imagen'))), 'image/png');
      });
      const filename = `${file.name.replace(/\.[^.]+$/, '')}.png`;
      return new File([blob], filename, { type: 'image/png' });
    } catch {
      return file;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const VOICE_NOTE_MIME = 'audio/ogg; codecs=opus';

  const crearGrabadorNotaVoz = (stream: MediaStream): RecorderLike => {
    if (window.MediaRecorder?.isTypeSupported?.(VOICE_NOTE_MIME)) {
      return new MediaRecorder(stream, { mimeType: VOICE_NOTE_MIME });
    }
    return new OpusMediaRecorder(
      stream,
      { mimeType: VOICE_NOTE_MIME },
      {
        encoderWorkerFactory: () => new Worker(encoderWorkerUrl),
        OggOpusEncoderWasmPath: oggOpusWasmUrl,
        WebMOpusEncoderWasmPath: webmOpusWasmUrl,
      },
    ) as unknown as RecorderLike;
  };

  const limpiarGrabacionAudio = async () => {
    if (audioTimerRef.current) {
      window.clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    audioRecorderRef.current = null;
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    setGrabandoAudio(false);
    setDuracionAudio(0);
  };

  const detenerGrabacionAudio = async (enviar: boolean) => {
    const recorder = audioRecorderRef.current;
    if (!grabandoAudio || !recorder) return;
    setProcesandoAudio(enviar);
    recorder.onstop = async () => {
      const chunks = [...audioChunksRef.current];
      audioChunksRef.current = [];
      await limpiarGrabacionAudio();
      if (!enviar) {
        setProcesandoAudio(false);
        return;
      }
      if (!chunks.length) {
        message.warning('No se capturo audio');
        setProcesandoAudio(false);
        return;
      }
      try {
        const blob = new Blob(chunks, { type: VOICE_NOTE_MIME });
        const file = new File([blob], `nota-voz-${Date.now()}.ogg`, { type: VOICE_NOTE_MIME });
        await adjuntarArchivo(file, { voice: true });
      } catch (error: any) {
        message.error(error?.message || 'No se pudo preparar la nota de voz');
      } finally {
        setProcesandoAudio(false);
      }
    };
    recorder.stop();
  };

  const iniciarGrabacionAudio = async () => {
    if (!selectedLead || selectedLead.channel !== 'whatsapp') {
      message.warning('Las notas de voz estan disponibles solo para WhatsApp');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      message.error('Este navegador no permite grabar audio');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = crearGrabadorNotaVoz(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.start(250);
      audioRecorderRef.current = recorder;
      audioStreamRef.current = stream;
      setGrabandoAudio(true);
      setDuracionAudio(0);
      audioTimerRef.current = window.setInterval(() => {
        setDuracionAudio((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      message.error(error?.message || 'No se pudo acceder al microfono');
      await limpiarGrabacionAudio();
    }
  };

  useEffect(() => () => {
    void limpiarGrabacionAudio();
  }, []);

  // Envia un archivo (imagen/video/documento/audio) por WhatsApp: lo sube a S3
  // y luego manda el mensaje con la URL publica para que Meta lo descargue.
  const adjuntarArchivo = async (file: File, opts?: { voice?: boolean }) => {
    if (!selectedLead) return;
    if (file.size > MAX_MEDIA_MB * 1024 * 1024) {
      message.error(`El archivo supera el limite de ${MAX_MEDIA_MB} MB.`);
      return;
    }
    const lead = selectedLead;
    const caption = respuesta.trim();
    const quoted = mensajeCitado;
    setSubiendoArchivo(true);
    try {
      const enviarComoDocumento = esArchivoPng(file);
      const archivoEnvio = enviarComoDocumento ? file : await normalizarImagenParaWhatsapp(file);
      const upload = await getMetaMediaUploadUrl(archivoEnvio.type || 'application/octet-stream', archivoEnvio.name);
      await subirArchivoAS3(upload.upload_url, archivoEnvio);
      const mediaTypeEnvio = enviarComoDocumento ? 'document' : upload.media_type;
      const quotedMessageId = whatsappReplyId(quoted);
      // Burbuja optimista con el archivo.
      const tempSk = `MENSAJE#pending#${Date.now()}`;
      const optimista = {
        pk: lead.pk,
        sk: tempSk,
        tipo: 'META_MENSAJE',
        channel: lead.channel,
        text: caption,
        direction: 'outgoing',
        message_status: 'enviando',
        event_type: mediaTypeEnvio,
        quoted_message_id: quotedMessageId,
        quoted_text: quoted ? resumenMensajeCitado(quoted) : undefined,
        quoted_sender: quoted ? (quoted.direction === 'incoming' ? nombreContacto(lead) : 'Tu') : undefined,
        media: {
          type: mediaTypeEnvio,
          mime_type: upload.content_type,
          filename: archivoEnvio.name,
          caption,
          public_url: upload.public_url,
          storage_status: 'stored',
          ...(opts?.voice ? { voice: true } : {}),
        },
        creado_en: new Date().toISOString(),
      } as unknown as MetaMensaje;
      setMensajes((prev) => [...prev, optimista]);
      setRespuesta('');
      setMensajeCitado(null);
      const result = await enviarMetaMensaje(lead.pk, {
        texto: caption,
        media_type: mediaTypeEnvio,
        media_url: upload.public_url,
        content_type: upload.content_type,
        filename: archivoEnvio.name,
        voice: opts?.voice,
        quoted_message_id: quotedMessageId,
        quoted_text: quoted ? resumenMensajeCitado(quoted) : undefined,
        quoted_sender: quoted ? (quoted.direction === 'incoming' ? nombreContacto(lead) : 'Tu') : undefined,
      });
      setMensajes((prev) => {
        const actualTemp = prev.find((m) => m.sk === tempSk);
        const sinTemp = prev.filter((m) => m.sk !== tempSk);
        if (result.item) {
          const real = actualTemp
            ? mergeMensajePreservandoContexto(actualTemp, result.item as MetaMensaje)
            : result.item as MetaMensaje;
          return mergeMensajesMeta(sinTemp, [real]);
        }
        return sinTemp;
      });
      if (!result.sent) {
        message.warning('Archivo registrado, pero Meta rechazo el envio real.');
      }
      refrescarConversacionSilencioso(lead);
      cargarLeads();
    } catch (error: any) {
      message.error(error?.message || 'No se pudo enviar el archivo');
    } finally {
      setSubiendoArchivo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const abrirReenvioAdjunto = (attachment: MetaAttachment, sourceMessage: MetaMensaje) => {
    if (sourceMessage.channel !== 'whatsapp') {
      message.warning('El reenvio de archivos esta disponible solo para WhatsApp');
      return;
    }
    if (!attachment.public_url) {
      message.warning('Este archivo aun no tiene una URL archivada para reenviar');
      return;
    }
    if (!normalizarTipoMedia(attachment)) {
      message.warning('Este tipo de archivo no se puede reenviar por Meta');
      return;
    }
    setReenvioAdjunto({ attachment, sourceMessage });
    setReenvioDestinoPk('');
    setReenvioCaption(attachment.caption || attachment.filename || '');
    setReenvioOpciones(leads.filter((lead) => lead.channel === 'whatsapp' && lead.pk !== selectedLead?.pk).slice(0, 50));
  };

  const toggleAudio = async (key: string) => {
    const audio = audioPlayerRefs.current[key];
    if (!audio) return;
    Object.entries(audioPlayerRefs.current).forEach(([otherKey, otherAudio]) => {
      if (otherKey !== key && otherAudio && !otherAudio.paused) otherAudio.pause();
    });
    if (audio.paused) {
      await audio.play();
      setAudioReproduciendo(key);
    } else {
      audio.pause();
      setAudioReproduciendo('');
    }
  };

  const actualizarProgresoAudio = (key: string, audio: HTMLAudioElement) => {
    setAudioProgreso((prev) => ({
      ...prev,
      [key]: {
        current: audio.currentTime || 0,
        duration: audio.duration || prev[key]?.duration || 0,
      },
    }));
  };

  const seekAudio = (key: string, value: number) => {
    const audio = audioPlayerRefs.current[key];
    if (!audio) return;
    audio.currentTime = value;
    actualizarProgresoAudio(key, audio);
  };

  const buscarDestinoReenvio = async (query: string) => {
    const text = query.trim();
    setBuscandoDestinoReenvio(true);
    try {
      const data = await listarMetaLeads({
        canal: 'whatsapp',
        ...(text ? { q: text } : { limit: LEADS_PAGE_SIZE }),
      });
      setReenvioOpciones((data.items || []).filter((lead) => lead.channel === 'whatsapp' && lead.pk !== selectedLead?.pk));
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron buscar conversaciones');
    } finally {
      setBuscandoDestinoReenvio(false);
    }
  };

  const prepararAdjuntoParaReenvio = async (attachment: MetaAttachment) => {
    const mediaType = normalizarTipoMedia(attachment);
    const originalUrl = attachment.public_url || '';
    if (esSticker(attachment) || !mediaType || !originalUrl) {
      throw new Error('Este archivo no se puede reenviar');
    }
    if (esPng(attachment)) {
      return {
        mediaType: 'document',
        mediaUrl: originalUrl,
        contentType: 'image/png',
        filename: attachment.filename || etiquetaAdjunto(attachment) || 'imagen.png',
      };
    }
    return {
      mediaType,
      mediaUrl: originalUrl,
      contentType: attachment.mime_type,
      filename: attachment.filename || etiquetaAdjunto(attachment),
    };
  };

  const toggleMensajeReenvio = (mensaje: MetaMensaje) => {
    if (!mensajeReenviableWhatsapp(mensaje)) {
      message.warning('Este mensaje no se puede reenviar');
      return;
    }
    const key = mensajeKey(mensaje);
    setMensajesSeleccionadosReenvio((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      if (prev.length >= MAX_REENVIO_MENSAJES) {
        message.warning(`Puedes seleccionar hasta ${MAX_REENVIO_MENSAJES} mensajes`);
        return prev;
      }
      return [...prev, key];
    });
  };

  const abrirReenvioSeleccion = () => {
    if (!mensajesSeleccionadosParaReenvio.length) {
      message.warning('Selecciona al menos un mensaje reenviable');
      return;
    }
    setReenvioDestinoPks([]);
    setReenvioOpciones(leads.filter((lead) => lead.channel === 'whatsapp' && lead.pk !== selectedLead?.pk).slice(0, 50));
    setReenvioSeleccionOpen(true);
  };

  const reenviarAdjunto = async () => {
    if (!reenvioAdjunto || !reenvioDestinoPk) {
      message.warning('Selecciona una conversacion destino');
      return;
    }
    const destino = reenvioOpciones.find((lead) => lead.pk === reenvioDestinoPk)
      || leads.find((lead) => lead.pk === reenvioDestinoPk);
    if (!destino) {
      message.warning('Selecciona una conversacion destino valida');
      return;
    }
    const attachment = reenvioAdjunto.attachment;
    const mediaType = normalizarTipoMedia(attachment);
    if (!mediaType || !attachment.public_url) {
      message.warning('Este archivo no se puede reenviar');
      return;
    }
    setReenviandoAdjunto(true);
    try {
      const media = await prepararAdjuntoParaReenvio(attachment);
      const result = await enviarMetaMensaje(destino.pk, {
        texto: reenvioCaption.trim(),
        media_type: media.mediaType,
        media_url: media.mediaUrl,
        content_type: media.contentType,
        filename: media.filename,
      });
      if (!result.sent) {
        message.warning('Reenvio registrado, pero Meta rechazo el envio real.');
      } else {
        message.success('Archivo reenviado');
      }
      setReenvioAdjunto(null);
      setReenvioDestinoPk('');
      setReenvioCaption('');
      if (selectedLead?.pk === destino.pk) {
        refrescarConversacionSilencioso(destino);
      }
      cargarLeads();
    } catch (error: any) {
      message.error(error?.message || 'No se pudo reenviar el archivo');
    } finally {
      setReenviandoAdjunto(false);
    }
  };

  const reenviarSeleccion = async () => {
    if (!mensajesSeleccionadosParaReenvio.length) {
      message.warning('Selecciona al menos un mensaje');
      return;
    }
    if (!reenvioDestinoPks.length) {
      message.warning('Selecciona al menos una conversacion destino');
      return;
    }
    if (reenvioDestinoPks.length > MAX_REENVIO_DESTINOS) {
      message.warning(`Puedes seleccionar hasta ${MAX_REENVIO_DESTINOS} destinos`);
      return;
    }
    const destinos = reenvioDestinoPks
      .map((pk) => reenvioOpciones.find((lead) => lead.pk === pk) || leads.find((lead) => lead.pk === pk))
      .filter((lead): lead is MetaLead => Boolean(lead && lead.channel === 'whatsapp'));
    if (!destinos.length) {
      message.warning('Selecciona destinos validos de WhatsApp');
      return;
    }

    setReenviandoAdjunto(true);
    let enviados = 0;
    let fallidos = 0;
    try {
      for (const destino of destinos) {
        for (const mensaje of mensajesSeleccionadosParaReenvio) {
          const attachments = adjuntosReenviables(mensaje);
          const text = textoMensaje(mensaje);
          const enviarTexto = text && !isPlaceholderConAdjunto(mensaje, attachmentsOf(mensaje).length);
          if (attachments.length) {
            for (const attachment of attachments) {
              const media = await prepararAdjuntoParaReenvio(attachment);
              const result = await enviarMetaMensaje(destino.pk, {
                texto: enviarTexto ? text : (attachment.caption || ''),
                media_type: media.mediaType,
                media_url: media.mediaUrl,
                content_type: media.contentType,
                filename: media.filename,
              });
              if (result.sent) enviados += 1;
              else fallidos += 1;
            }
          } else if (enviarTexto) {
            const result = await enviarMetaMensaje(destino.pk, { texto: text });
            if (result.sent) enviados += 1;
            else fallidos += 1;
          }
        }
      }
      if (fallidos) {
        message.warning(`Reenvio terminado: ${enviados} enviado(s), ${fallidos} fallido(s)`);
      } else {
        message.success(`Reenvio completado: ${enviados} mensaje(s)`);
      }
      setReenvioSeleccionOpen(false);
      setSeleccionReenvioActiva(false);
      setMensajesSeleccionadosReenvio([]);
      setReenvioDestinoPks([]);
      cargarLeads();
    } catch (error: any) {
      message.error(error?.message || 'No se pudo completar el reenvio');
    } finally {
      setReenviandoAdjunto(false);
    }
  };

  const abrirEditorNombre = () => {
    if (!selectedLead) return;
    // Precargamos el nombre actual (manual o alias de perfil), no el numero.
    const actual = (selectedLead.nombre_manual || selectedLead.contact_profile_name || '').trim();
    setNombreEditando(actual);
    setEditNombreOpen(true);
  };

  const guardarNombre = async () => {
    if (!selectedLead) return;
    const nombre = nombreEditando.trim();
    setGuardandoNombre(true);
    try {
      await renombrarMetaContacto(selectedLead.pk, nombre);
      // Actualizamos en memoria el lead seleccionado y la lista.
      setSelectedLead((prev) => (prev ? { ...prev, nombre_manual: nombre } : prev));
      setLeads((prev) => prev.map((l) => (l.pk === selectedLead.pk ? { ...l, nombre_manual: nombre } : l)));
      setEditNombreOpen(false);
    } catch (error: any) {
      message.error(error?.message || 'No se pudo guardar el nombre');
    } finally {
      setGuardandoNombre(false);
    }
  };

  const abrirConversion = () => {
    if (!selectedLead) return;
    convertForm.resetFields();
    convertForm.setFieldsValue({
      cedula: selectedLead.cliente_cedula,
      inmobiliaria_id: selectedLead.inmobiliaria_id,
      telefono: selectedLead.channel === 'whatsapp' ? selectedLead.external_contact_id : '',
    });
    setUnidades([]);
    setConvertOpen(true);
  };

  const abrirAsociarCliente = () => {
    if (!selectedLead) return;
    setTipoBusquedaCliente('cedula');
    setBusquedaCliente(selectedLead.channel === 'whatsapp' ? selectedLead.external_contact_id : '');
    setClientesEncontrados([]);
    setAsociarOpen(true);
  };

  const buscarClienteExistente = async () => {
    const query = busquedaCliente.trim();
    if (query.length < 2) {
      message.warning('Escribe al menos 2 caracteres');
      return;
    }
    setBuscandoClientes(true);
    try {
      const data = await buscarClientesAdmin(query, tipoBusquedaCliente);
      setClientesEncontrados(data || []);
      if (!data?.length) message.info('No se encontraron clientes');
    } catch (error: any) {
      message.error(error?.message || 'No se pudo buscar clientes');
    } finally {
      setBuscandoClientes(false);
    }
  };

  const asociarCliente = async (grupo: ClienteGrupo) => {
    if (!selectedLead) return;
    setAsociandoCliente(true);
    try {
      const result = await asociarMetaLeadCliente(selectedLead.pk, {
        cedula: grupo.cedula,
      });
      setSelectedLead(result.lead);
      setLeads((prev) => prev.map((lead) => (lead.pk === result.lead.pk ? result.lead : lead)));
      setAsociarOpen(false);
      message.success('Cliente asociado al lead');
    } catch (error: any) {
      message.error(error?.message || 'No se pudo asociar el cliente');
    } finally {
      setAsociandoCliente(false);
    }
  };

  const irAHistorialMensajes = () => {
    mensajesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cargarUnidadesProyecto = async (proyectoId?: string) => {
    convertForm.setFieldsValue({ unidad_id: undefined });
    setUnidades([]);
    if (!proyectoId) return;
    setLoadingUnidades(true);
    try {
      const data = await getUnidades(proyectoId, { limit: 200 });
      setUnidades(data || []);
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar las unidades');
    } finally {
      setLoadingUnidades(false);
    }
  };

  const guardarConversion = async () => {
    if (!selectedLead) return;
    try {
      const values = await convertForm.validateFields();
      const fechaNacimiento = values.fecha_nacimiento?.format
        ? values.fecha_nacimiento.format('YYYY-MM-DD')
        : values.fecha_nacimiento;
      const payload = validateAndNormalizeClientePayload({
        ...values,
        fecha_nacimiento: fechaNacimiento,
      });
      if (selectedLead.cliente_cedula && payload.cedula !== selectedLead.cliente_cedula) {
        message.error(`Este lead ya esta asociado a la cedula ${selectedLead.cliente_cedula}`);
        return;
      }
      setSavingConversion(true);
      const result = await convertirMetaLead(selectedLead.pk, {
        ...payload,
        inmobiliaria_id: String(payload.inmobiliaria_id || '').replace('INMOBILIARIA#', ''),
      });
      setSelectedLead(result.lead);
      setConvertOpen(false);
      convertForm.resetFields();
      await cargarLeads();
      await abrirConversacion(result.lead, false);
      message.success(result.proceso ? 'Bloqueo registrado desde lead Meta' : 'Cliente registrado desde lead Meta');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || 'No se pudo convertir el lead');
    } finally {
      setSavingConversion(false);
    }
  };

  return (
    <div className="-mx-3 -mt-3 flex h-[calc(100dvh-64px)] min-h-[520px] flex-col overflow-hidden lg:-mx-7 lg:-mt-4">
      <div className={`grid min-h-0 flex-1 gap-0 ${leadPanelOpen ? 'lg:grid-cols-[300px_minmax(0,1fr)_280px]' : 'lg:grid-cols-[300px_minmax(0,1fr)]'} grid-cols-1`}>
        <div ref={mensajesPanelRef} className={`${selectedLead ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-[var(--app-border)] bg-[var(--panel-bg)]`}>
          {/* Header del panel izquierdo — titulo + boton actualizar */}
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-3 py-2.5">
            <Text strong>Inbox Meta</Text>
            <Space size={4}>
              {!whatsappConectado && (
                <Button size="small" icon={<LinkOutlined />} href={whatsappOnboardingUrl} target="_blank" rel="noreferrer" />
              )}
              <Button size="small" icon={<ReloadOutlined />} onClick={cargarLeads} loading={loadingLeads} />
            </Space>
          </div>
          <div className="border-b border-[var(--app-border)] px-3 py-2">
            <Space direction="vertical" size={6} className="w-full">
              <Search
                allowClear
                placeholder="Buscar conversacion"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
              <Select
                allowClear
                placeholder="Todos los canales"
                value={canal}
                onChange={setCanal}
                options={[
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'messenger', label: 'Messenger' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                ]}
              />
            </Space>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingLeads && !conversaciones.length ? (
              <div className="grid h-full place-items-center">
                <Spin />
              </div>
            ) : conversaciones.length ? (
              <>
                {conversaciones.map((lead) => {
                  const active = selectedLead?.pk === lead.pk;
                  const pending = toNumber(lead.mensajes_recibidos) > toNumber(lead.mensajes_enviados);
                  return (
                    <button
                      key={lead.pk}
                      type="button"
                      onClick={() => abrirConversacion(lead)}
                      className={`block w-full border-b border-[var(--app-border)] px-3 py-2.5 text-left transition hover:bg-[var(--panel-soft-bg)] ${
                        active ? 'bg-[var(--action-soft-hover)]' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Text strong className="block max-w-[240px] truncate md:max-w-[200px]">{nombreContacto(lead)}</Text>
                          <Text type="secondary" className="block max-w-[240px] truncate text-xs md:max-w-[200px]">
                            {lead.account_alias || canalLabel[lead.channel] || 'Meta'}
                          </Text>
                        </div>
                        {pending && <Tag color="orange" bordered={false} style={{ background: 'transparent' }}>Nuevo</Tag>}
                      </div>
                      <Paragraph ellipsis={{ rows: 1 }} className="!mb-1 !mt-1.5 text-sm">
                        {resumenUltimoMensaje(lead.ultimo_mensaje_texto)}
                      </Paragraph>
                      <div className="flex items-center justify-between gap-2">
                        <Tag color={canalColor[lead.channel] || 'default'} bordered={false} style={{ background: 'transparent' }}>{canalLabel[lead.channel] || lead.channel}</Tag>
                        <Text type="secondary" className="text-xs">{formatDate(lead.ultimo_mensaje_en)}</Text>
                      </div>
                    </button>
                  );
                })}
                {hasMoreLeads && (
                  <div className="border-b border-[var(--app-border)] p-3">
                    <Button block size="small" onClick={cargarMasLeads} loading={loadingMoreLeads}>
                      Cargar mas
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center p-4">
                <Empty description="Sin conversaciones" />
              </div>
            )}
          </div>
        </div>

        <div className={`${selectedLead ? 'flex' : 'hidden md:flex'} min-h-0 flex-col bg-[var(--panel-bg)]`}>
          {selectedLead ? (
            <div className="flex h-full flex-col">
              <div className="flex min-h-[48px] items-center justify-between gap-2 border-b border-[var(--app-border)] px-2 py-2 sm:px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setSelectedLead(null)}
                    className="md:!hidden"
                    title="Volver a conversaciones"
                  />
                  <Text strong className="truncate text-sm">{nombreContacto(selectedLead)}</Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={abrirEditorNombre}
                    title="Editar nombre del contacto"
                  />
                  <Tag color={canalColor[selectedLead.channel] || 'default'} bordered={false} style={{ background: 'transparent' }} className="!m-0">
                    {canalLabel[selectedLead.channel] || selectedLead.channel}
                  </Tag>
                  <Tag color={estadoColor[selectedLead.estado || 'nuevo'] || 'default'} bordered={false} style={{ background: 'transparent' }} className="!m-0 hidden sm:inline-flex">
                    {selectedLead.estado || 'nuevo'}
                  </Tag>
                </div>
                <Space size={4}>
                  {selectedLead.channel === 'whatsapp' && (
                    <Button
                      size="small"
                      type={seleccionReenvioActiva ? 'primary' : 'default'}
                      onClick={() => {
                        setSeleccionReenvioActiva((value) => !value);
                        setMensajesSeleccionadosReenvio([]);
                      }}
                    >
                      {seleccionReenvioActiva ? 'Cancelar seleccion' : 'Seleccionar'}
                    </Button>
                  )}
                  <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => abrirConversacion(selectedLead)} loading={loadingConversation} title="Recargar" />
                  <Button
                    type={leadPanelOpen ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setLeadPanelOpen((v) => !v)}
                  >
                    {leadPanelOpen ? 'Cerrar' : 'Detalles'}
                  </Button>
                </Space>
              </div>

              <div
                ref={scrollContainerRef}
                onScroll={onMensajesScroll}
                className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3"
                style={{ background: 'var(--panel-soft-bg)', backgroundImage: 'radial-gradient(var(--app-border) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
              >
                {loadingConversation ? (
                  <div className="grid h-full place-items-center">
                    <Spin />
                  </div>
                ) : mensajesVisibles.length ? (
                  <div className="space-y-1.5">
                    {hasMoreMensajes && (
                      <div className="flex justify-center">
                        <Button
                          size="small"
                          type="link"
                          loading={loadingMoreMensajes}
                          onClick={cargarMensajesAnteriores}
                        >
                          Cargar mensajes anteriores
                        </Button>
                      </div>
                    )}
                    {mensajesVisibles.map((mensaje, idx) => {
                      const incoming = mensaje.direction === 'incoming';
                      const attachments = attachmentsOf(mensaje);
                      const displayText = textoMensaje(mensaje);
                      const keyReenvio = mensajeKey(mensaje);
                      const reenviable = mensajeReenviableWhatsapp(mensaje);
                      const seleccionadoReenvio = mensajesSeleccionadosReenvio.includes(keyReenvio);
                      const quotedOriginal = mensaje.quoted_message_id
                        ? mensajesPorExternalId.get(mensaje.quoted_message_id)
                        : null;
                      // Separador de fecha cuando cambia el dia.
                      const prevDia = idx > 0 ? diaKey(mensajesVisibles[idx - 1].event_timestamp) : null;
                      const esteDia = diaKey(mensaje.event_timestamp);
                      const mostrarSeparador = esteDia && esteDia !== prevDia;
                      return (
                        <div key={`${mensaje.pk}-${mensaje.sk}`}>
                          {mostrarSeparador && (
                            <div className="my-2 flex items-center gap-2">
                              <div className="h-px flex-1 bg-[var(--app-border)]" />
                              <Text type="secondary" className="text-[11px]">
                                {formatDiaSeparador(mensaje.event_timestamp)}
                              </Text>
                              <div className="h-px flex-1 bg-[var(--app-border)]" />
                            </div>
                          )}
                          <div className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
                          {seleccionReenvioActiva && (
                            <div className={`flex items-center ${incoming ? 'mr-2' : 'ml-2 order-2'}`}>
                              <Checkbox
                                checked={seleccionadoReenvio}
                                disabled={!reenviable}
                                onChange={() => toggleMensajeReenvio(mensaje)}
                              />
                            </div>
                          )}
                          <div
                            role={seleccionReenvioActiva && reenviable ? 'button' : undefined}
                            tabIndex={seleccionReenvioActiva && reenviable ? 0 : undefined}
                            onClick={() => {
                              if (seleccionReenvioActiva && reenviable) toggleMensajeReenvio(mensaje);
                            }}
                            onKeyDown={(event) => {
                              if (seleccionReenvioActiva && reenviable && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault();
                                toggleMensajeReenvio(mensaje);
                              }
                            }}
                            className={`max-w-[88%] px-3 py-1.5 shadow-sm sm:max-w-[78%] ${
                            incoming
                              ? 'rounded-[0_16px_16px_16px] bg-[var(--panel-bg)]'
                              : 'rounded-[16px_16px_0_16px] border border-[var(--action-border)] bg-[var(--action-soft-hover)]'
                          } ${seleccionadoReenvio ? 'ring-2 ring-[var(--action-border)]' : ''} ${seleccionReenvioActiva && reenviable ? 'cursor-pointer' : ''}`}>
                            {mensaje.quoted_message_id && (
                              <div className="mb-1 rounded-md border-l-2 border-[var(--action-border)] bg-[var(--panel-soft-bg)] px-2 py-1">
                                <Text type="secondary" className="block text-[11px]">
                                  {mensaje.quoted_sender || (quotedOriginal?.direction === 'incoming' ? nombreContacto(selectedLead) : 'Tu')}
                                </Text>
                                <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 text-xs">
                                  {mensaje.quoted_text || resumenMensajeCitado(quotedOriginal)}
                                </Paragraph>
                              </div>
                            )}
                            {(displayText || attachments.length === 0) && (
                              // No mostrar el texto si es solo un placeholder del tipo multimedia
                              // (ej. "[audio]", "[image]") y ya hay attachment que lo muestra.
                              !isPlaceholderConAdjunto(mensaje, attachments.length) && (
                              <Paragraph className="!mb-0.5 whitespace-pre-wrap text-sm">
                                {(displayText || 'Evento sin texto').split(/(https?:\/\/\S+)/g).map((part, i) =>
                                  /^https?:\/\//.test(part)
                                    ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline">{part}</a>
                                    : part
                                )}
                              </Paragraph>
                              )
                            )}
                            {attachments.length > 0 && (
                              <div className="space-y-1.5">
                                {attachments.map((attachment, index) => {
                                  const type = attachment.type || 'archivo';
                                  const href = attachment.public_url || attachment.url;
                                  const mime = attachment.mime_type || '';
                                  const label = attachment.filename || attachment.caption || '';

                                  // Imagen / sticker: mostrar inline con lightbox nativo
                                  if ((type === 'image' || type === 'sticker') && href) {
                                    return (
                                      <div key={`${type}-${index}`}>
                                        <a href={href} target="_blank" rel="noreferrer" title="Ver imagen completa">
                                          <img
                                            src={href}
                                            alt={label || 'imagen'}
                                            className="max-h-64 max-w-full rounded-md object-cover"
                                            loading="lazy"
                                          />
                                        </a>
                                        {label && <Text type="secondary" className="mt-0.5 block text-[11px]">{label}</Text>}
                                        {selectedLead.channel === 'whatsapp' && !seleccionReenvioActiva && attachment.public_url && normalizarTipoMedia(attachment) && (
                                          <Button
                                            size="small"
                                            type="link"
                                            className="!h-auto !p-0 text-[11px]"
                                            onClick={() => abrirReenvioAdjunto(attachment, mensaje)}
                                          >
                                            Reenviar
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  }

                                  // Video: player inline
                                  if (type === 'video' && href) {
                                    return (
                                      <div key={`${type}-${index}`}>
                                        <video
                                          src={href}
                                          controls
                                          className="max-h-64 max-w-full rounded-md"
                                          preload="metadata"
                                        />
                                        {label && <Text type="secondary" className="mt-0.5 block text-[11px]">{label}</Text>}
                                        {selectedLead.channel === 'whatsapp' && !seleccionReenvioActiva && attachment.public_url && normalizarTipoMedia(attachment) && (
                                          <Button
                                            size="small"
                                            type="link"
                                            className="!h-auto !p-0 text-[11px]"
                                            onClick={() => abrirReenvioAdjunto(attachment, mensaje)}
                                          >
                                            Reenviar
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  }

                                  // Audio / nota de voz: player inline compacto
                                  if ((type === 'audio' || type === 'voice_note' || mime.startsWith('audio/')) && href) {
                                    const audioKey = `${mensaje.sk}-${index}-${href}`;
                                    const progress = audioProgreso[audioKey] || { current: 0, duration: 0 };
                                    const playing = audioReproduciendo === audioKey;
                                    const notaVoz = esNotaVoz(attachment);
                                    return (
                                      <div key={`${type}-${index}`} className="flex min-w-[280px] max-w-[420px] flex-col gap-1">
                                        <div className="flex items-center gap-2 rounded-full bg-slate-800/90 px-3 py-2 text-white shadow-sm">
                                          <button
                                            type="button"
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                                            onClick={() => void toggleAudio(audioKey)}
                                            title={playing ? 'Pausar' : 'Reproducir'}
                                          >
                                            {playing ? <PauseOutlined /> : <PlayCircleFilled />}
                                          </button>
                                          <div className="min-w-0 flex-1">
                                            <input
                                              type="range"
                                              min={0}
                                              max={Math.max(progress.duration || 0, 1)}
                                              step="0.1"
                                              value={Math.min(progress.current || 0, Math.max(progress.duration || 0, 1))}
                                              onChange={(event) => seekAudio(audioKey, Number(event.target.value))}
                                              className="h-1 w-full accent-sky-300"
                                              title="Progreso de audio"
                                            />
                                            <div className="mt-0.5 flex items-center justify-between text-[11px] text-white/80">
                                              <span>{formatDuracionCorta(progress.current)}</span>
                                              <span>{formatDuracionCorta(progress.duration)}</span>
                                            </div>
                                          </div>
                                          <span className="h-6 w-6 rounded-full bg-white/20" title={notaVoz ? 'Nota de voz' : 'Audio'} />
                                        </div>
                                        <audio
                                          ref={(node) => { audioPlayerRefs.current[audioKey] = node; }}
                                          src={href}
                                          preload="metadata"
                                          className="hidden"
                                          onLoadedMetadata={(event) => actualizarProgresoAudio(audioKey, event.currentTarget)}
                                          onTimeUpdate={(event) => actualizarProgresoAudio(audioKey, event.currentTarget)}
                                          onEnded={() => setAudioReproduciendo('')}
                                          onPause={() => {
                                            setAudioReproduciendo((current) => (current === audioKey ? '' : current));
                                          }}
                                        />
                                        {label && !notaVoz && <Text type="secondary" className="text-[11px]">{label}</Text>}
                                        {selectedLead.channel === 'whatsapp' && !seleccionReenvioActiva && attachment.public_url && normalizarTipoMedia(attachment) && (
                                          <Button
                                            size="small"
                                            type="link"
                                            className="!h-auto !self-start !p-0 text-[11px]"
                                            onClick={() => abrirReenvioAdjunto(attachment, mensaje)}
                                          >
                                            Reenviar
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  }

                                  // Documento / otros: link de descarga
                                  return (
                                    <div key={`${type}-${index}`} className="flex items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-[var(--panel-bg)] px-2 py-1 text-sm">
                                      <FileOutlined />
                                      {href
                                        ? <a href={href} target="_blank" rel="noreferrer" className="truncate max-w-[200px]">{label || 'Archivo'}</a>
                                        : <Text className="truncate max-w-[200px]">{label || type}</Text>
                                      }
                                      {attachment.storage_status && attachment.storage_status !== 'stored' && (
                                        <Tag className="!m-0 text-[10px]">{attachment.storage_status}</Tag>
                                      )}
                                      {selectedLead.channel === 'whatsapp' && !seleccionReenvioActiva && attachment.public_url && normalizarTipoMedia(attachment) && (
                                        <Button
                                          size="small"
                                          type="link"
                                          className="!h-auto !p-0 text-[11px]"
                                          onClick={() => abrirReenvioAdjunto(attachment, mensaje)}
                                        >
                                          Reenviar
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {mensaje.reactions?.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {mensaje.reactions.map((reaction, index) => (
                                  <Tag key={`${reaction.sender_id || 'reaction'}-${index}`} className="!m-0 text-xs">
                                    {reaction.emoji || 'Reaccion'}
                                  </Tag>
                                ))}
                              </div>
                            ) : null}
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Text type="secondary" className="text-[11px] leading-none">{formatHora(mensaje.event_timestamp)}</Text>
                              {mensaje.edited && (
                                <Text type="secondary" className="text-[11px] leading-none">(edit)</Text>
                              )}
                              {!incoming && mensaje.message_status && (
                                <Text type="secondary" className="text-[11px] leading-none">{estadoMensajeMeta(mensaje.message_status)}</Text>
                              )}
                              {mensajePermiteRespuestaCitada(mensaje, selectedLead.channel) && (
                                <Button
                                  type="link"
                                  size="small"
                                  className="!h-auto !p-0 text-[11px] leading-none"
                                  onClick={() => setMensajeCitado(mensaje)}
                                >
                                  Responder
                                </Button>
                              )}
                            </div>
                            {errorVisibleMensajeMeta(mensaje) && (
                              <Text type="secondary" className="mt-0.5 block text-[11px]">
                                {errorVisibleMensajeMeta(mensaje)}
                              </Text>
                            )}
                          </div>
                        </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                    {seleccionReenvioActiva && (
                      <div className="sticky bottom-2 z-10 mx-auto flex max-w-md items-center justify-between gap-2 rounded-md border border-[var(--app-border)] bg-[var(--panel-bg)] px-3 py-2 shadow-lg">
                        <Text className="text-sm">
                          {mensajesSeleccionadosParaReenvio.length} seleccionado(s)
                        </Text>
                        <Space size={6}>
                          <Button
                            size="small"
                            onClick={() => {
                              setSeleccionReenvioActiva(false);
                              setMensajesSeleccionadosReenvio([]);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            disabled={!mensajesSeleccionadosParaReenvio.length}
                            onClick={abrirReenvioSeleccion}
                          >
                            Reenviar
                          </Button>
                        </Space>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center">
                    <Empty description="Sin mensajes" />
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--app-border)] bg-[var(--panel-bg)] px-2 py-2 sm:px-3">
                {mensajeCitado && (
                  <div className="mb-2 flex items-start justify-between gap-2 rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] px-2 py-1.5">
                    <div className="min-w-0 border-l-2 border-[var(--action-border)] pl-2">
                      <Text type="secondary" className="block text-[11px]">Respondiendo a</Text>
                      <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 text-xs">
                        {resumenMensajeCitado(mensajeCitado)}
                      </Paragraph>
                    </div>
                    <Button size="small" type="text" onClick={() => setMensajeCitado(null)}>
                      Quitar
                    </Button>
                  </div>
                )}
                <TextArea
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  maxLength={4000}
                  value={respuesta}
                  onChange={(event) => setRespuesta(event.target.value)}
                  placeholder={`Responder por ${canalLabel[selectedLead.channel] || 'Meta'}`}
                  className="!mb-2 resize-none rounded-2xl sm:!mb-1"
                  onPressEnter={(event) => {
                    if (!event.shiftKey) {
                      event.preventDefault();
                      enviarRespuesta();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <Text type="secondary" className="text-[11px]">Enter envia · Shift+Enter nueva linea</Text>
                  {grabandoAudio && (
                    <Text type="secondary" className="text-[11px]">
                      Grabando {formatDuracionAudio(duracionAudio)}
                    </Text>
                  )}
                  <Space size={6}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) adjuntarArchivo(file);
                      }}
                    />
                    <Button
                      icon={<PaperClipOutlined />}
                      loading={subiendoArchivo}
                      disabled={grabandoAudio || procesandoAudio}
                      onClick={() => fileInputRef.current?.click()}
                      title="Adjuntar archivo"
                    />
                    {grabandoAudio ? (
                      <>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => detenerGrabacionAudio(false)}
                          title="Cancelar nota de voz"
                        />
                        <Button
                          type="primary"
                          danger
                          icon={<StopOutlined />}
                          loading={procesandoAudio || subiendoArchivo}
                          onClick={() => detenerGrabacionAudio(true)}
                          title="Detener y enviar nota de voz"
                        />
                      </>
                    ) : (
                      <Button
                        icon={<AudioOutlined />}
                        loading={procesandoAudio}
                        disabled={subiendoArchivo || selectedLead.channel !== 'whatsapp'}
                        onClick={iniciarGrabacionAudio}
                        title="Grabar nota de voz"
                      />
                    )}
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={sending}
                      disabled={!respuesta.trim() || grabandoAudio || procesandoAudio}
                      onClick={enviarRespuesta}
                      title="Enviar"
                    />
                  </Space>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center">
              <Empty description="Selecciona una conversacion" />
            </div>
          )}
        </div>

        {leadPanelOpen && (
        <Card
          className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden border-l lg:static lg:z-auto"
          title="Lead"
          extra={(
            <Button size="small" onClick={() => setLeadPanelOpen(false)}>
              Cerrar
            </Button>
          )}
          bodyStyle={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        >
          {selectedLead ? (
            <Space direction="vertical" size={16} className="w-full">
              <div>
                <Text type="secondary">Responsable</Text>
                <Paragraph strong className="!mb-0">
                  {selectedLead.responsable_nombre || 'Sin asignar'}
                </Paragraph>
              </div>
              <div>
                <Text type="secondary">Inmobiliaria</Text>
                <Paragraph strong className="!mb-0">
                  {selectedLead.inmobiliaria_nombre || 'Sin asignar'}
                </Paragraph>
              </div>
              {selectedLead.cliente_asociado && (
                <div className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3">
                  <Text strong>Cliente asociado</Text>
                  <Paragraph className="!mb-0 !mt-1 text-sm">
                    {selectedLead.cliente_nombre || 'Cliente existente'} · {selectedLead.cliente_cedula || '-'}
                  </Paragraph>
                  <Text type="secondary" className="text-xs">
                    {selectedLead.cliente_registros_count || 1} registro(s) asociado(s)
                  </Text>
                  {selectedLead.cliente_nombre_variantes && selectedLead.cliente_nombre_variantes.length > 1 && (
                    <Paragraph className="!mb-0 !mt-1 text-xs" type="secondary">
                      Variantes: {selectedLead.cliente_nombre_variantes.join(', ')}
                    </Paragraph>
                  )}
                </div>
              )}
              {selectedLead.estado === 'convertido' ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <Text strong className="text-green-700">Cliente registrado</Text>
                  <Paragraph className="!mb-0 !mt-1 text-sm">
                    Cedula: {selectedLead.cliente_cedula || '-'}
                  </Paragraph>
                  <Space className="mt-2" size={8} wrap>
                    <Button className="p-0" size="small" type="link" onClick={irAHistorialMensajes}>
                      Ver historial de mensajes
                    </Button>
                    <Button size="small" onClick={abrirConversion}>
                      Registrar otra oportunidad
                    </Button>
                  </Space>
                </div>
              ) : (
                <Space direction="vertical" className="w-full">
                  <Button block onClick={abrirConversion}>
                    Registrar cliente o bloqueo
                  </Button>
                  <Button block onClick={abrirAsociarCliente}>
                    Asociar cliente existente
                  </Button>
                </Space>
              )}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Text strong>Oportunidades registradas</Text>
                  <Tag>{(selectedLead.historial_conversiones?.length || 0) + (selectedLead.oportunidades_asociadas?.length || 0)}</Tag>
                </div>
                {(selectedLead.historial_conversiones?.length || selectedLead.oportunidades_asociadas?.length) ? (
                  <div className="space-y-2">
                    {(selectedLead.historial_conversiones || []).map((item, index) => (
                      <div
                        key={`${item.convertido_en || index}-${item.unidad_id || 'sin-unidad'}`}
                        className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3"
                      >
                        <Space direction="vertical" size={2} className="w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tag color={item.con_unidad ? 'geekblue' : 'default'}>
                              {item.con_unidad ? 'Bloqueo' : 'Sin unidad'}
                            </Tag>
                            <Text strong>{getProyectoLabel(proyectos, item.proyecto_id)}</Text>
                          </div>
                          <Text className="text-sm">
                            Unidad: {item.unidad_nombre || item.unidad_id || 'Sin unidad'}
                          </Text>
                          <Text type="secondary" className="text-xs">
                            Cliente {item.cedula || '-'} · {getInmobiliariaLabel(inmobiliarias, item.inmobiliaria_id)}
                          </Text>
                          <Text type="secondary" className="text-xs">
                            {formatDate(item.convertido_en)} · {item.usuario_nombre || 'Sistema'}
                          </Text>
                        </Space>
                      </div>
                    ))}
                    {(selectedLead.oportunidades_asociadas || []).map((item, index) => (
                      <div
                        key={`${item.proceso_pk || index}-${item.unidad_id || 'sin-unidad'}`}
                        className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3"
                      >
                        <Space direction="vertical" size={2} className="w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tag color="blue">Cliente asociado</Tag>
                            <Tag>{item.estado || 'proceso'}</Tag>
                            <Text strong>{getProyectoLabel(proyectos, item.proyecto_id)}</Text>
                          </div>
                          <Text className="text-sm">
                            Unidad: {item.unidad_nombre || item.unidad_id || 'Sin unidad'}
                          </Text>
                          <Text type="secondary" className="text-xs">
                            Cliente {item.cedula || '-'} · {getInmobiliariaLabel(inmobiliarias, item.inmobiliaria_id)}
                          </Text>
                          <Text type="secondary" className="text-xs">
                            {formatDate(item.actualizado_en || item.fecha_inicio)}
                          </Text>
                        </Space>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin oportunidades registradas" />
                )}
              </div>
              <Form form={form} layout="vertical">
                <Form.Item label="Estado" name="estado">
                  <Select
                    options={[
                      { value: 'nuevo', label: 'Nuevo' },
                      { value: 'en_seguimiento', label: 'En seguimiento' },
                      { value: 'convertido', label: 'Convertido', disabled: !selectedLead.cliente_cedula },
                      { value: 'cerrado', label: 'Cerrado' },
                    ]}
                  />
                </Form.Item>
                {estadoGestion === 'cerrado' && (
                  <Form.Item
                    label="Motivo de cierre"
                    name="motivo_cierre"
                    rules={[{ required: true, message: 'Selecciona el motivo' }]}
                  >
                    <Select
                      placeholder="Seleccionar motivo"
                      options={motivosCierre.map((motivo) => ({ value: motivo, label: motivo }))}
                    />
                  </Form.Item>
                )}
                {selectedLead.motivo_cierre && (
                  <div className="rounded-md border border-[var(--app-border)] bg-gray-50 p-2">
                    <Text type="secondary" className="text-xs">Ultimo motivo de cierre</Text>
                    <div>{selectedLead.motivo_cierre}</div>
                    <Button className="mt-1 p-0" size="small" type="link" onClick={irAHistorialMensajes}>
                      Ver historial de mensajes
                    </Button>
                  </div>
                )}
                <Form.Item label="Responsable" name="responsable_id">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Seleccionar"
                    options={usuarios.map((usuario) => ({
                      value: usuario.pk,
                      label: `${usuario.nombre || usuario.cognito_username} (${usuario.rol})`,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="Inmobiliaria" name="inmobiliaria_id">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Seleccionar"
                    options={inmobiliarias.map((inmobiliaria) => ({
                      value: inmobiliaria.pk,
                      label: inmobiliaria.nombre,
                    }))}
                  />
                </Form.Item>
                <Button block type="primary" loading={savingLead} onClick={guardarGestionRapida}>
                  Guardar cambios
                </Button>
              </Form>

            </Space>
          ) : (
            <Empty description="Sin lead seleccionado" />
          )}
        </Card>
        )}
      </div>

      <Modal
        title="Nombre del contacto"
        open={editNombreOpen}
        onCancel={() => setEditNombreOpen(false)}
        onOk={guardarNombre}
        okText="Guardar"
        confirmLoading={guardandoNombre}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full" size={8}>
          <Text type="secondary">
            Numero: {selectedLead?.external_contact_id}
          </Text>
          <Input
            value={nombreEditando}
            maxLength={120}
            placeholder="Escribe un nombre para este contacto"
            onChange={(e) => setNombreEditando(e.target.value)}
            onPressEnter={guardarNombre}
            allowClear
          />
          <Text type="secondary" className="text-xs">
            Dejalo vacio para volver a mostrar el nombre de perfil o el numero.
          </Text>
        </Space>
      </Modal>

      <Modal
        title="Asociar cliente existente"
        open={asociarOpen}
        onCancel={() => setAsociarOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full" size={12}>
          <Space.Compact className="w-full">
            <Select
              value={tipoBusquedaCliente}
              onChange={setTipoBusquedaCliente}
              options={[
                { value: 'cedula', label: 'Cedula' },
                { value: 'nombre', label: 'Nombre' },
              ]}
              style={{ width: 130 }}
            />
            <Search
              allowClear
              value={busquedaCliente}
              placeholder="Buscar cliente existente"
              loading={buscandoClientes}
              onChange={(event) => setBusquedaCliente(event.target.value)}
              onSearch={buscarClienteExistente}
              enterButton="Buscar"
            />
          </Space.Compact>
          {clientesAgrupados.length ? (
            <div className="space-y-2">
              {clientesAgrupados.map((grupo) => (
                <div
                  key={grupo.cedula}
                  className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Space direction="vertical" size={2}>
                      <Text strong>{grupo.nombre}</Text>
                      <Text type="secondary" className="text-xs">
                        {grupo.cedula} · {grupo.registros.length} registro(s)
                      </Text>
                      <Text type="secondary" className="text-xs">
                        Inmobiliarias: {grupo.inmobiliarias.map((id) => getInmobiliariaLabel(inmobiliarias, id)).join(', ') || '-'}
                      </Text>
                      <Text type="secondary" className="text-xs">
                        Proyectos: {grupo.proyectos.map((id) => getProyectoLabel(proyectos, id)).join(', ') || '-'}
                      </Text>
                      {grupo.variantes.length > 1 && (
                        <Text type="secondary" className="text-xs">
                          Variantes: {grupo.variantes.join(', ')}
                        </Text>
                      )}
                    </Space>
                    <Button
                      type="primary"
                      size="small"
                      loading={asociandoCliente}
                      onClick={() => asociarCliente(grupo)}
                    >
                      Asociar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Busca y selecciona un cliente" />
          )}
        </Space>
      </Modal>

      <Modal
        title="Reenviar archivo"
        open={Boolean(reenvioAdjunto)}
        onCancel={() => {
          setReenvioAdjunto(null);
          setReenvioDestinoPk('');
          setReenvioCaption('');
        }}
        onOk={reenviarAdjunto}
        okText="Reenviar"
        cancelText="Cancelar"
        confirmLoading={reenviandoAdjunto}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full" size={12}>
          <div className="rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3">
            <Text strong>{reenvioAdjunto ? etiquetaAdjunto(reenvioAdjunto.attachment) : 'Archivo'}</Text>
            <Text type="secondary" className="mt-1 block text-xs">
              {reenvioAdjunto ? normalizarTipoMedia(reenvioAdjunto.attachment) || reenvioAdjunto.attachment.type || 'archivo' : ''}
            </Text>
          </div>
          <Select
            showSearch
            value={reenvioDestinoPk || undefined}
            placeholder="Seleccionar conversacion destino"
            filterOption={false}
            loading={buscandoDestinoReenvio}
            onSearch={buscarDestinoReenvio}
            onDropdownVisibleChange={(open) => {
              if (open && !reenvioOpciones.length) buscarDestinoReenvio('');
            }}
            onChange={setReenvioDestinoPk}
            options={reenvioOpciones.map((lead) => ({
              value: lead.pk,
              label: `${canalLabel[lead.channel] || lead.channel} - ${nombreContacto(lead)}`,
            }))}
          />
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={1000}
            value={reenvioCaption}
            onChange={(event) => setReenvioCaption(event.target.value)}
            placeholder="Mensaje opcional"
          />
        </Space>
      </Modal>

      <Modal
        title="Reenviar mensajes"
        open={reenvioSeleccionOpen}
        onCancel={() => {
          setReenvioSeleccionOpen(false);
          setReenvioDestinoPks([]);
        }}
        onOk={reenviarSeleccion}
        okText="Reenviar"
        cancelText="Cancelar"
        confirmLoading={reenviandoAdjunto}
        width={620}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full" size={12}>
          <div className="grid gap-3 rounded-md border border-[var(--app-border)] bg-[var(--panel-soft-bg)] p-3 sm:grid-cols-3">
            <div>
              <Text type="secondary" className="block text-xs">Mensajes</Text>
              <Text strong>{mensajesSeleccionadosParaReenvio.length}</Text>
            </div>
            <div>
              <Text type="secondary" className="block text-xs">Destinos</Text>
              <Text strong>{reenvioDestinoPks.length}</Text>
            </div>
            <div>
              <Text type="secondary" className="block text-xs">Envios</Text>
              <Text strong>{mensajesSeleccionadosParaReenvio.length * reenvioDestinoPks.length}</Text>
            </div>
          </div>
          <Search
            allowClear
            loading={buscandoDestinoReenvio}
            placeholder="Buscar chat WhatsApp por nombre o numero"
            onSearch={buscarDestinoReenvio}
            onChange={(event) => {
              if (!event.target.value.trim()) buscarDestinoReenvio('');
            }}
          />
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {reenvioOpciones.length ? reenvioOpciones.map((lead) => {
              const checked = reenvioDestinoPks.includes(lead.pk);
              return (
                <button
                  key={lead.pk}
                  type="button"
                  onClick={() => {
                    setReenvioDestinoPks((prev) => {
                      if (prev.includes(lead.pk)) return prev.filter((pk) => pk !== lead.pk);
                      if (prev.length >= MAX_REENVIO_DESTINOS) {
                        message.warning(`Puedes seleccionar hasta ${MAX_REENVIO_DESTINOS} destinos`);
                        return prev;
                      }
                      return [...prev, lead.pk];
                    });
                  }}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                    checked
                      ? 'border-[var(--action-border)] bg-[var(--action-soft-hover)]'
                      : 'border-[var(--app-border)] bg-[var(--panel-bg)] hover:border-[var(--action-border)]'
                  }`}
                >
                  <Checkbox checked={checked} />
                  <span className="min-w-0 flex-1">
                    <Text strong className="block truncate">{nombreContacto(lead)}</Text>
                    <Text type="secondary" className="block truncate text-xs">
                      {lead.external_contact_id} - {lead.account_alias || 'WhatsApp'}
                    </Text>
                  </span>
                  <Tag color="green" bordered={false} style={{ background: 'transparent' }}>WhatsApp</Tag>
                </button>
              );
            }) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Busca o selecciona un chat destino" />
            )}
          </div>
          <Text type="secondary" className="text-xs">
            Maximo {MAX_REENVIO_MENSAJES} mensajes y {MAX_REENVIO_DESTINOS} destinos por operacion. Los stickers no se reenvian; PNG se envia como documento.
          </Text>
        </Space>
      </Modal>

      <Modal
        title="Registrar cliente o bloqueo desde Meta"
        open={convertOpen}
        onCancel={() => setConvertOpen(false)}
        onOk={guardarConversion}
        okText="Registrar"
        confirmLoading={savingConversion}
        width={720}
      >
        <Form form={convertForm} layout="vertical">
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item
              name="cedula"
              label="Cedula / Pasaporte"
              rules={clienteFormRules.cedula}
            >
              <Input placeholder="Ej: 00112345678" disabled={Boolean(selectedLead?.cliente_cedula)} />
            </Form.Item>
            <Form.Item
              name="proyecto_id"
              label="Proyecto"
              rules={[{ required: true, message: 'Selecciona un proyecto' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Seleccionar proyecto"
                onChange={cargarUnidadesProyecto}
                options={proyectos.map((proyecto) => ({
                  value: proyecto.proyecto_id,
                  label: proyecto.nombre,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="nombres"
              label="Nombres"
              normalize={clienteFieldNormalizers.nombre}
              rules={clienteFormRules.nombres}
            >
              <Input placeholder="Nombres del cliente" />
            </Form.Item>
            <Form.Item
              name="apellidos"
              label="Apellidos"
              normalize={clienteFieldNormalizers.nombre}
              rules={clienteFormRules.apellidos}
            >
              <Input placeholder="Apellidos del cliente" />
            </Form.Item>
            <Form.Item
              name="inmobiliaria_id"
              label="Inmobiliaria"
              rules={[{ required: true, message: 'Selecciona una inmobiliaria' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Seleccionar inmobiliaria"
                options={inmobiliarias.map((inmobiliaria) => ({
                  value: inmobiliaria.pk,
                  label: inmobiliaria.nombre,
                }))}
              />
            </Form.Item>
            <Form.Item name="unidad_id" label="Unidad de interes">
              <Select
                allowClear
                showSearch
                loading={loadingUnidades}
                optionFilterProp="label"
                placeholder="Opcional"
                options={unidades
                  .filter((unidad) => unidad.estado === 'disponible')
                  .map((unidad) => ({
                    value: unidad.unidad_id,
                    label: unidad.id_unidad || unidad.unidad_id,
                  }))}
              />
            </Form.Item>
            <Form.Item name="correo" label="Correo" normalize={clienteFieldNormalizers.correo} rules={clienteFormRules.correo}>
              <Input type="email" placeholder="correo@ejemplo.com" />
            </Form.Item>
            <Form.Item name="telefono" label="Telefono" rules={clienteFormRules.telefono}>
              <Input inputMode="numeric" placeholder="8490000000" />
            </Form.Item>
            <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="estado_civil" label="Estado civil">
              <EstadoCivilSelect />
            </Form.Item>
            <Form.Item name="nacionalidad" label="Nacionalidad">
              <NacionalidadSelect />
            </Form.Item>
            <Form.Item name="pais_residencia" label="Pais de residencia">
              <PaisResidenciaSelect />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
