import React, { useState, useRef, useCallback } from 'react';
import type { Transaction } from '../../shared/types';
import { uploadCSV, startDemo, getTransactions } from '../api/client';
import './EvidenceDesk.css';

interface Props {
  onImportComplete: (txs: Transaction[], count: number) => void;
  onBack: () => void;
}

export default function EvidenceDesk({ onImportComplete, onBack }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5 MB.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsLoading(true);

    try {
      const result = await uploadCSV(file);
      const txs = await getTransactions();
      announce(`${result.transactionCount} transactions imported successfully`);
      onImportComplete(txs, result.transactionCount);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [onImportComplete]);

  const handleDemo = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setFileName('demo-investigation.csv');

    try {
      const result = await startDemo();
      const txs = await getTransactions();
      announce(`Demo case loaded with ${result.transactionCount} transactions`);
      onImportComplete(txs, result.transactionCount);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [onImportComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  function announce(msg: string) {
    const el = document.getElementById('live-announcer');
    if (el) el.textContent = msg;
  }

  return (
    <main className="evidence-desk" role="main">
      <div className="container">
        <button className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back to home">← Back to lobby</button>

        <div className="desk-content animate-fade-in">
          {/* Envelope header */}
          <header className="desk-header">
            <div className="desk-envelope-deco" aria-hidden="true">
              <div className="envelope-body">
                <div className="envelope-seal"></div>
              </div>
            </div>
            <span className="stamp" style={{ marginBottom: '12px' }}>CONFIDENTIAL</span>
            <h1>Case Dossier</h1>
            <p className="desk-subtitle">
              Upload your expense records to begin the investigation, or open a practice case file.
            </p>
          </header>

          {/* Upload Area */}
          <div
            className={`drop-zone desk-dropzone ${isDragging ? 'active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload CSV file. Click or drag and drop."
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); }
            }}
            id="file-drop-zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="sr-only"
              id="csv-file-input"
              aria-label="Choose CSV file"
            />

            {isLoading ? (
              <div className="desk-loading">
                <div className="desk-spinner" aria-hidden="true"></div>
                <p>Analyzing evidence from <strong>{fileName}</strong>...</p>
              </div>
            ) : (
              <>
                <div className="drop-visual" aria-hidden="true">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <rect x="8" y="12" width="40" height="32" rx="2" stroke="var(--terracotta)" strokeWidth="2" fill="none"/>
                    <path d="M8 20h40" stroke="var(--terracotta)" strokeWidth="1.5"/>
                    <path d="M28 28v10M24 34l4 4 4-4" stroke="var(--terracotta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="16" y="6" width="16" height="8" rx="1" fill="var(--manila)" stroke="var(--sand)" strokeWidth="1.5"/>
                    <text x="24" y="12.5" textAnchor="middle" fontSize="5" fill="var(--warm-gray)" fontFamily="monospace">CSV</text>
                  </svg>
                </div>
                <p className="drop-title">Drop your expense CSV here</p>
                <p className="drop-subtitle">or click to browse your case files</p>
                <p className="drop-hint">Accepts CSV files with Date, Description, and Amount columns · Max 5 MB</p>
              </>
            )}
          </div>

          {error && (
            <div className="desk-error" role="alert">
              <span aria-hidden="true">⚠️</span> {error}
            </div>
          )}

          {/* Divider */}
          <div className="desk-divider">
            <hr className="divider" />
            <span className="desk-divider-text">or</span>
            <hr className="divider" />
          </div>

          {/* Demo */}
          <div className="desk-demo">
            <div className="demo-folder" aria-hidden="true">
              <div className="demo-folder-body">
                <div className="demo-folder-tab">DEMO</div>
              </div>
            </div>
            <button className="btn btn-terracotta btn-lg" onClick={handleDemo} disabled={isLoading} id="start-demo">
              🗂️ Open Demo Investigation
            </button>
            <p className="desk-demo-hint">50 fictional transactions — perfect for trying the experience</p>
          </div>

          {/* Security */}
          <aside className="desk-security" aria-label="Privacy information">
            <div className="security-inner">
              <h3>🔒 Evidence Handling Protocol</h3>
              <ul className="security-list">
                <li>Files processed in memory only — never stored</li>
                <li>Sessions expire after 2 hours</li>
                <li>No bank account connections</li>
                <li>Your original file is never modified</li>
                <li>Export contains only your review decisions</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
