import { useState, useMemo, useEffect } from 'react';
import { GalaState, Member, Team, VoteMode, VoteRecord, ContestPhase } from '../../types/contest';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { formatDrawDate } from '../../utils/dates';
import { TapaEditModal } from './TapaEditModal';
import { RankingBallot } from './RankingBallot';
import { GalaCompanion } from './GalaCompanion';
import { TastingCompanion } from './TastingCompanion';
import { RulesModal } from '../RulesModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { AlertIcon, CheckIcon, ChevronDownIcon, LockIcon, LogoutIcon } from '../Icons';
import { Confetti } from '../Confetti';
import styles from './VotingView.module.css';

interface VotingViewProps {
  teams: Team[];
  members: Member[];
  currentMember?: Member | null;
  votes: Record<string, VoteRecord>;
  phase: ContestPhase;
  /** ISO date when the official serving order was fixed; missing while the draw is pending. */
  drawDoneAt?: string;
  title: string;
  gala: GalaState;
  voteMode: VoteMode;
  /** Team whose tapa is on the TV during the tasting. */
  activeTastingId?: string;
  tastingServedUpTo?: number;
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
  title,
  gala,
  voteMode,
  activeTastingId,
  tastingServedUpTo,
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
  // null = follow the phase (folded while tasting and voting); true/false once the person toggles it
  const [fichaOverride, setFichaOverride] = useState<boolean | null>(null);

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

  // Private tasting notes, by team id. Kept only on this phone, like the draft ranking.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const notesKey = currentMember ? `eurotapa_tasting_notes_${currentMember.id}` : null;
  useEffect(() => {
    if (!notesKey) return;
    try {
      const stored = JSON.parse(localStorage.getItem(notesKey) || '{}');
      setNotes(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {});
    } catch {
      setNotes({});
    }
  }, [notesKey]);

  const updateNote = (teamId: string, note: string) => {
    const next = { ...notes, [teamId]: note };
    setNotes(next);
    try {
      if (notesKey) localStorage.setItem(notesKey, JSON.stringify(next));
    } catch {
      // Notes are a convenience: tasting and voting still work without storage
    }
  };

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
              Introduce tu PIN personal de 4 dígitos para preparar la ficha de tu tapa, seguir la cata y votar.
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
              Cómo funciona y cómo se vota
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
  const isGalaLive = phase === 'GALA_TV' || phase === 'PODIO';
  const isAfterTasting = isVotingOpen || isGalaLive;
  const isTasting = phase === 'DEGUSTACION';
  const isDrawDone = !!drawDoneAt;
  const drawDate = drawDoneAt ? formatDrawDate(drawDoneAt) : '';
  const teamsByTurn = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const turnLabel = isDrawDone || isTasting || isAfterTasting ? `Turno #${currentTeam.tastingOrder}` : 'Turno por sortear';

  const isBallotOpen = isVotingOpen && !existingVote;
  const remaining = totalRivalsCount - rankedIds.length;
  const nextPoints = remaining;

  // While tasting and voting the own tapa stays folded, so the action starts at the top
  const isFichaOpen = fichaOverride ?? !(isVotingOpen || isTasting);

  const progressHint =
    rankedIds.length === 0
      ? `Toca tu favorita: se lleva ${totalRivalsCount} puntos.`
      : isVoteComplete
      ? 'Todo ordenado. Arrastra para ajustar o sella tu voto.'
      : `Toca la siguiente: se lleva ${nextPoints} ${nextPoints === 1 ? 'punto' : 'puntos'}.`;

  const fichaCard = isFichaOpen ? (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="flex items-center justify-between" style={{ gap: '8px', flexWrap: 'wrap' }}>
        <div className="flex items-center gap-2">
          <LockIcon />
          <h3 style={{ fontSize: '1.25rem' }}>{teamMembers.length > 1 ? 'Nuestra tapa secreta' : 'Mi tapa secreta'}</h3>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setIsEditModalOpen(true)}>
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Editar ficha y foto
        </button>
      </div>

      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        {currentTeam.photoUrl ? (
          <img
            src={currentTeam.photoUrl}
            alt={currentTeam.dishName}
            style={{ width: '88px', height: '88px', borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-canvas)',
              border: '2px dashed var(--border-color-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
              flexShrink: 0
            }}
          >
            Sin foto
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.15, color: 'var(--text-primary)' }}>
            {currentTeam.dishName || 'Aún sin nombre'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-body)', marginTop: '4px' }}>
            {currentTeam.description || 'Pulsa "Editar ficha y foto" para contar cómo está hecha.'}
          </div>
        </div>
      </div>

      {currentTeam.ingredients.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {currentTeam.ingredients.map((ing, i) => (
            <span key={i} className="badge badge-neutral" style={{ textTransform: 'none' }}>
              {ing}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
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
          {hasIngredients ? 'Ingredientes' : 'Sin ingredientes'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <span>Cocinan:</span>
        {teamMembers.map((m) => (
          <span key={m.id} className={`badge ${m.id === currentMember.id ? 'badge-blue' : 'badge-neutral'}`} style={{ textTransform: 'none' }}>
            {m.name}
            {m.id === currentMember.id ? ' (tú)' : ''}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          Tu PIN: <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{currentMember.pin}</span>
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', backgroundColor: 'var(--color-canvas)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', margin: 0 }}>
        <strong>Es secreta:</strong> la organización y el resto solo ven si la ficha está {isProfileComplete ? 'completa' : 'pendiente'}.
        Nadie verá el plato hasta que salga en la TV en su turno.
      </p>

      {(isVotingOpen || isTasting) && (
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setFichaOverride(false)}>
          Ocultar
        </button>
      )}
    </div>
  ) : (
    <button type="button" className={styles.fichaToggle} onClick={() => setFichaOverride(true)} aria-expanded="false">
      <LockIcon />
      <span className={styles.fichaToggleText}>
        {teamMembers.length > 1 ? 'Nuestra tapa' : 'Mi tapa'}: <strong>{currentTeam.dishName || 'sin nombre todavía'}</strong>
      </span>
      <ChevronDownIcon />
    </button>
  );

  return (
    <div className={`${styles.votingContainer} ${isBallotOpen ? styles.withBottomBar : ''}`}>
      {/* Who is logged in, in one line */}
      <header className={styles.topBar}>
        <div className={styles.avatar} aria-hidden="true">
          {currentMember.name.slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.topBarInfo}>
          <span className={styles.topBarName}>{currentMember.name}</span>
          <span className={styles.topBarMeta}>
            {teamMembers.length > 1 ? `${teamLabel(currentTeam, members)} · ` : ''}
            {turnLabel}
          </span>
        </div>
        <button type="button" className={styles.iconBtn} onClick={() => setIsRulesModalOpen(true)} aria-label="Ver la normativa">
          ?
        </button>
        <button type="button" className={styles.iconBtn} onClick={handleLogout} aria-label="Cerrar sesión">
          <LogoutIcon />
        </button>
      </header>

      {/* Gala night: the phone follows the TV with this person's own tapa in focus */}
      {isGalaLive && (
        <GalaCompanion
          title={title}
          teams={teams}
          members={members}
          votes={votes}
          gala={gala}
          phase={phase}
          voteMode={voteMode}
          currentTeam={currentTeam}
          currentMemberId={currentMember.id}
        />
      )}

      {/* Tasting: follow the tapa on the table, take private notes and build the ranking as you go */}
      {isTasting && (
        <TastingCompanion
          teams={teams}
          members={members}
          currentTeam={currentTeam}
          activeTastingId={activeTastingId}
          servedUpTo={tastingServedUpTo}
          ranking={rankedIds}
          onRankingChange={updateRanking}
          notes={notes}
          onNoteChange={updateNote}
        />
      )}

      {/* Before tasting the own tapa is the main thing; later it moves below the action */}
      {!isGalaLive && !isTasting && !isVotingOpen && fichaCard}

      {!isAfterTasting ? (
        isTasting ? null : isDrawDone ? (
          /* Before the contest day, draw already made: the team knows its turn and can prepare */
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <span className="badge badge-green">
                Orden oficial{drawDate ? ` · sorteado el ${drawDate}` : ''}
              </span>
              <div className={styles.companionRank}>#{currentTeam.tastingOrder}</div>
              <h3 style={{ fontSize: '1.4rem' }}>
                {teamMembers.length > 1 ? 'Servís' : 'Sirves'} en el turno {currentTeam.tastingOrder} de {teams.length}
                {currentTeam.tastingTime ? ` · ${currentTeam.tastingTime} h` : ''}
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '15px' }}>
                {teamMembers.length > 1 ? 'Tenéis' : 'Tienes'} hasta el día del concurso para pensar la tapa, hacer pruebas y completar la ficha secreta.
                Si la organización cambia algún turno, lo verás actualizado aquí.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {teamsByTurn.map((team) => {
                const isOwn = team.id === currentTeam.id;
                return (
                  <div key={team.id} className={`${styles.companionRow} ${isOwn ? styles.companionRowOwn : ''}`}>
                    <span className="mono" style={{ width: '30px', flexShrink: 0 }}>#{team.tastingOrder}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
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
            <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '15px' }}>
              En cuanto la organización haga el sorteo verás aquí vuestro turno y el orden completo, con tiempo para preparar y ensayar la tapa. Mientras tanto ya puedes ir completando la ficha secreta.
            </p>
          </div>
        )
      ) : existingVote && isGalaLive ? null : existingVote ? (
        /* Already voted: sealed */
        <div className={`card ${styles.sealedCard}`}>
          <Confetti count={28} />
          <div className={styles.stamp}>
            <CheckIcon />
            Voto
            <br />
            sellado
          </div>
          <h2 style={{ fontSize: '1.8rem' }}>¡Hecho, {currentMember.name}!</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '15px' }}>
            Tus puntos están guardados. Los resultados se revelan en directo en la pantalla grande cuando empiece la gala, y aquí verás cómo va tu tapa.
          </p>
          {teamMembers.length > 1 && voteMode === 'team' && (
            <p style={{ color: 'var(--text-muted)', maxWidth: '420px', fontSize: '14px' }}>
              Tu reparto se suma al del resto de tu equipo para formar un único voto de vuestra tapa.
            </p>
          )}
        </div>
      ) : !isVotingOpen ? (
        /* Gala already started and this person did not vote in time */
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <span className="badge badge-neutral">Votación cerrada</span>
          <h3 style={{ fontSize: '1.5rem' }}>La gala ya ha comenzado</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '15px' }}>
            La votación se cerró al empezar la gala y tu voto no llegó a sellarse. Puedes seguir aquí arriba cómo va tu tapa.
          </p>
        </div>
      ) : (
        /* Active voting: progress on top, ballot, main action fixed at the bottom */
        <>
          <div className={styles.progressBar}>
            <div className={styles.progressHead}>
              <span className={styles.progressCount}>
                {rankedIds.length}/{totalRivalsCount}
              </span>
              <span className={styles.progressHint}>{progressHint}</span>
            </div>
            <div className={styles.progressSegments} aria-hidden="true">
              {rivals.map((rival, i) => (
                <span
                  key={rival.id}
                  className={`${styles.progressSegment} ${
                    isVoteComplete ? styles.progressSegmentAllDone : i < rankedIds.length ? styles.progressSegmentDone : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <RankingBallot
            rivals={rivals}
            members={members}
            ranking={rankedIds}
            onChange={updateRanking}
            notes={notes}
            onNoteChange={updateNote}
          />

          <div className={styles.bottomBar}>
            <button className="btn btn-primary" disabled={!isVoteComplete} onClick={() => setIsConfirmOpen(true)}>
              {isVoteComplete ? 'Sellar mi voto' : `Te ${remaining === 1 ? 'falta' : 'faltan'} ${remaining} por ordenar`}
            </button>
          </div>
        </>
      )}

      {/* While tasting and voting the own tapa sits below, folded */}
      {(isTasting || isVotingOpen) && fichaCard}

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
          confirmLabel="Sellar y enviar"
          cancelLabel="Revisar otra vez"
          onConfirm={handleSubmitVote}
          onCancel={() => setIsConfirmOpen(false)}
        >
          <p style={{ marginBottom: '12px' }}>Este es tu reparto. Una vez sellado no se puede cambiar.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {rankedIds
              .flatMap((id) => rivals.filter((r) => r.id === id))
              .map((rival) => (
                <div key={rival.id} className={styles.companionRow} style={{ padding: '6px 4px' }}>
                  <span className="mono" style={{ width: '28px', flexShrink: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {assignedScores[rival.id]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rival.dishName || `Tapa de ${teamLabel(rival, members)}`}
                  </span>
                </div>
              ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
