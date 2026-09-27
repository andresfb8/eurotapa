import { useState } from 'react';
import { ContestState } from '../../types/contest';
import { RulesModal } from '../RulesModal';
import styles from './LoginView.module.css';

interface LoginViewProps {
  contests: ContestState[];
  activeContestId: string;
  onSelectContest: (contestId: string) => void;
  onLoginWithCode: (code: string, contestId?: string) => { success: boolean; error?: string };
  onLoginAsTV: (contestId?: string) => void;
}

export function LoginView({
  contests,
  activeContestId,
  onSelectContest,
  onLoginWithCode,
  onLoginAsTV
}: LoginViewProps) {
  const [code, setCode] = useState('');
  const [selectedContestId, setSelectedContestId] = useState(activeContestId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Por favor introduce tu código de acceso.');
      return;
    }

    const res = onLoginWithCode(code.trim(), selectedContestId);
    if (!res.success) {
      setErrorMsg(res.error || 'Código no válido.');
    } else {
      setErrorMsg(null);
    }
  };

  const handleContestChange = (newId: string) => {
    setSelectedContestId(newId);
    onSelectContest(newId);
    setErrorMsg(null);
  };

  const activeContest = contests.find((c) => c.id === selectedContestId) || contests[0];

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        {/* Brand identity */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogo}>ET</div>
          <div>
            <h1 className={styles.title}>EuroTapa</h1>
            <p className={styles.subtitle}>
              Concurso Gastronómico entre Amigos con la emoción de la gala de Eurovisión
            </p>
          </div>
        </div>

        {/* Contest selector (if multiple contests exist or single informative pill) */}
        <div className={styles.contestPicker}>
          <span className={styles.contestPickerLabel}>Concurso Activo</span>
          {contests.length > 1 ? (
            <select
              className={styles.contestSelect}
              value={selectedContestId}
              onChange={(e) => handleContestChange(e.target.value)}
            >
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.participants.length} participantes)
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              {activeContest ? activeContest.title : 'EuroTapa 2026'}
            </div>
          )}
        </div>

        {/* Form: PIN or Access Code */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className={styles.pinInputWrapper}>
            <div className={styles.pinLabel}>
              <span>Introduce tu Código o PIN</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>
                4 dígitos
              </span>
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              className={styles.pinInput}
              placeholder="••••"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              autoFocus
              required
            />
          </div>

          {errorMsg && (
            <div
              className="badge badge-red"
              style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'center', lineHeight: 1.4 }}
            >
              {errorMsg}
            </div>
          )}

          <div className={styles.actions}>
            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
              Entrar al Concurso
              <svg className="icon" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <div className={styles.divider}>o accede como</div>

            <div className={styles.secondaryOptions}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.tvBtn}`}
                onClick={() => onLoginAsTV(selectedContestId)}
                title="Abrir la pantalla grande para el televisor o proyector del salón"
              >
                📺 Modo Pantalla TV
              </button>

              <button
                type="button"
                className={`btn btn-secondary ${styles.rulesBtn}`}
                onClick={() => setIsRulesOpen(true)}
                title="Consultar la normativa y sistema de votación"
              >
                ? Reglas
              </button>
            </div>
          </div>
        </form>

        {/* Hints for demo testing */}
        <div className={styles.demoHints}>
          <div>
            <strong>👨‍🍳 Participantes:</strong> Cada amigo introduce su código personal (ej: <code>1001</code> Carlos, <code>1002</code> Marta, <code>1003</code> Javier...).
          </div>
          <div style={{ marginTop: '4px' }}>
            <strong>⚙️ Superadmin:</strong> PIN maestro <code>9999</code> para gestionar concursos, fases y participantes.
          </div>
        </div>
      </div>

      {isRulesOpen && <RulesModal onClose={() => setIsRulesOpen(false)} />}
    </div>
  );
}
