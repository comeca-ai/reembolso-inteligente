import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  /** "light" for dark backgrounds (sidebar), "dark" for light backgrounds */
  variant?: "light" | "dark";
}

/**
 * reembolsa.aí — circular teal mark + wordmark.
 * The mark is a circular loop with an embedded check/return arrow,
 * evoking "reembolso" (the money coming back).
 */
export function Logo({ className, withWordmark = true, variant = "dark" }: LogoProps) {
  const wordTone = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const accentTone = variant === "light" ? "text-sidebar-primary" : "text-brand";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8 shrink-0" />
      {withWordmark && (
        <span className={cn("text-[17px] font-semibold tracking-tight", wordTone)}>
          reembolsa<span className={accentTone}>.aí</span>
        </span>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="reembolsa.aí"
      role="img"
    >
      <circle cx="20" cy="20" r="20" fill="var(--brand)" />
      <path
        d="M27.5 14.2a9 9 0 1 0 1.9 5.2"
        stroke="var(--brand-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22.4 11.2l5.4 1.1-1.6 5.2"
        stroke="var(--brand-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M15.5 20.4l3.1 3.1 6.2-6.5"
        stroke="var(--brand-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
