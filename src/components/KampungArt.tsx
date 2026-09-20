// Decorative Kampung illustrations — hand-authored SVG, no dependencies and no
// client JS (lucide-react stays nav-only, per CLAUDE.md's "Stack & why").
// Colors come from the Tailwind tokens via fill-* utilities rather than literal
// hex, so the art tracks tailwind.config.ts like the rest of the UI.
//
// Everything here is aria-hidden: it carries no information the surrounding
// copy doesn't already state, so screen readers should skip it entirely.

type ArtProps = { className?: string };

/** Bottom edge of the skyline viewBox. Silhouettes run to it so the band
 *  bleeds off the bottom of the screen instead of floating on a baseline. */
const BASE = 240;

/** Distant HDB slabs, back layer. Each drops from `y` to BASE. */
const BLOCKS = [
  { x: 628, y: 112, w: 92 },
  { x: 736, y: 78, w: 72 },
  { x: 824, y: 128, w: 104 },
  { x: 944, y: 62, w: 82 },
  { x: 1042, y: 116, w: 96 },
] as const;

/** Evenly spaced window slots for one slab — punched in paper so the blocks
 *  read as HDB rather than as plain rectangles. */
function windowsFor({ x, y, w }: { x: number; y: number; w: number }) {
  const out: { x: number; y: number }[] = [];
  for (let wy = y + 18; wy < BASE - 18; wy += 24) {
    for (let wx = x + 13; wx < x + w - 11; wx += 22) {
      out.push({ x: wx, y: wy });
    }
  }
  return out;
}

/**
 * Horizon band: attap-roofed kampung houses stepping up into HDB slabs, with a
 * coconut palm between them. Silhouette only, two flat tones, meant to sit at
 * the very bottom of a page at low contrast — not as a hero image.
 */
export function KampungSkyline({ className = "" }: ArtProps) {
  return (
    <svg
      viewBox={`0 0 1200 ${BASE}`}
      className={`w-full ${className}`}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {/* Back layer: the new town on the horizon. */}
      <g className="fill-accentsoft">
        {BLOCKS.map((b) => (
          <rect key={`b-${b.x}`} x={b.x} y={b.y} width={b.w} height={BASE - b.y} />
        ))}
      </g>
      <g className="fill-paper">
        {BLOCKS.flatMap((b) =>
          windowsFor(b).map((w) => (
            <rect key={`w-${w.x}-${w.y}`} x={w.x} y={w.y} width={9} height={11} rx={1} />
          )),
        )}
      </g>
      {/* Bamboo laundry poles jutting from the slabs — the detail that makes a
          block of flats unmistakably an HDB block. */}
      <g className="stroke-accentsoft" strokeWidth={3} strokeLinecap="round">
        <path d="M736 142h-26M736 190h-22M944 126h-24M944 174h-28M1042 160h-22" />
      </g>

      {/* Front layer: the kampung itself. */}
      <g className="fill-accent">
        {/* Larger house — steep attap-style pitch with a deep overhang past
            the walls, which is what separates it from a generic house icon. */}
        <polygon points="44,178 150,92 256,178" />
        <rect x="80" y="174" width="140" height={BASE - 174} />
        {/* Smaller house */}
        <polygon points="270,192 344,130 418,192" />
        <rect x="292" y="188" width="104" height={BASE - 188} />

        {/* Coconut palm. Each frond is a tapered blade that arcs outward and
            then droops — drawn out along the top edge and back along the
            bottom. Straight radiating lines read as an asterisk, not a palm. */}
        <path d={`M496 ${BASE}c2-55 8-100 6-140h12c-2 42-4 85 0 140z`} />
        <path d="M505 90c40-5 80 10 110 45-30-25-70-35-110-37z" />
        <path d="M505 90c-40-5-80 10-110 45 30-25 70-35 110-37z" />
        <path d="M505 90c35-18 70-20 97-10-32 0-67 6-97 16z" />
        <path d="M505 90c-35-18-70-20-97-10 32 0 67 6 97 16z" />
        <path d="M505 92c30 13 50 43 57 78-14-35-34-60-59-70z" />
        <path d="M505 92c-30 13-50 43-57 78 14-35 34-60 59-70z" />
        <circle cx="499" cy="102" r="4.5" />
        <circle cx="511" cy="100" r="4.5" />
      </g>
      {/* Doors and windows punched back out in paper. */}
      <g className="fill-paper">
        <rect x="136" y="198" width="28" height={BASE - 198} rx="2" />
        <rect x="98" y="194" width="22" height="20" rx="2" />
        <rect x="180" y="194" width="22" height="20" rx="2" />
        <rect x="330" y="208" width="22" height={BASE - 208} rx="2" />
      </g>
    </svg>
  );
}

/**
 * Small attap-roof house glyph for the header lockup. Uses currentColor so it
 * inherits whatever text color it sits beside. Mirrored by src/app/icon.svg,
 * which Next serves as the favicon — keep the two shapes in sync.
 */
export function KampungMark({ className = "" }: ArtProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {/* One path with evenodd so the doorway is a genuine hole — it shows
          whatever sits behind the glyph instead of a hard-coded paper fill. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3 L23 11 L1 11 Z M4 12 h16 v9 H4 Z M9.5 15 h5 v6 h-5 Z"
      />
    </svg>
  );
}
