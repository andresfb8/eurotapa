import { useState } from 'react';
import { useContest } from './services/contestStore';
import { Navigation, ActiveTab } from './components/Navigation';
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
    resetContest
  } = useContest();

  // Active tab in UI: 'tv' | 'voting' | 'admin'
  const [activeTab, setActiveTab] = useState<ActiveTab>('tv');

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

              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab('voting')}
              >
                Ir a Votar en mi Móvil
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation
        currentTab={activeTab}
        onTabChange={setActiveTab}
        phase={state.phase}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'tv' && renderTVContent()}

        {activeTab === 'voting' && (
          <VotingView
            participants={state.participants}
            votes={state.votes}
            phase={state.phase}
            onSubmitVote={submitVote}
            onUpdateParticipant={updateParticipant}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            state={state}
            onSetPhase={setPhase}
            onUpdateParticipant={updateParticipant}
            onSimulateVotes={simulateSampleVotes}
            onReset={resetContest}
          />
        )}
      </main>
    </div>
  );
}
export default App;
