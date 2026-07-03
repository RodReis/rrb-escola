/* global React */
// CRM Escola — Login screen, 3 split-layout variations.
// Each screen is self-contained with its own theme toggle.

const { useState } = React;

function Mark({ size = 44, radius }) {
  const r = radius != null ? radius : Math.round(size * 0.28);
  return (
    <span style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'linear-gradient(150deg, var(--brand-500), var(--brand-700))', boxShadow: '0 8px 22px -8px rgba(35,72,201,.5), inset 0 1px 0 rgba(255,255,255,.18)' }}>
      <img src="uploads/epg-white.png" alt="EPG" style={{ width: '68%', height: 'auto', display: 'block' }} />
    </span>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <div style={{
      position: 'absolute', top: 26, right: 28, zIndex: 5,
      display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999,
      background: 'var(--surface-3)', border: '1px solid var(--border)',
    }}>
      {['light', 'dark'].map(t => (
        <button key={t} onClick={() => setTheme(t)} aria-label={t}
          style={{
            width: 34, height: 30, border: 'none', borderRadius: 999, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: theme === t ? 'var(--surface)' : 'transparent',
            color: theme === t ? 'var(--brand-600)' : 'var(--text-muted)',
            boxShadow: theme === t ? 'var(--shadow-xs)' : 'none', transition: 'all .18s var(--ease)',
          }}>
          {t === 'light'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>}
        </button>
      ))}
    </div>
  );
}

const FEATURES = [
  { t: 'Matrículas', d: 'fluxo completo', icon: <path d="M6 3h9l4 4v14H6z M14 3v4h4 M9 12h7M9 16h5" /> },
  { t: 'Cobranças', d: 'boletos e PIX', icon: <path d="M3 20V8M9 20V4M15 20v-8M21 20v-6" /> },
  { t: 'Claro e escuro', d: 'do seu jeito', icon: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /> },
];

function FeatureChip({ f, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      boxShadow: 'var(--shadow-xs)', minWidth: 0, flex: 1,
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `color-mix(in oklab, ${accent} 14%, var(--surface))`, color: accent,
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.t}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{f.d}</div>
      </div>
    </div>
  );
}

// ---- Left panels per variant ----
function LeftAurora() {
  return (
    <div className="lg-left" style={{ background: 'linear-gradient(160deg, var(--bg-grad-a), var(--bg-grad-b))', overflow: 'hidden' }}>
      <div className="aurora">
        <span style={{ background: 'var(--c-blue)', width: 340, height: 340, left: '-6%', top: '6%' }} />
        <span style={{ background: 'var(--c-violet)', width: 300, height: 300, right: '-4%', top: '-8%', animationDelay: '-5s' }} />
        <span style={{ background: 'var(--c-teal)', width: 260, height: 260, left: '34%', bottom: '-10%', animationDelay: '-9s' }} />
      </div>
      <LeftContent accent="var(--c-blue)" />
    </div>
  );
}

function LeftSpotlight() {
  return (
    <div className="lg-left" style={{ background: 'radial-gradient(120% 90% at 20% 0%, #16213f, var(--bg) 70%)', overflow: 'hidden' }}>
      <div className="dots" />
      <div className="orb" style={{ background: 'var(--brand-glow)', width: 360, height: 360, left: '8%', top: '14%' }} />
      <div className="orb" style={{ background: 'var(--c-violet)', width: 280, height: 280, right: '0%', bottom: '4%', animationDelay: '-6s' }} />
      <LeftContent accent="var(--brand-glow)" />
    </div>
  );
}

function LeftFlag() {
  return (
    <div className="lg-left" style={{ background: 'var(--brand-600)', overflow: 'hidden', color: '#fff' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(125deg, transparent 52%, var(--red-600) 52%)', opacity: .92 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 30% 30%, rgba(255,255,255,.16), transparent 70%)' }} />
      <LeftContent accent="#fff" inverted />
    </div>
  );
}

function LeftContent({ accent, inverted }) {
  const tColor = inverted ? '#fff' : 'var(--text)';
  const subColor = inverted ? 'rgba(255,255,255,.78)' : 'var(--text-soft)';
  const eyebrow = inverted ? 'rgba(255,255,255,.85)' : 'var(--brand-600)';
  return (
    <div className="lg-left-content" style={{ position: 'relative', zIndex: 2 }}>
      <div className="reveal" style={{ '--d': '0ms' }}><Mark size={52} /></div>
      <div className="reveal" style={{ '--d': '60ms', marginTop: 30 }}>
        <div className="rb-eyebrow" style={{ color: eyebrow }}>Gestão escolar local</div>
        <h1 className="rb-display" style={{ fontSize: 56, margin: '14px 0 0', color: tColor, lineHeight: .96 }}>CRM Escola</h1>
      </div>
      <p className="reveal" style={{ '--d': '120ms', fontSize: 19, fontWeight: 600, color: tColor, margin: '22px 0 0', maxWidth: 440, letterSpacing: '-0.01em' }}>
        Secretaria, matrículas e cobranças em uma só base.
      </p>
      <p className="reveal" style={{ '--d': '170ms', fontSize: 14.5, color: subColor, margin: '12px 0 0', maxWidth: 430, lineHeight: 1.6 }}>
        Frequência, portaria, relatórios em PDF e a operação diária do dia a dia da escola — em um sistema rápido e organizado.
      </p>
      {!inverted ? (
        <div className="reveal" style={{ '--d': '230ms', display: 'flex', gap: 12, marginTop: 34, maxWidth: 460 }}>
          {FEATURES.map((f, i) => <FeatureChip key={i} f={f} accent={['var(--c-blue)', 'var(--c-green)', 'var(--c-violet)'][i]} />)}
        </div>
      ) : (
        <div className="reveal" style={{ '--d': '230ms', display: 'flex', gap: 20, marginTop: 34, flexWrap: 'wrap' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .9 }}>{f.icon}</svg>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{f.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginForm() {
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(null);
  return (
    <div className="lg-right">
      <div className="lg-card reveal" style={{ '--d': '120ms' }}>
        <div className="rb-eyebrow">Acesso administrativo</div>
        <h2 className="rb-display" style={{ fontSize: 30, margin: '10px 0 4px', fontWeight: 700 }}>Entrar no sistema</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 26px' }}>Use suas credenciais administrativas.</p>

        <div className="rb-field" style={{ marginBottom: 16 }}>
          <label className="rb-label">E-mail</label>
          <div style={{ position: 'relative' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={focus === 'email' ? 'var(--brand-500)' : 'var(--text-faint)'} strokeWidth="1.8" style={{ position: 'absolute', left: 14, top: 14, transition: 'stroke .15s' }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            <input className="rb-input has-icon" defaultValue="admin@rrbescola.local" onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} />
          </div>
        </div>

        <div className="rb-field" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label className="rb-label">Senha</label>
            <a href="#" style={{ fontSize: 12, color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 550 }}>Esqueci a senha</a>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={focus === 'pw' ? 'var(--brand-500)' : 'var(--text-faint)'} strokeWidth="1.8" style={{ position: 'absolute', left: 14, top: 14, transition: 'stroke .15s' }}><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
            <input className="rb-input has-icon" type={show ? 'text' : 'password'} defaultValue="senha-secreta" onFocus={() => setFocus('pw')} onBlur={() => setFocus(null)} style={{ paddingRight: 44 }} />
            <button onClick={() => setShow(s => !s)} aria-label="Mostrar senha" style={{ position: 'absolute', right: 8, top: 8, width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {show
                ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9 9 0 0121 12a16 16 0 01-2.3 3M6.1 6.1A16 16 0 003 12a9 9 0 0010.5 6.8" /></svg>
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}
            </button>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-soft)', margin: '14px 0 20px', cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked style={{ width: 16, height: 16, accentColor: 'var(--brand-600)' }} /> Manter conectado neste dispositivo
        </label>

        <button className="rb-btn rb-btn-primary lg" style={{ width: '100%' }}>
          Entrar
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}

const VARIANTS = { aurora: LeftAurora, spotlight: LeftSpotlight, flag: LeftFlag };
const DEFAULT_THEME = { aurora: 'light', spotlight: 'dark', flag: 'light' };

function LoginScreen({ variant = 'aurora' }) {
  const [theme, setTheme] = useState(DEFAULT_THEME[variant] || 'light');
  const Left = VARIANTS[variant];
  return (
    <div data-theme={theme} className="lg-root" style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'var(--bg)', fontFamily: 'var(--font-body)', color: 'var(--text)' }}>
      <Left />
      <LoginForm />
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}

window.LoginScreen = LoginScreen;
