import { useEffect, useRef } from 'react';
import { createCityCanvas, type CityCanvas } from '../canvas/PixiApp';

export function CanvasHost() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CityCanvas | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;

    createCityCanvas(hostRef.current).then((canvas) => {
      if (cancelled) {
        canvas.destroy();
        return;
      }
      canvasRef.current = canvas;
    });

    return () => {
      cancelled = true;
      canvasRef.current?.destroy();
      canvasRef.current = null;
    };
  }, []);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
