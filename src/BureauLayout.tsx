import React, { useState } from 'react';
import { getSessionId } from './api/client';

export default function BureauLayout({ screen, onOffice, onInvestigation, onArchive, children }: {
  screen: string; onOffice: () => void; onInvestigation?: () => void; onArchive?: () => void; children: React.ReactNode;
}) {
  const [lamp, setLamp] = useState(true);
  const id = getSessionId();
  return <div className={`bureau ${lamp ? '' : 'lamp-dim'}`}>
    <a className="skip-link" href="#bureau-content">Skip to casework</a>
    <aside className="bureau-sidebar" aria-label="Case docket">
      <div className="docket-panel"><h2>Case docket register</h2><p className="micro">DIVISION 04 · FORENSIC</p>
        <dl><div><dt>Dossier ref:</dt><dd>{id ? `#${id.slice(0, 8).toUpperCase()}` : 'UNASSIGNED'}</dd></div>
        <div><dt>Status:</dt><dd className="olive">{screen === 'case-closed' ? 'REVIEW FILED' : id ? 'UNDER INQUIRY' : 'AWAITING EVIDENCE'}</dd></div>
        <div><dt>Record:</dt><dd>PRIVATE SESSION</dd></div></dl></div>
      <p className="micro sidebar-label">BUREAU CONTROLS</p>
      <button className="bureau-control" aria-pressed={lamp} onClick={() => setLamp(v => !v)}><span><strong>DESK LAMP</strong><small>INCANDESCENT · WARM LIGHT</small></span><span className={`lamp-switch ${lamp ? 'on' : ''}`} aria-hidden="true" /></button>
      <div className="bureau-control"><span><strong>EVIDENCE PROTOCOL</strong><small>IN MEMORY · 2 HOUR SESSION</small></span><span className="protocol-seal" aria-hidden="true">§</span></div>
      <div className="inspector-card"><span className="inspector-seal" aria-hidden="true">◎</span><div><strong>THE INVESTIGATOR</strong><small>EXPENSE REVIEW DIVISION</small></div></div>
    </aside>
    <div className="bureau-body"><header className="bureau-header"><div className="bureau-brand"><span>THE RECEIPT ROOM</span><small>BUREAU OF FINANCIAL INVESTIGATION</small></div><span className="department-tag">DEPT<br/>1947</span>
      <nav aria-label="Bureau desks"><button onClick={onOffice} aria-current={screen === 'landing' ? 'page' : undefined}>DESK 01: BUREAU OFFICE</button><button onClick={onInvestigation} disabled={!onInvestigation} aria-current={screen === 'investigation' || screen === 'evidence-desk' ? 'page' : undefined}>DESK 02: INVESTIGATION TABLE</button><button onClick={onArchive} disabled={!onArchive} aria-current={screen === 'case-closed' ? 'page' : undefined}>DESK 03: ARCHIVES</button></nav>
      <span className="dispatch-date micro">LOCAL DISPATCH<br/>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></header>
      <div id="bureau-content" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
