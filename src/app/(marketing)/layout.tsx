import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import MarketingHeader from '@/components/MarketingHeader';
import WebMcpBootstrap from '@/components/WebMcpBootstrap';
import { MARKETPOUNCE_SIGN_UP_REP, MARKETPOUNCE_AGENT_READY } from '@/lib/marketpounce';
import './landing.css';

/** Register WebMCP tools synchronously on first paint (IAR browser probe). */
const WEBMCP_BOOT = `(function(){try{var mc=navigator.modelContext;if(!mc||!mc.registerTool)return;mc.registerTool({name:"ccr_overview",description:"Cold Call Reps overview for agents.",inputSchema:{type:"object",properties:{}},execute:async function(){return{content:[{type:"text",text:"Cold Call Reps — human SDR marketplace. https://coldcallreps.com/llms.txt"}]};}});mc.registerTool({name:"find_guide",description:"Find a Cold Call Reps guide by topic.",inputSchema:{type:"object",properties:{topic:{type:"string"}},required:["topic"]},execute:async function(){return{content:[{type:"text",text:"https://coldcallreps.com/guides"}]};}});}catch(e){}})();`;

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <script dangerouslySetInnerHTML={{ __html: WEBMCP_BOOT }} />
      <WebMcpBootstrap />
      <MarketingHeader />
      <div style={{ flex: 1 }}>{children}</div>
      <footer className="mkt-footer">
        <div>
          <BrandMark size="sm" />
          <p className="mkt-footer-note" style={{ marginTop: '0.55rem' }}>
            Recruiting SDRs for the MarketPounce growth desk — train with AI voice, prove your
            skills, get paid on brand deals. Accounts are created on MarketPounce.
          </p>
        </div>
        <div className="mkt-footer-cols">
          <div className="mkt-footer-col">
            <p className="mkt-footer-heading">For SDRs</p>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/for/reps">SDR path</Link>
            <Link href="/hire-cold-callers">Hire cold callers</Link>
            <Link href="/pricing">Free to train</Link>
            <Link href="/guides">Guides</Link>
          </div>
          <div className="mkt-footer-col">
            <p className="mkt-footer-heading">Get started</p>
            <a href={MARKETPOUNCE_SIGN_UP_REP}>Join MarketPounce</a>
          </div>
          <div className="mkt-footer-col">
            <p className="mkt-footer-heading">For Operators</p>
            <a href={MARKETPOUNCE_AGENT_READY}>Is it agent-ready?</a>
          </div>
          <div className="mkt-footer-col">
            <p className="mkt-footer-heading">Company</p>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:support@coldcallreps.com">Support</a>
          </div>
        </div>
        <div className="mkt-footer-bottom">
          © {new Date().getFullYear()} ColdCallReps by MarketPounce
        </div>
      </footer>
    </div>
  );
}
