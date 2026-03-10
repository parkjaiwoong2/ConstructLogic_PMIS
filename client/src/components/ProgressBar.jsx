import { useState, useEffect, useRef } from 'react';
import './ProgressBar.css';

const DURATION_MS = 25000; // 25초 동안 0 → 90% 진행
const MAX_PROGRESS = 90;
const TICK_MS = 80;

export default function ProgressBar({ loading }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      setProgress(0);
      startRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        const p = Math.min(MAX_PROGRESS, (elapsed / DURATION_MS) * MAX_PROGRESS);
        setProgress(p);
      }, TICK_MS);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
      return () => clearTimeout(hideTimer);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div className="progress-bar" role="progressbar" aria-busy={loading} aria-valuenow={progress} aria-label="처리 중">
      <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
    </div>
  );
}
