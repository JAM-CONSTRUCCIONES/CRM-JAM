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

const ChatbotWidget = () => {
  const { usuario } = useAuthContext();
  const location = useLocation();

  const [open, setOpen] = useState(false);
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

  return (
    <>
      <style>{CSS}</style>

      {/* Launcher */}
      <div className={`jam-launcher${open ? ' chat-open' : ''}`}>
        {/* Teaser card */}
        <div className="jam-teaser" onClick={() => setOpen(true)}>
          <div className="jam-teaser-avatar">
            <img className="jam-img" src={ENGINEER_URL} alt="Ingeniero JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div>
            <div className="jam-teaser-title">Pregúntale al ingeniero</div>
            <div className="jam-teaser-sub"><span className="jam-dot" />En línea ahora</div>
          </div>
        </div>

        {/* FAB */}
        <button className="jam-fab" aria-label="Abrir JAM Asistente" onClick={() => setOpen(v => !v)}>
          <img src={ENGINEER_URL} alt="Abrir chat" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="jam-fab-status" />
        </button>
      </div>

      {/* Window */}
      {open && (
        <section className="jam-window open">
          {/* Header */}
          <header className="jam-header">
            <div className="jam-header-accent" />
            <button className="jam-close" aria-label="Cerrar chat" onClick={() => setOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
              </svg>
            </button>
            <div className="jam-header-main">
              <div className="jam-header-avatar">
                <img className="jam-img" src={ENGINEER_URL} alt="Ingeniero virtual JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="jam-live-badge" />
              </div>
              <div className="jam-header-info">
                <div className="jam-brand-row">
                  <div className="jam-logo-chip">
                    <img src={LOGO_URL} alt="JAM Construcciones" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="jam-title"><b>JAM</b> <em>Asistente</em></div>
                </div>
                <div className="jam-status-line"><span className="jam-dot" />En línea · Responde al instante</div>
                <div className="jam-tag-row">
                  <span className="jam-tag">IA</span>
                  <span className="jam-tag">24/7</span>
                  <span className="jam-tag">CRM Inmobiliario</span>
                </div>
              </div>
            </div>
            <div className="jam-modebar">
              <button className={`jam-mode-btn${mode === 'chat' ? ' active' : ''}`} onClick={() => setMode('chat')}>💬 Chat</button>
              <button className={`jam-mode-btn${mode === 'faq' ? ' active' : ''}`} onClick={() => setMode('faq')}>❔ FAQ</button>
              <span className="jam-mode-spacer" />
            </div>
          </header>

          {/* Body */}
          <main className="jam-body">
            <div className="jam-scroll" ref={scrollRef}>
              <img className="jam-watermark" src={LOGO_URL} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />

              {/* FAQ View */}
              {mode === 'faq' && (
                <section className="jam-view">
                  <div className="jam-section-title">Preguntas frecuentes</div>
                  <div className="jam-faq-intro">
                    Desliza por categorías y toca una pregunta para consultarla automáticamente con JAM Asistente.
                  </div>
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
                            <div className="jam-slide-title">{s.title}</div>
                            <div className="jam-slide-count">{s.questions.length} preguntas</div>
                          </div>
                          <div className="jam-faq-list">
                            {s.questions.map((q, qi) => (
                              <button key={qi} className="jam-faq-card" onClick={() => sendMessage(q.text)}>
                                <div className="jam-faq-icon">{q.icon}</div>
                                <div className="jam-faq-text">{q.text}</div>
                                <svg className="jam-faq-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
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
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button className="jam-slider-btn" aria-label="Siguiente" onClick={() => goToSlide(slide + 1)}>
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Chat View */}
              {mode === 'chat' && (
                <section className="jam-view">
                  <div className="jam-day">Hoy</div>
                  {/* Welcome message */}
                  <div className="jam-msg bot">
                    <div className="jam-avatar-mini">
                      <img className="jam-img" src={ENGINEER_URL} alt="Ingeniero JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="jam-bubble">
                      {`¡Hola! 👷 Soy el ingeniero virtual de JAM Construcciones.\nPuedo ayudarte con bloqueos, inventario, clientes, estados de venta y todo lo relacionado con el CRM. ¿En qué te puedo ayudar?`}
                      <span className="jam-time">{nowTime()}</span>
                    </div>
                  </div>

                  {/* Messages */}
                  {messages.map((msg, i) => (
                    <div key={i} className={`jam-msg ${msg.role}`}>
                      {msg.role === 'bot' && (
                        <div className="jam-avatar-mini">
                          <img className="jam-img" src={ENGINEER_URL} alt="Ingeniero JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      )}
                      <div className="jam-bubble">
                        {msg.content}
                        <span className="jam-time">{msg.time}</span>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="jam-typing show">
                      <div className="jam-avatar-mini">
                        <img className="jam-img" src={ENGINEER_URL} alt="Ingeniero JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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

          {/* Footer */}
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="jam-footer-brand">
              <div className="jam-footer-logo">
                <img src={LOGO_URL} alt="JAM" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              JAM Construcciones · CRM Inmobiliario
            </div>
          </footer>
        </section>
      )}
    </>
  );
};

const CSS = `
:root{--navy-950:#061426;--navy-900:#081c33;--navy-850:#0c2745;--navy-800:#10365f;--navy-700:#164b82;--blue:#246fba;--gold:#e99a17;--gold-2:#f5b642;--gold-3:#ffe3a3;--orange:#cf6f1b;--white:#ffffff;--paper:#fbfdff;--cream:#fff8ef;--cream-2:#f7ecdd;--line:#e3eaf2;--line-warm:#eadcc8;--text:#0f2035;--text-2:#2d4058;--muted:#7d8ca2;--muted-2:#a5b0bf;--green:#22c55e;--font:"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--serif:"Playfair Display",Georgia,serif;--shadow-xs:0 2px 8px rgba(6,20,38,.06);--shadow-sm:0 8px 24px rgba(6,20,38,.10);--shadow-md:0 18px 48px rgba(6,20,38,.16);--shadow-lg:0 34px 90px rgba(6,20,38,.24);--shadow-xl:0 54px 130px rgba(6,20,38,.34);--ease:cubic-bezier(.34,1.28,.64,1);}
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
.jam-launcher{position:fixed;right:26px;bottom:24px;z-index:10000;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}
.jam-teaser{min-width:276px;max-width:320px;display:flex;align-items:center;gap:13px;padding:12px 16px 12px 12px;border-radius:24px 24px 8px 24px;background:rgba(255,255,255,.94);border:1px solid rgba(255,255,255,.86);box-shadow:var(--shadow-md),inset 0 1px 0 rgba(255,255,255,.96);backdrop-filter:blur(16px);cursor:pointer;transition:transform .24s var(--ease),box-shadow .24s ease,opacity .22s ease;animation:jamFloatCard 4.8s ease-in-out infinite;}
.jam-teaser:hover{transform:translateY(-5px) scale(1.02);box-shadow:var(--shadow-lg),inset 0 1px 0 rgba(255,255,255,.96);}
.jam-launcher.chat-open .jam-teaser{opacity:0;transform:translateY(8px) scale(.94);pointer-events:none;animation:none;}
.jam-teaser-avatar{width:52px;height:52px;border-radius:18px;overflow:hidden;background:var(--cream);border:2px solid rgba(233,154,23,.48);box-shadow:0 8px 22px rgba(6,20,38,.13);flex-shrink:0;}
.jam-img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}
.jam-teaser-title{font-size:15px;line-height:1.18;color:var(--navy-950);font-weight:800;letter-spacing:-.035em;}
.jam-teaser-sub{margin-top:4px;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);font-weight:700;}
.jam-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 0 rgba(34,197,94,.42);animation:jamPulse 2.2s infinite;flex-shrink:0;display:inline-block;}
.jam-fab{width:72px;height:72px;border:none;border-radius:50%;cursor:pointer;position:relative;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.18),transparent 26%),linear-gradient(145deg,var(--navy-800),var(--navy-950));box-shadow:0 20px 58px rgba(6,20,38,.40),0 0 0 1px rgba(245,182,66,.28);transition:transform .26s var(--ease),box-shadow .26s ease;}
.jam-fab:hover{transform:scale(1.08) rotate(-3deg);box-shadow:0 30px 76px rgba(6,20,38,.50),0 0 0 2px rgba(245,182,66,.44);}
.jam-fab::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:1.5px dashed rgba(233,154,23,.34);animation:jamOrbit 18s linear infinite;}
.jam-fab img{width:59px;height:59px;border-radius:50%;border:2px solid rgba(255,227,163,.65);background:#fff;object-fit:cover;object-position:top center;z-index:1;}
.jam-fab-status{position:absolute;right:5px;bottom:5px;width:16px;height:16px;border-radius:50%;background:var(--green);border:3px solid var(--navy-950);z-index:2;}
.jam-window{position:fixed;right:26px;bottom:110px;width:432px;max-width:calc(100vw - 20px);height:680px;max-height:calc(100vh - 132px);display:flex;flex-direction:column;overflow:hidden;border-radius:32px;background:#fff;border:1px solid rgba(255,255,255,.88);box-shadow:var(--shadow-xl);z-index:9999;transform-origin:bottom right;}
.jam-window.open{animation:jamOpenWindow .34s var(--ease) both;}
.jam-header{position:relative;flex-shrink:0;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.99),rgba(251,253,255,.98));border-bottom:1px solid var(--line);}
.jam-header-accent{height:5px;background:linear-gradient(90deg,var(--navy-950) 0%,var(--blue) 38%,var(--gold) 72%,var(--gold-2) 100%);}
.jam-header::before{content:"";position:absolute;inset:5px 0 0;background:radial-gradient(circle at 95% 4%,rgba(36,111,186,.08),transparent 25%),radial-gradient(circle at 4% 4%,rgba(233,154,23,.10),transparent 27%);pointer-events:none;}
.jam-close{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:14px;border:1px solid #dde6f0;background:rgba(255,255,255,.88);color:#8392a5;display:grid;place-items:center;cursor:pointer;z-index:5;box-shadow:var(--shadow-xs);transition:all .18s ease;}
.jam-close:hover{background:var(--navy-950);color:#fff;border-color:var(--navy-950);transform:rotate(90deg);}
.jam-header-main{position:relative;z-index:2;display:flex;align-items:center;gap:14px;padding:17px 62px 14px 18px;}
.jam-header-avatar{position:relative;width:76px;height:76px;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,#fff,var(--cream));border:2px solid rgba(233,154,23,.50);box-shadow:0 12px 30px rgba(6,20,38,.14),inset 0 0 0 4px rgba(255,255,255,.56);flex-shrink:0;}
.jam-live-badge{position:absolute;right:-2px;bottom:-2px;width:18px;height:18px;border-radius:50%;background:var(--green);border:4px solid #fff;z-index:2;box-shadow:var(--shadow-xs);}
.jam-header-info{min-width:0;flex:1;}
.jam-brand-row{display:flex;align-items:center;gap:9px;margin-bottom:8px;min-width:0;}
.jam-logo-chip{width:34px;height:34px;border-radius:12px;border:1px solid rgba(233,154,23,.28);background:rgba(255,248,239,.92);padding:3px;overflow:hidden;box-shadow:var(--shadow-xs);flex-shrink:0;}
.jam-logo-chip img{width:100%;height:100%;object-fit:contain;display:block;}
.jam-title{font-family:var(--serif);font-size:25px;line-height:1;letter-spacing:-.045em;white-space:nowrap;}
.jam-title b{color:var(--navy-950);font-weight:700;}
.jam-title em{color:var(--gold);font-style:italic;font-weight:700;}
.jam-status-line{display:inline-flex;align-items:center;gap:7px;padding:5px 10px 5px 7px;border-radius:999px;background:#f2fbf6;color:#4d667f;border:1px solid #ddf4e7;font-size:12.5px;font-weight:800;letter-spacing:-.01em;}
.jam-tag-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;}
.jam-tag{display:inline-flex;align-items:center;gap:5px;border:1px solid #e0e7ef;background:#f8fafc;color:var(--navy-800);border-radius:999px;padding:5px 9px;font-size:10.8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;}
.jam-modebar{position:relative;z-index:2;display:flex;align-items:center;gap:9px;padding:0 18px 15px;}
.jam-mode-btn{border:1px solid #dde6f0;background:#fff;color:var(--text-2);font-size:13px;font-weight:900;border-radius:999px;padding:10px 17px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;box-shadow:var(--shadow-xs);transition:all .18s ease;font-family:var(--font);}
.jam-mode-btn:hover{transform:translateY(-2px);border-color:#cbd7e6;box-shadow:var(--shadow-sm);}
.jam-mode-btn.active{background:var(--navy-950);color:var(--gold-3);border-color:var(--navy-950);box-shadow:0 10px 24px rgba(6,20,38,.20);}
.jam-mode-spacer{flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent);}
.jam-body{flex:1;overflow:hidden;position:relative;background:#fff;display:flex;flex-direction:column;}
.jam-scroll{flex:1;overflow-y:auto;position:relative;scroll-behavior:smooth;}
.jam-scroll::-webkit-scrollbar{width:5px}
.jam-scroll::-webkit-scrollbar-thumb{background:#d7e0eb;border-radius:999px}
.jam-watermark{position:absolute;right:16px;bottom:36px;width:112px;opacity:.035;pointer-events:none;}
.jam-view{padding:18px 16px 16px;min-height:100%;}
.jam-section-title{display:flex;align-items:center;gap:10px;margin:0 0 14px;color:#97a3b5;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;}
.jam-section-title::after{content:"";flex:1;height:1px;background:var(--line);}
.jam-faq-intro{color:var(--text-2);font-size:14px;line-height:1.55;font-weight:600;background:#f8fafc;border:1px solid var(--line);border-radius:18px;padding:13px 14px;margin-bottom:14px;}
.jam-faq-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;margin-bottom:10px;scrollbar-width:none;}
.jam-faq-tabs::-webkit-scrollbar{display:none}
.jam-faq-tab{flex-shrink:0;border:1px solid #dfe7f1;background:#fff;color:var(--text-2);font-size:12.5px;font-weight:900;padding:8px 12px;border-radius:999px;cursor:pointer;transition:all .18s ease;box-shadow:var(--shadow-xs);font-family:var(--font);}
.jam-faq-tab:hover{transform:translateY(-2px);border-color:#cbd7e6;box-shadow:var(--shadow-sm);}
.jam-faq-tab.active{background:var(--navy-950);color:var(--gold-3);border-color:var(--navy-950);}
.jam-slider-wrap{position:relative;}
.jam-faq-slider{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:2px 2px 12px;scrollbar-width:none;}
.jam-faq-slider::-webkit-scrollbar{display:none}
.jam-slide{min-width:100%;scroll-snap-align:start;}
.jam-slide-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.jam-slide-title{display:flex;align-items:center;gap:9px;color:var(--navy-950);font-size:16px;line-height:1;font-weight:900;letter-spacing:-.035em;}
.jam-slide-count{color:#9ba8b9;font-size:12px;font-weight:800;}
.jam-faq-list{display:flex;flex-direction:column;gap:11px;}
.jam-faq-card{width:100%;display:flex;align-items:center;gap:13px;text-align:left;border:1px solid #dfe6f0;border-radius:18px;background:linear-gradient(180deg,#fff 0%,#fcfdff 100%);padding:14px 15px;cursor:pointer;box-shadow:0 6px 18px rgba(6,20,38,.045);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease;font-family:var(--font);}
.jam-faq-card:hover{transform:translateY(-2px);border-color:#c8d6e7;box-shadow:0 14px 34px rgba(6,20,38,.09);background:#fff;}
.jam-faq-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;flex-shrink:0;background:#f5f8fc;border:1px solid #e3ebf4;font-size:19px;}
.jam-faq-text{flex:1;color:var(--text);font-size:14.8px;line-height:1.38;font-weight:800;letter-spacing:-.025em;}
.jam-faq-arrow{color:#a3afbd;flex-shrink:0;}
.jam-slider-controls{display:flex;align-items:center;justify-content:space-between;margin-top:3px;}
.jam-slider-btns{display:flex;gap:8px;}
.jam-slider-btn{width:36px;height:36px;border-radius:12px;border:1px solid #dfe7f1;background:#fff;color:var(--text-2);box-shadow:var(--shadow-xs);cursor:pointer;display:grid;place-items:center;transition:all .18s ease;}
.jam-slider-btn:hover{transform:translateY(-2px);background:var(--navy-950);color:#fff;border-color:var(--navy-950);}
.jam-slider-dots{display:flex;align-items:center;gap:6px;}
.jam-slider-dot{width:7px;height:7px;border-radius:999px;background:#cfd8e5;transition:all .18s ease;}
.jam-slider-dot.active{width:22px;background:var(--gold);}
.jam-day{position:relative;text-align:center;color:#a9b2c2;font-size:11px;font-weight:900;letter-spacing:.10em;text-transform:uppercase;margin:2px 0 16px;}
.jam-day::before,.jam-day::after{content:"";position:absolute;top:50%;width:36%;height:1px;background:var(--line);}
.jam-day::before{left:0}
.jam-day::after{right:0}
.jam-msg{display:flex;align-items:flex-end;gap:10px;margin-bottom:10px;animation:jamMsgIn .22s ease both;}
.jam-msg.user{justify-content:flex-end}
.jam-avatar-mini{width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid rgba(233,154,23,.30);background:var(--cream);flex-shrink:0;box-shadow:var(--shadow-xs);}
.jam-bubble{max-width:82%;padding:13px 15px;font-size:14px;line-height:1.62;white-space:pre-wrap;word-break:break-word;letter-spacing:-.006em;}
.jam-msg.bot .jam-bubble{color:var(--text);background:#fffdf9;border:1px solid var(--line-warm);border-radius:22px 22px 22px 6px;box-shadow:0 8px 20px rgba(6,20,38,.055);}
.jam-msg.user .jam-bubble{color:#f3f9ff;background:linear-gradient(145deg,var(--navy-700),var(--navy-950));border-radius:22px 22px 6px 22px;box-shadow:0 10px 26px rgba(6,20,38,.18);}
.jam-time{display:block;margin-top:7px;color:#8191a4;font-size:10.5px;font-weight:800;opacity:.72;}
.jam-msg.user .jam-time{color:rgba(255,255,255,.72);text-align:right;}
.jam-typing{display:none;align-items:flex-end;gap:10px;margin-bottom:10px;}
.jam-typing.show{display:flex;animation:jamMsgIn .22s ease both;}
.jam-typing-bubble{display:flex;gap:5px;align-items:center;padding:15px 18px;border-radius:22px 22px 22px 6px;background:#fffdf9;border:1px solid var(--line-warm);box-shadow:0 8px 20px rgba(6,20,38,.055);}
.typing-dot{width:7px;height:7px;border-radius:50%;background:#bfa78b;animation:jamBounce 1.25s infinite ease-in-out;}
.typing-dot:nth-child(2){animation-delay:.16s}
.typing-dot:nth-child(3){animation-delay:.32s}
.jam-footer{flex-shrink:0;background:#fff;border-top:1px solid var(--line);padding:12px 14px 15px;}
.jam-input-row{display:flex;align-items:flex-end;gap:8px;padding:7px 7px 7px 15px;border:1.5px solid rgba(233,154,23,.36);border-radius:20px;background:linear-gradient(180deg,#fffaf2,#fff7ed);box-shadow:inset 0 0 0 3px rgba(255,255,255,.62);transition:border-color .2s ease,box-shadow .2s ease;}
.jam-input-row:focus-within{border-color:var(--gold);box-shadow:0 0 0 4px rgba(233,154,23,.11),inset 0 0 0 3px rgba(255,255,255,.66);}
.jam-input{flex:1;min-height:42px;max-height:94px;border:none;outline:none;background:transparent;resize:none;padding:11px 0;color:var(--text);font-size:14px;line-height:1.45;font-family:var(--font);font-weight:500;}
.jam-input::placeholder{color:#ae9f8e;font-weight:500;}
.jam-send{width:46px;height:46px;border:none;border-radius:16px;display:grid;place-items:center;cursor:pointer;color:#fff;background:radial-gradient(circle at 24% 18%,rgba(255,255,255,.28),transparent 28%),linear-gradient(145deg,var(--gold-2),var(--navy-950));box-shadow:0 10px 26px rgba(233,154,23,.31);transition:transform .22s var(--ease),box-shadow .22s ease,opacity .18s ease;flex-shrink:0;}
.jam-send:hover{transform:scale(1.08) rotate(-7deg);box-shadow:0 16px 34px rgba(233,154,23,.44);}
.jam-send:disabled{opacity:.46;cursor:not-allowed;transform:none;box-shadow:none;}
.jam-footer-brand{margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;color:#9ea8b6;font-size:12px;font-weight:800;letter-spacing:-.01em;}
.jam-footer-logo{width:24px;height:24px;border-radius:8px;padding:2px;overflow:hidden;background:#fff;border:1px solid #e1e7ef;}
.jam-footer-logo img{width:100%;height:100%;object-fit:contain;display:block}
@keyframes jamOpenWindow{from{opacity:0;transform:translateY(24px) scale(.88)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes jamMsgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes jamFloatCard{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes jamPulse{0%,100%{box-shadow:0 0 0 2px rgba(34,197,94,.25)}50%{box-shadow:0 0 0 9px rgba(34,197,94,0)}}
@keyframes jamOrbit{to{transform:rotate(360deg)}}
@keyframes jamBounce{0%,70%,100%{transform:translateY(0);opacity:.42}35%{transform:translateY(-5px);opacity:1}}
@media(max-width:560px){
  .jam-window{left:10px;right:10px;bottom:98px;width:auto;height:80vh;max-height:80vh;border-radius:28px;}
  .jam-launcher{right:16px;bottom:16px;}
  .jam-teaser{max-width:235px;min-width:0;}
  .jam-header-main{padding:15px 58px 13px 14px;gap:12px;}
  .jam-header-avatar{width:66px;height:66px;border-radius:22px;}
  .jam-title{font-size:22px;}
  .jam-status-line{font-size:12px;}
  .jam-bubble{max-width:84%;}
}
@media(max-width:390px){
  .jam-teaser{display:none}
  .jam-header-avatar{width:60px;height:60px}
  .jam-title{font-size:20px}
  .jam-modebar{padding-left:14px;padding-right:14px}
  .jam-view{padding:16px 14px 14px}
}
`;

export default ChatbotWidget;
