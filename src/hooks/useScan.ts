import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { DirEntry, DriveInfo, ScanSummary, ScanProgress } from '../types';

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

export function useScan() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const loadDrives = useCallback(async () => {
    try {
      const result = await invoke<DriveInfo[]>('list_drives');
      setDrives(result);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const startScan = useCallback(async (drive: string) => {
    setSelectedDrive(drive);
    setStatus('scanning');
    setSummary(null);
    setProgress(null);
    setError(null);

    // Set up progress listener
    if (unlistenRef.current) {
      unlistenRef.current();
    }
    unlistenRef.current = await listen<ScanProgress>('scan-progress', (event) => {
      setProgress(event.payload);
    });

    try {
      const result = await invoke<ScanSummary>('scan_drive', { drive });
      setSummary(result);
      setStatus('done');
    } catch (e) {
      setError(String(e));
      setStatus('error');
    } finally {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  }, []);

  /** Fetch one level of children for a given path — lightweight IPC call. */
  const fetchChildren = useCallback(async (path: string): Promise<DirEntry[]> => {
    return invoke<DirEntry[]>('get_children', { path });
  }, []);

  const cancelScan = useCallback(async () => {
    await invoke('cancel_scan');
    setStatus('idle');
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    setSummary(null);
    setStatus('idle');
    setProgress(null);
    setError(null);
    setSelectedDrive(null);
  }, []);

  return {
    drives,
    summary,
    status,
    progress,
    error,
    selectedDrive,
    loadDrives,
    startScan,
    fetchChildren,
    cancelScan,
    reset,
  };
}
