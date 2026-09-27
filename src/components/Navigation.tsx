import { useState } from 'react';
import { ContestPhase } from '../types/contest';
import { RulesModal } from './RulesModal';

export type ActiveTab = 'tv' | 'voting' | 'admin';

interface NavigationProps {
  currentTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  phase: ContestPhase;
}

export function Navigation({ currentTab, onTabChange, phase }: NavigationProps) {
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  return (
    <>
      <header
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--border-color)',
          padding: '12px var(--space-6)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Brand identity mark */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => onTabChange('tv')}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: 'var(--text-primary)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: '15px'
              }}
            >
              ET
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                EuroTapa
              </div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Edición 2026
              </div>
            </div>
          </div>

          {/* View Switcher Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-canvas)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '3px'
            }}
          >
            <button
              className="btn btn-sm"
              style={{
                backgroundColor: currentTab === 'tv' ? 'var(--color-surface)' : 'transparent',
                border: currentTab === 'tv' ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow: currentTab === 'tv' ? '0 1px 2px rgba(0,0,0,0.03)' : 'none'
              }}
              onClick={() => onTabChange('tv')}
            >
              📺 Modo TV
            </button>

            <button
              className="btn btn-sm"
              style={{
                backgroundColor: currentTab === 'voting' ? 'var(--color-surface)' : 'transparent',
                border: currentTab === 'voting' ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow: currentTab === 'voting' ? '0 1px 2px rgba(0,0,0,0.03)' : 'none'
              }}
              onClick={() => onTabChange('voting')}
            >
              📱 Votar (Móvil)
            </button>

            <button
              className="btn btn-sm"
              style={{
                backgroundColor: currentTab === 'admin' ? 'var(--color-surface)' : 'transparent',
                border: currentTab === 'admin' ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow: currentTab === 'admin' ? '0 1px 2px rgba(0,0,0,0.03)' : 'none'
              }}
              onClick={() => onTabChange('admin')}
            >
              ⚙️ Admin
            </button>
          </div>

          {/* Right side: Normativa Button & Phase */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsRulesOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                fontWeight: 600
              }}
              title="Consultar la normativa y reglas del concurso"
            >
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--text-inverse)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800
                }}
              >
                ?
              </span>
              Normativa
            </button>

            <span className="badge badge-neutral">
              Fase: {phase}
            </span>
          </div>
        </div>
      </header>

      {/* Rules Modal */}
      {isRulesOpen && <RulesModal onClose={() => setIsRulesOpen(false)} />}
    </>
  );
}
