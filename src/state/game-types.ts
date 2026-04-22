import type { RoleName } from '@/src/game/roles';

export type TrackedPlayer = {
  id: string;
  role: RoleName;
  alive: boolean;
  name: string;
};

export type TrackerRoleSnapshot = Record<string, RoleName>;
