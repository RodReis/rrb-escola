/* global React, I */
// RRB Escola — Dashboard. Colorful KPI cards + charts, 4 area tabs.

const fmtBR = (n) => n.toLocaleString('pt-BR');

function Panel({ children, style, pad = 20 }) {
  return <div className="rb-card" style={{ padding: pad, ...style }}>{children}</div>;
}

function Delta({ v, type }) {
  // type: 'good' | 'bad' | 'neutral'
  const cls = type === 'good' ? 'rb-pill-ok' : type === 'bad' ? 'rb-pill-bad' : 'rb-pill-neutral';
  return <span className={`rb-pill ${cls} rb-num`} style={{ height: 21 }}>{v}</span>;
}

function KpiCard({ hue, icon: Ico, label, value, delta, deltaType, sub }) {
  const [h, setH] = React.useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', borderRadius: 'var(--r-lg)', padding: '17px 18px 18px', overflow: 'hidden',
        border: '1px solid color-mix(in oklab, var(--hue) var(--tint-border), var(--border))',
        background: 'linear-gradient(165deg, color-mix(in oklab, var(--hue) calc(var(--tint-strength) + 4%), var(--surface)), var(--surface) 78%)',
        transform: h ? 'translateY(-3px)' : 'none', boxShadow: h ? 'var(--shadow-md)' : 'none',
        transition: 'transform .2s var(--ease), box-shadow .2s var(--ease)', '--hue': hue,
      }}>
      <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in oklab, var(--hue) 28%, transparent), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'var(--hue)', boxShadow: '0 6px 14px -6px var(--hue)' }}>
          <Ico size={17} stroke={2} />
        </span>
        {delta && <Delta v={delta} type={deltaType} />}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 13 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 27, letterSpacing: '-0.03em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ---- Area chart from a numeric series ----
function AreaChart({ series, color, height = 150 }) {
  const W = 520, H = height, pad = 6;
  const max = Math.max(...series), min = Math.min(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / span) * (H - pad * 2 - 14);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  const gid = 'g' + color.replace(/[^a-z]/gi, '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.26" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2.5" />
    </svg>
  );
}

function Donut({ pct, color, label, sub }) {
  const dash = `${pct} ${100 - pct}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg width="118" height="118" viewBox="0 0 42 42" style={{ flexShrink: 0 }}>
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--surface-3)" strokeWidth="5.5" />
        <circle cx="21" cy="21" r="15.9" fill="none" stroke={color} strokeWidth="5.5" strokeDasharray={dash} strokeDashoffset="25" strokeLinecap="round" transform="rotate(-90 21 21)" />
        <text x="21" y="21" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-display)" fontWeight="700" fontSize="9" fill="var(--text)">{pct}%</text>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  );
}

function Bars({ items }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, height: 132, paddingTop: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 7 }}>
            <span className="rb-num" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-soft)' }}>{it.val}</span>
            <div style={{ width: '100%', height: `${it.pct}%`, minHeight: 4, borderRadius: '7px 7px 3px 3px', background: `linear-gradient(180deg, ${it.hue}, color-mix(in oklab, ${it.hue} 45%, var(--surface)))`, animation: 'rbGrow .7s var(--ease-out) backwards', animationDelay: `${i * 0.06}s` }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 9 }}>
        {items.map((it, i) => <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: 'var(--text-muted)' }}>{it.label}</div>)}
      </div>
    </div>
  );
}

function SegTabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
      {tabs.map(t => {
        const on = value === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            border: 'none', background: on ? 'var(--surface)' : 'transparent', padding: '8px 16px', borderRadius: 999,
            fontSize: 12.5, fontWeight: on ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer',
            color: on ? 'var(--text)' : 'var(--text-muted)', boxShadow: on ? 'var(--shadow-xs)' : 'none', transition: 'all .16s var(--ease)',
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

const DASH = {
  financeiro: {
    kpis: [
      { hue: 'var(--c-blue)',  icon: I.financeiro, label: 'Receita do mês', value: 'R$ 321.432', delta: '+8,2%', deltaType: 'good', sub: 'Meta: R$ 310.000' },
      { hue: 'var(--c-coral)', icon: I.arrowUp,    label: 'Despesas',        value: 'R$ 135.659', delta: '+4,1%', deltaType: 'bad',  sub: 'Folha + custeio' },
      { hue: 'var(--c-green)', icon: I.chart,      label: 'Margem',          value: 'R$ 185.773', delta: '+12,4%', deltaType: 'good', sub: '57,8% da receita' },
      { hue: 'var(--c-violet)',icon: I.aluno,      label: 'Ticket médio',    value: 'R$ 1.612',   delta: '+1,9%', deltaType: 'good', sub: 'por aluno ativo' },
    ],
    area: { title: 'Receita · últimos 6 meses', value: 'R$ 321.432', delta: '+8% vs. maio', color: 'var(--c-blue)', series: [248, 262, 255, 281, 297, 321] },
    donut: { pct: 82, color: 'var(--c-green)', label: 'Mensalidades pagas', sub: '1.053 de 1.284 alunos em dia' },
    bars: { title: 'Despesas por categoria', items: [
      { label: 'Folha', val: '62k', pct: 92, hue: 'var(--c-coral)' },
      { label: 'Custeio', val: '31k', pct: 48, hue: 'var(--c-amber)' },
      { label: 'Infra', val: '24k', pct: 36, hue: 'var(--c-violet)' },
      { label: 'Outros', val: '18k', pct: 27, hue: 'var(--c-teal)' },
    ] },
    list: { title: 'Inadimplência recente', icon: I.inadimplencia, rows: [
      { n: 'Beatriz Oliveira Lima', t: '3ª EM', v: 'R$ 1.480', s: 'bad', sl: '12 dias', av: '#FFE6C7', i: 'BO' },
      { n: 'Helena Vasconcelos', t: '5º A', v: 'R$ 1.840', s: 'bad', sl: '4 dias', av: '#FFD8B0', i: 'HV' },
      { n: 'Sophia Camargo Reis', t: 'Inf V', v: 'R$ 2.140', s: 'warn', sl: 'boleto', av: '#E8D9FF', i: 'SC' },
      { n: 'Arthur Nogueira', t: 'Inf IV', v: 'R$ 1.480', s: 'warn', sl: 'boleto', av: '#D4F0DF', i: 'AN' },
    ] },
  },
  comercial: {
    kpis: [
      { hue: 'var(--c-violet)', icon: I.spark,      label: 'Leads no mês',   value: '184',  delta: '+22%', deltaType: 'good', sub: '47 esta semana' },
      { hue: 'var(--c-blue)',   icon: I.matriculas, label: 'Matrículas',     value: '41',   delta: '+9',   deltaType: 'good', sub: 'novas este mês' },
      { hue: 'var(--c-green)',  icon: I.check,      label: 'Conversão',      value: '22,3%', delta: '+3,1%', deltaType: 'good', sub: 'lead → matrícula' },
      { hue: 'var(--c-amber)',  icon: I.clock,      label: 'Tempo médio',    value: '6,4 d', delta: '-1,2 d', deltaType: 'good', sub: 'até fechamento' },
    ],
    area: { title: 'Matrículas · últimos 6 meses', value: '41 novas', delta: '+9 vs. maio', color: 'var(--c-violet)', series: [22, 28, 26, 31, 32, 41] },
    donut: { pct: 22, color: 'var(--c-violet)', label: 'Taxa de conversão', sub: '41 matrículas de 184 leads' },
    bars: { title: 'Funil comercial', items: [
      { label: 'Leads', val: '184', pct: 95, hue: 'var(--c-violet)' },
      { label: 'Visita', val: '96', pct: 60, hue: 'var(--c-blue)' },
      { label: 'Proposta', val: '58', pct: 40, hue: 'var(--c-teal)' },
      { label: 'Fechado', val: '41', pct: 28, hue: 'var(--c-green)' },
    ] },
    list: { title: 'Leads quentes', icon: I.spark, rows: [
      { n: 'Família Andrade', t: 'Inf III', v: '2 visitas', s: 'ok', sl: 'quente', av: '#D6E4FF', i: 'FA' },
      { n: 'Família Ribeiro', t: '1º A', v: 'proposta', s: 'warn', sl: 'morno', av: '#E8D9FF', i: 'FR' },
      { n: 'Família Souza', t: '6º B', v: 'visita', s: 'ok', sl: 'quente', av: '#D4F0DF', i: 'FS' },
      { n: 'Família Martins', t: '2ª EM', v: 'contato', s: 'warn', sl: 'morno', av: '#FFE6C7', i: 'FM' },
    ] },
  },
  secretaria: {
    kpis: [
      { hue: 'var(--c-blue)',  icon: I.alunos, label: 'Alunos ativos',      value: '1.284', delta: '+24', deltaType: 'good', sub: 'em 48 turmas' },
      { hue: 'var(--c-green)', icon: I.check,  label: 'Frequência hoje',    value: '94,1%', delta: '+0,8%', deltaType: 'good', sub: '1.208 presentes' },
      { hue: 'var(--c-amber)', icon: I.doc,    label: 'Docs. pendentes',    value: '37',   delta: '-12', deltaType: 'good', sub: 'a regularizar' },
      { hue: 'var(--c-coral)', icon: I.arrowRight, label: 'Transferências',  value: '5',    delta: '+2',  deltaType: 'neutral', sub: 'em análise' },
    ],
    area: { title: 'Frequência · últimos 6 meses', value: '94,1%', delta: '+0,8% vs. maio', color: 'var(--c-green)', series: [91, 92, 90, 93, 93, 94] },
    donut: { pct: 97, color: 'var(--c-blue)', label: 'Documentação completa', sub: '1.247 de 1.284 alunos' },
    bars: { title: 'Alunos por nível', items: [
      { label: 'Infantil', val: '280', pct: 65, hue: 'var(--c-amber)' },
      { label: 'Fund. I', val: '320', pct: 75, hue: 'var(--c-green)' },
      { label: 'Fund. II', val: '430', pct: 100, hue: 'var(--c-blue)' },
      { label: 'Médio', val: '254', pct: 59, hue: 'var(--c-violet)' },
    ] },
    list: { title: 'Documentos pendentes', icon: I.doc, rows: [
      { n: 'Lucas Henrique Costa', t: '7º A', v: 'Histórico', s: 'warn', sl: 'pendente', av: '#D4F0DF', i: 'LH' },
      { n: 'Manuela Tavares', t: '2ª EM', v: 'Atestado', s: 'warn', sl: 'pendente', av: '#FFE6C7', i: 'MT' },
      { n: 'Davi Lemos Cardoso', t: '8º B', v: 'RG cópia', s: 'bad', sl: 'atrasado', av: '#D4F0DF', i: 'DL' },
      { n: 'Pedro Henrique', t: '4º A', v: 'Vacina', s: 'warn', sl: 'pendente', av: '#E8D9FF', i: 'PH' },
    ] },
  },
  pedagogico: {
    kpis: [
      { hue: 'var(--c-violet)', icon: I.star,  label: 'Média geral',       value: '7,8',  delta: '+0,3', deltaType: 'good', sub: 'escala 0–10' },
      { hue: 'var(--c-blue)',   icon: I.layers,label: 'Turmas',            value: '48',   delta: '+2',   deltaType: 'neutral', sub: 'ano letivo 2026' },
      { hue: 'var(--c-green)',  icon: I.check,  label: 'Aprovação prevista', value: '91,5%', delta: '+1,4%', deltaType: 'good', sub: 'projeção do ano' },
      { hue: 'var(--c-coral)',  icon: I.bell,  label: 'Ocorrências',       value: '23',   delta: '-7',   deltaType: 'good', sub: 'no bimestre' },
    ],
    area: { title: 'Média geral · 6 bimestres', value: '7,8', delta: '+0,3 vs. anterior', color: 'var(--c-violet)', series: [7.1, 7.3, 7.2, 7.5, 7.6, 7.8] },
    donut: { pct: 91, color: 'var(--c-green)', label: 'Aprovação prevista', sub: '1.175 de 1.284 alunos' },
    bars: { title: 'Desempenho por área', items: [
      { label: 'Exatas', val: '7,4', pct: 74, hue: 'var(--c-blue)' },
      { label: 'Humanas', val: '8,1', pct: 81, hue: 'var(--c-violet)' },
      { label: 'Lingua.', val: '7,9', pct: 79, hue: 'var(--c-teal)' },
      { label: 'Artes', val: '8,6', pct: 86, hue: 'var(--c-pink)' },
    ] },
    list: { title: 'Turmas em atenção', icon: I.layers, rows: [
      { n: '9º B — Matemática', t: '32 alunos', v: '6,2', s: 'bad', sl: 'baixa', av: '#D6E4FF', i: '9B' },
      { n: '3ª EM — Física', t: '28 alunos', v: '6,5', s: 'warn', sl: 'atenção', av: '#FFE6C7', i: '3E' },
      { n: '7º A — Redação', t: '30 alunos', v: '6,8', s: 'warn', sl: 'atenção', av: '#D4F0DF', i: '7A' },
      { n: '8º B — Química', t: '29 alunos', v: '6,9', s: 'warn', sl: 'atenção', av: '#E8D9FF', i: '8B' },
    ] },
  },
};

const pillCls = { ok: 'rb-pill-ok', warn: 'rb-pill-warn', bad: 'rb-pill-bad' };

function MiniList({ data }) {
  return (
    <Panel pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--brand-600)' }}><data.icon size={16} /></span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{data.title}</span>
        <a href="#" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 550 }}>Ver tudo</a>
      </div>
      <div>
        {data.rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < data.rows.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            <span style={{ width: 34, height: 34, borderRadius: 999, background: r.av, color: '#20283e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{r.i}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.n}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{r.t}</div>
            </div>
            <span className="rb-num" style={{ fontSize: 12.5, fontWeight: 600 }}>{r.v}</span>
            <span className={`rb-pill ${pillCls[r.s]}`}><span className="dot" />{r.sl}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Dashboard() {
  const [tab, setTab] = React.useState('financeiro');
  const d = DASH[tab];
  return (
    <div style={{ padding: '22px 26px 30px', maxWidth: 1320, width: '100%', margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="rb-eyebrow">Visão geral · 2026.1</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', margin: '7px 0 0' }}>Olá, Renata 👋</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '5px 0 0' }}>Resumo do dia — segunda, 15 de junho de 2026.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="rb-btn rb-btn-ghost"><I.download size={15} /> Relatório</button>
          <button className="rb-btn rb-btn-primary"><I.plus size={15} stroke={2.2} /> Nova matrícula</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SegTabs value={tab} onChange={setTab} tabs={[
          { id: 'financeiro', label: 'Financeiro' }, { id: 'comercial', label: 'Comercial' },
          { id: 'secretaria', label: 'Secretaria' }, { id: 'pedagogico', label: 'Pedagógico' },
        ]} />
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 15 }}>
        {d.kpis.map((k, i) => <KpiCard key={tab + i} {...k} />)}
      </div>

      {/* charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 15, marginBottom: 15 }}>
        <Panel>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="rb-eyebrow" style={{ color: 'var(--text-muted)' }}>{d.area.title}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 25, letterSpacing: '-0.02em', marginTop: 6 }}>{d.area.value} <span style={{ fontSize: 12.5, color: 'var(--ok)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>↑ {d.area.delta}</span></div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}><AreaChart series={d.area.series} color={d.area.color} /></div>
        </Panel>
        <Panel><div className="rb-eyebrow" style={{ color: 'var(--text-muted)', marginBottom: 18 }}>Indicador-chave</div><Donut {...d.donut} /></Panel>
      </div>

      {/* bars + list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 15 }}>
        <Panel>
          <div className="rb-eyebrow" style={{ color: 'var(--text-muted)', marginBottom: 14 }}>{d.bars.title}</div>
          <Bars items={d.bars.items} />
        </Panel>
        <MiniList data={d.list} />
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, KpiCard, Panel, SegTabs, AreaChart, Donut, Bars });
