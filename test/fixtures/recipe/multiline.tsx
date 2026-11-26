import { useState } from 'react';

export function Counter({ limit }: { limit: number }) {
  const [n, setN] = useState<number>(0);
  const over = n > limit;
  return (
    <div className="card">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={n > limit}
        onClick={() => {
          if (n < limit) setN((v) => v + 1);
        }}
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setN((v) => (v > 0 ? v - 1 : 0))}
        className="px-3 py-1 rounded border"
        aria-label={over ? 'Over the limit >' : 'Remove'}
      >
        Remove
      </button>
    </div>
  );
}
