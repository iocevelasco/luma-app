import { cn } from '@/lib/utils';

interface GridBackgroundProps {
  className?: string;
  opacity?: number;
  size?: number;
}

export function GridBackground({ className, opacity = 0.025, size = 48 }: GridBackgroundProps) {
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{
        backgroundImage:
          'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: `${size}px ${size}px`,
        opacity,
      }}
      aria-hidden="true"
    />
  );
}
