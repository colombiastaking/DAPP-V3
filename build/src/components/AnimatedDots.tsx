import { useEffect, useRef, useState } from 'react';

export function AnimatedDots({ style }: { style?: React.CSSProperties }) {
  const [dots, setDots] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <span style={style}>{dots || '.'}</span>
  );
}
