/* global React, Shell, Dashboard, Alunos, I, TweaksPanel, useTweaks, TweakSection, TweakRadio */
// CRM Escola — Sistema app: routes Dashboard / Alunos, owns theme, hosts Tweaks.

const SISTEMA_TWEAKS = /*EDITMODE-BEGIN*/{
  "theme": "light"
}/*EDITMODE-END*/;

function Placeholder({ id }) {
  const map = {
    matriculas: { icon: I.matriculas, t: 'Matrículas', d: 'Fluxo de matrícula, rematrícula e contratos.' },
    financeiro: { icon: I.financeiro, t: 'Financeiro', d: 'Boletos, PIX, repasses e conciliação.' },
    secretaria: { icon: I.doc, t: 'Secretaria', d: 'Documentos, declarações e transferências.' },
    relatorios: { icon: I.relatorios, t: 'Relatórios', d: 'Painéis e exportações personalizadas.' },
  };
  const m = map[id] || { icon: I.layers, t: 'Em breve', d: 'Seção em construção.' };
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-600)', background: 'color-mix(in oklab, var(--brand-600) 12%, var(--surface))', border: '1px solid color-mix(in oklab, var(--brand-600) 22%, var(--border))' }}>
          <m.icon size={28} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '18px 0 0' }}>{m.t}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>{m.d}</p>
        <span className="rb-pill rb-pill-neutral" style={{ marginTop: 16 }}><span className="dot" />Em construção</span>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(SISTEMA_TWEAKS);
  const [route, setRoute] = React.useState('dashboard');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    try { localStorage.setItem('rrb-theme', t.theme); } catch (e) {}
  }, [t.theme]);

  const setTheme = (v) => setTweak('theme', v);

  let screen;
  if (route === 'dashboard') screen = <Dashboard />;
  else if (route === 'alunos') screen = <Alunos />;
  else screen = <Placeholder id={route} />;

  return (
    <React.Fragment>
      <Shell active={route} onNavigate={setRoute} theme={t.theme} setTheme={setTheme}>
        {screen}
      </Shell>
      <TweaksPanel title="Tweaks">
        <TweakSection title="Aparência">
          <TweakRadio label="Tema" value={t.theme} onChange={setTheme}
            options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

window.App = App;
