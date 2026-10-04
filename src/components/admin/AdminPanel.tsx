import { useEffect, useState } from 'react';
import { ContestState, GalaMode, Member } from '../../types/contest';
import { CreateContestModal } from './CreateContestModal';
import { buildParticipantLink, buildTvLink, getPublicAppBaseUrl, isLocalOrigin } from '../../utils/appUrl';
import { membersOfTeam, teamLabel } from '../../utils/teams';
import { formatVotingReminder } from '../../utils/whatsappExport';
import { isValidPin } from '../../utils/pins';
import styles from './AdminPanel.module.css';

interface AdminPanelProps {
  state: ContestState;
  contests: ContestState[];
  onSelectContest: (contestId: string) => void;
  onCreateContest: (
    title: string,
    code?: string,
    adminPin?: string,
    teams?: { memberNames: string[] }[]
  ) => void;
  onDeleteContest: (contestId: string) => void;
  onAddTeam: (contestId: string, memberNames: string[]) => void;
  onRemoveTeam: (contestId: string, teamId: string) => void;
  onUpdateMemberPin: (memberId: string, pin: string) => void;
  onRegenerateMemberPin: (memberId: string) => void;
  onRemoveVote: (memberId: string) => void;
  onSetPhase: (phase: ContestState['phase']) => void;
  onSetGalaMode: (mode: GalaMode) => void;
  onGenerateSchedule: (startTime: string, minutesPerTeam: number) => void;
  onSimulateVotes: () => void;
  onReset: () => void;
  onOpenTV?: () => void;
  onLogout?: () => void;
}

const PHASES: { key: ContestState['phase']; label: string }[] = [
  { key: 'CONFIGURACION', label: '1. Configuración' },
  { key: 'SORTEO', label: '2. Sorteo' },
  { key: 'DEGUSTACION', label: '3. Degustación' },
  { key: 'VOTACION', label: '4. Votación Móvil' },
  { key: 'GALA_TV', label: '5. Gala en Vivo' },
  { key: 'PODIO', label: '6. Podio Final' }
];

const GALA_MODES: { key: GalaMode; label: string; description: string }[] = [
  {
    key: 'CLASICA',
    label: 'Clásica — uno a uno',
    description: 'Cada punto de cada jurado se revela con un clic, del más bajo a la puntuación máxima.'
  },
  {
    key: 'DRAMATICA',
    label: 'Dramática — Reparto rápido + Top 3',
    description: 'Los puntos bajos se entregan todos de golpe con un clic y después el Top 3 se revela uno a uno.'
  },
  {
    key: 'MAXIMA',
    label: 'Solo la máxima',
    description: 'Reparto rápido de los puntos bajos en un clic y después se revela únicamente la puntuación máxima.'
  },
  {
    key: 'DIRECTA',
    label: 'Directa — todo de golpe',
    description: 'El voto completo de cada jurado se entrega con un solo clic. Ideal si la gala va con prisa.'
  }
];

interface MemberRowProps {
  member: Member;
  hasVoted: boolean;
  takenPins: Set<string>;
  copiedMemberId: string | null;
  onCopyLink: (member: Member) => void;
  onSavePin: (memberId: string, pin: string) => void;
  onRegeneratePin: (memberId: string) => void;
  onRemoveVote: (member: Member) => void;
}

function MemberRow({
  member,
  hasVoted,
  takenPins,
  copiedMemberId,
  onCopyLink,
  onSavePin,
  onRegeneratePin,
  onRemoveVote
}: MemberRowProps) {
  const [pinDraft, setPinDraft] = useState(member.pin);

  useEffect(() => {
    setPinDraft(member.pin);
  }, [member.pin]);

  const commitPin = () => {
    const clean = pinDraft.trim();
    if (clean === member.pin) return;
    if (!isValidPin(clean)) {
      alert('El PIN debe ser un código de 4 dígitos.');
      setPinDraft(member.pin);
      return;
    }
    if (takenPins.has(clean)) {
      alert(`El PIN ${clean} ya está en uso por otra persona de este concurso.`);
      setPinDraft(member.pin);
      return;
    }
    onSavePin(member.id, clean);
  };

  const isCopied = copiedMemberId === member.id;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '6px 0',
        borderTop: '1px solid var(--border-subtle)',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{member.name}</span>
        <span className={`badge ${hasVoted ? 'badge-green' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
          {hasVoted ? 'Ya Votó' : 'Sin Votar'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          className="input mono"
          value={pinDraft}
          maxLength={4}
          inputMode="numeric"
          onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commitPin}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          title="PIN personal (editable)"
          style={{ width: '58px', padding: '3px 6px', fontSize: '12px', textAlign: 'center' }}
        />

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '3px 8px' }}
          onClick={() => onCopyLink(member)}
          title="Copiar enlace directo de acceso para enviar por WhatsApp"
        >
          {isCopied ? '✓ Copiado' : '📋 Enlace'}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '11px', padding: '3px 8px' }}
          onClick={() => onRegeneratePin(member.id)}
          title="Generar un PIN nuevo para esta persona"
        >
          ↻ PIN
        </button>

        {hasVoted && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--pastel-red-text)' }}
            onClick={() => onRemoveVote(member)}
            title="Reabrir el voto sellado de esta persona"
          >
            Reabrir voto
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminPanel({
  state,
  contests,
  onSelectContest,
  onCreateContest,
  onDeleteContest,
  onAddTeam,
  onRemoveTeam,
  onUpdateMemberPin,
  onRegenerateMemberPin,
  onRemoveVote,
  onSetPhase,
  onSetGalaMode,
  onGenerateSchedule,
  onSimulateVotes,
  onReset,
  onOpenTV,
  onLogout
}: AdminPanelProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeamNames, setNewTeamNames] = useState('');
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [isTvLinkCopied, setIsTvLinkCopied] = useState(false);
  const [isAllLinksCopied, setIsAllLinksCopied] = useState(false);
  const [isReminderCopied, setIsReminderCopied] = useState(false);
  const [scheduleStart, setScheduleStart] = useState('14:00');
  const [scheduleMinutes, setScheduleMinutes] = useState('15');

  const totalTeams = state.teams.length;
  const totalMembers = state.members.length;
  const votesReceivedCount = Object.keys(state.votes).length;

  const isLocal = isLocalOrigin();
  const publicBaseUrl = getPublicAppBaseUrl();

  const profilesReadyCount = state.teams.filter(
    (t) => !!t.dishName && !!t.photoUrl && t.ingredients.length > 0
  ).length;

  const sortedTeams = [...state.teams].sort((a, b) => a.tastingOrder - b.tastingOrder);
  const pendingMembers = state.members.filter((m) => !state.votes[m.id]);
  const galaMode: GalaMode = state.galaMode ?? 'CLASICA';

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const names = newTeamNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) return;
    if (names.length > 3) {
      alert('Un equipo puede tener como máximo 3 personas. Se usarán las 3 primeras.');
    }
    onAddTeam(state.id, names.slice(0, 3));
    setNewTeamNames('');
  };

  const handleCopyTvLink = () => {
    const link = buildTvLink(state.id);
    navigator.clipboard.writeText(link).then(() => {
      setIsTvLinkCopied(true);
      setTimeout(() => setIsTvLinkCopied(false), 2500);
    }).catch(() => {
      prompt('Copia este enlace para abrir la pantalla de TV en otro dispositivo:', link);
    });
  };

  const handleCopyParticipantLink = (member: Member) => {
    const link = buildParticipantLink(state.id, member.pin);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedMemberId(member.id);
      setTimeout(() => setCopiedMemberId(null), 2500);
    }).catch(() => {
      prompt(`Copia este enlace para ${member.name}:`, link);
    });
  };

  const handleCopyAllLinks = () => {
    const lines = state.members.map((m) => `${m.name}: ${buildParticipantLink(state.id, m.pin)}`);
    const text = `${state.title} — Enlaces de acceso\n\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setIsAllLinksCopied(true);
      setTimeout(() => setIsAllLinksCopied(false), 2500);
    }).catch(() => {
      prompt('Copia los enlaces de acceso:', text);
    });
  };

  const handleCopyReminder = () => {
    const text = formatVotingReminder(
      state.title,
      pendingMembers.map((m) => m.name),
      publicBaseUrl
    );
    navigator.clipboard.writeText(text).then(() => {
      setIsReminderCopied(true);
      setTimeout(() => setIsReminderCopied(false), 2500);
    }).catch(() => {
      prompt('Copia el recordatorio para el grupo:', text);
    });
  };

  const handleRemoveVote = (member: Member) => {
    if (
      window.confirm(
        `¿Reabrir el voto de ${member.name}? Podrá volver a votar. Si la gala ya había comenzado, usa "Deshacer" o reinicia la gala para evitar descuadres.`
      )
    ) {
      onRemoveVote(member.id);
    }
  };

  const handleGenerateSchedule = () => {
    const minutes = parseInt(scheduleMinutes, 10);
    if (isNaN(minutes) || minutes <= 0 || minutes > 240) {
      alert('Indica los minutos entre turnos (1 a 240).');
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(scheduleStart.trim())) {
      alert('Indica una hora de inicio válida, por ejemplo 14:00.');
      return;
    }
    onGenerateSchedule(scheduleStart.trim(), minutes);
  };

  return (
    <div className={styles.adminContainer}>
      {/* Top Bar with Multi-Contest Switcher & Session Controls */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-green">Superadmin</span>
              <span className="badge badge-neutral">PIN Maestro: {state.adminPin}</span>
              {state.code && <span className="badge badge-blue">Código: {state.code}</span>}
            </div>
            <h1 style={{ fontSize: '1.9rem', marginTop: '6px' }}>{state.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {onOpenTV && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenTV}
                title="Abrir pantalla de proyección para la TV"
              >
                Modo TV
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyTvLink}
              title="Copiar enlace para abrir la pantalla de TV en otro dispositivo"
            >
              {isTvLinkCopied ? '✓ Enlace TV Copiado' : 'Enlace TV'}
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              ➕ Nuevo Concurso
            </button>

            {onLogout && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
                title="Cerrar sesión de Superadmin"
              >
                Salir
              </button>
            )}
          </div>
        </div>

        {/* Multi-Contest Selector Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: '240px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Administrar concurso:
            </span>
            <select
              className="input"
              style={{ padding: '6px 12px', fontSize: '13px', width: 'auto', flex: 1, maxWidth: '320px' }}
              value={state.id}
              onChange={(e) => onSelectContest(e.target.value)}
            >
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.teams.length} tapas - {c.members.length} personas - {c.phase})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {contests.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--pastel-red-text)' }}
                onClick={() => {
                  if (window.confirm(`¿Estás seguro de eliminar el concurso "${state.title}"? Esta acción no se puede deshacer.`)) {
                    onDeleteContest(state.id);
                  }
                }}
              >
                🗑️ Eliminar Concurso
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (window.confirm('¿Reiniciar las votaciones y fases de este concurso?')) {
                  onReset();
                }
              }}
            >
              Reiniciar Concurso
            </button>
          </div>
        </div>
      </div>

      {/* Local server notice */}
      {isLocal && (
        <div className="card" style={{ backgroundColor: 'var(--pastel-yellow-bg)', borderColor: '#EBD9A6' }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--pastel-yellow-text)' }}>
                Estás en un servidor local
              </strong>
              <p style={{ fontSize: '13px', color: 'var(--pastel-yellow-text)', marginTop: '2px' }}>
                Los enlaces se generan con <span className="mono">{publicBaseUrl}</span>, así que sí funcionan en los móviles.
                Ten en cuenta que apuntan al sitio publicado: ejecuta <span className="mono">npm run build</span> y despliega
                para que los concursantes reciban la última versión.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phase Switcher */}
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Fase Actual del Concurso</h3>
        <div className={styles.phaseTabs}>
          {PHASES.map((p) => (
            <button
              key={p.key}
              className={`${styles.phaseTab} ${state.phase === p.key ? styles.phaseTabActive : ''}`}
              onClick={() => onSetPhase(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
          Cambiar de fase actualiza automáticamente la pantalla de TV y las opciones visibles en los móviles de los participantes.
        </p>
      </div>

      {/* Gala configuration */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3>Configuración de la Gala</h3>
          <span className="badge badge-yellow">Se puede cambiar en caliente</span>
        </div>
        <div className={styles.phaseTabs}>
          {GALA_MODES.map((m) => (
            <button
              key={m.key}
              className={`${styles.phaseTab} ${galaMode === m.key ? styles.phaseTabActive : ''}`}
              onClick={() => onSetGalaMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
          {GALA_MODES.find((m) => m.key === galaMode)?.description}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fichas de Equipo Listas
          </span>
          <div className={styles.statNumber}>
            {profilesReadyCount} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/ {totalTeams}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Votos Registrados
          </span>
          <div className={styles.statNumber}>
            {votesReceivedCount} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/ {totalMembers}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estado de Gala
          </span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700 }}>
            {state.phase === 'GALA_TV' ? `Jurado ${state.gala.currentVoterIndex + 1}` : state.phase}
          </div>
        </div>
      </div>

      {/* Sorteo & Schedule */}
      <div className="card">
        <h3 style={{ marginBottom: '4px' }}>Sorteo y Horario de Turnos</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          El sorteo se realiza en la pantalla de TV (aleatorio, con reordenación manual). Aquí puedes generar las horas
          de cada turno para que salgan en el mensaje de WhatsApp.
        </p>

        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Hora de inicio:</label>
          <input
            type="text"
            className="input mono"
            value={scheduleStart}
            onChange={(e) => setScheduleStart(e.target.value)}
            placeholder="14:00"
            style={{ width: '80px', padding: '6px 8px', fontSize: '13px' }}
          />
          <label style={{ fontSize: '13px', fontWeight: 600, marginLeft: '8px' }}>Minutos por tapa:</label>
          <input
            type="text"
            className="input mono"
            value={scheduleMinutes}
            onChange={(e) => setScheduleMinutes(e.target.value.replace(/\D/g, ''))}
            placeholder="15"
            style={{ width: '64px', padding: '6px 8px', fontSize: '13px' }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerateSchedule}>
            Generar horarios
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
          {sortedTeams.map((team, index) => (
            <span key={team.id} className="badge badge-neutral" style={{ textTransform: 'none', fontSize: '11px' }}>
              #{index + 1} {teamLabel(team, state.members)}
              {team.tastingTime ? ` · ${team.tastingTime}` : ' · sin hora'}
            </span>
          ))}
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="card" style={{ backgroundColor: 'var(--color-canvas)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '18px' }}>🔒</span>
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              Privacidad y Secreto de Tapas Garantizado
            </strong>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Para mantener la sorpresa y emoción del concurso, los nombres de tapas, fotos e ingredientes están ocultos en este panel. Solo ves el estado de preparación de cada equipo.
            </p>
          </div>
        </div>
      </div>

      {/* Fast testing action */}
      <div className="card" style={{ backgroundColor: 'var(--pastel-blue-bg)', borderColor: '#BEDDF3' }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ color: 'var(--pastel-blue-text)' }}>⚡ Simulación Inmediata para Pruebas</h3>
            <p style={{ fontSize: '13px', color: '#1A4D6E', marginTop: '2px' }}>
              Genera votos de prueba para todos los participantes con 1 clic y pasa directo a la Gala de Eurovisión en TV.
            </p>
          </div>
          <button className="btn btn-primary" onClick={onSimulateVotes}>
            Simular Votos y Abrir Gala
          </button>
        </div>
      </div>

      {/* Teams Management */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3>Equipos de este Concurso ({totalTeams} tapas · {totalMembers} personas)</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Hasta 3 personas por tapa. Cada persona tiene su PIN y su voto; la ficha del plato es compartida.
            </span>
          </div>

          {/* Add team form */}
          <form onSubmit={handleAddTeam} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input"
              style={{ padding: '6px 12px', fontSize: '13px', width: '260px' }}
              placeholder="Ana, Luis, Marta (máx. 3, separados por comas)"
              value={newTeamNames}
              onChange={(e) => setNewTeamNames(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              ➕ Añadir Equipo
            </button>
          </form>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyAllLinks}>
            {isAllLinksCopied ? '✓ Enlaces Copiados' : '📋 Copiar todos los enlaces'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyReminder}>
            {isReminderCopied
              ? '✓ Recordatorio Copiado'
              : `⏳ Recordar votación (${pendingMembers.length} pendientes)`}
          </button>
        </div>

        <div className={styles.votersGrid}>
          {sortedTeams.map((team) => {
            const teamMembers = membersOfTeam(team.id, state.members);
            const isComplete = !!team.dishName && !!team.photoUrl && team.ingredients.length > 0;
            const hasDishName = !!team.dishName && team.dishName.trim().length > 0;
            const hasPhoto = !!team.photoUrl && team.photoUrl.trim().length > 0;
            const takenPins = new Set(
              state.members.filter((m) => !teamMembers.some((tm) => tm.id === m.id)).map((m) => m.pin)
            );

            return (
              <div key={team.id} className={styles.voterCard} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                <div className="flex items-center justify-between" style={{ gap: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    Turno #{team.tastingOrder} · {teamLabel(team, state.members)}
                  </div>

                  <div className="flex items-center gap-1">
                    {isComplete ? (
                      <span className="badge badge-green" title="Nombre, ingredientes y fotografía listos">
                        ✓ Ficha Lista
                      </span>
                    ) : !hasPhoto ? (
                      <span className="badge badge-yellow" title="Falta subir la fotografía de la tapa">
                        Falta Foto
                      </span>
                    ) : (
                      <span className="badge badge-neutral" title={hasDishName ? 'Pendiente de completar' : 'Falta el nombre del plato'}>
                        Incompleta
                      </span>
                    )}

                    {state.teams.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--pastel-red-text)' }}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la tapa del equipo ${teamLabel(team, state.members)}?`)) {
                            onRemoveTeam(state.id, team.id);
                          }
                        }}
                        title="Eliminar equipo y sus votos"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {teamMembers.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    hasVoted={!!state.votes[member.id]}
                    takenPins={takenPins}
                    copiedMemberId={copiedMemberId}
                    onCopyLink={handleCopyParticipantLink}
                    onSavePin={onUpdateMemberPin}
                    onRegeneratePin={onRegenerateMemberPin}
                    onRemoveVote={handleRemoveVote}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateContestModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={onCreateContest}
        />
      )}
    </div>
  );
}
