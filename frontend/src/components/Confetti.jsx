const PIECE_COUNT = 12;

export default function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }).map((_, i) => {
        const angle = (360 / PIECE_COUNT) * i + (i % 2 === 0 ? 6 : -6);
        const delay = (i % 4) * 0.05;
        const distance = 70 + (i % 3) * 18;
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className={`confetti-piece confetti-piece-${i % 5}`}
            style={{ '--angle': `${angle}deg`, '--delay': `${delay}s`, '--distance': `${distance}px` }}
          />
        );
      })}
    </div>
  );
}
