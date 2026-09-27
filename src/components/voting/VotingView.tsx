import { useState, useMemo } from 'react';
import { Participant, VoteRecord, ContestPhase } from '../../types/contest';
import { TapaEditModal } from './TapaEditModal';
import { RulesModal } from '../RulesModal';
import styles from './VotingView.module.css';

interface VotingViewProps {
  participants: Participant[];
  currentParticipant?: Participant | null;
  votes: Record<string, VoteRecord>;
  phase: ContestPhase;
  onSubmitVote: (vote: VoteRecord) => void;
  onUpdateParticipant: (participant: Participant) => void;
  onLogout?: () => void;
}

export function VotingView({
  participants,
  currentParticipant: initialParticipant,
  votes,
  phase,
  onSubmitVote,
  onUpdateParticipant,
  onLogout
}: VotingViewProps) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(initialParticipant?.id || '');
  const [enteredPin, setEnteredPin] = useState<string>(initialParticipant?.pin || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialParticipant);
  const [authError, setAuthError] = useState<string | null>(null);

  // Voting state: targetParticipantId -> points
  const [assignedScores, setAssignedScores] = useState<Record<string, number>>({});
  const [expandedTapaId, setExpandedTapaId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Find active participant
  const currentParticipant = useMemo(() => {
    if (initialParticipant) {
      return participants.find((p) => p.id === initialParticipant.id) || initialParticipant;
    }
    if (selectedParticipantId) {
      return participants.find((p) => p.id === selectedParticipantId);
    }
    if (enteredPin.trim().length === 4) {
      return participants.find((p) => p.pin === enteredPin.trim());
    }
    return undefined;
  }, [participants, initialParticipant, selectedParticipantId, enteredPin]);

  // Rivals to vote for: all participants EXCEPT the current logged-in participant
  const rivals = useMemo(() => {
    if (!currentParticipant) return [];
    return participants.filter((p) => p.id !== currentParticipant.id);
  }, [participants, currentParticipant]);

  // Total points to distribute: from (N-1) down to 1
  const totalRivalsCount = rivals.length;
  const availablePointsList = useMemo(() => {
    const list: number[] = [];
    for (let pts = totalRivalsCount; pts >= 1; pts--) {
      list.push(pts);
    }
    return list;
  }, [totalRivalsCount]);

  // Which points are currently already used
  const usedPoints = useMemo(() => new Set(Object.values(assignedScores)), [assignedScores]);

  // Check if all points are allocated
  const isVoteComplete = useMemo(() => {
    if (Object.keys(assignedScores).length !== totalRivalsCount) return false;
    return availablePointsList.every((pts) => usedPoints.has(pts));
  }, [assignedScores, totalRivalsCount, availablePointsList, usedPoints]);

  // Has current participant already submitted?
  const existingVote = currentParticipant ? votes[currentParticipant.id] : undefined;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = enteredPin.trim();

    if (!pin) {
      setAuthError('Por favor introduce tu código PIN de 4 dígitos.');
      return;
    }

    let matched = currentParticipant;
    if (!matched) {
      matched = participants.find((p) => p.pin === pin);
    }

    if (!matched || matched.pin !== pin) {
      setAuthError('Código PIN no encontrado. Consulta con el organizador.');
      return;
    }

    setSelectedParticipantId(matched.id);
    setAuthError(null);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    setIsAuthenticated(false);
    setEnteredPin('');
    setSelectedParticipantId('');
    setAssignedScores({});
  };

  const handleAssignPoint = (targetId: string, pointStr: string) => {
    const pts = parseInt(pointStr, 10);
    setAssignedScores((prev) => {
      const next = { ...prev };
      if (isNaN(pts) || pts <= 0) {
        delete next[targetId];
      } else {
        Object.entries(next).forEach(([id, val]) => {
          if (val === pts && id !== targetId) {
            delete next[id];
          }
        });
        next[targetId] = pts;
      }
      return next;
    });
  };

  const handleSubmitVote = () => {
    if (!currentParticipant || !isVoteComplete) return;

    if (window.confirm('¿Confirmas el envío definitivo de tus votos? No podrás modificarlos una vez sellados.')) {
      const record: VoteRecord = {
        voterId: currentParticipant.id,
        voterName: currentParticipant.name,
        scores: assignedScores,
        submittedAt: new Date().toISOString()
      };
      onSubmitVote(record);
    }
  };

  // If not authenticated: show fallback login
  if (!isAuthenticated || !currentParticipant) {
    return (
      <div className={styles.votingContainer}>
        <div className={styles.loginCard}>
          <div>
            <span className="badge badge-neutral">Portal del Chef</span>
            <h1 style={{ marginTop: '8px', fontSize: '2rem' }}>Acceso a tu Tapa Secreta</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Introduce tu código personal de 4 dígitos para editar los detalles de tu plato y participar en las votaciones.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Selecciona tu Nombre (Opcional)
              </label>
              <select
                className="input"
                value={selectedParticipantId}
                onChange={(e) => {
                  setSelectedParticipantId(e.target.value);
                  setAuthError(null);
                }}
              >
                <option value="">-- Elige tu nombre o escribe directamente tu PIN abajo --</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Tu Código PIN (4 dígitos)
              </label>
              <input
                type="password"
                className="input mono"
                maxLength={4}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="Ej: 1001"
                required
              />
            </div>

            {authError && (
              <div className="badge badge-red" style={{ padding: '6px 12px', alignSelf: 'flex-start' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              Entrar a mi Portal
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsRulesModalOpen(true)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              Consultar Normativa y Sistema de Puntos
            </button>
          </form>
        </div>

        {isRulesModalOpen && <RulesModal onClose={() => setIsRulesModalOpen(false)} />}
      </div>
    );
  }

  const hasDishName = !!currentParticipant.dishName && currentParticipant.dishName.trim().length > 0;
  const hasPhoto = !!currentParticipant.photoUrl && currentParticipant.photoUrl.trim().length > 0;
  const hasIngredients = currentParticipant.ingredients && currentParticipant.ingredients.length > 0;
  const isProfileComplete = hasDishName && hasPhoto && hasIngredients;

  const isVotingOpen = phase === 'VOTACION' || phase === 'GALA_TV' || phase === 'PODIO';

  return (
    <div className={styles.votingContainer}>
      {/* Participant Header (Exclusive for this user) */}
      <div className={styles.editTapaCard}>
        <div>
          <span className="badge badge-green">Chef Conectado</span>
          <h2 style={{ fontSize: '1.6rem', marginTop: '4px' }}>{currentParticipant.name}</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Turno de cocina: <strong>#{currentParticipant.tastingOrder}</strong> • PIN personal: <span className="mono">{currentParticipant.pin}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsRulesModalOpen(true)}
            title="Ver normativa del concurso"
          >
            ? Normativa
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            title="Salir y cambiar de usuario"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Secret Tapa Management Card (Accessible at all times) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '16px' }}>🔒</span>
            <h3 style={{ fontSize: '1.25rem' }}>Mi Tapa Secreta</h3>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsEditModalOpen(true)}
          >
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Editar Ficha y Foto
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {currentParticipant.photoUrl ? (
            <img
              src={currentParticipant.photoUrl}
              alt={currentParticipant.dishName}
              style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
            />
          ) : (
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-canvas)',
                border: '1px dashed var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '4px'
              }}
            >
              Sin foto
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-primary)' }}>
              {currentParticipant.dishName || 'Sin título definido'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-body)', marginTop: '4px' }}>
              {currentParticipant.description || 'Pulsa en "Editar Ficha y Foto" para añadir la elaboración.'}
            </div>
            {currentParticipant.ingredients.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {currentParticipant.ingredients.map((ing, i) => (
                  <span key={i} className="badge badge-neutral" style={{ fontSize: '11px', textTransform: 'none' }}>
                    {ing}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Readiness Checklist */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Estado:</span>
          <span className={`badge ${hasDishName ? 'badge-green' : 'badge-yellow'}`}>
            {hasDishName ? '✓ Nombre listo' : '⚠️ Falta nombre'}
          </span>
          <span className={`badge ${hasPhoto ? 'badge-green' : 'badge-yellow'}`}>
            {hasPhoto ? '✓ Foto subida' : '⚠️ Falta foto'}
          </span>
          <span className={`badge ${hasIngredients ? 'badge-green' : 'badge-neutral'}`}>
            {hasIngredients ? '✓ Ingredientes indicados' : '⚠️ Sin ingredientes'}
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', backgroundColor: 'var(--color-canvas)', padding: '8px 12px', borderRadius: '4px', margin: 0 }}>
          🔒 <strong>Confidencialidad absoluta:</strong> El organizador y los demás participantes solo ven que has completado la ficha ({isProfileComplete ? 'Completada' : 'Pendiente'}), pero nadie verá tu plato ni ingredientes hasta que llegue tu turno de cata en la TV.
        </p>
      </div>

      {/* Voting Section */}
      {!isVotingOpen ? (
        /* Waiting banner while in SORTEO or DEGUSTACION */
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <span className="badge badge-blue">
            Fase Actual: {phase === 'SORTEO' ? 'Sorteo previo de cocina' : 'Degustación y Cata'}
          </span>
          <h3 style={{ fontSize: '1.5rem' }}>Las votaciones se abrirán tras la cata</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '14px' }}>
            Cocina y sirve tu plato cuando llegue tu <strong>Turno #{currentParticipant.tastingOrder}</strong>. En cuanto todos los comensales hayan probado todas las tapas, el organizador activará aquí el reparto de puntos estilo Eurovisión.
          </p>
        </div>
      ) : existingVote ? (
        /* If already voted: Show locked confirmation */
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
          <div className="badge badge-green" style={{ fontSize: '13px', padding: '6px 16px' }}>
            ✓ Voto Sellado y Registrado
          </div>
          <h2 style={{ fontSize: '1.8rem' }}>¡Tus puntos han sido guardados!</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '14px' }}>
            Gracias por participar, {currentParticipant.name}. Los resultados se revelarán en directo en la pantalla de TV al comenzar la Gran Gala de EuroTapa.
          </p>
        </div>
      ) : (
        /* Active Eurovision Voting Section */
        <>
          <div className={styles.stickyHeader}>
            <div className="flex items-center justify-between">
              <span className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                PUNTOS A REPARTIR (DE {totalRivalsCount} A 1):
              </span>
              <span className="mono" style={{ fontSize: '12px', color: isVoteComplete ? 'var(--pastel-green-text)' : 'var(--text-muted)' }}>
                {Object.keys(assignedScores).length}/{totalRivalsCount} asignados
              </span>
            </div>

            <div className={styles.remainingPointsBar}>
              {availablePointsList.map((pts) => {
                const isUsed = usedPoints.has(pts);
                return (
                  <span
                    key={pts}
                    className={`${styles.pointBadge} ${isUsed ? styles.pointBadgeUsed : ''}`}
                    title={isUsed ? `Punto ${pts} asignado` : `Punto ${pts} disponible`}
                  >
                    {pts}
                  </span>
                );
              })}
            </div>
          </div>

          <div className={styles.rivalsList}>
            {rivals.map((rival) => {
              const currentScore = assignedScores[rival.id];
              const isExpanded = expandedTapaId === rival.id;

              return (
                <div key={rival.id} className={styles.tapaCard}>
                  <div className={styles.tapaHeader}>
                    {rival.photoUrl ? (
                      <img src={rival.photoUrl} alt={rival.dishName} className={styles.tapaThumb} />
                    ) : (
                      <div className={styles.tapaThumb} style={{ backgroundColor: 'var(--color-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                        Sin foto
                      </div>
                    )}

                    <div className={styles.tapaInfo}>
                      <div className={styles.dishTitle}>{rival.dishName || `Tapa de ${rival.name}`}</div>
                      <div className={styles.authorText}>Chef: {rival.name}</div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedTapaId(isExpanded ? null : rival.id)}
                      style={{ padding: '4px 8px' }}
                      title="Ver ingredientes y detalles"
                    >
                      {isExpanded ? 'Ocultar' : 'Ficha'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className={styles.accordionContent}>
                      {rival.description && <p style={{ marginBottom: '8px' }}>{rival.description}</p>}
                      {rival.ingredients.length > 0 && (
                        <div>
                          <strong>Ingredientes:</strong> {rival.ingredients.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.pointAssignmentArea}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Puntos para esta tapa:
                    </span>

                    <div className="flex items-center gap-2">
                      {currentScore && (
                        <span className={styles.assignedPill}>
                          ★ {currentScore} {currentScore === 1 ? 'pt' : 'pts'}
                        </span>
                      )}

                      <select
                        className={styles.selectorSelect}
                        value={currentScore || ''}
                        onChange={(e) => handleAssignPoint(rival.id, e.target.value)}
                      >
                        <option value="">-- Asignar puntos --</option>
                        {availablePointsList.map((pts) => {
                          const isAssignedElsewhere = usedPoints.has(pts) && currentScore !== pts;
                          return (
                            <option key={pts} value={pts} disabled={isAssignedElsewhere}>
                              {pts} puntos {isAssignedElsewhere ? '(Ya asignado)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
            disabled={!isVoteComplete}
            onClick={handleSubmitVote}
          >
            {isVoteComplete
              ? 'Sellar y Enviar mis Puntos'
              : `Asigna todos los puntos (${Object.keys(assignedScores).length}/{totalRivalsCount})`}
          </button>
        </>
      )}

      {/* Edit modal */}
      {isEditModalOpen && (
        <TapaEditModal
          participant={currentParticipant}
          onSave={onUpdateParticipant}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* Rules modal */}
      {isRulesModalOpen && <RulesModal onClose={() => setIsRulesModalOpen(false)} />}
    </div>
  );
}
