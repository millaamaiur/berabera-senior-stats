import { useState } from 'react';

interface PlayerAvatarProps {
  playerId: string;
  name: string;
  className?: string;
}

/** A player's photo (public/players/<id>.png), falling back to initials if it fails to load or doesn't exist. */
export function PlayerAvatar({ playerId, name, className = 'h-10 w-10' }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-800 font-bold text-slate-400 ${className}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={`/players/${playerId}.png`}
      alt={name}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full border-2 border-slate-700 object-cover ${className}`}
    />
  );
}
