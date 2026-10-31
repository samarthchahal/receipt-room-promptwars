import React, { useState, useCallback, useEffect } from 'react';
import type { Transaction } from '../shared/types';
import Landing from './screens/Landing';
import EvidenceDesk from './screens/EvidenceDesk';
import InvestigationRoom from './screens/InvestigationRoom';
import CaseClosed from './screens/CaseClosed';
import BureauLayout from './BureauLayout';
import { getTransactions } from './api/client';

type Screen = 'landing' | 'evidence-desk' | 'investigation' | 'case-closed';

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  useEffect(() => { document.getElementById('bureau-content')?.focus(); }, [screen]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [navigationError, setNavigationError] = useState('');
  const resumeInvestigation = async () => {
    if (transactions.length) {
      try { setTransactions(await getTransactions()); setScreen('investigation'); setNavigationError(''); }
      catch (err) { setNavigationError((err as Error).message); }
    } else setScreen('evidence-desk');
  };

  const handleImportComplete = useCallback((txs: Transaction[], count: number) => {
    setTransactions(txs);
    setTransactionCount(count);
    setScreen('investigation');
  }, []);

  const handleCaseClosed = useCallback(() => {
    setScreen('case-closed');
  }, []);

  const handleNewInvestigation = useCallback(() => {
    setTransactions([]);
    setTransactionCount(0);
    setScreen('landing');
  }, []);

  return (
    <div className="app">
      {/* Accessible live region for screen reader announcements */}
      <div className="live-region" role="status" aria-live="polite" id="live-announcer"></div>
      <BureauLayout screen={screen} onOffice={() => setScreen('landing')} onInvestigation={resumeInvestigation} onArchive={screen === 'case-closed' ? () => setScreen('case-closed') : undefined}>
      {navigationError && <p role="alert" className="bureau-error">{navigationError}</p>}

      {screen === 'landing' && (
        <Landing
          onBegin={() => setScreen('evidence-desk')}
          onDemo={() => setScreen('evidence-desk')}
        />
      )}

      {screen === 'evidence-desk' && (
        <EvidenceDesk
          onImportComplete={handleImportComplete}
          onBack={() => setScreen('landing')}
        />
      )}

      {screen === 'investigation' && (
        <InvestigationRoom
          initialTransactions={transactions}
          onCaseClosed={handleCaseClosed}
          onBack={() => setScreen('evidence-desk')}
        />
      )}

      {screen === 'case-closed' && (
        <CaseClosed
          onNewInvestigation={handleNewInvestigation}
        />
      )}
      </BureauLayout>
    </div>
  );
}
