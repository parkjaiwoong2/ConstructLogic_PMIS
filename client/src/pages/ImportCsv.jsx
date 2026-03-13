import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import './ImportCsv.css';

const CURRENT_USER_KEY = 'currentUserName';

export default function ImportCsv() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';
  const [text, setText] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem(CURRENT_USER_KEY) || '');
  const [companyId, setCompanyId] = useState('');
  const [displayCompany, setDisplayCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [cardNo, setCardNo] = useState('');
  const [cardOptions, setCardOptions] = useState([]);
  const [defaultCardNo, setDefaultCardNo] = useState('');
  const [defaultProjectName, setDefaultProjectName] = useState('');
  const [users, setUsers] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => []);
    api.getCompanies({ list: 1, mine: 1 }).then(list => {
      const arr = Array.isArray(list) ? list : [];
      setCompanies(arr);
      const def = arr.length === 1 ? arr[0] : (arr.find(c => c.id === user?.company_id) || arr[0]);
      if (def) setCompanyId(String(def.id));
    }).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (userName) localStorage.setItem(CURRENT_USER_KEY, userName);
  }, [userName]);

  const effectiveCompanyId = isAdmin ? (companyId || displayCompany?.company_id) : (displayCompany?.company_id ?? user?.company_id);

  useEffect(() => {
    if (!userName?.trim()) {
      setDisplayCompany(null);
      setDefaultCardNo('');
      setDefaultProjectName('');
      setCardNo('');
      setCardOptions([]);
      return;
    }
    (async () => {
      try {
        const [companyRes, settings] = await Promise.all([
          api.getUserCompany(userName).catch(() => ({})),
          api.getUserSettings(userName),
        ]);
        const cr = companyRes;
        setDisplayCompany(cr?.company_id ? { company_id: cr.company_id, company_name: cr.company_name } : null);

        const cid = effectiveCompanyId || cr?.company_id || user?.company_id;
        const [userCards, corporateCards] = await Promise.all([
          api.getUserCards(userName, false, cid || undefined).catch(() => []),
          cid ? api.getCorporateCards(cid).catch(() => []) : Promise.resolve([]),
        ]);
        const uc = Array.isArray(userCards) ? userCards : [];
        const corp = Array.isArray(corporateCards) ? corporateCards : [];

        const allCards = corp.map(c => ({ card_no: (c.card_no || '').trim(), label: c.label || c.card_no || '' })).filter(c => c.card_no);
        const defaultCard = uc.find(c => c.is_default) || uc[0] || corp[0];
        const dCard = defaultCard?.card_no?.trim() || '';
        if (dCard && !allCards.some(c => c.card_no === dCard)) {
          allCards.unshift({ card_no: dCard, label: defaultCard?.label || dCard });
        }
        setCardOptions(allCards);
        setDefaultCardNo(dCard);
        setCardNo(dCard);

        const projects = await api.getProjects(cr?.company_id || cid);
        const proj = Array.isArray(projects) && projects.find(p => p.id === settings?.default_project_id);
        setDefaultProjectName(proj?.name || '');
      } catch (e) { /* ignore */ }
    })();
  }, [userName, effectiveCompanyId, user?.company_id]);

  /** 엑셀 복사는 탭 구분. 탭 우선 사용 시 숫자 내 '10,150' 천단위 쉼표가 컬럼 분리되지 않음 */
  const parseCsvLine = (line) => {
    const byTab = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    if (byTab.length >= 6) return byTab;
    const byComma = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return byComma.length >= 6 ? byComma : byTab;
  };

  const toAmount = (s) => (s || '').trim().replace(/,/g, '');


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
      const card = toAmount(cols[4] || '');
      const cash = toAmount(cols[5] || '');
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

  const effectiveCardNo = (cardNo || defaultCardNo || '').trim();

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
        card_no: effectiveCardNo,
        project_name: defaultProjectName || undefined,
        company_id: effectiveCompanyId || undefined,
      });
      let msg = `${r.count}건 임포트 완료. 문서번호: ${r.doc_no}`;
      if (r.corrected_items?.length) {
        const correctionText = r.corrected_items.map(c =>
          c.reason === '사용내역과 항목 불일치'
            ? `${c.line}번째 라인: 사용내역과 항목이 맞지 않아 '${c.wrong}' → '${c.correct}'(으)로 수정하여 저장합니다.`
            : `${c.line}번째 라인의 항목 '${c.wrong}'이(가) 사용내역 항목에 없어 '${c.correct}'(으)로 수정하여 저장합니다.`
        ).join('\n');
        msg = correctionText + '\n\n' + msg;
      }
      alert(msg);
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
      <p className="desc">엑셀에서 날짜~현금 열(6열)을 선택 후 붙여넣으세요. 탭으로 구분되며, 10,150 같은 천단위 표기도 정상 인식됩니다. 날짜 형식: YYYY-MM-DD</p>
      <div className="card">
        <div className="form-row">
          <label>회사</label>
          {isAdmin ? (
            <select value={companyId || ''} onChange={e => setCompanyId(e.target.value)} disabled={companies.length <= 1}>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.id === user?.company_id ? ' (대표)' : ''}</option>
              ))}
            </select>
          ) : (
            <input type="text" value={displayCompany?.company_name || (user?.company_id && companies.find(c => c.id === user.company_id)?.name) || '-'} readOnly style={{ background: '#f5f5f5', color: '#333' }} />
          )}
        </div>
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
        <div className="form-row">
          <label className={!(cardNo || defaultCardNo)?.trim() ? 'required' : ''}>카드번호 <span className="req">*</span></label>
          <select
            value={cardNo}
            onChange={e => setCardNo(e.target.value)}
            style={{ minWidth: 260 }}
          >
            <option value="">{cardOptions.length ? '선택' : (userName ? '등록된 카드 없음' : '사용자 선택 후 표시')}</option>
            {cardOptions.map(c => (
              <option key={c.card_no} value={c.card_no}>{c.label || c.card_no}{c.label && c.label !== c.card_no ? ` (${c.card_no})` : ''}</option>
            ))}
          </select>
        </div>
        {userName && defaultProjectName && (
          <div className="form-row hint">
            기본 현장: {defaultProjectName}
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
