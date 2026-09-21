/* global React */
// Lectiva — Icons + brand mark
// Stroke-based, 24x24 viewBox, currentColor

const Icon = ({ d, size = 18, stroke = 1.6, fill = 'none', children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
       stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  // Navigation
  dashboard: (p) => <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></Icon>,
  alunos: (p) => <Icon {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><circle cx="17" cy="7" r="2.5"/><path d="M15 20c0-2.4 1.6-4.5 4-5"/></Icon>,
  aluno: (p) => <Icon {...p}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.7 3.1-6.5 7-6.5s7 2.8 7 6.5"/></Icon>,
  matriculas: (p) => <Icon {...p}><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h7M9 16h5"/></Icon>,
  planos: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h3"/></Icon>,
  financeiro: (p) => <Icon {...p}><path d="M3 20V8M9 20V4M15 20v-8M21 20v-6"/></Icon>,
  portaria: (p) => <Icon {...p}><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/></Icon>,
  relatorios: (p) => <Icon {...p}><path d="M5 3h11l4 4v14a1 1 0 01-1 1H5z"/><path d="M15 3v4h5"/><circle cx="9" cy="13" r="1.5"/><path d="M9 14.5L9 19M14 11l-3.5 3.5"/></Icon>,
  inadimplencia: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v.5"/></Icon>,
  importacoes: (p) => <Icon {...p}><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></Icon>,
  calendario: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 14.4l1.4.8-1.6 2.8-1.6-.6a7 7 0 01-1.6.9l-.2 1.7h-3.2l-.2-1.7a7 7 0 01-1.6-.9l-1.6.6L3.2 15.2l1.4-.8a7 7 0 010-1.8l-1.4-.8 1.6-2.8 1.6.6c.5-.4 1-.7 1.6-.9l.2-1.7h3.2l.2 1.7c.6.2 1.1.5 1.6.9l1.6-.6 1.6 2.8-1.4.8a7 7 0 010 1.8z"/></Icon>,
  bell: (p) => <Icon {...p}><path d="M6 8a6 6 0 1112 0c0 5 2 7 2 7H4s2-2 2-7z"/><path d="M10 19a2 2 0 004 0"/></Icon>,
  search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></Icon>,
  filter: (p) => <Icon {...p}><path d="M3 5h18M6 12h12M10 19h4"/></Icon>,
  plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  arrow: (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>,
  arrowDown: (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>,
  arrowUp: (p) => <Icon {...p}><path d="M6 15l6-6 6 6"/></Icon>,
  arrowRight: (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  check: (p) => <Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>,
  close: (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  more: (p) => <Icon {...p}><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></Icon>,
  download: (p) => <Icon {...p}><path d="M12 3v13M7 11l5 5 5-5M4 20h16"/></Icon>,
  upload: (p) => <Icon {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></Icon>,
  mail: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Icon>,
  phone: (p) => <Icon {...p}><path d="M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></Icon>,
  shield: (p) => <Icon {...p}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></Icon>,
  spark: (p) => <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></Icon>,
  building: (p) => <Icon {...p}><rect x="4" y="4" width="16" height="17" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></Icon>,
  chart: (p) => <Icon {...p}><path d="M4 4v16h16"/><path d="M8 14l3-4 3 3 5-6"/></Icon>,
  edit: (p) => <Icon {...p}><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></Icon>,
  menu: (p) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16"/></Icon>,
  star: (p) => <Icon {...p}><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/></Icon>,
  doc: (p) => <Icon {...p}><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v4h5"/><path d="M9 13h6M9 17h4"/></Icon>,
  zap: (p) => <Icon {...p}><path d="M13 3L4 14h7l-1 7 9-11h-7z"/></Icon>,
  layers: (p) => <Icon {...p}><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></Icon>,
  whatsapp: (p) => <Icon {...p}><path d="M5 19l1.5-3.5A8 8 0 1110 19a8 8 0 01-2.5-.4L5 19z"/></Icon>,
  pix: (p) => <Icon {...p}><path d="M5 12L12 5l7 7-7 7z"/><path d="M9 8l3 3 3-3M9 16l3-3 3 3"/></Icon>,
  clock: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  pin: (p) => <Icon {...p}><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></Icon>,
  birthday: (p) => <Icon {...p}><path d="M5 18v-5a2 2 0 012-2h10a2 2 0 012 2v5"/><path d="M3 18h18M9 11V8M15 11V8M12 11V8"/><circle cx="9" cy="6" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="15" cy="6" r="1"/></Icon>,
};

// Brand mark — EPG logo on a rounded badge
function LectivaMark({ size = 36, inverted = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: size * 0.22,
      background: inverted ? '#ffffff' : 'linear-gradient(150deg, var(--brand-500, #3A5FE0), var(--brand-700, #1B36A6))',
      boxShadow: inverted ? 'var(--shadow-xs)' : 'inset 0 1px 0 rgba(255,255,255,.18)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <img src={inverted ? 'uploads/epg-navy.png' : 'uploads/epg-white.png'} alt="EPG"
        style={{ width: '70%', height: 'auto', display: 'block' }} />
    </span>
  );
}

function LectivaWord({ size = 22, color = 'currentColor' }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: size,
      fontStyle: 'italic', letterSpacing: '-0.015em', color,
      fontWeight: 400, lineHeight: 1,
    }}>Lectiva</span>
  );
}

function LectivaLogo({ size = 28, color, inverted = false, compact = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <LectivaMark size={size} inverted={inverted} />
      {!compact && <LectivaWord size={size * 0.95} color={color} />}
    </span>
  );
}

Object.assign(window, { I, Icon, LectivaMark, LectivaWord, LectivaLogo });
