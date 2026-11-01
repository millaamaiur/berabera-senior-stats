/** A single match's score as the scoreboard shows it: home team first, so away matches read "rival - us". */
export function formatScore(isHome: boolean, goalsFor: number, goalsAgainst: number): string {
  return isHome ? `${goalsFor} - ${goalsAgainst}` : `${goalsAgainst} - ${goalsFor}`;
}
