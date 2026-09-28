import { useState } from 'react';
import { useContest } from './services/contestStore';
import { Navigation, AdminViewTab } from './components/Navigation';
import { LoginView } from './components/auth/LoginView';
import { DrawView } from './components/draw/DrawView';
import { TastingView } from './components/tasting/TastingView';
import { VotingView } from './components/voting/VotingView';
import { GalaTVView } from './components/gala/GalaTVView';
import { AdminPanel } from './components/admin/AdminPanel';

export function App() {
  const {
    state,
    setPhase,
    updateParticipant,
    reorderTasting,
    submitVote,
    setActiveTasting,
    nextGalaStep,
    simulateSampleVotes,
    resetContest,

    // Multi-contest
    contestsList,
    activeContestId,
    createContest,
    switchContest,
    deleteContest,
    addParticipantToContest,
    removeParticipantFromContest,

    // Auth & Session
    session,
    currentParticipant,
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

  // TV View router based on contest state phase
  const renderTVContent = () => {
    switch (state.phase) {
      case 'CONFIGURACION':
      case 'SORTEO':
        return (
          <DrawView
            title={state.title}
            participants={state.participants}
            onReorder={reorderTasting}
            onProceedToTasting={() => setPhase('DEGUSTACION')}
          />
        );

      case 'DEGUSTACION':
        return (
          <TastingView
            participants={state.participants}
            activeId={state.activeTastingId}
            onSelectActive={setActiveTasting}
            onProceedToVoting={() => setPhase('VOTACION')}
          />
        );

      case 'VOTACION': {
        const total = state.participants.length;
        const voted = Object.keys(state.votes).length;

        return (
          <div
            className="container"
            style={{
              maxWidth: '820px',
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px'
            }}
          >
            <span className="badge badge-green" style={{ padding: '6px 16px', fontSize: '13px' }}>
              Votación en Curso
            </span>
            <h1 style={{ fontSize: '3rem' }}>El Jurado está Votando</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '540px' }}>
              Cada participante está puntuando las tapas rivales desde su teléfono móvil (de {total - 1} puntos a 1).
            </p>

            <div
              className="card"
              style={{
                width: '100%',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                PROGRESO EN TIEMPO REAL
              </span>
              <div className="mono" style={{ fontSize: '3.5rem', fontWeight: 800 }}>
                {voted} / {total}
              </div>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                {voted === total ? '¡Todos los votos han sido recibidos!' : 'Esperando los últimos votos...'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                className="btn btn-primary"
                style={{ padding: '12px 24px', fontSize: '15px' }}
                onClick={() => setPhase('GALA_TV')}
                disabled={voted === 0}
              >
                Comenzar la Gran Gala de Eurovisión
                <svg className="icon" viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        );
      }

      case 'GALA_TV':
      case 'PODIO':
        return (
          <GalaTVView
            participants={state.participants}
            votes={state.votes}
            gala={state.gala}
            phase={state.phase}
            onNextGalaStep={nextGalaStep}
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
          participants={state.participants}
          currentParticipant={currentParticipant}
          votes={state.votes}
          phase={state.phase}
          onSubmitVote={submitVote}
          onUpdateParticipant={updateParticipant}
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
            <span style={{ fontSize: '14px', fontWeight: 700 }}>📺 {state.title}</span>
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

        <main style={{ flex: 1 }}>{renderTVContent()}</main>
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
            onAddParticipant={addParticipantToContest}
            onRemoveParticipant={removeParticipantFromContest}
            onSetPhase={setPhase}
            onUpdateParticipant={updateParticipant}
            onSimulateVotes={simulateSampleVotes}
            onReset={resetContest}
            onOpenTV={() => setAdminTab('tv')}
            onLogout={logout}
          />
        ) : (
          renderTVContent()
        )}
      </main>
    </div>
  );
}

export default App;
