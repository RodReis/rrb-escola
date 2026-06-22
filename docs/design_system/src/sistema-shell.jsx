/* global React, I */
// RRB Escola — Sistema shell (topbar) on the new colorful design system.
// Light + dark via [data-theme] on <html>. EPG brand badge.

const TOP_NAV = [
  { id: 'dashboard',  label: 'Dashboard',  icon: I.dashboard },
  { id: 'alunos',     label: 'Alunos',     icon: I.alunos },
  { id: 'matriculas', label: 'Matrículas', icon: I.matriculas },
  { id: 'financeiro', label: 'Financeiro', icon: I.financeiro },
  { id: 'secretaria', label: 'Secretaria', icon: I.doc },
  { id: 'relatorios', label: 'Relatórios', icon: I.relatorios },
];

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingRight: 18, borderRight: '1px solid var(--border)', flexShrink: 0 }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(150deg, var(--brand-500), var(--brand-700))',
        boxShadow: '0 6px 16px -8px rgba(35,72,201,.6), inset 0 1px 0 rgba(255,255,255,.18)',
      }}>
        <img src="uploads/epg-white.png" alt="EPG" style={{ width: '70%', height: 'auto', display: 'block' }} />
      </span>
      <div style={{ lineHeight: 1.12, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>RRB Escola</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>Gestão Escolar</div>
      </div>
    </div>
  );
}

function NavLink({ item, active, onNavigate }) {
  const on = active === item.id;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={() => onNavigate && onNavigate(item.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 34, padding: '0 12px', border: 'none', borderRadius: 9,
        fontSize: 12.5, fontFamily: 'inherit', fontWeight: on ? 600 : 500,
        cursor: 'pointer', letterSpacing: '-0.005em',
        color: on ? 'var(--brand-600)' : (hover ? 'var(--text)' : 'var(--text-muted)'),
        background: on ? 'color-mix(in oklab, var(--brand-600) 12%, var(--surface))' : (hover ? 'var(--surface-3)' : 'transparent'),
        transition: 'all .15s var(--ease)',
      }}>
      <item.icon size={14.5} stroke={1.8} />
      <span>{item.label}</span>
    </button>
  );
}

function IconBtn({ children, onClick, title, dot }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 36, height: 36, border: '1px solid var(--border-strong)', borderRadius: 9,
        background: h ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--text-soft)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        transition: 'all .15s var(--ease)', flexShrink: 0,
      }}>
      {children}
      {dot && <span style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--c-coral)', boxShadow: '0 0 0 2px var(--surface)' }} />}
    </button>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <IconBtn title="Alternar tema" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      {theme === 'light'
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>}
    </IconBtn>
  );
}

function Topbar({ active, onNavigate, theme, setTheme }) {
  return (
    <header style={{
      height: 62, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 18px', background: 'var(--surface)',
      borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)',
      position: 'relative', zIndex: 30,
    }}>
      <Brand />
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {TOP_NAV.map(it => <NavLink key={it.id} item={it} active={active} onNavigate={onNavigate} />)}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ position: 'relative' }}>
          <I.search size={14} style={{ position: 'absolute', left: 13, top: 11, color: 'var(--text-faint)' }} />
          <input className="rb-input has-icon" placeholder="Buscar aluno, matrícula…"
            style={{ width: 230, height: 36, fontSize: 13, paddingRight: 40 }} />
          <span className="rb-mono" style={{ position: 'absolute', right: 8, top: 9, fontSize: 10, color: 'var(--text-faint)', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 5 }}>⌘K</span>
        </div>

        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 11px',
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 9,
          color: 'var(--text-soft)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500, flexShrink: 0,
        }}>
          <I.calendario size={13} /><span style={{ color: 'var(--text)', fontWeight: 600 }}>2026.1</span><I.arrowDown size={11} />
        </button>

        <ThemeToggle theme={theme} setTheme={setTheme} />
        <IconBtn title="Notificações" dot><I.bell size={15} /></IconBtn>

        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, paddingLeft: 11, paddingRight: 8, height: 38,
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
        }}>
          <div style={{ lineHeight: 1.15, textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Renata Brito</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Diretora</div>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: 'linear-gradient(135deg, var(--c-coral), #C81515)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>RB</div>
        </button>
      </div>
    </header>
  );
}

function Shell({ active, onNavigate, theme, setTheme, children }) {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', fontFamily: 'var(--font-body)', color: 'var(--text)' }}>
      <Topbar active={active} onNavigate={onNavigate} theme={theme} setTheme={setTheme} />
      <main className="rb-scroll" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </main>
    </div>
  );
}

Object.assign(window, { Shell, Topbar });
