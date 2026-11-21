/**
 * A key to the fork: the same drawing with its three encodings labelled. Shapes only, no values.
 */
export function ForkKey() {
  const W = 520, H = 250, mid = 125, sx = 200, x1 = 380;
  const curve = (dy: number) => `M${sx},${mid} C${sx + 80},${mid} ${x1 - 80},${mid + dy} ${x1},${mid + dy}`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
        aria-label="Key to the fork. The thicker branch is the likelier direction. The distance between the branch ends is the expected move. The dashed branches show the typical move.">
        <line x1="20" y1={mid} x2={sx} y2={mid} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
        <g stroke="var(--text-3)" strokeDasharray="3 5" fill="none">
          <path d={curve(-52)} />
          <path d={curve(52)} />
        </g>
        <path d={curve(-78)} stroke="var(--up)" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d={curve(78)} stroke="var(--down)" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* spread bracket */}
        <g stroke="var(--text-2)" strokeWidth="1">
          <line x1={x1 + 22} y1={mid - 78} x2={x1 + 22} y2={mid + 78} />
          <line x1={x1 + 17} y1={mid - 78} x2={x1 + 27} y2={mid - 78} />
          <line x1={x1 + 17} y1={mid + 78} x2={x1 + 27} y2={mid + 78} />
        </g>
        <g fontSize="13" fill="var(--text-2)">
          <text x={x1 + 34} y={mid - 4}>spread =</text>
          <text x={x1 + 34} y={mid + 13}>expected move</text>
          <text x={x1 - 150} y={mid - 96}>thicker = likelier</text>
          <text x={x1 - 150} y={mid + 108}>thinner = less likely</text>
          <text x="20" y={mid - 14}>today</text>
          <text x="20" y={mid + 30} fill="var(--text-3)">dashed = typical move</text>
        </g>
      </svg>
    </figure>
  );
}
