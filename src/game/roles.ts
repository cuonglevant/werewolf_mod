export const SPECIAL_ROLES = [
  'Seer',
  'Apprentice Seer',
  'Bodyguard',
  'Witch',
  'Enchantress',
  'Hunter',
  'Cupid',
  'Little Girl',
  'Elder',
  'Strongman',
  'Thief',
  'Scapegoat',
  'Fox',
  'Tanner',
  'Cursed',
  'Whitewolf',
  'The Doppelgänger',
] as const;

export type SpecialRole = (typeof SPECIAL_ROLES)[number];

export type RoleName = 'Werewolf' | 'Villager' | SpecialRole;

export type RoleCounts = Record<RoleName, number>;

export const ROLE_SHORT_DESCRIPTIONS: Record<SpecialRole, string> = {
  Seer: 'Checks one player each night.',
  'Apprentice Seer': 'Becomes Seer when Seer dies.',
  Bodyguard: 'Protects one player from attacks.',
  Witch: 'Has one heal and one poison potion.',
  Enchantress: 'Enchants one player at night according to your table rules.',
  Hunter: 'Eliminates someone when dying.',
  Cupid: 'Links two lovers at game start.',
  'Little Girl': 'May peek during werewolf phase.',
  Elder: 'Vote counts as two votes during day voting.',
  Strongman:
    'Survives a Werewolf attack, then automatically dies at the start of the next night.',
  Thief: 'May swap role early in game.',
  Scapegoat: 'Executed when village vote ties.',
  Fox: 'Can sense nearby werewolf presence.',
  Tanner: 'Wins if executed by the village.',
  Cursed: 'May turn into werewolf if attacked.',
  Whitewolf: 'Special wolf with unique night power.',
  'The Doppelgänger': 'Copies another role at game start.',
};

export const ROLE_DISPLAY_ORDER: RoleName[] = [
  'Werewolf',
  'Seer',
  'Apprentice Seer',
  'Bodyguard',
  'Witch',
  'Enchantress',
  'Hunter',
  'Cupid',
  'Little Girl',
  'Elder',
  'Strongman',
  'Thief',
  'Scapegoat',
  'Fox',
  'Tanner',
  'Cursed',
  'Whitewolf',
  'The Doppelgänger',
  'Villager',
];

export const getStandardWerewolfCount = (playerCount: number): number => {
  if (playerCount <= 5) return 1;
  if (playerCount <= 8) return 2;
  if (playerCount <= 11) return 3;
  if (playerCount <= 15) return 4;
  return Math.max(4, Math.floor(playerCount / 4));
};

export const calculateRoleCounts = (
  playerCount: number,
  enabledSpecialRoles: SpecialRole[],
  werewolfCount: number,
): RoleCounts => {
  const werewolves = Math.max(
    1,
    Math.min(werewolfCount, Math.max(1, playerCount - 1)),
  );
  const specialCount = enabledSpecialRoles.length;
  const villagers = Math.max(0, playerCount - werewolves - specialCount);

  const counts: RoleCounts = {
    Werewolf: werewolves,
    Villager: villagers,
    Seer: 0,
    'Apprentice Seer': 0,
    Bodyguard: 0,
    Witch: 0,
    Enchantress: 0,
    Hunter: 0,
    Cupid: 0,
    'Little Girl': 0,
    Elder: 0,
    Strongman: 0,
    Thief: 0,
    Scapegoat: 0,
    Fox: 0,
    Tanner: 0,
    Cursed: 0,
    Whitewolf: 0,
    'The Doppelgänger': 0,
  };

  enabledSpecialRoles.forEach((role) => {
    counts[role] = 1;
  });

  return counts;
};

export const canFitSelectedSpecialRoles = (
  playerCount: number,
  enabledSpecialRoles: SpecialRole[],
  werewolfCount: number,
): boolean => {
  if (werewolfCount < 1 || werewolfCount >= playerCount) {
    return false;
  }

  const werewolves = werewolfCount;
  return enabledSpecialRoles.length <= playerCount - werewolves;
};

export const getDeckList = (counts: RoleCounts): RoleName[] => {
  return ROLE_DISPLAY_ORDER.flatMap((role) =>
    Array.from({ length: counts[role] }, () => role),
  );
};
