import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, nextTick } from '../api';
import ProgressBar from '../components/ProgressBar';
import './ImportCsv.css';

const CURRENT_USER_KEY = 'currentUserName';

export default function ImportCsv() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem(CURRENT_USER_KEY) || '');
  const [defaultCardNo, setDefaultCardNo] = useState('');
  const [defaultProjectName, setDefaultProjectName] = useState('');
  const [users, setUsers] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => []);
  }, []);

  useEffect(() => {
    if (userName) localStorage.setItem(CURRENT_USER_KEY, userName);
  }, [userName]);

  useEffect(() => {
    if (!userName?.trim()) {
      setDefaultCardNo('');
      setDefaultProjectName('');
      return;
    }
    (async () => {
      try {
        const [cards, settings, projects] = await Promise.all([
          api.getUserCards(userName),
          api.getUserSettings(userName),
          api.getProjects(),
        ]);
        const defaultCard = Array.isArray(cards) && (cards.find(c => c.is_default) || cards[0]);
        setDefaultCardNo(defaultCard?.card_no || '');
        const proj = projects?.find(p => p.id === settings?.default_project_id);
        setDefaultProjectName(proj?.name || '');
      } catch (e) { /* ignore */ }
    })();
  }, [userName]);

  const parseCsvLine = (line) => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === '\t') && !inQuotes) {
        cols.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim().replace(/^"|"$/g, ''));
    return cols;
  };

  const parseCsv = (csvText) => {
    const lines = csvText.trim().split(/\r?\n/);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const useDate = (cols[0] || '').trim();
      const projectName = (cols[1] || '').trim();
      const accountName = (cols[2] || '').trim();
      const desc = (cols[3] || '').trim();
      let card = (cols[4] || '').trim();
      let cash = (cols[5] || '').trim();
      if (cols.length > 6) {
        const rest = cols.slice(4).map(c => (c || '').trim());
        if (rest.length === 2) {
          card = rest[0];
          cash = rest[1];
        } else if (rest.length >= 3) {
          const mid = Math.ceil(rest.length / 2);
          card = rest.slice(0, mid).join('').replace(/,/g, '');
          cash = rest.slice(mid).join('').replace(/,/g, '');
        }
      }
      if (!useDate || /^날/.test(useDate) || useDate.includes('합') || useDate.includes('*')) continue;
      const dateMatch = useDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (dateMatch) {
        const [, y, m, d] = dateMatch;
        const normDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        rows.push({
          use_date: normDate,
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
    await nextTick();
    try {
      const r = await api.importCsv({
        rows,
        user_name: userName,
        card_no: defaultCardNo || undefined,
        project_name: defaultProjectName || undefined,
      });
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
      <ProgressBar loading={importing} />
      <header className="page-header">
        <h1>CSV 임포트</h1>
      </header>
      <p className="desc">엑셀에서 7행(헤더)부터 날짜~현금 열까지 선택 후 붙여넣으세요. 날짜 형식: YYYY-MM-DD</p>
      <div className="card">
        <div className="form-row">
          <label>사용자</label>
          <input
            value={userName}
            onChange={e => setUserName(e.target.value)}
            placeholder="사용자명"
            list="import-user-list"
          />
          <datalist id="import-user-list">
            {users.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>
        {userName && (
          <div className="form-row hint">
            기본 카드: {defaultCardNo || '(없음)'} · 기본 현장: {defaultProjectName || '(없음)'}
          </div>
        )}
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
