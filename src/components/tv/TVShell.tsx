import { ReactNode, useEffect, useRef, useState } from 'react';
import { TvTheme } from '../../types/contest';
import styles from './TVStage.module.css';

/** Token set for each look of the stage. Light (cream) is the default. */
const themeAttr = (theme?: TvTheme) => (theme === 'dark' ? 'tv' : 'tv-light');

interface TVStageProps {
  theme?: TvTheme;
  children: ReactNode;
}

/** Full-size stage for every TV screen. Also what goes fullscreen. */
export function TVStage({ theme, children }: TVStageProps) {
  return (
    <div className={styles.stage} data-theme={themeAttr(theme)} data-tv-stage="">
      {children}
    </div>
  );
}

/** Puts the nearest TV stage in fullscreen (or leaves it), so the monitor shows nothing else. */
export function FullscreenButton() {
  const ref = useRef<HTMLButtonElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const stage = ref.current?.closest('[data-tv-shell]')?.querySelector('[data-tv-stage]') ?? document.documentElement;
    stage.requestFullscreen().catch(() => {});
  };

  return (
    <button ref={ref} type="button" className="btn btn-secondary btn-sm" onClick={toggle}>
      <svg className="icon" viewBox="0 0 24 24">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
      {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
    </button>
  );
}

interface TVShellProps {
  title: string;
  phaseLabel: string;
  theme?: TvTheme;
  /** Extra controls for the strip (contest picker). */
  extra?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

const CHROME_VISIBLE_MS = 2600;

/**
 * Public TV screen: the stage takes the whole monitor. The only chrome is a thin strip that
 * appears while the mouse moves, with the fullscreen and close buttons.
 */
export function TVShell({ title, phaseLabel, theme, extra, onClose, children }: TVShellProps) {
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);

  const showChrome = () => {
    setIsChromeVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setIsChromeVisible(false), CHROME_VISIBLE_MS);
  };

  useEffect(() => {
    showChrome();
    return () => window.clearTimeout(hideTimer.current);
    // Shown once on mount, then it follows the mouse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.shell} data-theme={themeAttr(theme)} data-tv-shell="" onMouseMove={showChrome} onTouchStart={showChrome}>
      <header className={`${styles.chrome} ${isChromeVisible ? styles.chromeVisible : ''}`}>
        <div className={styles.chromeGroup}>
          <strong>{title}</strong>
          <span className="badge badge-neutral">{phaseLabel}</span>
        </div>
        <div className={styles.chromeGroup}>
          {extra}
          <FullscreenButton />
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cerrar TV
          </button>
        </div>
      </header>

      <TVStage theme={theme}>{children}</TVStage>
    </div>
  );
}
