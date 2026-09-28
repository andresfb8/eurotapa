import { useState } from 'react';
import { ContestState, Participant, ContestPhase } from '../../types/contest';
import { CreateContestModal } from './CreateContestModal';
import { buildParticipantLink, buildTvLink, getPublicAppBaseUrl, isLocalOrigin } from '../../utils/appUrl';
import styles from './AdminPanel.module.css';

interface AdminPanelProps {
  state: ContestState;
  contests: ContestState[];
  onSelectContest: (contestId: string) => void;
  onCreateContest: (
    title: string,
    code?: string,
    adminPin?: string,
    participants?: { name: string; pin: string }[]
  ) => void;
  onDeleteContest: (contestId: string) => void;
  onAddParticipant: (contestId: string, name: string, pin?: string) => void;
  onRemoveParticipant: (contestId: string, participantId: string) => void;
  onSetPhase: (phase: ContestPhase) => void;
  onUpdateParticipant: (participant: Participant) => void;
  onSimulateVotes: () => void;
  onReset: () => void;
  onOpenTV?: () => void;
  onLogout?: () => void;
}

const PHASES: { key: ContestPhase; label: string }[] = [
  { key: 'CONFIGURACION', label: '1. Configuración' },
  { key: 'SORTEO', label: '2. Sorteo' },
  { key: 'DEGUSTACION', label: '3. Degustación' },
  { key: 'VOTACION', label: '4. Votación Móvil' },
  { key: 'GALA_TV', label: '5. Gala en Vivo' },
  { key: 'PODIO', label: '6. Podio Final' }
];

export function AdminPanel({
  state,
  contests,
  onSelectContest,
  onCreateContest,
  onDeleteContest,
  onAddParticipant,
  onRemoveParticipant,
  onSetPhase,
  onSimulateVotes,
  onReset,
  onOpenTV,
  onLogout
}: AdminPanelProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null);
  const [isTvLinkCopied, setIsTvLinkCopied] = useState(false);

  const totalParticipants = state.participants.length;
  const votesReceivedCount = Object.keys(state.votes).length;

  const isLocal = isLocalOrigin();
  const publicBaseUrl = getPublicAppBaseUrl();

  const profilesReadyCount = state.participants.filter(
    (p) => !!p.dishName && !!p.photoUrl && p.ingredients.length > 0
  ).length;

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantName.trim()) return;
    onAddParticipant(state.id, newParticipantName.trim());
    setNewParticipantName('');
  };

  const handleCopyTvLink = () => {
    const link = buildTvLink(state.id);
    navigator.clipboard.writeText(link).then(() => {
      setIsTvLinkCopied(true);
      setTimeout(() => setIsTvLinkCopied(false), 2500);
    }).catch(() => {
      prompt('Copia este enlace para abrir la pantalla de TV en otro dispositivo:', link);
    });
  };

  const handleCopyParticipantLink = (participant: Participant) => {
    const link = buildParticipantLink(state.id, participant.pin);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedParticipantId(participant.id);
      setTimeout(() => setCopiedParticipantId(null), 2500);
    }).catch(() => {
      prompt('Copia este enlace para el participante:', link);
    });
  };

  return (
    <div className={styles.adminContainer}>
      {/* Top Bar with Multi-Contest Switcher & Session Controls */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-green">Superadmin</span>
              <span className="badge badge-neutral">PIN Maestro: {state.adminPin}</span>
              {state.code && <span className="badge badge-blue">Código: {state.code}</span>}
            </div>
            <h1 style={{ fontSize: '1.9rem', marginTop: '6px' }}>{state.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {onOpenTV && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenTV}
                title="Abrir pantalla de proyección para la TV"
              >
                📺 Modo TV
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyTvLink}
              title="Copiar enlace para abrir la pantalla de TV en otro dispositivo"
            >
              {isTvLinkCopied ? '✓ Enlace TV Copiado' : '🔗 Enlace TV'}
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              ➕ Nuevo Concurso
            </button>

            {onLogout && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
                title="Cerrar sesión de Superadmin"
              >
                Salir
              </button>
            )}
          </div>
        </div>

        {/* Multi-Contest Selector Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: '240px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Administrar concurso:
            </span>
            <select
              className="input"
              style={{ padding: '6px 12px', fontSize: '13px', width: 'auto', flex: 1, maxWidth: '320px' }}
              value={state.id}
              onChange={(e) => onSelectContest(e.target.value)}
            >
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.participants.length} participantes - {c.phase})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {contests.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--pastel-red-text)' }}
                onClick={() => {
                  if (window.confirm(`¿Estás seguro de eliminar el concurso "${state.title}"? Esta acción no se puede deshacer.`)) {
                    onDeleteContest(state.id);
                  }
                }}
              >
                🗑️ Eliminar Concurso
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (window.confirm('¿Reiniciar las votaciones y fases de este concurso?')) {
                  onReset();
                }
              }}
            >
              Reiniciar Concurso
            </button>
          </div>
        </div>
      </div>

      {/* Local server notice */}
      {isLocal && (
        <div className="card" style={{ backgroundColor: 'var(--pastel-yellow-bg)', borderColor: '#EBD9A6' }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--pastel-yellow-text)' }}>
                Estás en un servidor local
              </strong>
              <p style={{ fontSize: '13px', color: 'var(--pastel-yellow-text)', marginTop: '2px' }}>
                Los enlaces se generan con <span className="mono">{publicBaseUrl}</span>, así que sí funcionan en los móviles.
                Ten en cuenta que apuntan al sitio publicado: ejecuta <span className="mono">npm run build</span> y despliega
                para que los concursantes reciban la última versión.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phase Switcher */}
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Fase Actual del Concurso</h3>
        <div className={styles.phaseTabs}>
          {PHASES.map((p) => (
            <button
              key={p.key}
              className={`${styles.phaseTab} ${state.phase === p.key ? styles.phaseTabActive : ''}`}
              onClick={() => onSetPhase(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
          Cambiar de fase actualiza automáticamente la pantalla de TV y las opciones visibles en los móviles de los participantes.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fichas Secretas Listas
          </span>
          <div className={styles.statNumber}>
            {profilesReadyCount} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/ {totalParticipants}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Votos Registrados
          </span>
          <div className={styles.statNumber}>
            {votesReceivedCount} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/ {totalParticipants}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estado de Gala
          </span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700 }}>
            {state.phase === 'GALA_TV' ? `Jurado ${state.gala.currentVoterIndex + 1}` : state.phase}
          </div>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="card" style={{ backgroundColor: 'var(--color-canvas)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '18px' }}>🔒</span>
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              Privacidad y Secreto de Tapas Garantizado
            </strong>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Para mantener la sorpresa y emoción del concurso, los nombres de tapas, fotos e ingredientes están ocultos en este panel. Solo ves el estado de preparación de cada participante.
            </p>
          </div>
        </div>
      </div>

      {/* Fast testing action */}
      <div className="card" style={{ backgroundColor: 'var(--pastel-blue-bg)', borderColor: '#BEDDF3' }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ color: 'var(--pastel-blue-text)' }}>⚡ Simulación Inmediata para Pruebas</h3>
            <p style={{ fontSize: '13px', color: '#1A4D6E', marginTop: '2px' }}>
              Genera votos de prueba para todos los participantes con 1 clic y pasa directo a la Gala de Eurovisión en TV.
            </p>
          </div>
          <button className="btn btn-primary" onClick={onSimulateVotes}>
            Simular Votos y Abrir Gala
          </button>
        </div>
      </div>

      {/* Participants Management */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3>Participantes de este Concurso ({totalParticipants})</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Comparte el PIN personal o copia el enlace directo para WhatsApp
            </span>
          </div>

          {/* Add participant form */}
          <form onSubmit={handleAddParticipant} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input"
              style={{ padding: '6px 12px', fontSize: '13px', width: '180px' }}
              placeholder="Nombre del amigo..."
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              ➕ Añadir
            </button>
          </form>
        </div>

        <div className={styles.votersGrid}>
          {state.participants.map((p) => {
            const hasDishName = !!p.dishName && p.dishName.trim().length > 0;
            const hasPhoto = !!p.photoUrl && p.photoUrl.trim().length > 0;
            const hasIngredients = p.ingredients && p.ingredients.length > 0;
            const isComplete = hasDishName && hasPhoto && hasIngredients;
            const hasVoted = !!state.votes[p.id];
            const isCopied = copiedParticipantId === p.id;

            return (
              <div key={p.id} className={styles.voterCard}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Turno: <strong>#{p.tastingOrder}</strong> • PIN: <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.pin}</span>
                  </div>

                  <div
                    className="mono"
                    style={{
                      marginTop: '6px',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={`Enlace de acceso de ${p.name}`}
                  >
                    {buildParticipantLink(state.id, p.pin)}
                  </div>

                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => handleCopyParticipantLink(p)}
                      title="Copiar enlace directo de acceso para enviar por WhatsApp"
                    >
                      {isCopied ? '✓ ¡Enlace Copiado!' : '📋 WhatsApp Link'}
                    </button>

                    {state.participants.length > 3 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--pastel-red-text)' }}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar a ${p.name} de este concurso?`)) {
                            onRemoveParticipant(state.id, p.id);
                          }
                        }}
                        title="Eliminar participante"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {isComplete ? (
                    <span className="badge badge-green" title="Nombre, ingredientes y fotografía listos">
                      ✓ Ficha Lista
                    </span>
                  ) : !hasPhoto ? (
                    <span className="badge badge-yellow" title="Falta subir la fotografía de la tapa">
                      Falta Foto
                    </span>
                  ) : (
                    <span className="badge badge-neutral" title="Pendiente de rellenar datos">
                      Incompleta
                    </span>
                  )}

                  <span className={`badge ${hasVoted ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                    {hasVoted ? 'Ya Votó' : 'Sin Votar'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateContestModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={onCreateContest}
        />
      )}
    </div>
  );
}
