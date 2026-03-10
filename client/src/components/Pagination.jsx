import './Pagination.css';

const PAGE_SIZE = 20;

export { PAGE_SIZE };

export default function Pagination({ total, page, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  if (total <= 0) return null;

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total}건 중 {start}-{end}
      </span>
      <div className="pagination-btns">
        <button type="button" disabled={!canPrev} onClick={() => onChange(page - 1)}>
          이전
        </button>
        <span className="pagination-page">
          {page} / {totalPages}
        </span>
        <button type="button" disabled={!canNext} onClick={() => onChange(page + 1)}>
          다음
        </button>
      </div>
    </div>
  );
}
