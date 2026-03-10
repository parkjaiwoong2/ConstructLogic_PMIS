import './ProgressBar.css';

export default function ProgressBar({ loading }) {
  if (!loading) return null;
  return (
    <div className="progress-bar" role="progressbar" aria-busy="true" aria-label="처리 중">
      <div className="progress-bar-inner" />
    </div>
  );
}
