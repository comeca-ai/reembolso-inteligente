import { cn } from "@/lib/utils";
import logoCompact from "@/assets/reembolsa-logo-compact.png.asset.json";
import logoCompactWhite from "@/assets/reembolsa-logo-compact-white.png.asset.json";
import logoFull from "@/assets/reembolsa-logo.png.asset.json";
import logoFullWhite from "@/assets/reembolsa-logo-white.png.asset.json";
import iconColor from "@/assets/reembolsa-icon.png.asset.json";
import iconWhite from "@/assets/reembolsa-icon-white.png.asset.json";

interface LogoProps {
  className?: string;
  /** Mostra o wordmark "reembolsa aí". Quando false, exibe só o ícone. */
  withWordmark?: boolean;
  /** Inclui o slogan "Reembolso rápido, sem complicação". */
  withTagline?: boolean;
  /** "light" para fundos escuros (sidebar), "dark" para fundos claros. */
  variant?: "light" | "dark";
}

/**
 * Logotipo oficial reembolsa.aí (arte do cliente).
 * Renderiza o PNG da marca em diferentes formatos/variantes.
 */
export function Logo({
  className,
  withWordmark = true,
  withTagline = false,
  variant = "dark",
}: LogoProps) {
  const light = variant === "light";

  if (!withWordmark) {
    return (
      <img
        src={(light ? iconWhite : iconColor).url}
        alt="reembolsa aí"
        className={cn("h-8 w-auto", className)}
        loading="eager"
        decoding="async"
      />
    );
  }

  const src = withTagline
    ? (light ? logoFullWhite : logoFull).url
    : (light ? logoCompactWhite : logoCompact).url;

  return (
    <img
      src={src}
      alt="reembolsa aí — Reembolso rápido, sem complicação"
      className={cn("h-8 w-auto", className)}
      loading="eager"
      decoding="async"
    />
  );
}

/** Apenas o ícone circular da marca. */
export function LogoMark({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <img
      src={(variant === "light" ? iconWhite : iconColor).url}
      alt="reembolsa aí"
      className={cn("h-8 w-8", className)}
      loading="eager"
      decoding="async"
    />
  );
}
