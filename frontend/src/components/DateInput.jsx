function toDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DateInput({ value, onChange, style, className }) {
  const { width, ...inputStyle } = style || {};

  return (
    <div style={{ position: 'relative', display: 'inline-block', width }}>
      {/* Visible display in dd/mm/yyyy */}
      <input
        type="text"
        readOnly
        value={toDisplay(value)}
        placeholder="jj/mm/aaaa"
        className={className}
        style={{ width: '100%', cursor: 'pointer', paddingRight: 28, ...inputStyle }}
      />
      {/* Calendar icon */}
      <span style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', fontSize: 13, color: 'var(--text-muted)', userSelect: 'none',
      }}>📅</span>
      {/* Invisible native date picker that captures clicks */}
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0, opacity: 0,
          cursor: 'pointer', width: '100%', height: '100%',
        }}
      />
    </div>
  );
}
