import { useState, useMemo, useEffect } from 'react';
import { Member, Team, VoteRecord, ContestPhase } from '../../types/contest';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { formatDrawDate } from '../../utils/dates';
import { TapaEditModal } from './TapaEditModal';
import { RankingBallot } from './RankingBallot';
import { RulesModal } from '../RulesModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { AlertIcon, CheckIcon, LockIcon } from '../Icons';
import styles from './VotingView.module.css';

interface VotingViewProps {
  teams: Team[];
  members: Member[];
  currentMember?: Member | null;
  votes: Record<string, VoteRecord>;
  phase: ContestPhase;
  /** ISO date when the official serving order was fixed; missing while the draw is pending. */
  drawDoneAt?: string;
  onSubmitVote: (vote: VoteRecord) => void;
  onUpdateTeam: (team: Team) => void;
  onLogout?: () => void;
}

export function VotingView({
  teams,
  members,
  currentMember: initialMember,
  votes,
  phase,
  drawDoneAt,
  onSubmitVote,
  onUpdateTeam,
  onLogout
}: VotingViewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMember?.id || '');
  const [enteredPin, setEnteredPin] = useState<string>(initialMember?.pin || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialMember);
  const [authError, setAuthError] = useState<string | null>(null);

  // Voting state: rival team ids from favourite to least favourite
  const [ranking, setRanking] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Find active member (a person) and their team
  const currentMember = useMemo(() => {
    if (initialMember) {
      return members.find((m) => m.id === initialMember.id) || initialMember;
    }
    if (selectedMemberId) {
      return members.find((m) => m.id === selectedMemberId);
    }
    if (enteredPin.trim().length === 4) {
      return members.find((m) => m.pin === enteredPin.trim());
    }
    return undefined;
  }, [members, initialMember, selectedMemberId, enteredPin]);

  const currentTeam = useMemo(() => {
    if (!currentMember) return undefined;
    return teams.find((t) => t.id === currentMember.teamId);
  }, [teams, currentMember]);

  // Rivals to vote for: every team EXCEPT the one this member cooks with
  const rivals = useMemo(() => {
    if (!currentTeam) return [];
    return teams.filter((t) => t.id !== currentTeam.id);
  }, [teams, currentTeam]);

  // Total points to distribute: from (number of rival tapas) down to 1
  const totalRivalsCount = rivals.length;

  // The unfinished ranking is kept on this phone, so a reload or a locked screen does not lose it
  const draftKey = currentMember ? `eurotapa_vote_draft_${currentMember.id}` : null;
  useEffect(() => {
    if (!draftKey) return;
    try {
      const stored = JSON.parse(localStorage.getItem(draftKey) || '[]');
      setRanking(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);
    } catch {
      setRanking([]);
    }
  }, [draftKey]);

  const updateRanking = (next: string[]) => {
    setRanking(next);
    try {
      if (draftKey) localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      // The draft is a convenience: voting still works without storage
    }
  };

  // Only rivals that still exist count (a team may have been removed while the draft was open)
  const rankedIds = useMemo(
    () => ranking.filter((id, index) => rivals.some((r) => r.id === id) && ranking.indexOf(id) === index),
    [ranking, rivals]
  );

  // Position decides the points: first place gets N-1, last place 1
  const assignedScores = useMemo(() => {
    const scores: Record<string, number> = {};
    rankedIds.forEach((id, index) => {
      scores[id] = totalRivalsCount - index;
    });
    return scores;
  }, [rankedIds, totalRivalsCount]);

  const isVoteComplete = totalRivalsCount > 0 && rankedIds.length === totalRivalsCount;

  // Has current member already submitted?
  const existingVote = currentMember ? votes[currentMember.id] : undefined;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = enteredPin.trim();

    if (!pin) {
      setAuthError('Por favor introduce tu código PIN de 4 dígitos.');
      return;
    }

    let matched = currentMember;
    if (!matched) {
      matched = members.find((m) => m.pin === pin);
    }

    if (!matched || matched.pin !== pin) {
      setAuthError('Código PIN no encontrado. Consulta con el organizador.');
      return;
    }

    setSelectedMemberId(matched.id);
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
    setSelectedMemberId('');
    setRanking([]);
  };

  const handleSubmitVote = () => {
    if (!currentMember || !isVoteComplete) return;

    const record: VoteRecord = {
      voterId: currentMember.id,
      voterName: currentMember.name,
      scores: assignedScores,
      submittedAt: new Date().toISOString()
    };
    onSubmitVote(record);
    setIsConfirmOpen(false);
    try {
      if (draftKey) localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  };

  // If not authenticated: show fallback login
  if (!isAuthenticated || !currentMember || !currentTeam) {
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
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  setAuthError(null);
                }}
              >
                <option value="">-- Elige tu nombre o escribe directamente tu PIN abajo --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
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

  const teamMembers = membersOfTeam(currentTeam.id, members);
  const hasDishName = !!currentTeam.dishName && currentTeam.dishName.trim().length > 0;
  const hasPhoto = !!currentTeam.photoUrl && currentTeam.photoUrl.trim().length > 0;
  const hasIngredients = currentTeam.ingredients && currentTeam.ingredients.length > 0;
  const isProfileComplete = hasDishName && hasPhoto && hasIngredients;

  // Voting closes when the gala starts: a late vote would change the juries mid-reveal
  const isVotingOpen = phase === 'VOTACION';
  const isAfterTasting = isVotingOpen || phase === 'GALA_TV' || phase === 'PODIO';
  const isTasting = phase === 'DEGUSTACION';
  const isDrawDone = !!drawDoneAt;
  const drawDate = drawDoneAt ? formatDrawDate(drawDoneAt) : '';
  const teamsByTurn = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const turnLabel = isDrawDone || isTasting || isAfterTasting ? `Turno #${currentTeam.tastingOrder}` : 'Turno por sortear';

  return (
    <div className={styles.votingContainer}>
      {/* Member Header (Exclusive for this person) */}
      <div className={styles.editTapaCard}>
        <div>
          <span className="badge badge-green">Chef Conectado</span>
          <h2 style={{ fontSize: '1.6rem', marginTop: '4px' }}>{currentMember.name}</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Equipo: <strong>{teamLabel(currentTeam, members)}</strong> · {turnLabel} · PIN personal:{' '}
            <span className="mono">{currentMember.pin}</span>
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

      {/* Secret Tapa Management Card (Editable by any member of the team) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div className="flex items-center gap-2">
            <LockIcon />
            <h3 style={{ fontSize: '1.25rem' }}>Nuestra Tapa Secreta</h3>
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
          {currentTeam.photoUrl ? (
            <img
              src={currentTeam.photoUrl}
              alt={currentTeam.dishName}
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
              {currentTeam.dishName || 'Sin título definido'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-body)', marginTop: '4px' }}>
              {currentTeam.description || 'Pulsa en "Editar Ficha y Foto" para añadir la elaboración.'}
            </div>
            {currentTeam.ingredients.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {currentTeam.ingredients.map((ing, i) => (
                  <span key={i} className="badge badge-neutral" style={{ fontSize: '11px', textTransform: 'none' }}>
                    {ing}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team members */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cocinan esta tapa:</span>
          {teamMembers.map((m) => (
            <span key={m.id} className={`badge ${m.id === currentMember.id ? 'badge-blue' : 'badge-neutral'}`} style={{ fontSize: '11px', textTransform: 'none' }}>
              {m.name}
              {m.id === currentMember.id ? ' (tú)' : ''}
            </span>
          ))}
        </div>

        {/* Readiness Checklist */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Estado:</span>
          <span className={`badge ${hasDishName ? 'badge-green' : 'badge-yellow'}`}>
            {hasDishName ? <CheckIcon /> : <AlertIcon />}
            {hasDishName ? 'Nombre listo' : 'Falta nombre'}
          </span>
          <span className={`badge ${hasPhoto ? 'badge-green' : 'badge-yellow'}`}>
            {hasPhoto ? <CheckIcon /> : <AlertIcon />}
            {hasPhoto ? 'Foto subida' : 'Falta foto'}
          </span>
          <span className={`badge ${hasIngredients ? 'badge-green' : 'badge-neutral'}`}>
            {hasIngredients ? <CheckIcon /> : <AlertIcon />}
            {hasIngredients ? 'Ingredientes indicados' : 'Sin ingredientes'}
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', backgroundColor: 'var(--color-canvas)', padding: '8px 12px', borderRadius: '4px', margin: 0 }}>
          <strong>Confidencialidad absoluta:</strong> El organizador y los demás participantes solo ven que la ficha del equipo está completada ({isProfileComplete ? 'Completada' : 'Pendiente'}), pero nadie verá el plato ni los ingredientes hasta que llegue el turno de cata en la TV.
        </p>
      </div>

      {/* Voting Section */}
      {!isAfterTasting ? (
        isTasting ? (
          /* Contest day: tasting in progress */
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <span className="badge badge-blue">Fase Actual: Degustación y Cata</span>
            <h3 style={{ fontSize: '1.5rem' }}>Las votaciones se abrirán tras la cata</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '14px' }}>
              Cocina y sirve tu plato cuando llegue vuestro <strong>Turno #{currentTeam.tastingOrder}</strong>. En cuanto todos los comensales hayan probado todas las tapas, el organizador activará aquí el reparto de puntos estilo Eurovisión.
            </p>
          </div>
        ) : isDrawDone ? (
          /* Before the contest day, draw already made: the team knows its turn and can prepare */
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <span className="badge badge-green">
                Orden oficial{drawDate ? ` · sorteado el ${drawDate}` : ''}
              </span>
              <h3 style={{ fontSize: '1.5rem' }}>
                {teamMembers.length > 1 ? 'Servís' : 'Sirves'} en el Turno #{currentTeam.tastingOrder} de {teams.length}
                {currentTeam.tastingTime ? ` · ${currentTeam.tastingTime} h` : ''}
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '14px' }}>
                {teamMembers.length > 1 ? 'Tenéis' : 'Tienes'} hasta el día del concurso para pensar la tapa, hacer pruebas y completar la ficha secreta.
                Si la organización cambia algún turno, lo verás actualizado aquí.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              {teamsByTurn.map((team) => {
                const isOwn = team.id === currentTeam.id;
                return (
                  <div
                    key={team.id}
                    className="flex items-center justify-between"
                    style={{
                      gap: '12px',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      backgroundColor: isOwn ? 'var(--pastel-blue-bg)' : 'transparent',
                      color: isOwn ? 'var(--pastel-blue-text)' : 'var(--text-body)',
                      fontWeight: isOwn ? 600 : 400
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="mono" style={{ marginRight: '8px' }}>#{team.tastingOrder}</span>
                      {teamLabel(team, members)}
                      {isOwn ? ' (tu equipo)' : ''}
                    </span>
                    {team.tastingTime && <span className="mono" style={{ flexShrink: 0 }}>{team.tastingTime} h</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Before the contest day, draw still pending */
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <span className="badge badge-yellow">Sorteo pendiente</span>
            <h3 style={{ fontSize: '1.5rem' }}>Aún no se han sorteado los turnos</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '14px' }}>
              En cuanto la organización haga el sorteo verás aquí vuestro turno y el orden completo, con tiempo para preparar y ensayar la tapa. Mientras tanto ya puedes ir completando la ficha secreta.
            </p>
          </div>
        )
      ) : existingVote ? (
        /* If already voted: Show locked confirmation */
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
          <div className="badge badge-green" style={{ fontSize: '13px', padding: '6px 16px' }}>
            <CheckIcon />
            Voto Sellado y Registrado
          </div>
          <h2 style={{ fontSize: '1.8rem' }}>¡Tus puntos han sido guardados!</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '14px' }}>
            Gracias por participar, {currentMember.name}. Los resultados se revelarán en directo en la pantalla de TV al comenzar la Gran Gala de EuroTapa.
          </p>
          {teamMembers.length > 1 && (
            <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '13px' }}>
              Tu reparto se sumará al del resto de tu equipo para formar un único voto de vuestra tapa.
            </p>
          )}
        </div>
      ) : !isVotingOpen ? (
        /* Gala already started and this person did not vote in time */
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <span className="badge badge-neutral">Votación cerrada</span>
          <h3 style={{ fontSize: '1.5rem' }}>La gala ya ha comenzado</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '14px' }}>
            La votación se cerró al empezar la gala y tu voto no llegó a sellarse. Sigue los resultados en la pantalla de TV.
          </p>
        </div>
      ) : (
        /* Active Eurovision Voting Section */
        <>
          <div className={styles.stickyHeader}>
            <div className="flex items-center justify-between">
              <span className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                ORDENA LAS TAPAS (DE {totalRivalsCount} A 1 PUNTOS)
              </span>
              <span className="mono" style={{ fontSize: '12px', color: isVoteComplete ? 'var(--pastel-green-text)' : 'var(--text-muted)' }}>
                {rankedIds.length}/{totalRivalsCount} ordenadas
              </span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Toca las tapas de tu favorita a la que menos te gustó. Después arrastra o usa las flechas para ajustar.
            </span>
          </div>

          <RankingBallot rivals={rivals} members={members} ranking={rankedIds} onChange={updateRanking} />

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
            disabled={!isVoteComplete}
            onClick={() => setIsConfirmOpen(true)}
          >
            {isVoteComplete
              ? 'Sellar y Enviar mis Puntos'
              : `Ordena todas las tapas (${rankedIds.length}/${totalRivalsCount})`}
          </button>
        </>
      )}

      {/* Edit modal */}
      {isEditModalOpen && (
        <TapaEditModal
          team={currentTeam}
          members={members}
          onSave={onUpdateTeam}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* Rules modal */}
      {isRulesModalOpen && <RulesModal onClose={() => setIsRulesModalOpen(false)} />}

      {/* Final confirmation before sealing the vote */}
      {isConfirmOpen && (
        <ConfirmDialog
          title="¿Sellar tu voto?"
          confirmLabel="Sellar y Enviar mis Puntos"
          cancelLabel="Revisar otra vez"
          onConfirm={handleSubmitVote}
          onCancel={() => setIsConfirmOpen(false)}
        >
          <p style={{ marginBottom: '12px' }}>
            Este es tu reparto. Una vez sellado no podrás modificarlo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rankedIds
              .flatMap((id) => rivals.filter((r) => r.id === id))
              .map((rival) => (
                <div key={rival.id} className="flex items-center justify-between" style={{ gap: '12px' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rival.dishName || `Tapa de ${teamLabel(rival, members)}`}
                  </span>
                  <span className="mono" style={{ fontWeight: 700, flexShrink: 0 }}>
                    {assignedScores[rival.id]} {assignedScores[rival.id] === 1 ? 'pt' : 'pts'}
                  </span>
                </div>
              ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
