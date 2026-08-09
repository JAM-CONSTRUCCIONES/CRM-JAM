import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BotMessageSquare, ChevronLeft, ChevronRight, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthContext } from '../../context/AuthContext';

const API_URL = 'https://253hubrxvpidhtqh43bn2m2gzy0fwqla.lambda-url.us-east-1.on.aws/';
const LOGO_URL = '/Jam-Construcciones.png';
const ENGINEER_URL = '/injamfoto.png';

interface Message {
  role: 'user' | 'bot';
  content: string;
  time: string;
}

type Mode = 'faq' | 'chat';

const FAQ_SLIDES = [
  {
    title: 'CRM',
    kicker: 'Uso general',
    questions: [
      { icon: 'CRM', text: 'Que puede hacer el CRM de JAM Construcciones?' },
      { icon: 'MT', text: 'Quien creo el CRM de JAM Construcciones?' },
      { icon: 'USR', text: 'Que usuarios pueden usar el CRM?' },
    ],
  },
  {
    title: 'Operaciones',
    kicker: 'Inventario y bloqueos',
    questions: [
      { icon: 'BLQ', text: 'Como bloqueo una unidad disponible en el CRM?' },
      { icon: 'INV', text: 'Que informacion tiene una unidad dentro del inventario?' },
      { icon: '24H', text: 'Cuanto dura un bloqueo de unidad?' },
      { icon: 'ALR', text: 'Que pasa cuando un bloqueo vence?' },
    ],
  },
  {
    title: 'Clientes',
    kicker: 'Captacion y proceso',
    questions: [
      { icon: 'CLI', text: 'Como registro un cliente nuevo en el CRM?' },
      { icon: 'EST', text: 'Cuales son los estados del proceso de venta?' },
      { icon: 'EXC', text: 'Que es la exclusividad de cliente por proyecto?' },
    ],
  },
  {
    title: 'Administracion',
    kicker: 'Usuarios y metricas',
    questions: [
      { icon: 'INM', text: 'Como creo una inmobiliaria en el CRM?' },
      { icon: 'ADM', text: 'Como creo un usuario en el CRM?' },
      { icon: 'KPI', text: 'Que metricas muestra el dashboard del CRM?' },
    ],
  },
];

function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const ChatbotWidget = ({ onClose }: { onClose?: () => void }) => {
  const { usuario } = useAuthContext();
  const location = useLocation();

  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>('faq');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback((delay = 60) => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, delay);
  }, []);

  useEffect(() => {
    if (open && mode === 'chat') scrollBottom();
  }, [messages, open, mode, scrollBottom]);

  const goToSlide = (index: number) => {
    const clamped = Math.max(0, Math.min(index, FAQ_SLIDES.length - 1));
    setSlide(clamped);
    if (sliderRef.current) {
      const slideWidth = sliderRef.current.clientWidth + 16;
      sliderRef.current.scrollTo({ left: clamped * slideWidth, behavior: 'smooth' });
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setMode('chat');
    const userMsg: Message = { role: 'user', content: text.trim(), time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollBottom(40);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          channel: 'crm',
          user_role: usuario?.rol ?? 'crm_user',
          user_name: usuario?.nombre ?? 'Usuario',
          user_email: (usuario as any)?.username ?? '',
          context: location.pathname,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      if (data.body && typeof data.body === 'string') {
        try { data = JSON.parse(data.body); } catch { /* ok */ }
      }
      const answer = data.answer || data.message || 'No pude obtener respuesta en este momento.';
      setMessages(prev => [...prev, { role: 'bot', content: answer, time: nowTime() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: 'No pude conectarme ahora mismo. Verifica la conexion o intenta nuevamente.',
        time: nowTime(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [loading, usuario, location.pathname, scrollBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 104)}px`;
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;

  return (
    <>
      <div className="jam-ai-overlay" onClick={handleClose} />
      <section className="jam-ai-window">
        <header className="jam-ai-header">
          <div className="jam-ai-brand">
            <div className="jam-ai-portrait">
              <img src={ENGINEER_URL} alt="Asistente JAM" />
              <span className="jam-ai-live" />
            </div>
            <div className="min-w-0">
              <div className="jam-ai-name">
                <img src={LOGO_URL} alt="JAM" />
                JAM Asistente
              </div>
              <div className="jam-ai-status">
                <span />
                En linea para CRM e inventario
              </div>
            </div>
          </div>

          <div className="jam-ai-actions">
            <div className="jam-ai-segment">
              <button className={cn(mode === 'faq' && 'active')} onClick={() => setMode('faq')}>FAQ</button>
              <button className={cn(mode === 'chat' && 'active')} onClick={() => setMode('chat')}>Chat</button>
            </div>
            <Button variant="ghost" size="icon" className="jam-ai-close" onClick={handleClose} aria-label="Cerrar">
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <main className="jam-ai-body">
          <div ref={scrollRef} className="jam-ai-scroll">
            {mode === 'faq' ? (
              <section className="jam-ai-view">
                <div className="jam-ai-hero">
                  <div>
                    <h2>Preguntas frecuentes</h2>
                    <p>Selecciona una pregunta para consultar al asistente.</p>
                  </div>
                  <img src={ENGINEER_URL} alt="Asistente JAM" />
                </div>

                <div className="jam-ai-tabs">
                  {FAQ_SLIDES.map((item, index) => (
                    <button key={item.title} className={cn(slide === index && 'active')} onClick={() => goToSlide(index)}>
                      {item.title}
                    </button>
                  ))}
                </div>

                <div className="jam-ai-slider" ref={sliderRef} onScroll={() => {
                  if (!sliderRef.current) return;
                  const sw = sliderRef.current.clientWidth + 16;
                  const idx = Math.round(sliderRef.current.scrollLeft / sw);
                  if (idx !== slide) setSlide(idx);
                }}>
                  {FAQ_SLIDES.map(item => (
                    <article key={item.title} className="jam-ai-slide">
                      <div className="jam-ai-slide-head">
                        <div>
                          <div className="jam-ai-slide-kicker">{item.kicker}</div>
                          <div className="jam-ai-slide-title">{item.title}</div>
                        </div>
                        <span>{item.questions.length} preguntas</span>
                      </div>
                      <div className="jam-ai-question-list">
                        {item.questions.map(question => (
                          <button key={question.text} className="jam-ai-question" onClick={() => sendMessage(question.text)}>
                            <span className="jam-ai-question-code">{question.icon}</span>
                            <span>{question.text}</span>
                            <ChevronRight className="size-4" />
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="jam-ai-slider-footer">
                  <div className="jam-ai-dots">
                    {FAQ_SLIDES.map((item, index) => (
                      <span key={item.title} className={cn(slide === index && 'active')} />
                    ))}
                  </div>
                  <div className="jam-ai-stepper">
                    <Button variant="outline" size="icon" onClick={() => goToSlide(slide - 1)} aria-label="Anterior">
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => goToSlide(slide + 1)} aria-label="Siguiente">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="jam-ai-view">
                <div className="jam-ai-day">Hoy</div>
                <MessageBubble role="bot" time={nowTime()}>
                  Hola, soy el asistente virtual de JAM Construcciones. Puedo ayudarte con bloqueos, inventario, clientes, estados de venta y uso del CRM.
                </MessageBubble>
                {messages.map((msg, index) => (
                  <MessageBubble key={`${msg.time}-${index}`} role={msg.role} time={msg.time}>
                    {msg.content}
                  </MessageBubble>
                ))}
                {loading && (
                  <div className="jam-ai-typing">
                    <AvatarMini />
                    <div className="jam-ai-typing-bubble">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>

        <footer className="jam-ai-footer">
          <div className="jam-ai-input-wrap">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={loading}
              maxLength={1500}
              placeholder="Escribe tu pregunta aqui..."
            />
            <Button
              size="icon"
              className="jam-ai-send"
              disabled={!input.trim() || loading}
              onClick={() => sendMessage(input)}
              aria-label="Enviar mensaje"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <div className="jam-ai-footnote">
            <BotMessageSquare className="size-3.5" />
            JAM Construcciones · CRM Inmobiliario
          </div>
        </footer>
      </section>
      <style>{CSS}</style>
    </>
  );
};

const AvatarMini = () => (
  <div className="jam-ai-avatar-mini">
    <img src={ENGINEER_URL} alt="Asistente" />
  </div>
);

const MessageBubble = ({ role, time, children }: { role: Message['role']; time: string; children: React.ReactNode }) => (
  <div className={cn('jam-ai-message', role)}>
    {role === 'bot' && <AvatarMini />}
    <div className="jam-ai-bubble">
      {children}
      <span>{time}</span>
    </div>
  </div>
);

const CSS = `
.jam-ai-overlay{position:fixed;inset:0;background:rgba(15,23,42,.34);backdrop-filter:blur(2px);z-index:9998;animation:jamAiFade .18s ease both;}
.jam-ai-window{position:fixed;top:50%;left:50%;z-index:9999;display:flex;height:820px;max-height:calc(100vh - 28px);width:680px;max-width:calc(100vw - 18px);transform:translate(-50%,-50%);flex-direction:column;overflow:hidden;border:1px solid var(--border);border-radius:18px;background:var(--card);color:var(--card-foreground);box-shadow:0 24px 70px rgba(15,23,42,.28);animation:jamAiOpen .22s cubic-bezier(.34,1.15,.64,1) both;font-family:system-ui,'Segoe UI',Roboto,sans-serif;}
.jam-ai-header{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,var(--card),var(--background));padding:14px 16px;}
.jam-ai-brand{display:flex;min-width:0;align-items:center;gap:12px;}
.jam-ai-portrait{position:relative;display:grid;height:58px;width:58px;flex-shrink:0;place-items:center;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--muted);}
.jam-ai-portrait img{height:100%;width:100%;object-fit:cover;object-position:center 22%;}
.jam-ai-live{position:absolute;right:5px;bottom:5px;height:11px;width:11px;border:2px solid var(--card);border-radius:999px;background:#22c55e;}
.jam-ai-name{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;line-height:1.1;color:var(--foreground);}
.jam-ai-name img{height:22px;width:22px;object-fit:contain;}
.jam-ai-status{margin-top:5px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted-foreground);}
.jam-ai-status span{height:7px;width:7px;border-radius:999px;background:#22c55e;}
.jam-ai-actions{display:flex;align-items:center;gap:8px;}
.jam-ai-segment{display:flex;gap:2px;border:1px solid var(--border);border-radius:9px;background:var(--muted);padding:3px;}
.jam-ai-segment button{height:30px;border:0;border-radius:7px;background:transparent;color:var(--muted-foreground);cursor:pointer;padding:0 12px;font:inherit;font-size:12px;font-weight:700;}
.jam-ai-segment button.active{background:var(--card);color:var(--foreground);box-shadow:0 1px 3px rgba(15,23,42,.10);}
.jam-ai-close{height:36px;width:36px;}
.jam-ai-body{min-height:0;flex:1;background:var(--background);}
.jam-ai-scroll{height:100%;overflow-y:auto;scroll-behavior:smooth;}
.jam-ai-scroll::-webkit-scrollbar{width:7px;}
.jam-ai-scroll::-webkit-scrollbar-thumb{border-radius:999px;background:var(--border);}
.jam-ai-view{padding:16px;}
.jam-ai-hero{display:grid;grid-template-columns:1fr 132px;align-items:end;gap:16px;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:linear-gradient(135deg,var(--card) 0%,var(--accent) 100%);padding:16px 16px 0;box-shadow:0 10px 28px rgba(15,23,42,.08);}
.jam-ai-eyebrow{display:flex;width:max-content;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;background:var(--card);padding:5px 9px;color:var(--primary);font-size:11px;font-weight:800;}
.jam-ai-hero h2{margin:0 0 6px;color:var(--foreground);font-size:21px;line-height:1.15;font-weight:800;letter-spacing:0;}
.jam-ai-hero p{margin:0 0 16px;color:var(--muted-foreground);font-size:13px;line-height:1.5;}
.jam-ai-hero img{align-self:end;max-height:158px;width:132px;object-fit:cover;object-position:center top;}
.jam-ai-tabs{display:flex;gap:8px;overflow-x:auto;padding:14px 0 10px;scrollbar-width:none;}
.jam-ai-tabs::-webkit-scrollbar{display:none;}
.jam-ai-tabs button{flex-shrink:0;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--muted-foreground);cursor:pointer;padding:7px 12px;font:inherit;font-size:12px;font-weight:800;}
.jam-ai-tabs button.active{border-color:var(--primary);background:var(--primary);color:var(--primary-foreground);}
.jam-ai-slider{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;}
.jam-ai-slider::-webkit-scrollbar{display:none;}
.jam-ai-slide{min-width:100%;scroll-snap-align:start;border:1px solid var(--border);border-radius:16px;background:var(--card);padding:14px;}
.jam-ai-slide-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;}
.jam-ai-slide-kicker{font-size:11px;font-weight:700;color:var(--muted-foreground);}
.jam-ai-slide-title{margin-top:2px;font-size:17px;font-weight:800;color:var(--foreground);}
.jam-ai-slide-head span{border-radius:999px;background:var(--muted);padding:4px 8px;color:var(--muted-foreground);font-size:11px;font-weight:700;}
.jam-ai-question-list{display:grid;gap:9px;}
.jam-ai-question{display:grid;grid-template-columns:44px 1fr 18px;align-items:center;gap:11px;width:100%;border:1px solid var(--border);border-radius:12px;background:var(--background);padding:10px 12px;text-align:left;color:var(--foreground);cursor:pointer;font:inherit;font-size:13px;font-weight:650;transition:background .16s,border-color .16s,transform .16s;}
.jam-ai-question:hover{border-color:var(--primary);background:var(--accent);transform:translateY(-1px);}
.jam-ai-question-code{display:grid;height:34px;width:40px;place-items:center;border-radius:9px;background:var(--card);color:var(--primary);font-size:10px;font-weight:900;}
.jam-ai-slider-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;}
.jam-ai-dots{display:flex;align-items:center;gap:5px;}
.jam-ai-dots span{height:6px;width:6px;border-radius:999px;background:var(--border);transition:all .16s;}
.jam-ai-dots span.active{width:22px;background:var(--primary);}
.jam-ai-stepper{display:flex;gap:7px;}
.jam-ai-stepper button{height:34px;width:34px;}
.jam-ai-day{position:relative;margin:3px 0 16px;text-align:center;color:var(--muted-foreground);font-size:11px;font-weight:800;text-transform:uppercase;}
.jam-ai-day:before,.jam-ai-day:after{content:"";position:absolute;top:50%;height:1px;width:38%;background:var(--border);}
.jam-ai-day:before{left:0;}
.jam-ai-day:after{right:0;}
.jam-ai-message{display:flex;align-items:flex-end;gap:9px;margin-bottom:11px;}
.jam-ai-message.user{justify-content:flex-end;}
.jam-ai-avatar-mini{height:36px;width:36px;flex-shrink:0;overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--muted);}
.jam-ai-avatar-mini img{height:100%;width:100%;object-fit:cover;object-position:center 20%;}
.jam-ai-bubble{max-width:80%;white-space:pre-wrap;word-break:break-word;border-radius:16px;padding:11px 13px;font-size:14px;line-height:1.55;}
.jam-ai-message.bot .jam-ai-bubble{border:1px solid var(--border);border-bottom-left-radius:5px;background:var(--card);color:var(--foreground);}
.jam-ai-message.user .jam-ai-bubble{border-bottom-right-radius:5px;background:var(--primary);color:var(--primary-foreground);}
.jam-ai-bubble span{display:block;margin-top:6px;font-size:10px;font-weight:700;opacity:.55;}
.jam-ai-message.user .jam-ai-bubble span{text-align:right;}
.jam-ai-typing{display:flex;align-items:flex-end;gap:9px;margin-bottom:11px;}
.jam-ai-typing-bubble{display:flex;gap:4px;border:1px solid var(--border);border-radius:16px 16px 16px 5px;background:var(--card);padding:13px 15px;}
.jam-ai-typing-bubble span{height:6px;width:6px;border-radius:999px;background:var(--muted-foreground);animation:jamAiBounce 1.2s infinite ease-in-out;}
.jam-ai-typing-bubble span:nth-child(2){animation-delay:.15s;}
.jam-ai-typing-bubble span:nth-child(3){animation-delay:.30s;}
.jam-ai-footer{border-top:1px solid var(--border);background:var(--card);padding:12px;}
.jam-ai-input-wrap{display:flex;align-items:flex-end;gap:8px;border:1px solid var(--input);border-radius:14px;background:var(--background);padding:7px 7px 7px 13px;transition:border-color .16s,box-shadow .16s;}
.jam-ai-input-wrap:focus-within{border-color:var(--ring);box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 18%,transparent);}
.jam-ai-input-wrap textarea{min-height:38px;max-height:104px;flex:1;resize:none;border:0;background:transparent;padding:9px 0;color:var(--foreground);outline:none;font:inherit;font-size:14px;line-height:1.45;}
.jam-ai-input-wrap textarea::placeholder{color:var(--muted-foreground);}
.jam-ai-send{height:42px;width:42px;flex-shrink:0;}
.jam-ai-footnote{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;color:var(--muted-foreground);font-size:11px;font-weight:700;}
@keyframes jamAiFade{from{opacity:0}to{opacity:1}}
@keyframes jamAiOpen{from{opacity:0;transform:translate(-50%,-48%) scale(.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes jamAiBounce{0%,70%,100%{opacity:.35;transform:translateY(0)}35%{opacity:1;transform:translateY(-4px)}}
@media(max-width:620px){
  .jam-ai-window{height:calc(100vh - 20px);width:calc(100vw - 14px);border-radius:16px;}
  .jam-ai-header{align-items:flex-start;flex-direction:column;}
  .jam-ai-actions{width:100%;justify-content:space-between;}
  .jam-ai-hero{grid-template-columns:1fr 92px;}
  .jam-ai-hero img{max-height:132px;width:92px;}
  .jam-ai-bubble{max-width:86%;}
}
`;

export default ChatbotWidget;
