/**
 * The one bit of branding that differs between deployments of this same
 * codebase for different squads of the club (e.g. Senior vs Cadete
 * Femenino) — everything else (logo, colors, layout) stays shared.
 */
export const TEAM_NAME = (import.meta.env.VITE_TEAM_NAME as string | undefined) || 'BERA BERA';
