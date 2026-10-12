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
    generateTastingSchedule,
    clearTastingSchedule,
    simulateSampleVotes,
    resetContest,

    // Multi-contest
    contestsList,
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
          minHeight: '100vh',
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
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)', padding: '20px 0' }}>
        <VotingView
          teams={state.teams}
          members={state.members}
          currentMember={currentMember}
          votes={state.votes}
          phase={state.phase}
          drawDoneAt={state.drawDoneAt}
          title={state.title}
          gala={state.gala}
          activeTastingId={state.activeTastingId}
          tastingServedUpTo={state.tastingServedUpTo}
          onSubmitVote={submitVote}
          onUpdateTeam={updateTeam}
          onLogout={logout}
        />
      </main>
    );
  }

  // 3. If logged in as TV -> Large Screen TV View (With discrete exit option)
  if (session.role === 'tv') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--border-color)',
            padding: '8px var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{state.title}</span>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              Fase: {state.phase}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {contestsList.length > 1 && (
              <select
                className="input"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                value={state.id}
                onChange={(e) => switchContest(e.target.value)}
              >
                {contestsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={logout}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              Cerrar TV
            </button>
          </div>
        </header>

        <main style={{ flex: 1 }}>{renderTVContent(false)}</main>
      </div>
    );
  }

  // 4. If logged in as SUPERADMIN -> Full Multi-Contest Admin Console
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation
        role="superadmin"
        contestTitle={state.title}
        phase={state.phase}
        adminTab={adminTab}
        onAdminTabChange={setAdminTab}
        onLogout={logout}
      />

      <main style={{ flex: 1 }}>
        {adminTab === 'admin' ? (
          <AdminPanel
            state={state}
            contests={contestsList}
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
          renderTVContent(true)
        )}
      </main>
    </div>
  );
}

export default App;
