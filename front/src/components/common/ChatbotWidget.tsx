import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';

const API_URL = 'https://253hubrxvpidhtqh43bn2m2gzy0fwqla.lambda-url.us-east-1.on.aws/';
const LOGO_URL = 'https://methodicatechnologybucketgeneral.s3.us-east-1.amazonaws.com/Jam-Construcciones.png';
const ENGINEER_URL = 'https://methodicatechnologybucketgeneral.s3.us-east-1.amazonaws.com/injamfoto.png';

interface Message {
  role: 'user' | 'bot';
  content: string;
  time: string;
}

type Mode = 'faq' | 'chat';

const FAQ_SLIDES = [
  {
    title: '📌 CRM', questions: [
      { icon: '📦', text: '¿Qué puede hacer el CRM de JAM Construcciones?' },
      { icon: '⚙️', text: '¿Quién creó el CRM de JAM Construcciones?' },
      { icon: '👥', text: '¿Qué usuarios pueden usar el CRM?' },
    ],
  },
  {
    title: '🔒 Operaciones', questions: [
      { icon: '🔒', text: '¿Cómo bloqueo una unidad disponible en el CRM?' },
      { icon: '🏠', text: '¿Qué información tiene una unidad dentro del inventario?' },
      { icon: '⏱️', text: '¿Cuánto dura un bloqueo de unidad?' },
      { icon: '⚠️', text: '¿Qué pasa cuando un bloqueo vence?' },
    ],
  },
  {
    title: '👤 Clientes', questions: [
      { icon: '👤', text: '¿Cómo registro un cliente nuevo en el CRM?' },
      { icon: '📋', text: '¿Cuáles son los estados del proceso de venta?' },
      { icon: '🏷️', text: '¿Qué es la exclusividad de cliente por proyecto?' },
    ],
  },
  {
    title: '📊 Administración', questions: [
      { icon: '🏬', text: '¿Cómo creo una inmobiliaria en el CRM?' },
      { icon: '🧑‍💻', text: '¿Cómo creo un usuario en el CRM?' },
      { icon: '📊', text: '¿Qué métricas muestra el dashboard del CRM?' },
    ],
  },
];

function nowTime() {
  const d = new Date();
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

const ChatbotWidget = ({ onClose }: { onClose?: () => void }) => {
  const { usuario } = useAuthContext();
  const location = useLocation();

  const [open, setOpen] = useState(true); // Abierto por defecto cuando se usa desde sidebar
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
      const slideWidth = sliderRef.current.clientWidth + 14;
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
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let data = await res.json();
      if (data.body && typeof data.body === 'string') {
        try { data = JSON.parse(data.body); } catch { /* ok */ }
      }
      const answer = data.answer || data.message || 'No pude obtener respuesta en este momento.';
      setMessages(prev => [...prev, { role: 'bot', content: answer, time: nowTime() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: 'No pude conectarme ahora mismo. Verifica la conexión o intenta nuevamente.',
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
    e.target.style.height = Math.min(e.target.scrollHeight, 94) + 'px';
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const avatarFallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.jam-avatar-fallback')) {
      const fb = document.createElement('div');
      fb.className = 'jam-avatar-fallback';
      fb.textContent = '👷';
      parent.appendChild(fb);
    }
  };

  return (
    <>
      <style>{CSS}</style>

      {/* Overlay sutil */}
      {open && <div className="jam-overlay" onClick={handleClose} />}

      {open && (
        <section className="jam-window open">

          {/* ── Header compacto ── */}
          <header className="jam-header">
            <div className="jam-header-stripe" />
            <div className="jam-header-inner">
              <div className="jam-header-avatar">
                <img className="jam-img" src={ENGINEER_URL} alt="Asistente JAM" onError={avatarFallback} />
                <span className="jam-live-dot" />
              </div>
              <div className="jam-header-info">
                <div className="jam-header-name">
                  <img className="jam-header-logo" src={LOGO_URL} alt="JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  JAM Asistente
                </div>
                <div className="jam-header-status">
                  <span className="jam-status-dot" />
                  En línea · Responde al instante
                </div>
              </div>
              <div className="jam-header-actions">
                <button className={`jam-tab${mode === 'faq' ? ' active' : ''}`} onClick={() => setMode('faq')}>FAQ</button>
                <button className={`jam-tab${mode === 'chat' ? ' active' : ''}`} onClick={() => setMode('chat')}>Chat</button>
                <button className="jam-close" aria-label="Cerrar" onClick={handleClose}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {/* ── Body ── */}
          <main className="jam-body">
            <div className="jam-scroll" ref={scrollRef}>

              {/* FAQ */}
              {mode === 'faq' && (
                <section className="jam-view">
                  <p className="jam-faq-intro">
                    Selecciona una categoría y toca una pregunta para consultarla con el asistente.
                  </p>
                  <div className="jam-faq-tabs">
                    {FAQ_SLIDES.map((s, i) => (
                      <button key={i} className={`jam-faq-tab${slide === i ? ' active' : ''}`} onClick={() => goToSlide(i)}>
                        {s.title}
                      </button>
                    ))}
                  </div>
                  <div className="jam-slider-wrap">
                    <div className="jam-faq-slider" ref={sliderRef} onScroll={() => {
                      if (!sliderRef.current) return;
                      const sw = sliderRef.current.clientWidth + 14;
                      const idx = Math.round(sliderRef.current.scrollLeft / sw);
                      if (idx !== slide) setSlide(idx);
                    }}>
                      {FAQ_SLIDES.map((s, si) => (
                        <article key={si} className="jam-slide">
                          <div className="jam-slide-head">
                            <span className="jam-slide-title">{s.title}</span>
                            <span className="jam-slide-count">{s.questions.length} preguntas</span>
                          </div>
                          <div className="jam-faq-list">
                            {s.questions.map((q, qi) => (
                              <button key={qi} className="jam-faq-card" onClick={() => sendMessage(q.text)}>
                                <span className="jam-faq-icon">{q.icon}</span>
                                <span className="jam-faq-text">{q.text}</span>
                                <svg className="jam-faq-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none">
                                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="jam-slider-controls">
                      <div className="jam-slider-dots">
                        {FAQ_SLIDES.map((_, i) => (
                          <span key={i} className={`jam-slider-dot${slide === i ? ' active' : ''}`} />
                        ))}
                      </div>
                      <div className="jam-slider-btns">
                        <button className="jam-slider-btn" aria-label="Anterior" onClick={() => goToSlide(slide - 1)}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button className="jam-slider-btn" aria-label="Siguiente" onClick={() => goToSlide(slide + 1)}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Chat */}
              {mode === 'chat' && (
                <section className="jam-view">
                  <div className="jam-day">Hoy</div>

                  {/* Bienvenida */}
                  <div className="jam-msg bot">
                    <div className="jam-avatar-mini">
                      <img className="jam-img" src={ENGINEER_URL} alt="Asistente" onError={avatarFallback} />
                    </div>
                    <div className="jam-bubble">
                      {'¡Hola! 👷 Soy el asistente virtual de JAM Construcciones.\nPuedo ayudarte con bloqueos, inventario, clientes, estados de venta y todo lo relacionado con el CRM. ¿En qué te puedo ayudar?'}
                      <span className="jam-time">{nowTime()}</span>
                    </div>
                  </div>

                  {messages.map((msg, i) => (
                    <div key={i} className={`jam-msg ${msg.role}`}>
                      {msg.role === 'bot' && (
                        <div className="jam-avatar-mini">
                          <img className="jam-img" src={ENGINEER_URL} alt="Asistente" onError={avatarFallback} />
                        </div>
                      )}
                      <div className="jam-bubble">
                        {msg.content}
                        <span className="jam-time">{msg.time}</span>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="jam-typing show">
                      <div className="jam-avatar-mini">
                        <img className="jam-img" src={ENGINEER_URL} alt="Asistente" onError={avatarFallback} />
                      </div>
                      <div className="jam-typing-bubble">
                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </main>

          {/* ── Footer ── */}
          <footer className="jam-footer">
            <div className="jam-input-row">
              <textarea
                ref={inputRef}
                className="jam-input"
                rows={1}
                placeholder="Escribe tu pregunta aquí..."
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={loading}
                maxLength={1500}
              />
              <button
                className="jam-send"
                aria-label="Enviar mensaje"
                disabled={!input.trim() || loading}
                onClick={() => sendMessage(input)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="jam-footer-brand">
              <img className="jam-footer-logo" src={LOGO_URL} alt="JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              JAM Construcciones · CRM Inmobiliario
            </div>
          </footer>

        </section>
      )}
    </>
  );
};

const CSS = `
.jam-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:9998;animation:jamFadeIn .2s ease;}
.jam-window{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:620px;max-width:calc(100vw - 16px);height:840px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:#fff;border:1px solid #e8edf3;box-shadow:0 24px 64px rgba(0,0,0,.18);z-index:9999;font-family:system-ui,'Segoe UI',Roboto,sans-serif;}
.jam-window.open{animation:jamOpenWindow .28s cubic-bezier(.34,1.28,.64,1) both;}
.jam-header{flex-shrink:0;background:#fff;border-bottom:1px solid #f0f0f0;}
.jam-header-stripe{height:3px;background:linear-gradient(90deg,#1677ff 0%,#4096ff 60%,#69b1ff 100%);}
.jam-header-inner{display:flex;align-items:center;gap:12px;padding:12px 14px 10px;}
.jam-header-avatar{position:relative;width:44px;height:44px;border-radius:50%;overflow:hidden;background:#f5f8fc;border:1.5px solid #e8edf3;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;}
.jam-header-avatar .jam-img{width:100%;height:100%;object-fit:cover;}
.jam-live-dot{position:absolute;right:1px;bottom:1px;width:11px;height:11px;border-radius:50%;background:#52c41a;border:2px solid #fff;}
.jam-header-info{flex:1;min-width:0;}
.jam-header-name{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;color:#111;white-space:nowrap;}
.jam-header-logo{width:20px;height:20px;border-radius:5px;object-fit:contain;border:1px solid #e8edf3;background:#fff;flex-shrink:0;}
.jam-header-status{display:flex;align-items:center;gap:5px;font-size:12px;color:#888;margin-top:2px;}
.jam-status-dot{width:7px;height:7px;border-radius:50%;background:#52c41a;flex-shrink:0;}
.jam-header-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.jam-tab{border:1px solid #e8edf3;background:#fafafa;color:#555;font-size:12px;font-weight:500;padding:5px 12px;border-radius:6px;cursor:pointer;transition:all .15s;font-family:inherit;}
.jam-tab:hover{border-color:#91caff;color:#1677ff;background:#f0f7ff;}
.jam-tab.active{background:#1677ff;color:#fff;border-color:#1677ff;}
.jam-close{width:30px;height:30px;border-radius:6px;border:1px solid #e8edf3;background:#fafafa;color:#888;display:grid;place-items:center;cursor:pointer;transition:all .15s;flex-shrink:0;}
.jam-close:hover{background:#fff1f0;color:#ff4d4f;border-color:#ffccc7;}
.jam-body{flex:1;overflow:hidden;background:#fff;display:flex;flex-direction:column;}
.jam-scroll{flex:1;overflow-y:auto;scroll-behavior:smooth;}
.jam-scroll::-webkit-scrollbar{width:4px}
.jam-scroll::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:999px}
.jam-view{padding:16px 14px 14px;}
.jam-faq-intro{color:#555;font-size:13.5px;line-height:1.55;background:#f5f8fc;border:1px solid #e8edf3;border-radius:10px;padding:11px 13px;margin-bottom:12px;}
.jam-faq-tabs{display:flex;gap:7px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none;}
.jam-faq-tabs::-webkit-scrollbar{display:none}
.jam-faq-tab{flex-shrink:0;border:1px solid #e8edf3;background:#fafafa;color:#555;font-size:12px;font-weight:500;padding:6px 12px;border-radius:6px;cursor:pointer;transition:all .15s;font-family:inherit;}
.jam-faq-tab:hover{border-color:#91caff;color:#1677ff;background:#f0f7ff;}
.jam-faq-tab.active{background:#1677ff;color:#fff;border-color:#1677ff;}
.jam-slider-wrap{position:relative;}
.jam-faq-slider{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:2px 2px 10px;scrollbar-width:none;}
.jam-faq-slider::-webkit-scrollbar{display:none}
.jam-slide{min-width:100%;scroll-snap-align:start;}
.jam-slide-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.jam-slide-title{font-size:15px;font-weight:700;color:#111;letter-spacing:-.02em;}
.jam-slide-count{color:#aaa;font-size:12px;font-weight:500;}
.jam-faq-list{display:flex;flex-direction:column;gap:9px;}
.jam-faq-card{width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:1px solid #e8edf3;border-radius:12px;background:#fff;padding:12px 14px;cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s;font-family:inherit;}
.jam-faq-card:hover{border-color:#91caff;box-shadow:0 4px 16px rgba(22,119,255,.10);background:#f0f7ff;}
.jam-faq-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;background:#f5f8fc;border:1px solid #e8edf3;font-size:17px;}
.jam-faq-text{flex:1;color:#222;font-size:13.5px;line-height:1.4;font-weight:500;}
.jam-faq-arrow{color:#bbb;flex-shrink:0;}
.jam-slider-controls{display:flex;align-items:center;justify-content:space-between;margin-top:6px;}
.jam-slider-btns{display:flex;gap:6px;}
.jam-slider-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e8edf3;background:#fff;color:#555;cursor:pointer;display:grid;place-items:center;transition:all .15s;}
.jam-slider-btn:hover{background:#1677ff;color:#fff;border-color:#1677ff;}
.jam-slider-dots{display:flex;align-items:center;gap:5px;}
.jam-slider-dot{width:6px;height:6px;border-radius:999px;background:#d0d7e2;transition:all .18s;}
.jam-slider-dot.active{width:18px;background:#1677ff;}
.jam-day{position:relative;text-align:center;color:#bbb;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:4px 0 14px;}
.jam-day::before,.jam-day::after{content:"";position:absolute;top:50%;width:34%;height:1px;background:#f0f0f0;}
.jam-day::before{left:0}
.jam-day::after{right:0}
.jam-msg{display:flex;align-items:flex-end;gap:9px;margin-bottom:10px;animation:jamMsgIn .2s ease both;}
.jam-msg.user{justify-content:flex-end}
.jam-avatar-mini{width:34px;height:34px;border-radius:50%;overflow:hidden;border:1.5px solid #e8edf3;background:#f5f8fc;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;}
.jam-avatar-mini .jam-img{width:100%;height:100%;object-fit:cover;}
.jam-avatar-fallback{font-size:inherit;}
.jam-bubble{max-width:80%;padding:11px 14px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;}
.jam-msg.bot .jam-bubble{color:#1a1a1a;background:#f5f7fa;border:1px solid #e8edf3;border-radius:16px 16px 16px 4px;}
.jam-msg.user .jam-bubble{color:#fff;background:#1677ff;border-radius:16px 16px 4px 16px;}
.jam-time{display:block;margin-top:5px;font-size:10.5px;font-weight:500;opacity:.55;}
.jam-msg.bot .jam-time{color:#666;}
.jam-msg.user .jam-time{color:rgba(255,255,255,.8);text-align:right;}
.jam-typing{display:none;align-items:flex-end;gap:9px;margin-bottom:10px;}
.jam-typing.show{display:flex;animation:jamMsgIn .2s ease both;}
.jam-typing-bubble{display:flex;gap:4px;align-items:center;padding:13px 16px;border-radius:16px 16px 16px 4px;background:#f5f7fa;border:1px solid #e8edf3;}
.typing-dot{width:6px;height:6px;border-radius:50%;background:#aaa;animation:jamBounce 1.2s infinite ease-in-out;}
.typing-dot:nth-child(2){animation-delay:.15s}
.typing-dot:nth-child(3){animation-delay:.30s}
.jam-footer{flex-shrink:0;background:#fff;border-top:1px solid #f0f0f0;padding:10px 12px 12px;}
.jam-input-row{display:flex;align-items:flex-end;gap:8px;padding:6px 6px 6px 14px;border:1.5px solid #d9d9d9;border-radius:14px;background:#fafafa;transition:border-color .2s,box-shadow .2s;}
.jam-input-row:focus-within{border-color:#1677ff;box-shadow:0 0 0 3px rgba(22,119,255,.10);background:#fff;}
.jam-input{flex:1;min-height:38px;max-height:90px;border:none;outline:none;background:transparent;resize:none;padding:9px 0;color:#222;font-size:14px;line-height:1.45;font-family:inherit;font-weight:400;}
.jam-input::placeholder{color:#bbb;}
.jam-send{width:42px;height:42px;border:none;border-radius:10px;display:grid;place-items:center;cursor:pointer;color:#fff;background:#1677ff;transition:background .18s,transform .18s,opacity .18s;flex-shrink:0;}
.jam-send:hover{background:#0958d9;transform:scale(1.06);}
.jam-send:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.jam-footer-brand{margin-top:8px;display:flex;align-items:center;justify-content:center;gap:7px;color:#bbb;font-size:11.5px;font-weight:500;}
.jam-footer-logo{width:20px;height:20px;border-radius:6px;overflow:hidden;background:#fff;border:1px solid #e8edf3;flex-shrink:0;}
.jam-footer-logo{width:20px;height:20px;object-fit:contain;display:block;}
:root[data-theme='dark'] .jam-window,
:root[data-theme='dark'] .jam-header,
:root[data-theme='dark'] .jam-body,
:root[data-theme='dark'] .jam-footer{background:var(--panel-bg);border-color:var(--app-border);}
:root[data-theme='dark'] .jam-header-name,
:root[data-theme='dark'] .jam-slide-title,
:root[data-theme='dark'] .jam-faq-text,
:root[data-theme='dark'] .jam-input,
:root[data-theme='dark'] .jam-msg.bot .jam-bubble{color:#f8fafc;}
:root[data-theme='dark'] .jam-header-status,
:root[data-theme='dark'] .jam-faq-intro,
:root[data-theme='dark'] .jam-slide-count,
:root[data-theme='dark'] .jam-footer-brand,
:root[data-theme='dark'] .jam-msg.bot .jam-time,
:root[data-theme='dark'] .jam-day{color:#cbd5e1;}
:root[data-theme='dark'] .jam-header-avatar,
:root[data-theme='dark'] .jam-header-logo,
:root[data-theme='dark'] .jam-tab,
:root[data-theme='dark'] .jam-close,
:root[data-theme='dark'] .jam-faq-intro,
:root[data-theme='dark'] .jam-faq-tab,
:root[data-theme='dark'] .jam-faq-icon,
:root[data-theme='dark'] .jam-faq-card,
:root[data-theme='dark'] .jam-slider-btn,
:root[data-theme='dark'] .jam-avatar-mini,
:root[data-theme='dark'] .jam-msg.bot .jam-bubble,
:root[data-theme='dark'] .jam-typing-bubble,
:root[data-theme='dark'] .jam-input-row,
:root[data-theme='dark'] .jam-footer-logo{background:var(--panel-soft-bg);border-color:var(--app-border);}
:root[data-theme='dark'] .jam-faq-card:hover,
:root[data-theme='dark'] .jam-tab:hover,
:root[data-theme='dark'] .jam-faq-tab:hover{background:var(--nav-hover-bg);}
:root[data-theme='dark'] .jam-tab,
:root[data-theme='dark'] .jam-faq-tab,
:root[data-theme='dark'] .jam-slider-btn,
:root[data-theme='dark'] .jam-close{color:#cbd5e1;}
:root[data-theme='dark'] .jam-tab.active,
:root[data-theme='dark'] .jam-faq-tab.active{background:#1677ff;color:#fff;border-color:#4096ff;}
:root[data-theme='dark'] .jam-faq-card:hover .jam-faq-text,
:root[data-theme='dark'] .jam-tab:hover,
:root[data-theme='dark'] .jam-faq-tab:hover,
:root[data-theme='dark'] .jam-slider-btn:hover{color:#f8fafc;}
:root[data-theme='dark'] .jam-input::placeholder{color:#94a3b8;}
:root[data-theme='dark'] .jam-faq-arrow{color:#94a3b8;}
:root[data-theme='dark'] .typing-dot{background:#cbd5e1;}
:root[data-theme='dark'] .jam-day::before,
:root[data-theme='dark'] .jam-day::after{background:var(--app-border);}
:root[data-theme='dark'] .jam-input-row:focus-within{background:var(--panel-bg);}
@keyframes jamFadeIn{from{opacity:0}to{opacity:1}}
@keyframes jamOpenWindow{from{opacity:0;transform:translate(-50%,-50%) translateY(20px) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) translateY(0) scale(1)}}
@keyframes jamMsgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes jamBounce{0%,70%,100%{transform:translateY(0);opacity:.4}35%{transform:translateY(-4px);opacity:1}}
@media(max-width:560px){
  .jam-window{width:calc(100vw - 16px);height:calc(100vh - 32px);border-radius:20px;}
  .jam-bubble{max-width:86%;}
}
`;

export default ChatbotWidget;
