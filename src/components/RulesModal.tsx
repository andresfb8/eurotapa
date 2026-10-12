import { ReactNode } from 'react';

interface RulesModalProps {
  onClose: () => void;
  /** Organizers also get a short guide to running the contest. */
  audience?: 'participant' | 'organizer';
}

interface Item {
  title: string;
  body: ReactNode;
}

const RULES: Item[] = [
  {
    title: 'Nadie vota su propia tapa',
    body: (
      <>
        Como en Eurovisión, tu tapa no aparece en tu papeleta. Si la cocináis en equipo, ninguno de sus miembros puede
        votarla.
      </>
    )
  },
  {
    title: 'Votas ordenando, de tu favorita a la que menos',
    body: (
      <>
        Con 8 tapas ordenas las 7 rivales: la primera se lleva <strong>7 puntos</strong>, la segunda <strong>6</strong>, y
        así hasta <strong>1</strong>. No hay empates ni huecos: cada tapa ocupa un puesto. Hasta que sellas el voto
        puedes cambiar el orden; después ya no.
      </>
    )
  },
  {
    title: 'Todas las tapas reciben los mismos votos',
    body: (
      <>
        Cada persona vota desde su móvil. Si todos los equipos tienen el mismo tamaño, <strong>cada persona es un
        jurado</strong> y su voto cuenta tal cual. Si hay equipos de tamaños distintos, los repartos de cada equipo se
        suman, se ordenan de nuevo y salen como <strong>un único voto por tapa</strong>, para que ninguna reciba más
        votos que otra. La organización puede fijar uno u otro sistema antes de la gala.
      </>
    )
  },
  {
    title: 'La votación se cierra al empezar la gala',
    body: (
      <>
        Cuando la organización arranca la gala ya no se admite ningún voto. Quien no haya sellado el suyo se queda sin
        votar, así que no lo dejes para el final.
      </>
    )
  },
  {
    title: 'El orden de salida se sortea con antelación',
    body: (
      <>
        El turno de cada equipo se decide días antes, para poder pensar y ensayar la tapa. Lo verás en tu móvil junto al
        orden completo. Si surge un imprevisto, la organización puede mover algún turno y se actualiza al momento.
      </>
    )
  },
  {
    title: 'Las tapas son secretas hasta que se sirven',
    body: (
      <>
        Rellena la ficha de tu tapa (nombre, foto e ingredientes) cuando quieras: nadie la ve, ni siquiera la
        organización, hasta que llega su turno en la pantalla. Los ingredientes ayudan a quien tenga alergias.
      </>
    )
  },
  {
    title: 'Desempate',
    body: (
      <>
        A igualdad de puntos gana la tapa con más puntuaciones máximas; si siguen empatadas, la que tenga más segundas
        máximas, y así sucesivamente. Si coinciden en todas, <strong>comparten puesto</strong>.
      </>
    )
  }
];

const NIGHT: Item[] = [
  {
    title: 'Durante la cata',
    body: (
      <>
        Tu móvil muestra la tapa que está en la mesa. Puedes apuntar una nota privada y añadirla a tu ranking
        provisional, que vas ordenando tapa a tapa. Las notas y el ranking se guardan solo en tu móvil.
      </>
    )
  },
  {
    title: 'En la votación',
    body: (
      <>
        Toca las fotos en orden para añadirlas y ajusta arrastrando o con las flechas. Si ya ordenaste durante la cata,
        solo tienes que repasar y pulsar "Sellar mi voto". En la pantalla grande irán pasando todas las tapas para
        refrescar la memoria.
      </>
    )
  },
  {
    title: 'En la gala',
    body: (
      <>
        La pantalla grande revela los votos jurado a jurado. En tu móvil ves cómo va tu tapa en directo, quién te da
        puntos y, al final, tu puesto y un resumen para compartir.
      </>
    )
  }
];

const ORGANIZER: Item[] = [
  {
    title: 'Antes del día',
    body: (
      <>
        Crea el concurso con un equipo por línea, cambia el PIN de organizador y apúntalo: es la única llave del panel.
        Envía a cada persona su enlace, haz el sorteo (o fija un orden a mano) y compártelo. Las horas de cada turno son
        opcionales.
      </>
    )
  },
  {
    title: 'El día del concurso',
    body: (
      <>
        Abre la pantalla grande con "Enlace TV": solo muestra, no tiene controles. Tú lo manejas todo desde la pestaña
        "Ver TV" de tu móvil u ordenador: pasar tapas en la degustación, abrir la votación y empezar la gala.
      </>
    )
  },
  {
    title: 'Votación y gala',
    body: (
      <>
        Elige el tipo de voto (individual o combinado por equipo) antes de empezar; en automático se decide según el
        tamaño de los equipos. Usa "Recordar votación" para avisar a quien falte. Al empezar la gala la votación se cierra, así que espera a
        tener los votos. En la gala cada clic revela un paso y "Deshacer" vuelve atrás. Puedes cambiar el modo de
        revelado y el aspecto de la TV (claro u oscuro) en cualquier momento.
      </>
    )
  }
];

function Section({ label, items }: { label: string; items: Item[] }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ fontSize: '1.15rem' }}>{label}</h3>
      {items.map((item, index) => (
        <div
          key={item.title}
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 14px',
            backgroundColor: 'var(--color-canvas-subtle)',
            borderRadius: 'var(--radius-sm)',
            border: '2px solid var(--border-color)'
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-saffron)',
              border: '2px solid var(--ink)',
              color: '#161514',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '14px'
            }}
          >
            {index + 1}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{item.title}</div>
            <p style={{ color: 'var(--text-body)', fontSize: '14px', lineHeight: 1.5 }}>{item.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export function RulesModal({ onClose, audience = 'participant' }: RulesModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Normativa y ayuda"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 18, 18, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 250,
        padding: '12px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '92dvh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          borderColor: 'var(--ink)',
          boxShadow: 'var(--shadow-float)'
        }}
      >
        <div className="flex items-center justify-between" style={{ gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <span className="badge badge-yellow">Normativa y ayuda</span>
            <h2 style={{ fontSize: '1.7rem', marginTop: '4px' }}>Cómo funciona EuroTapa</h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ flexShrink: 0, minWidth: '44px', minHeight: '44px' }}
            onClick={onClose}
            aria-label="Cerrar normativa"
          >
            ✕
          </button>
        </div>

        <Section label="Las reglas" items={RULES} />
        <Section label="La noche del concurso, en tu móvil" items={NIGHT} />
        {audience === 'organizer' && <Section label="Guía rápida para quien organiza" items={ORGANIZER} />}

        <button type="button" className="btn btn-primary" style={{ minHeight: '52px' }} onClick={onClose}>
          Entendido, ¡a cocinar!
        </button>
      </div>
    </div>
  );
}
