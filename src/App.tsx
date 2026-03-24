import { useEffect } from 'react';
import { useScan } from './hooks/useScan';
import { DrivePicker } from './components/DrivePicker';
import { ScanProgressView } from './components/ScanProgressView';
import { AnalysisView } from './components/AnalysisView';
import './App.css';

export default function App() {
  const scan = useScan();

  useEffect(() => {
    scan.loadDrives();
  }, []);

  if (scan.status === 'scanning') {
    return (
      <div className="app">
        <ScanProgressView
          progress={scan.progress}
          drive={scan.selectedDrive!}
          onCancel={scan.cancelScan}
        />
      </div>
    );
  }

  if (scan.status === 'done' && scan.summary) {
    return (
      <div className="app">
        <AnalysisView
          summary={scan.summary}
          drive={scan.selectedDrive!}
          drives={scan.drives}
          fetchChildren={scan.fetchChildren}
          onRescan={() => scan.startScan(scan.selectedDrive!)}
          onChangeDrive={scan.reset}
        />
      </div>
    );
  }

  if (scan.status === 'error') {
    return (
      <div className="app">
        <DrivePicker
          drives={scan.drives}
          onScan={scan.startScan}
          error={scan.error}
          loading={scan.drives.length === 0}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <DrivePicker
        drives={scan.drives}
        onScan={scan.startScan}
        error={scan.error}
        loading={scan.drives.length === 0}
      />
    </div>
  );
}
