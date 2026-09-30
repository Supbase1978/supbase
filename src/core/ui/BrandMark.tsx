export interface BrandMarkProps {
  /** Négyzet oldalhossz px-ben (a viewBox 32×32, arányosan skálázódik). */
  size?: number;
  className?: string;
}

/**
 * Suptime logójel: amber napkorong, felülnézeti fehér SUP-deszka orral
 * felfelé, mellette PÁRHUZAMOS sötét evezőlapát. A lapát SZÁNDÉKOSAN nem
 * keresztezi a deszkát — az áthúzott forma tiltó jelként (lásd "Tilos"
 * státusz) olvasódna. Kizárólag a biztonsági blokktól független
 * márkatokenekből épül (`--ink-deep`, `--amber`, `--surface`, `--petrol`);
 * a biztonsági (safe/caution/danger/stale) színek itt NEM jelenhetnek meg.
 * Dekoratív — a hívó fél (pl. a fejléc-Link) adja az akadálymentes nevet.
 */
export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="9" fill="var(--ink-deep)" />
      <circle cx="16" cy="16" r="10.2" fill="var(--amber)" />
      <g transform="translate(13.6 16.4) rotate(-90) scale(0.78)">
        <path
          d="M-12 0 C-12 -2.9 -6.5 -2.9 0 -2.9 C6 -2.9 10.2 -1.7 12.8 0 C10.2 1.7 6 2.9 0 2.9 C-6.5 2.9 -12 2.9 -12 0 Z"
          fill="var(--surface)"
        />
        <line
          x1="-8.5"
          y1="0"
          x2="8.5"
          y2="0"
          stroke="var(--petrol)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
      <line
        x1="20.4"
        y1="8.6"
        x2="20.4"
        y2="20.2"
        stroke="var(--ink-deep)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="18.9"
        y1="8.6"
        x2="21.9"
        y2="8.6"
        stroke="var(--ink-deep)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M20.4 19.6 C22.2 20.5 22.2 23.6 20.4 24.6 C18.6 23.6 18.6 20.5 20.4 19.6 Z"
        fill="var(--ink-deep)"
      />
    </svg>
  );
}
