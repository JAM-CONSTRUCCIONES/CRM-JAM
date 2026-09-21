import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { EditOutlined, FileOutlined, LinkOutlined, PaperClipOutlined, PictureOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import {
  convertirMetaLead,
  enviarMetaMensaje,
  getMetaMediaUploadUrl,
  subirArchivoAS3,
  renombrarMetaContacto,
  gestionarMetaLead,
  getMetaConversacion,
  listarMetaLeads,
  type MetaLead,
  type MetaMensaje,
} from '../../services/meta.service';
import { getInmobiliarias, type Inmobiliaria } from '../../services/inmobiliarias.service';
import { getProyectos, getUnidades } from '../../services/proyectos.service';
import { getUsuariosSistema, type UsuarioSistema } from '../../services/sistema.service';
import type { Proyecto, Unidad } from '../../types';

const { Paragraph, Text, Title } = Typography;
const { Search, TextArea } = Input;
const { useBreakpoint } = Grid;

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

const estadoColor: Record<string, string> = {
  nuevo: 'blue',
  en_seguimiento: 'gold',
  convertido: 'green',
  cerrado: 'default',
};

const mensajeEstadoColor: Record<string, string> = {
  enviado: 'green',
  delivered: 'cyan',
  read: 'blue',
  pendiente_configuracion: 'orange',
  fallido: 'red',
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
const JAM_WHATSAPP_WEBHOOK_URL = 'https://agfdz17sk6.execute-api.us-east-1.amazonaws.com/api/webhooks/whatsapp';
const JAM_META_INBOX_URL = 'https://d12nm0khvt8zd9.cloudfront.net/meta-inbox';

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

// Firma de la lista de mensajes: id + estado de cada uno. Permite detectar
// tanto mensajes nuevos como cambios de estado (sent/delivered/read).
const mensajesSignature = (mensajes: MetaMensaje[]) =>
  mensajes.map((m) => `${m.sk}:${m.message_status || ''}`).join('|');

// Nombre a mostrar del contacto: nombre editado por el agente > alias de perfil
// (WhatsApp/Meta) > numero/id. Asi los numeros de WhatsApp muestran algo util.
const nombreContacto = (lead: MetaLead) =>
  (lead.nombre_manual || '').trim()
  || (lead.contact_profile_name || '').trim()
  || (lead.contact_username ? `@${lead.contact_username}` : '')
  || lead.external_contact_id;

const getProyectoLabel = (proyectos: Proyecto[], proyectoId?: string) => (
  proyectos.find((proyecto) => proyecto.proyecto_id === proyectoId)?.nombre || proyectoId || '-'
);

const getInmobiliariaLabel = (inmobiliarias: Inmobiliaria[], inmobiliariaId?: string) => (
  inmobiliarias.find((item) => item.pk === inmobiliariaId || item.pk === `INMOBILIARIA#${inmobiliariaId}`)?.nombre
  || inmobiliariaId
  || '-'
);

export default function MetaInboxPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [mensajes, setMensajes] = useState<MetaMensaje[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [canal, setCanal] = useState<string>();
  const [busqueda, setBusqueda] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [hasMoreMensajes, setHasMoreMensajes] = useState(false);
  const [loadingMoreMensajes, setLoadingMoreMensajes] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editNombreOpen, setEditNombreOpen] = useState(false);
  const [nombreEditando, setNombreEditando] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const CONVERSATION_PAGE_SIZE = 50;
  const MAX_MEDIA_MB = 16;
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [savingConversion, setSavingConversion] = useState(false);
  const [sending, setSending] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();
  const mensajesPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Indica si el usuario esta cerca del fondo (para auto-scroll no intrusivo).
  const nearBottomRef = useRef(true);
  const prevSelectedPkRef = useRef<string | undefined>(undefined);
  const estadoGestion = Form.useWatch('estado', form);

  // Refs para el polling: evitan closures obsoletos y permiten
  // pausar el refresco automatico mientras el usuario esta trabajando.
  const selectedLeadRef = useRef<MetaLead | null>(null);
  const mensajesRef = useRef<MetaMensaje[]>([]);
  const convCycleRef = useRef(0);
  const busyRef = useRef(false);
  const LEADS_POLL_MS = 10000;
  const CONVERSATION_POLL_MS = 7000;
  // #4 Backoff: cuando la API falla, se saltan ciclos de forma progresiva
  // (1, 2, 4... hasta un tope) y se vuelve al ritmo normal al recuperarse.
  const MAX_BACKOFF_STEPS = 6;
  const leadsFailRef = useRef(0);
  const leadsSkipRef = useRef(0);
  const convFailRef = useRef(0);
  const convSkipRef = useRef(0);

  const conversaciones = useMemo(() => {
    const text = busqueda.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesCanal = !canal || lead.channel === canal;
      if (!matchesCanal) return false;
      if (!text) return true;
      return [
        lead.external_contact_id,
        lead.nombre_manual,
        lead.contact_profile_name,
        lead.ultimo_mensaje_texto,
        lead.responsable_nombre,
        lead.inmobiliaria_nombre,
        lead.account_alias,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [busqueda, canal, leads]);

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
    cargarLeads();
    cargarAsignables();
  }, []);

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

  // Actualiza la lista de leads sin spinner ni abrir conversacion.
  const refrescarLeadsSilencioso = async () => {
    try {
      const data = await listarMetaLeads();
      setLeads(data.items || []);
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
      const traidos = data.mensajes || [];
      if (data.incremental) {
        if (!traidos.length) return;
        // Append de los nuevos, evitando duplicados por sk.
        setMensajes((prev) => {
          const existentes = new Set(prev.map((m) => m.sk));
          const faltantes = traidos.filter((m) => !existentes.has(m.sk));
          return faltantes.length ? [...prev, ...faltantes] : prev;
        });
      } else {
        // Refresh de estado: fusiona la ultima pagina con el historial ya cargado
        // (que puede tener mensajes mas antiguos por "cargar anteriores").
        setMensajes((prev) => {
          const traidosSks = new Set(traidos.map((m) => m.sk));
          const anteriores = prev.filter((m) => !traidosSks.has(m.sk));
          const fusion = [...anteriores, ...traidos];
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
      const data = await listarMetaLeads();
      setLeads(data.items || []);
      if (!selectedLead && data.items?.length) {
        await abrirConversacion(data.items[0], false);
      }
    } catch (error: any) {
      message.error(error?.message || 'No se pudieron cargar las conversaciones Meta');
    } finally {
      setLoadingLeads(false);
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
  const cargarMensajesAnteriores = async () => {
    const lead = selectedLeadRef.current;
    if (!lead || loadingMoreMensajes) return;
    const oldest = mensajes[0]?.sk;
    if (!oldest) return;
    setLoadingMoreMensajes(true);
    try {
      const data = await getMetaConversacion(lead.pk, {
        limit: CONVERSATION_PAGE_SIZE,
        before: oldest,
      });
      const previos = data.mensajes || [];
      if (previos.length) {
        // Prepend evitando duplicados por sk.
        setMensajes((prev) => {
          const existentes = new Set(prev.map((m) => m.sk));
          const nuevos = previos.filter((m) => !existentes.has(m.sk));
          return [...nuevos, ...prev];
        });
      }
      setHasMoreMensajes(Boolean(data.has_more));
    } catch (error: any) {
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
    // UI optimista: mostramos el mensaje al instante y limpiamos el input,
    // sin recargar todo el chat ni bloquear con spinner.
    const tempSk = `MENSAJE#pending#${Date.now()}`;
    const optimista = {
      pk: lead.pk,
      sk: tempSk,
      tipo: 'META_MENSAJE',
      channel: lead.channel,
      texto,
      direction: 'outgoing',
      message_status: 'enviando',
      creado_en: new Date().toISOString(),
    } as unknown as MetaMensaje;
    setMensajes((prev) => [...prev, optimista]);
    setRespuesta('');
    setSending(true);
    try {
      const result = await enviarMetaMensaje(lead.pk, { texto });
      // Reemplazamos la burbuja temporal por el mensaje real devuelto.
      setMensajes((prev) => {
        const sinTemp = prev.filter((m) => m.sk !== tempSk);
        if (result.item && !sinTemp.some((m) => m.sk === result.item!.sk)) {
          return [...sinTemp, result.item as MetaMensaje];
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

  // Envia un archivo (imagen/video/documento/audio) por WhatsApp: lo sube a S3
  // y luego manda el mensaje con la URL publica para que Meta lo descargue.
  const adjuntarArchivo = async (file: File) => {
    if (!selectedLead) return;
    if (file.size > MAX_MEDIA_MB * 1024 * 1024) {
      message.error(`El archivo supera el limite de ${MAX_MEDIA_MB} MB.`);
      return;
    }
    const lead = selectedLead;
    const caption = respuesta.trim();
    setSubiendoArchivo(true);
    try {
      const upload = await getMetaMediaUploadUrl(file.type || 'application/octet-stream', file.name);
      await subirArchivoAS3(upload.upload_url, file);
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
        event_type: upload.media_type,
        media: {
          type: upload.media_type,
          mime_type: upload.content_type,
          filename: file.name,
          caption,
          public_url: upload.public_url,
          storage_status: 'stored',
        },
        creado_en: new Date().toISOString(),
      } as unknown as MetaMensaje;
      setMensajes((prev) => [...prev, optimista]);
      setRespuesta('');
      const result = await enviarMetaMensaje(lead.pk, {
        texto: caption,
        media_type: upload.media_type,
        media_url: upload.public_url,
        content_type: upload.content_type,
        filename: file.name,
      });
      setMensajes((prev) => {
        const sinTemp = prev.filter((m) => m.sk !== tempSk);
        if (result.item && !sinTemp.some((m) => m.sk === result.item!.sk)) {
          return [...sinTemp, result.item as MetaMensaje];
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
    convertForm.setFieldsValue({
      inmobiliaria_id: selectedLead.inmobiliaria_id,
      telefono: selectedLead.channel === 'whatsapp' ? selectedLead.external_contact_id : '',
    });
    setUnidades([]);
    setConvertOpen(true);
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
      setSavingConversion(true);
      const result = await convertirMetaLead(selectedLead.pk, {
        ...values,
        inmobiliaria_id: String(values.inmobiliaria_id || '').replace('INMOBILIARIA#', ''),
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
    <div className="flex h-[calc(100vh-112px)] flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Title level={2} className="!mb-1">Inbox Meta</Title>
          <Text type="secondary">Responde conversaciones de Instagram, Messenger y WhatsApp desde una sola bandeja.</Text>
        </div>
        <Space wrap>
          {!whatsappConectado && (
            <Button icon={<LinkOutlined />} href={whatsappOnboardingUrl} target="_blank" rel="noreferrer">
              Conectar WhatsApp
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={cargarLeads} loading={loadingLeads}>
            Actualizar
          </Button>
        </Space>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <Card ref={mensajesPanelRef} className="min-h-0 overflow-hidden" bodyStyle={{ height: '100%', padding: 0 }}>
          <div className="border-b border-[var(--app-border)] p-3">
            <Space direction="vertical" className="w-full">
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
          <div className="h-[calc(100%-112px)] overflow-y-auto">
            {loadingLeads && !conversaciones.length ? (
              <div className="grid h-full place-items-center">
                <Spin />
              </div>
            ) : conversaciones.length ? (
              conversaciones.map((lead) => {
                const active = selectedLead?.pk === lead.pk;
                const pending = toNumber(lead.mensajes_recibidos) > toNumber(lead.mensajes_enviados);
                return (
                  <button
                    key={lead.pk}
                    type="button"
                    onClick={() => abrirConversacion(lead)}
                    className={`block w-full border-b border-[var(--app-border)] px-3 py-3 text-left transition hover:bg-[var(--panel-soft-bg)] ${
                      active ? 'bg-[var(--action-soft-hover)]' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Text strong className="block max-w-[200px] truncate">{nombreContacto(lead)}</Text>
                        <Text type="secondary" className="block max-w-[200px] truncate text-xs">
                          {lead.account_alias || canalLabel[lead.channel] || 'Meta'}
                        </Text>
                      </div>
                      {pending && <Tag color="orange">Nuevo</Tag>}
                    </div>
                    <Paragraph ellipsis={{ rows: 2 }} className="!mb-1 !mt-2 text-sm">
                      {lead.ultimo_mensaje_texto || 'Sin mensaje de texto'}
                    </Paragraph>
                    <div className="flex items-center justify-between gap-2">
                      <Tag color={canalColor[lead.channel] || 'default'}>{canalLabel[lead.channel] || lead.channel}</Tag>
                      <Text type="secondary" className="text-xs">{formatDate(lead.ultimo_mensaje_en)}</Text>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="grid h-full place-items-center p-4">
                <Empty description="Sin conversaciones" />
              </div>
            )}
          </div>
        </Card>

        <Card className="min-h-0 overflow-hidden" bodyStyle={{ height: '100%', padding: 0 }}>
          {selectedLead ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--app-border)] px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <Space wrap align="center">
                    <div>
                      <Space align="center" size={6}>
                        <Title level={4} className="!mb-0">{nombreContacto(selectedLead)}</Title>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={abrirEditorNombre}
                          title="Editar nombre del contacto"
                        />
                      </Space>
                      {nombreContacto(selectedLead) !== selectedLead.external_contact_id && (
                        <Text type="secondary" className="block text-xs">{selectedLead.external_contact_id}</Text>
                      )}
                    </div>
                    <Tag color={canalColor[selectedLead.channel] || 'default'}>
                      {canalLabel[selectedLead.channel] || selectedLead.channel}
                    </Tag>
                    <Tag color={estadoColor[selectedLead.estado || 'nuevo'] || 'default'}>
                      {selectedLead.estado || 'nuevo'}
                    </Tag>
                  </Space>
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => abrirConversacion(selectedLead)} loading={loadingConversation}>
                    Recargar
                  </Button>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                onScroll={onMensajesScroll}
                className="min-h-0 flex-1 overflow-y-auto bg-[var(--panel-soft-bg)] p-4"
              >
                {loadingConversation ? (
                  <div className="grid h-full place-items-center">
                    <Spin />
                  </div>
                ) : mensajes.length ? (
                  <div className="space-y-3">
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
                    {mensajes.map((mensaje) => {
                      const incoming = mensaje.direction === 'incoming';
                      const attachments = attachmentsOf(mensaje);
                      return (
                        <div key={`${mensaje.pk}-${mensaje.sk}`} className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[82%] rounded-md border px-3 py-2 shadow-sm ${
                            incoming
                              ? 'border-[var(--app-border)] bg-[var(--panel-bg)]'
                              : 'border-[var(--action-border)] bg-[var(--action-soft-hover)]'
                          }`}>
                            {(mensaje.text || attachments.length === 0) && (
                              <Paragraph className="!mb-1 whitespace-pre-wrap">
                                {mensaje.text || 'Evento sin texto'}
                              </Paragraph>
                            )}
                            {attachments.length > 0 && (
                              <div className="mb-2 space-y-1">
                                {attachments.map((attachment, index) => {
                                  const type = attachment.type || 'archivo';
                                  const icon = type === 'image' || type === 'sticker' ? <PictureOutlined /> : <FileOutlined />;
                                  const label = attachment.filename || attachment.title || attachment.caption || type;
                                  const href = attachment.public_url || attachment.url;
                                  return (
                                    <div key={`${type}-${index}`} className="rounded-md border border-[var(--app-border)] bg-[var(--panel-bg)] px-2 py-1 text-sm">
                                      <Space size={6} wrap>
                                        {icon}
                                        <Text>{label}</Text>
                                        {href && (
                                          <a href={href} target="_blank" rel="noreferrer">
                                            <LinkOutlined /> Abrir
                                          </a>
                                        )}
                                        {attachment.mime_type && <Text type="secondary" className="text-xs">{attachment.mime_type}</Text>}
                                        {attachment.storage_status && <Tag>{attachment.storage_status}</Tag>}
                                      </Space>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <Space size={6} wrap>
                              <Text type="secondary" className="text-xs">{formatDate(mensaje.event_timestamp)}</Text>
                              <Text type="secondary" className="text-xs">{incoming ? 'recibido' : 'enviado'}</Text>
                              {!incoming && mensaje.message_status && (
                                <Tag color={mensajeEstadoColor[mensaje.message_status] || 'orange'}>
                                  {mensaje.message_status}
                                </Tag>
                              )}
                            </Space>
                            {(mensaje.meta_error || mensaje.error_message) && (
                              <Paragraph type="secondary" className="!mb-0 !mt-1 text-xs">
                                {mensaje.meta_error || mensaje.error_message}
                              </Paragraph>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="grid h-full place-items-center">
                    <Empty description="Sin mensajes" />
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--app-border)] bg-[var(--panel-bg)] p-3">
                <Space direction="vertical" className="w-full">
                  <TextArea
                    rows={isMobile ? 3 : 4}
                    maxLength={4000}
                    showCount
                    value={respuesta}
                    onChange={(event) => setRespuesta(event.target.value)}
                    placeholder={`Responder por ${canalLabel[selectedLead.channel] || 'Meta'}`}
                    onPressEnter={(event) => {
                      if (!event.shiftKey) {
                        event.preventDefault();
                        enviarRespuesta();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Text type="secondary" className="text-xs">Enter envia. Shift + Enter agrega linea.</Text>
                    <Space>
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
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Adjuntar
                      </Button>
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={sending}
                        disabled={!respuesta.trim()}
                        onClick={enviarRespuesta}
                      >
                        Enviar mensaje
                      </Button>
                    </Space>
                  </div>
                </Space>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center">
              <Empty description="Selecciona una conversacion" />
            </div>
          )}
        </Card>

        <Card
          className="flex min-h-0 flex-col overflow-hidden"
          title="Lead"
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
                <Button block onClick={abrirConversion}>
                  Registrar cliente o bloqueo
                </Button>
              )}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Text strong>Oportunidades registradas</Text>
                  <Tag>{selectedLead.historial_conversiones?.length || 0}</Tag>
                </div>
                {selectedLead.historial_conversiones?.length ? (
                  <div className="space-y-2">
                    {selectedLead.historial_conversiones.map((item, index) => (
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
              rules={[{ required: true, message: 'Ingresa cedula o pasaporte' }]}
            >
              <Input placeholder="Ej: 00112345678" />
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
              rules={[{ required: true, message: 'Ingresa nombres' }]}
            >
              <Input placeholder="Nombres del cliente" />
            </Form.Item>
            <Form.Item
              name="apellidos"
              label="Apellidos"
              rules={[{ required: true, message: 'Ingresa apellidos' }]}
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
            <Form.Item name="correo" label="Correo">
              <Input type="email" placeholder="correo@ejemplo.com" />
            </Form.Item>
            <Form.Item name="telefono" label="Telefono">
              <Input inputMode="numeric" placeholder="8490000000" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
