import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import './ImportCsv.css';

export default function ImportCsv() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [userName, setUserName] = useState('배명수');
  const [importing, setImporting] = useState(false);

  const parseCsv = (csvText) => {
    const lines = csvText.trim().split(/\r?\n/);
    const rows = [];
    for (let i = 6; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const useDate = cols[0];
      const projectName = (cols[1] || '').trim();
      const accountName = (cols[2] || '').trim();
      const desc = (cols[3] || '').trim();
      const card = cols[4] || '';
      const cash = cols[5] || '';
      if (!useDate || useDate === '날    짜' || useDate.includes('합  계') || useDate.includes('합    계')) continue;
      if (/^\d{4}-\d{2}-\d{2}$/.test(useDate) || /^\d{4}\/\d{2}\/\d{2}$/.test(useDate)) {
        rows.push({
          use_date: useDate.replace(/\//g, '-'),
          project_name: projectName,
          account_item_name: accountName,
          description: desc,
          card_amount: card,
          cash_amount: cash,
        });
      }
    }
    return rows;
  };

  const handleImport = async () => {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      alert('유효한 데이터가 없습니다. CSV 형식(날짜, 현장명, 항목, 세부사용내역, 카드, 현금)을 확인하세요.');
      return;
    }
    setImporting(true);
    try {
      const r = await api.importCsv({ rows, user_name: userName });
      alert(`${r.count}건 임포트 완료. 문서번호: ${r.doc_no}`);
      navigate(`/documents/${r.id}`);
    } catch (err) {
      alert(err.message || '임포트 실패');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="import-csv">
      <header className="page-header">
        <h1>CSV 임포트</h1>
      </header>
      <p className="desc">엑셀에서 CSV로 저장한 후 내용을 붙여넣으세요. 7행부터 데이터로 인식합니다.</p>
      <div className="card">
        <div className="form-row">
          <label>사용자</label>
          <input value={userName} onChange={e => setUserName(e.target.value)} />
        </div>
        <label>CSV 내용</label>
        <textarea
          rows={15}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="날짜, 현장명, 항목, 세부사용내역, 카드, 현금..."
        />
        <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
          {importing ? '임포트 중...' : '임포트'}
        </button>
      </div>
    </div>
  );
}
