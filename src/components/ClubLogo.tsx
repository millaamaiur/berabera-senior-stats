interface ClubLogoProps {
  className?: string;
}

/** The real Bera Bera Donostia club crest. */
export function ClubLogo({ className }: ClubLogoProps) {
  return <img src="/logo.png" alt="Bera Bera Donostia" className={className} />;
}
