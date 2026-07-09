'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LandingPage() {
  return (
    <main>
      <section
        style={{
          minHeight: 'calc(100vh - 72px)',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem 1.5rem 4rem',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(255,90,31,0.22), transparent 55%), radial-gradient(ellipse 60% 50% at 10% 80%, rgba(45,212,191,0.12), transparent 50%), linear-gradient(165deg, #0c1222 0%, #10182c 45%, #0a101c 100%)',
        }}
      >
        <div style={{ maxWidth: 720, width: '100%', textAlign: 'left' }}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.8rem, 9vw, 5.2rem)',
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              margin: '0 0 1.25rem',
            }}
          >
            Cold<span style={{ color: 'var(--accent)' }}>Call</span>Reps
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.35rem, 3.5vw, 1.85rem)',
              fontWeight: 600,
              lineHeight: 1.25,
              margin: '0 0 0.85rem',
              maxWidth: 520,
            }}
          >
            Master Your Reps. Become a Top Rep.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            style={{ color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.55, maxWidth: 480, margin: '0 0 1.75rem' }}
          >
            Live voice practice for SDRs and outbound hustlers — gatekeepers, $500 website pitches, and the classic pen drill.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}
          >
            <Link
              href="/sign-up"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: '0.85rem 1.35rem',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              Start practicing
            </Link>
            <Link
              href="/pricing"
              style={{
                border: '1px solid var(--line)',
                padding: '0.85rem 1.35rem',
                borderRadius: 10,
                fontWeight: 600,
                color: 'var(--ink)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              See pricing
            </Link>
          </motion.div>
        </div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            position: 'absolute',
            right: '-8%',
            bottom: '8%',
            width: 'min(48vw, 420px)',
            height: 'min(48vw, 420px)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,90,31,0.35), transparent 70%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
      </section>

      <section style={{ padding: '4rem 1.5rem', maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Built for reps who grind
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: '2rem', maxWidth: 520 }}>
          Realistic xAI voice. Personalized prospects. Leaderboards that double as a hiring signal.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {[
            ['Gatekeeper → Boss', 'Two-stage calls with transfer tools and live coach whispers.'],
            ['$500 Website Pitch', 'Practice the Lovable site close on no-website local businesses.'],
            ['Top Reps Board', 'Weekly points, streaks, badges — opt into the hiring board.'],
          ].map(([title, body]) => (
            <div
              key={title}
              style={{
                padding: '1.25rem 0',
                borderTop: '1px solid var(--line)',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', margin: '0 0 0.4rem' }}>{title}</h3>
              <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.5, fontSize: '0.95rem' }}>{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
