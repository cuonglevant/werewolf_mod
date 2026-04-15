import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  calculateRoleCounts,
  canFitSelectedSpecialRoles,
  getDeckList,
  getStandardWerewolfCount,
  ROLE_DISPLAY_ORDER,
  RoleCounts,
  RoleName,
  SPECIAL_ROLES,
  SpecialRole,
} from '@/src/game/roles';

type TrackedPlayer = {
  id: string;
  role: RoleName;
  alive: boolean;
  name: string;
};

type TrackerRoleSnapshot = Record<string, RoleName>;

export type AppLanguage = 'en' | 'vi';

type GameContextValue = {
  playerCount: number;
  playerNames: string[];
  selectedRoles: Record<SpecialRole, boolean>;
  setPlayerCount: (count: number) => void;
  setPlayerNames: (names: string[]) => void;
  setWerewolfCount: (count: number) => void;
  toggleRole: (role: SpecialRole) => void;
  generated: boolean;
  counts: RoleCounts;
  deckList: RoleName[];
  tracker: TrackedPlayer[];
  canGenerate: boolean;
  generateGame: () => void;
  toggleTrackerPlayer: (id: string) => void;
  setTrackerPlayerAlive: (id: string, alive: boolean) => void;
  setTrackerPlayerRole: (id: string, role: RoleName) => void;
  resetTracker: () => void;
  werewolfCount: number;
  suggestedWerewolfCount: number;
  language: AppLanguage;
  toggleLanguage: () => void;
};

const defaultSelectedRoles = Object.fromEntries(
  SPECIAL_ROLES.map((role) => [role, false]),
) as Record<SpecialRole, boolean>;

const emptyCounts = Object.fromEntries(
  ROLE_DISPLAY_ORDER.map((role) => [role, 0]),
) as RoleCounts;

const GameContext = createContext<GameContextValue | null>(null);

const buildTrackerFromCounts = (counts: RoleCounts): TrackedPlayer[] => {
  return ROLE_DISPLAY_ORDER.flatMap((role) =>
    Array.from({ length: counts[role] }, (_, index) => ({
      id: `${role}-${index + 1}`,
      role,
      alive: true,
      name: '',
    })),
  );
};

export const GameProvider = ({ children }: { children: React.ReactNode }) => {
  const [playerCount, setPlayerCount] = useState(8);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 8 }, (_, index) => `Player ${index + 1}`),
  );
  const [werewolfCount, setWerewolfCount] = useState(
    getStandardWerewolfCount(8),
  );
  const [selectedRoles, setSelectedRoles] =
    useState<Record<SpecialRole, boolean>>(defaultSelectedRoles);
  const [generated, setGenerated] = useState(false);
  const [counts, setCounts] = useState<RoleCounts>(emptyCounts);
  const [deckList, setDeckList] = useState<RoleName[]>([]);
  const [tracker, setTracker] = useState<TrackedPlayer[]>([]);
  const [initialTrackerRoles, setInitialTrackerRoles] =
    useState<TrackerRoleSnapshot>({});
  const [language, setLanguage] = useState<AppLanguage>('en');

  const enabledSpecialRoles = useMemo(
    () => SPECIAL_ROLES.filter((role) => selectedRoles[role]),
    [selectedRoles],
  );

  const suggestedWerewolfCount = useMemo(
    () => getStandardWerewolfCount(playerCount),
    [playerCount],
  );

  useEffect(() => {
    const maxWerewolves = Math.max(1, playerCount - 1);
    setWerewolfCount((prev) => Math.max(1, Math.min(prev, maxWerewolves)));
  }, [playerCount]);

  const updatePlayerCount = useCallback((count: number) => {
    const sanitizedCount = Math.max(0, count);
    setPlayerCount(sanitizedCount);
    setPlayerNames((previousNames) => {
      if (sanitizedCount <= previousNames.length) {
        return previousNames.slice(0, sanitizedCount);
      }

      return [
        ...previousNames,
        ...Array.from(
          { length: sanitizedCount - previousNames.length },
          (_, index) => `Player ${previousNames.length + index + 1}`,
        ),
      ];
    });
  }, []);

  const canGenerate = useMemo(
    () =>
      playerCount >= 3 &&
      canFitSelectedSpecialRoles(
        playerCount,
        enabledSpecialRoles,
        werewolfCount,
      ),
    [enabledSpecialRoles, playerCount, werewolfCount],
  );

  const toggleRole = useCallback((role: SpecialRole) => {
    setSelectedRoles((prev) => ({ ...prev, [role]: !prev[role] }));
  }, []);

  const generateGame = useCallback(() => {
    const nextCounts = calculateRoleCounts(
      playerCount,
      enabledSpecialRoles,
      werewolfCount,
    );
    const nextDeck = getDeckList(nextCounts);
    const nextTracker = buildTrackerFromCounts(nextCounts).map(
      (entry, index) => ({
        ...entry,
        name: playerNames[index]?.trim() || `Player ${index + 1}`,
      }),
    );
    setCounts(nextCounts);
    setDeckList(nextDeck);
    setTracker(nextTracker);
    setInitialTrackerRoles(
      Object.fromEntries(nextTracker.map((player) => [player.id, player.role])),
    );
    setGenerated(true);
  }, [enabledSpecialRoles, playerCount, werewolfCount, playerNames]);

  const toggleTrackerPlayer = useCallback((id: string) => {
    setTracker((prev) =>
      prev.map((player) =>
        player.id === id ? { ...player, alive: !player.alive } : player,
      ),
    );
  }, []);

  const setTrackerPlayerAlive = useCallback((id: string, alive: boolean) => {
    setTracker((prev) =>
      prev.map((player) => (player.id === id ? { ...player, alive } : player)),
    );
  }, []);

  const setTrackerPlayerRole = useCallback((id: string, role: RoleName) => {
    setTracker((prev) =>
      prev.map((player) => (player.id === id ? { ...player, role } : player)),
    );
  }, []);

  const resetTracker = useCallback(() => {
    setTracker((prev) =>
      prev.map((player) => ({
        ...player,
        alive: true,
        role: initialTrackerRoles[player.id] ?? player.role,
      })),
    );
  }, [initialTrackerRoles]);

  const toggleLanguage = useCallback(() => {
    setLanguage((previous) => (previous === 'en' ? 'vi' : 'en'));
  }, []);

  const value = useMemo(
    () => ({
      playerCount,
      playerNames,
      selectedRoles,
      setPlayerCount: updatePlayerCount,
      setPlayerNames,
      setWerewolfCount,
      toggleRole,
      generated,
      counts,
      deckList,
      tracker,
      canGenerate,
      generateGame,
      toggleTrackerPlayer,
      setTrackerPlayerAlive,
      setTrackerPlayerRole,
      resetTracker,
      werewolfCount,
      suggestedWerewolfCount,
      language,
      toggleLanguage,
    }),
    [
      playerCount,
      playerNames,
      selectedRoles,
      updatePlayerCount,
      generated,
      counts,
      deckList,
      tracker,
      canGenerate,
      werewolfCount,
      suggestedWerewolfCount,
      language,
      toggleRole,
      generateGame,
      toggleTrackerPlayer,
      setTrackerPlayerAlive,
      setTrackerPlayerRole,
      resetTracker,
      toggleLanguage,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }

  return context;
};
