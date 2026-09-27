import { useState } from 'react';
import { ContestPhase, UserRole } from '../types/contest';
import { RulesModal } from './RulesModal';

export type AdminViewTab = 'admin' | 'tv';

interface NavigationProps {
  role: UserRole;
  contestTitle: string;
  phase: ContestPhase;
  participantName?: string;
  adminTab?: AdminViewTab;
  onAdminTabChange?: (tab: AdminViewTab) => void;
  onLogout: () => void;
}

export function Navigation({
  role,
  contestTitle,
  phase,
  participantName,
  adminTab = 'admin',
  onAdminTabChange,
  onLogout
}: NavigationProps) {
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  return (
    <>
      <header
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px var(--space-6)',
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
          {/* Brand mark and contest title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {contestTitle}
              </div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                {role === 'superadmin' && 'Panel Superadmin'}
                {role === 'participant' && `Chef: ${participantName || 'Participante'}`}
                {role === 'tv' && 'Modo Pantalla TV'}
              </div>
            </div>
          </div>

          {/* Superadmin View Switcher (Only visible to superadmin) */}
          {role === 'superadmin' && onAdminTabChange && (
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
                type="button"
                className="btn btn-sm"
                style={{
                  backgroundColor: adminTab === 'admin' ? 'var(--color-surface)' : 'transparent',
                  border: adminTab === 'admin' ? '1px solid var(--border-color)' : '1px solid transparent',
                  boxShadow: adminTab === 'admin' ? '0 1px 2px rgba(0,0,0,0.03)' : 'none'
                }}
                onClick={() => onAdminTabChange('admin')}
              >
                ⚙️ Mando Admin
              </button>

              <button
                type="button"
                className="btn btn-sm"
                style={{
                  backgroundColor: adminTab === 'tv' ? 'var(--color-surface)' : 'transparent',
                  border: adminTab === 'tv' ? '1px solid var(--border-color)' : '1px solid transparent',
                  boxShadow: adminTab === 'tv' ? '0 1px 2px rgba(0,0,0,0.03)' : 'none'
                }}
                onClick={() => onAdminTabChange('tv')}
              >
                📺 Ver TV
              </button>
            </div>
          )}

          {/* Right actions: Rules, Phase, Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              Fase: {phase}
            </span>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsRulesOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                fontWeight: 600
              }}
              title="Consultar la normativa y reglas del concurso"
            >
              ? Reglas
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              style={{ padding: '4px 10px', fontSize: '12px' }}
              title="Salir y volver a la pantalla de código"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Rules Modal */}
      {isRulesOpen && <RulesModal onClose={() => setIsRulesOpen(false)} />}
    </>
  );
}
