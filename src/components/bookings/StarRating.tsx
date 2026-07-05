'use client';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md';
}

function Star({ filled, dim }: { filled: boolean; dim: number }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={filled ? '#10d96a' : 'none'}
        stroke={filled ? '#10d96a' : '#d1d5db'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const dim = size === 'sm' ? 20 : 28;
  return (
    <div className="flex gap-1" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          disabled={!onChange}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-volt rounded disabled:cursor-default"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          aria-pressed={star === value}
        >
          <Star filled={star <= value} dim={dim} />
        </button>
      ))}
    </div>
  );
}
