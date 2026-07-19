import Link from 'next/link';
import { scoreColor } from '@/lib/trainer/session-utils';

type ScorePoint = {
  id: string;
  overallScore: number;
  createdAt: Date | string;
};

type ScoreTrendChartProps = {
  sessions: ScorePoint[];
  /** Chronological left→right; pass newest-first and we reverse. */
  newestFirst?: boolean;
};

/**
 * Lightweight SVG bar chart for last N session scores — no chart library.
 */
export default function ScoreTrendChart({
  sessions,
  newestFirst = true,
}: ScoreTrendChartProps) {
  if (sessions.length === 0) {
    return (
      <div className="score-trend score-trend--empty">
        <p className="score-trend__empty-title">Practice to unlock your score trend</p>
        <p className="muted score-trend__empty-desc">
          Run a few AI warm-ups — your last sessions will chart here.
        </p>
        <Link href="/practice" className="btn btn--sm" style={{ marginTop: '0.65rem' }}>
          Start practice
        </Link>
      </div>
    );
  }

  const points = newestFirst ? [...sessions].reverse() : sessions;
  const scores = points.map((p) => Math.max(0, Math.min(100, p.overallScore || 0)));
  const maxScore = Math.max(100, ...scores);
  const w = 320;
  const h = 120;
  const padX = 8;
  const padY = 12;
  const barGap = 4;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const barW = Math.max(6, (innerW - barGap * (scores.length - 1)) / scores.length);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const avgY = padY + innerH - (avg / maxScore) * innerH;

  return (
    <div className="score-trend">
      <svg
        className="score-trend__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Score trend across ${scores.length} sessions. Average ${avg}.`}
        preserveAspectRatio="none"
      >
        {/* Avg guide */}
        <line
          x1={padX}
          x2={w - padX}
          y1={avgY}
          y2={avgY}
          className="score-trend__avg-line"
          strokeDasharray="3 3"
        />
        {scores.map((score, i) => {
          const barH = Math.max(2, (score / maxScore) * innerH);
          const x = padX + i * (barW + barGap);
          const y = padY + innerH - barH;
          return (
            <rect
              key={points[i].id}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              className="score-trend__bar"
              style={{ fill: scoreColor(score) }}
            >
              <title>{`Score ${score}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="score-trend__footer">
        <span className="muted">Last {scores.length} sessions</span>
        <span className="score-trend__avg">
          Avg <strong style={{ color: scoreColor(avg) }}>{avg}</strong>
        </span>
      </div>
    </div>
  );
}
