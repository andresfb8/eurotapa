import { useEffect, useMemo, useState } from 'react';
import { ContestState, RemoteContestSummary } from '../../types/contest';
import { RulesModal } from '../RulesModal';
import styles from './LoginView.module.css';

interface LoginViewProps {
  contests: ContestState[];
  remoteContests?: RemoteContestSummary[];
  initialError?: string | null;
  activeContestId: string;
  onSelectContest: (contestId: string) => void;
  onLoginWithCode: (code: string, contestId?: string) => Promise<{ success: boolean; error?: string }>;
  onLoginAsTV: (contestId?: string) => void;
}

export function LoginView({
  contests,
  remoteContests,
  initialError,
  activeContestId,
  onSelectContest,
  onLoginWithCode,
  onLoginAsTV
}: LoginViewProps) {
  const [code, setCode] = useState('');
  const [selectedContestId, setSelectedContestId] = useState(activeContestId);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Contests cached on this device + contests announced by the cloud registry
  const contestOptions = useMemo(() => {
    const loadedIds = new Set(contests.map((c) => c.id));
    const loaded = contests.map((c) => ({
      id: c.id,
      label: `${c.title} (${c.members.length} participantes)`,
      pending: false
    }));
    const pending = (remoteContests || [])
      .filter((r) => !loadedIds.has(r.id))
      .map((r) => ({
        id: r.id,
        label: `${r.title}${r.participantsCount ? ` (${r.participantsCount} participantes)` : ''}`,
        pending: true
      }));
    return [...loaded, ...pending];
  }, [contests, remoteContests]);

  useEffect(() => {
    if (contestOptions.length > 0 && !contestOptions.some((o) => o.id === selectedContestId)) {
      setSelectedContestId(contestOptions[0].id);
    }
  }, [contestOptions, selectedContestId]);

  const selectedOption = contestOptions.find((o) => o.id === selectedContestId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Por favor introduce tu código de acceso.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onLoginWithCode(code.trim(), selectedContestId || undefined);
      if (!res.success) {
        setErrorMsg(res.error || 'Código no válido.');
      } else {
        setErrorMsg(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContestChange = (newId: string) => {
    setSelectedContestId(newId);
    onSelectContest(newId);
    setErrorMsg(null);
  };

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
          {contestOptions.length > 1 ? (
            <select
              className={styles.contestSelect}
              value={selectedContestId}
              onChange={(e) => handleContestChange(e.target.value)}
            >
              {contestOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                  {o.pending ? ' — se cargará al entrar' : ''}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              {selectedOption ? selectedOption.label : 'EuroTapa 2026'}
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
            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar al Concurso'}
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
