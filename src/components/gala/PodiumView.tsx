import { ScoreboardItem } from '../../types/contest';

interface PodiumViewProps {
  finalRanking: ScoreboardItem[];
  onRestart: () => void;
}

export function PodiumView({ finalRanking, onRestart }: PodiumViewProps) {
  const first = finalRanking[0];
  const second = finalRanking[1];
  const third = finalRanking[2];

  const handleShareWinners = async () => {
    let msg = `🏆 *RESULTADOS FINALES — EUROTAPA 2026* 🏆\n\n`;
    if (first) msg += `🥇 *1º PUESTO:* ${first.name} — "${first.dishName}" (${first.totalPoints} pts)\n`;
    if (second) msg += `🥈 *2º PUESTO:* ${second.name} — "${second.dishName}" (${second.totalPoints} pts)\n`;
    if (third) msg += `🥉 *3º PUESTO:* ${third.name} — "${third.dishName}" (${third.totalPoints} pts)\n\n`;

    msg += `*CLASIFICACIÓN GENERAL:*\n`;
    finalRanking.forEach((item) => {
      msg += `#${item.rank} ${item.name} (${item.dishName}) — ${item.totalPoints} pts\n`;
    });

    try {
      await navigator.clipboard.writeText(msg);
      alert('¡Clasificación final copiada al portapapeles para WhatsApp!');
    } catch {
      // fallback
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '36px' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-yellow" style={{ padding: '6px 16px', fontSize: '13px' }}>
          Gala Concluida
        </span>
        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginTop: '8px' }}>
          El Podio de EuroTapa
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
          Tras una emocionante votación, estos son los platos coronados por el jurado.
        </p>
      </div>

      {/* Podium Display */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: '24px',
          alignItems: 'end',
          margin: '20px 0'
        }}
      >
        {/* 2nd Place */}
        {second && (
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px',
              backgroundColor: 'var(--color-surface)',
              minHeight: '340px',
              justifyContent: 'space-between'
            }}
          >
            <span className="badge badge-neutral" style={{ fontSize: '13px' }}>🥈 2º Lugar</span>
            {second.photoUrl && (
              <img
                src={second.photoUrl}
                alt={second.dishName}
                style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', margin: '12px 0' }}
              />
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>{second.dishName}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Chef: {second.name}</div>
            </div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, marginTop: '12px' }}>
              {second.totalPoints} pts
            </div>
          </div>
        )}

        {/* 1st Place */}
        {first && (
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '32px 24px',
              backgroundColor: 'var(--pastel-yellow-bg)',
              border: '2px solid #ECD9A5',
              minHeight: '400px',
              justifyContent: 'space-between'
            }}
          >
            <span className="badge badge-yellow" style={{ fontSize: '14px', padding: '6px 14px' }}>
              👑 CAMPEÓN EUROTAPA
            </span>
            {first.photoUrl && (
              <img
                src={first.photoUrl}
                alt={first.dishName}
                style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ECD9A5', margin: '12px 0' }}
              />
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.9rem', lineHeight: 1.1 }}>{first.dishName}</div>
              <div style={{ fontSize: '16px', color: 'var(--text-body)', marginTop: '4px' }}>
                Chef: <strong>{first.name}</strong>
              </div>
            </div>
            <div className="mono" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '12px' }}>
              {first.totalPoints} pts
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {third && (
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px',
              backgroundColor: 'var(--color-surface)',
              minHeight: '300px',
              justifyContent: 'space-between'
            }}
          >
            <span className="badge badge-neutral" style={{ fontSize: '13px' }}>🥉 3º Lugar</span>
            {third.photoUrl && (
              <img
                src={third.photoUrl}
                alt={third.dishName}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', margin: '12px 0' }}
              />
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem' }}>{third.dishName}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Chef: {third.name}</div>
            </div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>
              {third.totalPoints} pts
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4">
        <button className="btn btn-primary" onClick={handleShareWinners}>
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Compartir Resultados en WhatsApp
        </button>

        <button className="btn btn-secondary" onClick={onRestart}>
          Volver al Inicio
        </button>
      </div>

      {/* Full Classification Table */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          Clasificación Completa Oficial
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {finalRanking.map((item) => (
            <div
              key={item.participantId}
              className="flex items-center justify-between"
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '14px'
              }}
            >
              <div className="flex items-center gap-3">
                <span className="mono" style={{ width: '28px', fontWeight: 700 }}>
                  #{item.rank}
                </span>
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>— {item.dishName}</span>
              </div>
              <span className="mono" style={{ fontWeight: 700 }}>
                {item.totalPoints} pts
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
