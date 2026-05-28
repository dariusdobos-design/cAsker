import { SquareCheck } from "lucide-react";

type StateIconProps = {
  className?: string;
};

const STROKE = 2.25;

/** Dopyt – auto + servisný kľúč (vlastné SVG) */
export function CarWrenchIcon({ className }: StateIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M20.96 16.45c.01-.15.04-.3.04-.45v.5zM11 16c0 .71.15 1.39.42 2H6v1c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v-8l2.08-6c.2-.58.76-1 1.42-1h11c.66 0 1.22.42 1.42 1L21 11v5c0-2.76-2.24-5-5-5s-5 2.24-5 5m-3-2.5c0-.83-.67-1.5-1.5-1.5S5 12.67 5 13.5S5.67 15 6.5 15S8 14.33 8 13.5M19 10l-1.5-4.5h-11L5 10zm3.87 11.19l-4.11-4.11c.41-1.04.18-2.26-.68-3.11c-.9-.91-2.25-1.09-3.34-.59l1.94 1.94l-1.35 1.36l-1.99-1.95c-.54 1.09-.29 2.44.59 3.35a2.91 2.91 0 0 0 3.12.68l4.11 4.1c.18.19.45.19.63 0l1.04-1.03c.22-.18.22-.5.04-.64"
      />
    </svg>
  );
}

/** Čaká – presýpacie hodiny (vlastné SVG) */
export function HourglassStateIcon({ className }: StateIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={32}
        d="M145.61 464h220.78c19.8 0 35.55-16.29 33.42-35.06C386.06 308 304 310 304 256s83.11-51 95.8-172.94c2-18.78-13.61-35.06-33.41-35.06H145.61c-19.8 0-35.37 16.28-33.41 35.06C124.89 205 208 201 208 256s-82.06 52-95.8 172.94c-2.14 18.77 13.61 35.06 33.41 35.06"
      />
      <path
        fill="currentColor"
        d="M343.3 432H169.13c-15.6 0-20-18-9.06-29.16C186.55 376 240 356.78 240 326V224c0-19.85-38-35-61.51-67.2c-3.88-5.31-3.49-12.8 6.37-12.8h142.73c8.41 0 10.23 7.43 6.4 12.75C310.82 189 272 204.05 272 224v102c0 30.53 55.71 47 80.4 76.87c9.95 12.04 6.47 29.13-9.1 29.13"
      />
    </svg>
  );
}

/** Prijaté – štvorec s fajkou */
export function CheckboxStateIcon({ className }: StateIconProps) {
  return (
    <SquareCheck
      className={`shrink-0 ${className ?? ""}`}
      strokeWidth={STROKE}
      aria-hidden
    />
  );
}

export const STATE_ICONS = {
  inquiry: CarWrenchIcon,
  waiting: HourglassStateIcon,
  done: CheckboxStateIcon,
} as const;
