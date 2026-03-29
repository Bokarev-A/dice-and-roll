interface EmptyProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function Empty({ icon = '🎲', title, subtitle }: EmptyProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      gap: '12px',
      textAlign: 'center',
    }}>
      <span style={{ fontSize: '3rem' }}>{icon}</span>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        letterSpacing: '0.1em',
      }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}