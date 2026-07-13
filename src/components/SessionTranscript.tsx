'use client';

/** Render a stored trainer transcript as chat bubbles. */
export default function SessionTranscript({ transcript }: { transcript: string }) {
  const lines = transcript
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(USER|GATEKEEPER|DECISION_MAKER|PROSPECT|ASSISTANT|COACH)\s*:\s*(.*)$/i);
      if (match) {
        return { role: match[1].toLowerCase(), text: match[2] };
      }
      return { role: 'prospect', text: line };
    });

  if (!lines.length) {
    return <p className="muted">Empty transcript.</p>;
  }

  return (
    <div className="session-detail__chat">
      {lines.map((entry, i) => {
        const isUser = entry.role === 'user';
        return (
          <div
            key={`${entry.role}-${i}`}
            className={`bubble bubble--${entry.role}${isUser ? ' bubble--right' : ' bubble--left'}`}
          >
            <strong>{entry.role.replace(/_/g, ' ')}</strong>
            <span>{entry.text}</span>
          </div>
        );
      })}
    </div>
  );
}
