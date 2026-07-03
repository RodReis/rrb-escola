/* global React, I */
// CRM Escola — Alunos (grid/table) on the new design system.

const ROWS = [
  { id: '#A-1024', nome: 'Maria Eduarda Albuquerque', turma: '6º A',  nivel: 'Fund. II', lvl: 'fund_ii', resp: 'Carolina Albuquerque', plano: 'Integral', valor: 'R$ 1.840,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 11, av: '#FFD3D3', i: 'ME' },
  { id: '#A-1025', nome: 'João Pedro Santos',          turma: '9º B', nivel: 'Fund. II', lvl: 'fund_ii', resp: 'Marcos Santos',         plano: 'Manhã',    valor: 'R$ 1.240,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 14, av: '#D6E4FF', i: 'JP' },
  { id: '#A-1026', nome: 'Beatriz Oliveira Lima',      turma: '3ª EM', nivel: 'E. Médio', lvl: 'medio',  resp: 'Helena Lima',          plano: 'Tarde',    valor: 'R$ 1.480,00', s: 'bad',  fin: '12 dias em atraso', venc: '10/06', age: 17, av: '#FFE6C7', i: 'BO' },
  { id: '#A-1027', nome: 'Lucas Henrique Costa',       turma: '7º A', nivel: 'Fund. II', lvl: 'fund_ii', resp: 'Patrícia Costa',        plano: 'Manhã',    valor: 'R$ 1.240,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 12, av: '#D4F0DF', i: 'LH' },
  { id: '#A-1028', nome: 'Sophia Camargo Reis',        turma: 'Inf V', nivel: 'Ed. Inf.', lvl: 'infantil', resp: 'Rafael Reis',         plano: 'Integral', valor: 'R$ 2.140,00', s: 'warn', fin: 'Aguardando boleto', venc: '12/06', age: 5,  av: '#E8D9FF', i: 'SC' },
  { id: '#A-1029', nome: 'Theo Andrade Macedo',        turma: '1ª EM', nivel: 'E. Médio', lvl: 'medio',  resp: 'Larissa Macedo',        plano: 'Tarde',    valor: 'R$ 1.480,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 15, av: '#FFD3D3', i: 'TA' },
  { id: '#A-1030', nome: 'Helena Vasconcelos Pinto',   turma: '5º A', nivel: 'Fund. I',  lvl: 'fund_i',  resp: 'Daniel Pinto',          plano: 'Integral', valor: 'R$ 1.840,00', s: 'bad',  fin: '4 dias em atraso',  venc: '10/06', age: 10, av: '#FFD8B0', i: 'HV' },
  { id: '#A-1031', nome: 'Davi Lemos Cardoso',         turma: '8º B', nivel: 'Fund. II', lvl: 'fund_ii', resp: 'Carla Cardoso',         plano: 'Manhã',    valor: 'R$ 1.240,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 13, av: '#D4F0DF', i: 'DL' },
  { id: '#A-1032', nome: 'Manuela Tavares Ferreira',   turma: '2ª EM', nivel: 'E. Médio', lvl: 'medio',  resp: 'Bruno Ferreira',        plano: 'Tarde',    valor: 'R$ 1.480,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 16, av: '#FFE6C7', i: 'MT' },
  { id: '#A-1033', nome: 'Pedro Henrique Moraes',      turma: '4º A', nivel: 'Fund. I',  lvl: 'fund_i',  resp: 'Cristina Moraes',       plano: 'Integral', valor: 'R$ 1.840,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 9,  av: '#E8D9FF', i: 'PH' },
  { id: '#A-1034', nome: 'Isabela Rocha Fernandes',    turma: '6º B', nivel: 'Fund. II', lvl: 'fund_ii', resp: 'Marina Fernandes',      plano: 'Manhã',    valor: 'R$ 1.240,00', s: 'ok',   fin: 'Em dia',            venc: '10/06', age: 11, av: '#FFE6C7', i: 'IR' },
  { id: '#A-1035', nome: 'Arthur Nogueira Salles',     turma: 'Inf IV', nivel: 'Ed. Inf.', lvl: 'infantil', resp: 'Felipe Salles',      plano: 'Tarde',    valor: 'R$ 1.480,00', s: 'warn', fin: 'Aguardando boleto', venc: '14/06', age: 4,  av: '#D4F0DF', i: 'AN' },
];

const PILL = { ok: 'rb-pill-ok', warn: 'rb-pill-warn', bad: 'rb-pill-bad' };
const GRID = '34px 2.3fr 1fr 1.1fr 1.4fr 1.2fr 116px';

function HeadStat({ label, value, color }) {
  return (
    <div style={{ padding: '2px 0 2px 16px', borderLeft: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      <div className="rb-num" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, color: color || 'var(--text)', fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}

function Chip({ label, value }) {
  const [h, setH] = React.useState(false);
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 11px',
      border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', background: h ? 'var(--surface-2)' : 'var(--surface)',
      cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', fontFamily: 'inherit', transition: 'all .14s var(--ease)',
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
      <I.arrowDown size={12} />
    </button>
  );
}

function RowAction({ icon: Ico, title, tone, onClick }) {
  const [h, setH] = React.useState(false);
  const color = tone === 'brand' ? 'var(--brand-600)' : tone === 'green' ? 'var(--c-green)' : 'var(--text-muted)';
  return (
    <button title={title} onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: 30, height: 30, borderRadius: 8, border: '1px solid', cursor: 'pointer',
        borderColor: h ? 'color-mix(in oklab, ' + color + ' 40%, var(--border))' : 'transparent',
        background: h ? 'color-mix(in oklab, ' + color + ' 12%, var(--surface))' : 'transparent',
        color: h ? color : 'var(--text-faint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .14s var(--ease)',
      }}><Ico size={15} /></button>
  );
}

function HeaderCell({ children, sortable }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: sortable ? 'pointer' : 'default' }}>{children}{sortable && <I.arrowDown size={11} />}</span>;
}

function BulkBar({ count, onClear }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 50,
      background: 'color-mix(in oklab, var(--brand-600) 9%, var(--surface))',
      borderBottom: '1px solid color-mix(in oklab, var(--brand-600) 22%, var(--border))',
      animation: 'rbSlideDown .22s var(--ease-out)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--brand-600)' }}>
        <span className="rb-num">{count}</span> selecionado{count > 1 ? 's' : ''}
      </span>
      <div style={{ width: 1, height: 22, background: 'var(--border-strong)' }} />
      <button className="rb-btn rb-btn-ghost sm"><I.whatsapp size={14} /> Mensagem</button>
      <button className="rb-btn rb-btn-ghost sm"><I.doc size={14} /> Gerar boleto</button>
      <button className="rb-btn rb-btn-ghost sm"><I.download size={14} /> Exportar</button>
      <button className="rb-btn rb-btn-ghost sm" style={{ color: 'var(--bad)', borderColor: 'color-mix(in oklab, var(--bad) 35%, var(--border))' }}><I.close size={14} /> Excluir</button>
      <button onClick={onClear} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <I.close size={13} /> Limpar seleção
      </button>
    </div>
  );
}

function PgBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      minWidth: 32, height: 32, border: active ? 'none' : '1px solid var(--border-strong)', borderRadius: 8,
      background: active ? 'var(--brand-600)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-soft)',
      fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '0 9px',
      boxShadow: active ? 'var(--shadow-brand)' : 'none',
    }}>{children}</button>
  );
}

function Alunos() {
  const [level, setLevel] = React.useState('todos');
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(() => new Set(['#A-1024']));
  const [hoverRow, setHoverRow] = React.useState(null);

  const levels = [
    { id: 'todos', label: 'Todos', count: 1284 },
    { id: 'infantil', label: 'Infantil', count: 280 },
    { id: 'fund_i', label: 'Fund. I', count: 320 },
    { id: 'fund_ii', label: 'Fund. II', count: 430 },
    { id: 'medio', label: 'Médio', count: 254 },
  ];

  const visible = ROWS.filter(r => (level === 'todos' || r.lvl === level) &&
    (q === '' || (r.nome + r.id + r.resp).toLowerCase().includes(q.toLowerCase())));

  const allSel = visible.length > 0 && visible.every(r => sel.has(r.id));
  const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(prev => { const n = new Set(prev); if (allSel) visible.forEach(r => n.delete(r.id)); else visible.forEach(r => n.add(r.id)); return n; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Page header */}
      <div style={{ padding: '20px 26px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="rb-mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Gestão</span><span style={{ opacity: .4 }}>/</span><span style={{ color: 'var(--text)' }}>Secretaria</span><span style={{ opacity: .4 }}>/</span><span style={{ color: 'var(--brand-600)' }}>Alunos</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="rb-btn rb-btn-ghost sm" style={{ height: 36 }}><I.download size={14} /> Exportar</button>
            <button className="rb-btn rb-btn-ghost sm" style={{ height: 36 }}><I.upload size={14} /> Importar</button>
            <button className="rb-btn rb-btn-primary sm" style={{ height: 36 }}><I.plus size={14} stroke={2.2} /> Novo aluno</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 27, margin: 0, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>Alunos</h1>
            <span className="rb-pill rb-pill-info rb-num" style={{ height: 24 }}>1.284 ativos</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <HeadStat label="Novos no mês" value="+24" color="var(--ok)" />
            <HeadStat label="Aniversariantes hoje" value="3" />
            <HeadStat label="Taxa de retenção" value="96,4%" color="var(--brand-600)" />
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '12px 26px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          {levels.map(f => {
            const on = level === f.id;
            return (
              <button key={f.id} onClick={() => setLevel(f.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: 'none',
                fontSize: 12, fontWeight: on ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer',
                color: on ? '#fff' : 'var(--text-muted)', background: on ? 'var(--brand-600)' : 'transparent',
                boxShadow: on ? 'var(--shadow-brand)' : 'none', transition: 'all .15s var(--ease)',
              }}>
                {f.label}
                <span className="rb-num" style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: on ? 'rgba(255,255,255,.24)' : 'var(--surface)', border: on ? 'none' : '1px solid var(--border)' }}>{f.count.toLocaleString('pt-BR')}</span>
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 320 }}>
          <I.search size={14} style={{ position: 'absolute', left: 13, top: 11, color: 'var(--text-faint)' }} />
          <input className="rb-input has-icon" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, ID ou responsável…" style={{ height: 36, fontSize: 13 }} />
        </div>

        <div style={{ display: 'flex', gap: 7, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Chip label="Turma" value="Todas" />
          <Chip label="Plano" value="Todos" />
          <Chip label="Status" value="Todos" />
          <button title="Mais filtros" style={{ width: 36, height: 36, border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--text-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><I.filter size={14} /></button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, padding: '16px 26px 22px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="rb-card" style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0 }}>
          {sel.size > 0 && <BulkBar count={sel.size} onClear={() => setSel(new Set())} />}

          {/* head */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '11px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <input type="checkbox" checked={allSel} onChange={toggleAll} style={{ width: 16, height: 16, accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
            <HeaderCell sortable>Aluno</HeaderCell>
            <HeaderCell>Turma</HeaderCell>
            <HeaderCell>Plano</HeaderCell>
            <HeaderCell>Responsável</HeaderCell>
            <HeaderCell>Status financeiro</HeaderCell>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>

          {/* rows */}
          <div className="rb-scroll" style={{ overflow: 'auto', flex: 1 }}>
            {visible.map((a, idx) => {
              const on = sel.has(a.id);
              const hov = hoverRow === a.id;
              return (
                <div key={a.id} onClick={() => toggle(a.id)} onMouseEnter={() => setHoverRow(a.id)} onMouseLeave={() => setHoverRow(null)}
                  style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '0 16px', height: 56, alignItems: 'center',
                    borderBottom: idx < visible.length - 1 ? '1px solid var(--border-soft)' : 'none',
                    background: on ? 'color-mix(in oklab, var(--brand-600) 6%, var(--surface))' : (hov ? 'var(--surface-2)' : 'transparent'),
                    cursor: 'pointer', position: 'relative', transition: 'background .12s var(--ease)' }}>
                  {on && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--brand-600)' }} />}
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 999, background: a.av, color: '#20283e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{a.i}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
                      <div className="rb-mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{a.id} · {a.age} anos</div>
                    </div>
                  </div>
                  <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.turma}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{a.nivel}</div></div>
                  <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.plano}</div><div className="rb-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{a.valor}</div></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.resp}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}><I.whatsapp size={11} /> responsável</div>
                  </div>
                  <div>
                    <span className={`rb-pill ${PILL[a.s]}`}><span className="dot" />{a.fin}</span>
                    <div className="rb-mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>vence {a.venc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', opacity: hov || on ? 1 : 0.55, transition: 'opacity .14s var(--ease)' }}>
                    <RowAction icon={I.whatsapp} title="Enviar mensagem" tone="green" />
                    <RowAction icon={I.edit} title="Editar" tone="brand" />
                    <RowAction icon={I.more} title="Mais ações" />
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Nenhum aluno encontrado</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>Ajuste a busca ou os filtros.</div>
              </div>
            )}
          </div>

          {/* footer */}
          <div style={{ padding: '11px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--surface-2)' }}>
            <span>Mostrando <strong style={{ color: 'var(--text)' }}>1–{visible.length}</strong> de <strong style={{ color: 'var(--text)' }}>1.284</strong> alunos</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PgBtn>‹</PgBtn><PgBtn active>1</PgBtn><PgBtn>2</PgBtn><PgBtn>3</PgBtn>
              <span style={{ padding: '0 4px' }}>…</span><PgBtn>129</PgBtn><PgBtn>›</PgBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Alunos });
