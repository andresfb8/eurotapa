import { useState } from 'react';
import { ContestState, Participant, ContestPhase } from '../../types/contest';
import styles from './AdminPanel.module.css';

interface AdminPanelProps {
  state: ContestState;
  onSetPhase: (phase: ContestPhase) => void;
  onUpdateParticipant: (participant: Participant) => void;
  onSimulateVotes: () => void;
  onReset: () => void;
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
  onSetPhase,
  onSimulateVotes,
  onReset
}: AdminPanelProps) {
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === state.adminPin) {
      setIsAdminAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const totalParticipants = state.participants.length;
  const votesReceivedCount = Object.keys(state.votes).length;

  // Count how many participants have completed their secret profiles
  const profilesReadyCount = state.participants.filter(
    (p) => !!p.dishName && !!p.photoUrl && p.ingredients.length > 0
  ).length;

  if (!isAdminAuthenticated) {
    return (
      <div className={styles.adminContainer}>
        <div className={styles.loginCard}>
          <div>
            <span className="badge badge-neutral">Superadmin</span>
            <h2 style={{ marginTop: '8px' }}>Mando de Control</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Introduce el PIN maestro para acceder a la gestión del concurso.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              className="input mono"
              maxLength={6}
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              placeholder="PIN maestro (por defecto: 9999)"
              required
            />
            {authError && <div className="badge badge-red">PIN maestro incorrecto</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Acceder como Superadmin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminContainer}>
      <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <span className="badge badge-green">Superadmin Conectado</span>
          <h1 style={{ fontSize: '2rem', marginTop: '6px' }}>Mando Central del Organizador</h1>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (window.confirm('¿Reiniciar todo el concurso a los valores originales de prueba?')) {
              onReset();
            }
          }}
        >
          Reiniciar Concurso
        </button>
      </div>

      {/* Phase Switcher */}
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Fase Actual del Evento</h3>
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

      {/* Metrics */}
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

      {/* Participants & Readiness Checklist */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
          <h3>Chequeo de Participantes</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Comparte a cada amigo su código PIN personal
          </span>
        </div>

        <div className={styles.votersGrid}>
          {state.participants.map((p) => {
            const hasDishName = !!p.dishName && p.dishName.trim().length > 0;
            const hasPhoto = !!p.photoUrl && p.photoUrl.trim().length > 0;
            const hasIngredients = p.ingredients && p.ingredients.length > 0;
            const isComplete = hasDishName && hasPhoto && hasIngredients;
            const hasVoted = !!state.votes[p.id];

            return (
              <div key={p.id} className={styles.voterCard}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Turno: <strong>#{p.tastingOrder}</strong> • Código: <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.pin}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {/* Secret Tapa Readiness Indicator */}
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

                  {/* Voting Status */}
                  <span className={`badge ${hasVoted ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                    {hasVoted ? 'Ya Votó' : 'Sin Votar'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
