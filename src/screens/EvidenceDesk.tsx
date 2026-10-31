import React, { useState, useRef, useCallback } from 'react';
import type { Transaction } from '../../shared/types';
import { uploadCSV, startDemo, getTransactions, setSessionId } from '../api/client';
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

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

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
        <button className="btn btn-ghost" onClick={onBack} aria-label="Back to home">
          ← Back
        </button>

        <div className="desk-content animate-fade-in">
          <header className="desk-header">
            <span className="desk-icon" aria-hidden="true">📋</span>
            <h1>Evidence Desk</h1>
            <p>Upload your expense file to begin the investigation, or open a demo case.</p>
          </header>

          {/* File Upload Area */}
          <div
            className={`drop-zone ${isDragging ? 'active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload CSV file. Click or drag and drop."
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
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
                <div className="drop-icon" aria-hidden="true">📂</div>
                <p className="drop-title">Drop your expense CSV here</p>
                <p className="drop-subtitle">or click to browse files</p>
                <p className="drop-hint">Supports files with Date, Description, and Amount columns</p>
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

          {/* Demo Button */}
          <div className="desk-demo">
            <button
              className="btn btn-terracotta btn-lg"
              onClick={handleDemo}
              disabled={isLoading}
              id="start-demo"
            >
              <span aria-hidden="true">🗂️</span>
              Open Demo Investigation
            </button>
            <p className="desk-demo-hint">
              50 fictional transactions — perfect for trying the experience
            </p>
          </div>

          {/* Security Notice */}
          <aside className="desk-security card" aria-label="Privacy information">
            <h3>🔒 Your Data is Safe</h3>
            <ul>
              <li>Files are processed in memory only</li>
              <li>No data is stored permanently</li>
              <li>Sessions expire after 2 hours</li>
              <li>We never connect to bank accounts</li>
              <li>Your original file is never modified</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
