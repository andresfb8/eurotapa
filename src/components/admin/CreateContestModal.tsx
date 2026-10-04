import { useState } from 'react';

interface CreateContestModalProps {
  onClose: () => void;
  onCreate: (
    title: string,
    code?: string,
    adminPin?: string,
    teams?: { memberNames: string[] }[]
  ) => void;
}

export function CreateContestModal({ onClose, onCreate }: CreateContestModalProps) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [adminPin, setAdminPin] = useState('9999');
  const [teamsText, setTeamsText] = useState('Carlos\nMarta, Luis\nJavier, Elena, David');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor introduce un nombre para el concurso.');
      return;
    }

    // Each line is one tapa/team; names separated by commas (max. 3 members per team)
    const lines = teamsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let hadTooMany = false;
    const teams = lines
      .map((line) => {
        const names = line
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        if (names.length > 3) hadTooMany = true;
        return { memberNames: names.slice(0, 3) };
      })
      .filter((t) => t.memberNames.length > 0);

    if (hadTooMany) {
      alert('Alguna línea tenía más de 3 nombres: se usarán solo los 3 primeros de cada equipo.');
    }

    // PINs are assigned by the store, guaranteeing they are unique inside the contest
    onCreate(title.trim(), code.trim() || undefined, adminPin.trim() || '9999', teams);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div>
            <span className="badge badge-green">Nuevo Concurso</span>
            <h2 style={{ fontSize: '1.6rem', marginTop: '4px' }}>Crear Concurso de Tapas</h2>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Nombre / Edición del Concurso *
            </label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Tapas de Primavera 2026, Concurso Peña Gastronómica..."
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Código Corto del Concurso
              </label>
              <input
                type="text"
                className="input mono"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: TAPA26"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                Identificador rápido (opcional)
              </span>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                PIN Superadmin
              </label>
              <input
                type="text"
                className="input mono"
                maxLength={6}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="9999"
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                PIN para administrar este concurso
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Tapas y Equipos
            </label>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Una tapa por línea. Si la cocina un equipo, escribe sus nombres separados por comas
              (máximo 3 personas por tapa). A cada persona se le asignará un PIN único de 4 dígitos.
            </span>
            <textarea
              className="input"
              rows={6}
              value={teamsText}
              onChange={(e) => setTeamsText(e.target.value)}
              placeholder={'Carlos\nMarta, Luis\nJavier, Elena, David'}
            />
          </div>

          <div className="flex items-center justify-end gap-3" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Crear y Activar Concurso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
