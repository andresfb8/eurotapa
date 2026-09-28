import { useState } from 'react';

interface CreateContestModalProps {
  onClose: () => void;
  onCreate: (
    title: string,
    code?: string,
    adminPin?: string,
    participants?: { name: string; pin: string }[]
  ) => void;
}

export function CreateContestModal({ onClose, onCreate }: CreateContestModalProps) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [adminPin, setAdminPin] = useState('9999');
  const [participantsText, setParticipantsText] = useState(
    'Carlos\nMarta\nJavier\nElena\nDavid\nLaura'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Por favor introduce un nombre para el concurso.');
      return;
    }

    // Parse participant names
    const lines = participantsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // PINs are assigned by the store, guaranteeing they are unique inside the contest
    const participants = lines.map((name) => ({ name, pin: '' }));

    onCreate(title.trim(), code.trim() || undefined, adminPin.trim() || '9999', participants);
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
              Nombres de los Amigos / Participantes
            </label>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Escribe un nombre por línea. A cada participante se le asignará un PIN único de 4 dígitos dentro de este concurso (1001, 1002, 1003...). Podrás añadir más participantes después.
            </span>
            <textarea
              className="input"
              rows={6}
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
              placeholder="Carlos&#10;Marta&#10;Javier..."
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
