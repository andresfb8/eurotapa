import { useState } from 'react';
import { useContest } from './services/contestStore';
import { Navigation, AdminViewTab } from './components/Navigation';
import { LoginView } from './components/auth/LoginView';
import { DrawView } from './components/draw/DrawView';
import { TastingView } from './components/tasting/TastingView';
import { VotingView } from './components/voting/VotingView';
import { VotingTVView } from './components/voting/VotingTVView';
import { GalaTVView } from './components/gala/GalaTVView';
import { AdminPanel } from './components/admin/AdminPanel';
import { TVShell, TVStage } from './components/tv/TVShell';
import { ContestPhase } from './types/contest';
import { effectiveVoteMode } from './utils/juries';

const PHASE_LABELS: Record<ContestPhase, string> = {
  CONFIGURACION: 'Preparación',
  SORTEO: 'Sorteo',
  DEGUSTACION: 'Degustación',
  VOTACION: 'Votación',
  GALA_TV: 'Gala',
  PODIO: 'Podio'
};

export function App() {
  const {
    state,
    setPhase,
    updateTeam,
    updateMemberPin,
    regenerateMemberPin,
    reorderTasting,
    confirmDraw,
    submitVote,
    removeVote,
    setActiveTasting,
    nextGalaStep,
    undoGalaStep,
    setGalaMode,
    setTvTheme,
    setVoteMode,
    generateTastingSchedule,
    clearTastingSchedule,
    simulateSampleVotes,
    resetContest,

    // Multi-contest
    contestsList,
    adminContestsList,
    updateContestMeta,
    activeContestId,
    createContest,
    switchContest,
    deleteContest,
    addTeamToContest,
    removeTeamFromContest,

    // Auth & Session
    session,
    currentMember,
    loginWithCode,
    loginAsTV,
    logout,

    // Access link bootstrap
    booting,
    bootstrapError,
    remoteContests
  } = useContest();

  // Tab for superadmin: 'admin' or 'tv' preview
  const [adminTab, setAdminTab] = useState<AdminViewTab>('admin');

  // Individual juries when all teams have the same size, one combined vote per team otherwise
  const voteMode = effectiveVoteMode(state.teams, state.members, state.voteMode);

  // TV View router based on contest state phase.
  // canControl is false for the public TV screen (no PIN needed to open it), so it can only display.
  const renderTVContent = (canControl: boolean) => {
    switch (state.phase) {
      case 'CONFIGURACION':
      case 'SORTEO':
        return (
          <DrawView
            title={state.title}
            teams={state.teams}
            members={state.members}
            drawDoneAt={state.drawDoneAt}
            canControl={canControl}
            onReorder={reorderTasting}
            onConfirmDraw={confirmDraw}
            onProceedToTasting={() => setPhase('DEGUSTACION')}
          />
        );

      case 'DEGUSTACION':
        return (
          <TastingView
            teams={state.teams}
            members={state.members}
            activeId={state.activeTastingId}
            canControl={canControl}
            onSelectActive={setActiveTasting}
            onProceedToVoting={() => setPhase('VOTACION')}
          />
        );

      case 'VOTACION':
        return (
          <VotingTVView
            teams={state.teams}
            members={state.members}
            votedCount={Object.keys(state.votes).length}
            totalVoters={state.members.length}
            canControl={canControl}
            onStartGala={() => setPhase('GALA_TV')}
          />
        );

      case 'GALA_TV':
      case 'PODIO':
        return (
          <GalaTVView
            teams={state.teams}
            members={state.members}
            votes={state.votes}
            gala={state.gala}
            phase={state.phase}
            galaMode={state.galaMode}
            voteMode={voteMode}
            canControl={canControl}
            onNextGalaStep={nextGalaStep}
            onUndoGalaStep={undoGalaStep}
            onRestart={() => setPhase('SORTEO')}
          />
        );
    }
  };

  // 0. Opening an access link -> wait until the contest and the session are resolved
  if (booting) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-canvas)',
          padding: '24px'
        }}
      >
        <div className="card" style={{ padding: '32px 40px', textAlign: 'center' }}>
          <div
            className="mono"
            style={{ fontSize: '12px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}
          >
            Abriendo tu espacio
          </div>
          <div style={{ fontSize: '1.4rem', marginTop: '6px' }}>Cargando concurso…</div>
        </div>
      </div>
    );
  }

  // 1. If not logged in -> Portal de Acceso por Código
  if (!session) {
    return (
      <LoginView
        contests={contestsList}
        remoteContests={remoteContests}
        initialError={bootstrapError}
        activeContestId={activeContestId}
        onSelectContest={switchContest}
        onLoginWithCode={loginWithCode}
        onLoginAsTV={loginAsTV}
      />
    );
  }

  // 2. If logged in as PARTICIPANT -> Exclusive Chef Portal (Cannot see other tabs or TV)
  if (session.role === 'participant') {
    return (
      <main style={{ minHeight: '100dvh', backgroundColor: 'var(--color-canvas)', padding: '20px 0' }}>
        <VotingView
          teams={state.teams}
          members={state.members}
          currentMember={currentMember}
          votes={state.votes}
          phase={state.phase}
          drawDoneAt={state.drawDoneAt}
          title={state.title}
          gala={state.gala}
          voteMode={voteMode}
          activeTastingId={state.activeTastingId}
          tastingServedUpTo={state.tastingServedUpTo}
          onSubmitVote={submitVote}
          onUpdateTeam={updateTeam}
          onLogout={logout}
        />
      </main>
    );
  }

  // 3. If logged in as TV -> the stage takes the whole monitor; a thin strip appears with the mouse
  if (session.role === 'tv') {
    return (
      <TVShell
        title={state.title}
        phaseLabel={PHASE_LABELS[state.phase]}
        theme={state.tvTheme}
        onClose={logout}
        extra={
          contestsList.length > 1 && (
            <select
              className="input"
              style={{ padding: '4px 8px', fontSize: '13px', width: 'auto' }}
              value={state.id}
              onChange={(e) => switchContest(e.target.value)}
            >
              {contestsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )
        }
      >
        {renderTVContent(false)}
      </TVShell>
    );
  }

  // 4. If logged in as SUPERADMIN -> Full Multi-Contest Admin Console
  return (
    <div
      data-tv-shell=""
      style={
        adminTab === 'tv'
          ? { display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }
          : { display: 'flex', flexDirection: 'column', minHeight: '100dvh' }
      }
    >
      <Navigation
        role="superadmin"
        contestTitle={state.title}
        phase={state.phase}
        adminTab={adminTab}
        onAdminTabChange={setAdminTab}
        onLogout={logout}
      />

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {adminTab === 'admin' ? (
          <AdminPanel
            state={state}
            contests={adminContestsList}
            onUpdateAdminPin={(pin) => updateContestMeta(state.id, { adminPin: pin })}
            onSelectContest={switchContest}
            onCreateContest={createContest}
            onDeleteContest={deleteContest}
            onAddTeam={addTeamToContest}
            onRemoveTeam={removeTeamFromContest}
            onUpdateMemberPin={updateMemberPin}
            onRegenerateMemberPin={regenerateMemberPin}
            onRemoveVote={removeVote}
            onSetPhase={setPhase}
            onSetGalaMode={setGalaMode}
            onSetTvTheme={setTvTheme}
            onSetVoteMode={setVoteMode}
            onGenerateSchedule={generateTastingSchedule}
            onClearSchedule={clearTastingSchedule}
            onReorder={reorderTasting}
            onConfirmDraw={confirmDraw}
            onSimulateVotes={simulateSampleVotes}
            onReset={resetContest}
            onOpenTV={() => setAdminTab('tv')}
            onLogout={logout}
          />
        ) : (
          <TVStage theme={state.tvTheme}>{renderTVContent(true)}</TVStage>
        )}
      </main>
    </div>
  );
}

export default App;
