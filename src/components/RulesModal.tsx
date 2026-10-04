interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 250,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '88vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '28px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div>
            <span className="badge badge-yellow">Reglamento Oficial</span>
            <h2 style={{ fontSize: '1.8rem', marginTop: '4px' }}>Normativa de EuroTapa</h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Cerrar normativa"
          >
            ✕
          </button>
        </div>

        {/* Rules Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', lineHeight: 1.6 }}>
          {/* Rule 1 */}
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ color: 'var(--pastel-yellow-text)', fontSize: '15px' }}>01.</span>
              Regla de Oro: Prohibido el Auto-Voto
            </div>
            <p style={{ color: 'var(--text-body)' }}>
              Al igual que en Eurovisión, ningún participante puede votar por su propia tapa. Si la tapa la cocina un equipo,
              ninguno de sus miembros podrá votarla: aparecerá automáticamente deshabilitada en vuestros móviles.
            </p>
          </div>

          {/* Rule 2 */}
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ color: 'var(--pastel-yellow-text)', fontSize: '15px' }}>02.</span>
              Reparto Estricto de Puntos (de N-1 a 1)
            </div>
            <p style={{ color: 'var(--text-body)' }}>
              Si compiten 8 tapas, cada jurado repartirá <strong>7 puntos</strong> a su tapa preferida, <strong>6 puntos</strong> a la
              segunda, y así sucesivamente hasta <strong>1 punto</strong>. No se pueden repetir puntos ni dejar huecos sin calificar.
              Cada miembro de un equipo emite su propio voto.
            </p>
          </div>

          {/* Rule 3 */}
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ color: 'var(--pastel-yellow-text)', fontSize: '15px' }}>03.</span>
              Sorteo y Turnos de Salida
            </div>
            <p style={{ color: 'var(--text-body)' }}>
              El orden en el que se sirven las tapas se define en el sorteo previo en la TV. Respeta tu turno para que cada plato salga recién cocinado y a la temperatura óptima.
            </p>
          </div>

          {/* Rule 4 */}
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ color: 'var(--pastel-yellow-text)', fontSize: '15px' }}>04.</span>
              Transparencia e Ingredientes
            </div>
            <p style={{ color: 'var(--text-body)' }}>
              Cada equipo debe registrar el nombre, ingredientes clave y foto de su tapa. Esto permite a los amigos consultar posibles alérgenos y recordar los matices de cada plato antes de puntuar.
            </p>
          </div>

          {/* Rule 5 */}
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-canvas-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ color: 'var(--pastel-yellow-text)', fontSize: '15px' }}>05.</span>
              Criterio Oficial de Desempate
            </div>
            <p style={{ color: 'var(--text-body)' }}>
              En caso de empate a puntos totales en la clasificación, vencerá la tapa que haya obtenido más puntuaciones máximas (más 9s, más 8s, etc.).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            EuroTapa • La mejor gastronomía entre amigos
          </span>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Entendido, ¡a cocinar!
          </button>
        </div>
      </div>
    </div>
  );
}
