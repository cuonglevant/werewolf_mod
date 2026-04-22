import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ROLE_DISPLAY_ORDER,
  SPECIAL_ROLES,
  type RoleName,
} from '@/src/game/roles';
import { getRoleLabel } from '@/src/i18n/roles';
import { APP_COLORS as COLORS } from '@/src/shared/colors';
import { uiText } from '@/src/i18n/ui';
import { useGame } from '@/src/state/game-context';

const NIGHT_PHASES = [
  'Werewolves',
  'Seer',
  'Bodyguard',
  'Witch',
  'Cupid',
  'Whitewolf',
  'The Doppelgänger',
  'Discussion',
  'Vote',
  'Lynch',
] as const;

const DEFAULT_PHASE_SECONDS = 45;
const DEFAULT_DISCUSSION_SECONDS = 90;
const DEFAULT_VOTE_SECONDS = 15;
const DEFAULT_LYNCH_SECONDS = 30;

type NightPhaseName = (typeof NIGHT_PHASES)[number];

type PhaseTimerState = {
  remaining: number;
  running: boolean;
};

type NightLogEntry = {
  id: string;
  night: number;
  text: string;
  createdAt: string;
};

type PendingDoppelCopy = {
  doppelId: string;
  targetId: string;
  copiedRole: RoleName;
};

type PendingHunterRevenge = {
  hunterId: string;
  targetId: string;
};

type LastAppliedNightAction = {
  playerId: string;
  previousAlive: boolean;
  changedAlive: boolean;
  previousRole: RoleName;
  changedRole: boolean;
  nextRole: RoleName;
  logEntryId: string;
  previousWasProtectedByBodyguard: boolean;
  nextWasProtectedByBodyguard: boolean;
  previousWitchChecklist: boolean[];
  nextWitchChecklist: boolean[];
  previousCursedChecklist: boolean[];
  nextCursedChecklist: boolean[];
  previousCupidChecklist: boolean[];
  nextCupidChecklist: boolean[];
  previousDoppelChecklist: boolean[];
  nextDoppelChecklist: boolean[];
  previousFoxChecklist: boolean[];
  nextFoxChecklist: boolean[];
  previousSeerCheckedPlayerIds: string[];
  nextSeerCheckedPlayerIds: string[];
  previousEnchantressMarkedPlayerIds?: string[];
  nextEnchantressMarkedPlayerIds?: string[];
  previousDoppelCopiedPlayerIds: string[];
  nextDoppelCopiedPlayerIds: string[];
  previousCupidLinkedPlayerIds: string[];
  nextCupidLinkedPlayerIds: string[];
  previousWerewolfAttackedPlayerIds: string[];
  nextWerewolfAttackedPlayerIds: string[];
  previousWhitewolfAttackedPlayerIds?: string[];
  nextWhitewolfAttackedPlayerIds?: string[];
  previousBodyguardProtectedPlayerIds?: string[];
  nextBodyguardProtectedPlayerIds?: string[];
  previousPendingDoppelCopy?: PendingDoppelCopy | null;
  nextPendingDoppelCopy?: PendingDoppelCopy | null;
  secondaryRoleChangePlayerId?: string;
  secondaryPreviousRole?: RoleName;
  secondaryNextRole?: RoleName;
  secondaryChangedRole?: boolean;
  previousPendingHunterRevenge?: PendingHunterRevenge | null;
  nextPendingHunterRevenge?: PendingHunterRevenge | null;
  secondaryAliveChangePlayerId?: string;
  secondaryPreviousAlive?: boolean;
  secondaryNextAlive?: boolean;
  secondaryChangedAlive?: boolean;
  tertiaryAliveChangePlayerId?: string;
  tertiaryPreviousAlive?: boolean;
  tertiaryNextAlive?: boolean;
  tertiaryChangedAlive?: boolean;
  previousStrongmanSurvivedPlayerIds?: string[];
  nextStrongmanSurvivedPlayerIds?: string[];
  previousPendingCursedTransformPlayerIds?: string[];
  nextPendingCursedTransformPlayerIds?: string[];
};

type PlayerNightAction = {
  key: string;
  label: string;
  noteTemplate: string;
  aliveAfter?: boolean;
  roleAfter?: RoleName;
  requiresRole?: Exclude<RoleName, 'Villager'>;
  disabled?: boolean;
};

type NightGuideStep = {
  id: string;
  title: string;
  call: string;
  notes: string;
  requiresRole?:
    | 'Werewolf'
    | 'Whitewolf'
    | 'Seer'
    | 'Bodyguard'
    | 'Witch'
    | 'Enchantress'
    | 'Hunter'
    | 'Cupid'
    | 'The Doppelgänger'
    | 'Thief'
    | 'Fox'
    | 'Little Girl';
  firstNightOnly?: boolean;
  evenNightOnly?: boolean;
};

const NIGHT_GUIDE_STEPS: NightGuideStep[] = [
  {
    id: 'sleep',
    title: 'Close Night',
    call: 'Everyone closes eyes. Moderator confirms silence.',
    notes: 'Pause a moment before each role call so transitions stay clear.',
  },
  {
    id: 'doppelganger',
    title: 'Doppelgänger Choice',
    call: 'Doppelgänger wakes and points to a player to copy.',
    notes: 'Record the copied target privately.',
    requiresRole: 'The Doppelgänger',
    firstNightOnly: true,
  },
  {
    id: 'thief',
    title: 'Thief Decision',
    call: 'Thief wakes and may switch role if your variant allows.',
    notes: 'Apply once on the first night only.',
    requiresRole: 'Thief',
    firstNightOnly: true,
  },
  {
    id: 'cupid',
    title: 'Cupid Setup',
    call: 'Cupid wakes and chooses two lovers.',
    notes: 'Inform lovers silently, then Cupid sleeps.',
    requiresRole: 'Cupid',
    firstNightOnly: true,
  },
  {
    id: 'bodyguard',
    title: 'Bodyguard Protects',
    call: 'Bodyguard wakes and selects one player to protect.',
    notes: 'Protected players survive werewolf attacks this night.',
    requiresRole: 'Bodyguard',
  },
  {
    id: 'werewolves',
    title: 'Werewolves Act',
    call: 'Werewolves wake, choose one target, then sleep.',
    notes:
      'Use player modal actions to mark attack results. Strongman auto-dies next night after surviving; Cursed auto-turns into Werewolf next night when attacked.',
    requiresRole: 'Werewolf',
  },
  {
    id: 'hunter',
    title: 'Hunter Marks Target',
    call: 'Hunter wakes and picks one revenge target if your table uses this rule.',
    notes: 'If Hunter dies, the marked target is eliminated immediately.',
    requiresRole: 'Hunter',
  },
  {
    id: 'whitewolf',
    title: 'Whitewolf Action',
    call: 'Whitewolf wakes for their special action on even-numbered nights.',
    notes:
      'Resolve right after Werewolves on nights 2, 4, 6... unless your table uses another order.',
    requiresRole: 'Whitewolf',
    evenNightOnly: true,
  },
  {
    id: 'witch',
    title: 'Witch Potions',
    call: 'Witch wakes and may heal or poison according to remaining potions.',
    notes: 'Using modal actions auto-updates Witch potion checklist.',
    requiresRole: 'Witch',
  },
  {
    id: 'enchantress',
    title: 'Enchantress Casts Spell',
    call: 'Enchantress wakes and marks one player according to your table rules.',
    notes: 'Resolve the enchanted effect using your chosen variant.',
    requiresRole: 'Enchantress',
  },
  {
    id: 'seer',
    title: 'Seer Checks',
    call: 'Seer wakes and checks one player.',
    notes: 'Reveal alignment privately, then Seer sleeps.',
    requiresRole: 'Seer',
  },
  {
    id: 'fox',
    title: 'Fox Senses',
    call: 'Fox wakes and uses sensing action if enabled in your variant.',
    notes: 'Skip if your table does not use Fox night sensing.',
    requiresRole: 'Fox',
  },
  {
    id: 'little-girl',
    title: 'Little Girl Reminder',
    call: 'Little Girl may peek only if your table allows that variant.',
    notes: 'Apply your group’s safety/fair-play rule consistently.',
    requiresRole: 'Little Girl',
  },
  {
    id: 'resolve',
    title: 'Resolve & Dawn',
    call: 'Resolve effects, then announce dawn and outcomes.',
    notes: 'Log key developments before starting discussion/vote.',
  },
];

const CUPID_LINK_LOVERS_ACTION: PlayerNightAction = {
  key: 'cupid_link_lovers',
  label: 'Link lovers',
  noteTemplate: '{name} linked two lovers.',
  requiresRole: 'Cupid',
};

const HUNTER_SET_REVENGE_TARGET_ACTION: PlayerNightAction = {
  key: 'hunter_set_revenge_target',
  label: 'Choose revenge target',
  noteTemplate: '{name} selected a revenge target.',
  requiresRole: 'Hunter',
};

const SEER_CHECK_PLAYER_ACTION: PlayerNightAction = {
  key: 'seer_check_player',
  label: 'Check player',
  noteTemplate: '{name} checked a player.',
  requiresRole: 'Seer',
};

const ENCHANTRESS_MARK_TARGET_ACTION: PlayerNightAction = {
  key: 'enchantress_mark_target',
  label: 'Cast spell on player',
  noteTemplate: '{name} cast a spell on a player.',
  requiresRole: 'Enchantress',
};

const DOPPEL_COPY_PLAYER_ACTION: PlayerNightAction = {
  key: 'doppel_copy_player',
  label: 'Copy player',
  noteTemplate: '{name} copied a player role.',
  requiresRole: 'The Doppelgänger',
};

const WITCH_SAVE_TARGET_ACTION: PlayerNightAction = {
  key: 'witch_save_target',
  label: 'Save',
  noteTemplate: '{name} used Witch save.',
  requiresRole: 'Witch',
};

const WITCH_KILL_TARGET_ACTION: PlayerNightAction = {
  key: 'witch_kill_target',
  label: 'Kill',
  noteTemplate: '{name} used Witch kill.',
  requiresRole: 'Witch',
};

const BODYGUARD_CHOOSE_TARGET_ACTION: PlayerNightAction = {
  key: 'bodyguard_choose_target',
  label: 'Choose player to protect',
  noteTemplate: '{name} chose a player to protect.',
  requiresRole: 'Bodyguard',
};

const ROLE_SPECIFIC_ACTIONS: Partial<Record<RoleName, PlayerNightAction[]>> = {
  Cursed: [
    {
      key: 'cursed_turned_werewolf',
      label: 'Cursed transformed into Werewolf',
      noteTemplate: '{name} transformed into a Werewolf.',
      aliveAfter: true,
      roleAfter: 'Werewolf',
      requiresRole: 'Werewolf',
    },
  ],
  Fox: [
    {
      key: 'fox_sensed_werewolf',
      label: 'Fox sensed nearby Werewolf',
      noteTemplate: '{name} sensed nearby Werewolf activity.',
      requiresRole: 'Fox',
    },
    {
      key: 'fox_sensed_clear',
      label: 'Fox sensed no Werewolf nearby',
      noteTemplate: '{name} sensed no nearby Werewolf activity.',
      requiresRole: 'Fox',
    },
  ],
};

const PLAYER_NIGHT_ACTIONS: PlayerNightAction[] = [
  {
    key: 'werewolf_attack',
    label: 'Attacked by Werewolf',
    noteTemplate: '{name} was attacked by Werewolves.',
    aliveAfter: false,
    requiresRole: 'Werewolf',
  },
  {
    key: 'witch_killed',
    label: 'Killed by Witch',
    noteTemplate: '{name} was killed by Witch.',
    aliveAfter: false,
    requiresRole: 'Witch',
  },
  {
    key: 'village_vote_killed',
    label: 'Dead by village vote',
    noteTemplate: '{name} died by village vote.',
    aliveAfter: false,
  },
  {
    key: 'witch_saved',
    label: 'Saved by Witch',
    noteTemplate: '{name} was saved by Witch.',
    aliveAfter: true,
    requiresRole: 'Witch',
  },
  {
    key: 'seer_checked',
    label: 'Checked by Seer',
    noteTemplate: '{name} was checked by Seer.',
    requiresRole: 'Seer',
  },
  {
    key: 'whitewolf_killed',
    label: 'Killed by Whitewolf',
    noteTemplate: '{name} was killed by Whitewolf.',
    aliveAfter: false,
    requiresRole: 'Whitewolf',
  },
];

const SPECIAL_ROLE_CHECKLISTS = {
  Cupid: ['Lovers linked'],
  Witch: ['Heal potion used', 'Poison potion used'],
  Cursed: ['Cursed turned into Werewolf'],
  Fox: ['Sensing used this night'],
  'The Doppelgänger': ['Role copied at game start'],
} as const;

type SpecialChecklistRole = keyof typeof SPECIAL_ROLE_CHECKLISTS;

type RoleEditStep = 'role' | 'player' | 'assign';

type TrackerTabKey = 'players-actions' | 'guide' | 'timers' | 'special-checks';

type SpecialChecklistState = Record<SpecialChecklistRole, boolean[]>;

const buildInitialSpecialChecklistState = (): SpecialChecklistState => ({
  Cupid: SPECIAL_ROLE_CHECKLISTS.Cupid.map(() => false),
  Witch: SPECIAL_ROLE_CHECKLISTS.Witch.map(() => false),
  Cursed: SPECIAL_ROLE_CHECKLISTS.Cursed.map(() => false),
  Fox: SPECIAL_ROLE_CHECKLISTS.Fox.map(() => false),
  'The Doppelgänger': SPECIAL_ROLE_CHECKLISTS['The Doppelgänger'].map(
    () => false,
  ),
});

const buildInitialPhaseTimers = (
  durationSeconds: number,
): Record<NightPhaseName, PhaseTimerState> =>
  NIGHT_PHASES.reduce(
    (accumulator, phase) => ({
      ...accumulator,
      [phase]: { remaining: durationSeconds, running: false },
    }),
    {} as Record<NightPhaseName, PhaseTimerState>,
  );

const buildDefaultPhaseTimers = (): Record<NightPhaseName, PhaseTimerState> => {
  const baseTimers = buildInitialPhaseTimers(DEFAULT_PHASE_SECONDS);

  return {
    ...baseTimers,
    Discussion: { remaining: DEFAULT_DISCUSSION_SECONDS, running: false },
    Vote: { remaining: DEFAULT_VOTE_SECONDS, running: false },
    Lynch: { remaining: DEFAULT_LYNCH_SECONDS, running: false },
  };
};

const buildDefaultDayTimerInputs = (): Record<
  'Discussion' | 'Vote' | 'Lynch',
  string
> => ({
  Discussion: String(DEFAULT_DISCUSSION_SECONDS),
  Vote: String(DEFAULT_VOTE_SECONDS),
  Lynch: String(DEFAULT_LYNCH_SECONDS),
});

const formatSeconds = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const normalizeDuration = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 5) {
    return DEFAULT_PHASE_SECONDS;
  }

  return parsed;
};

const DAY_TIMER_PHASES = ['Discussion', 'Vote', 'Lynch'] as const;
type DayTimerPhase = (typeof DAY_TIMER_PHASES)[number];
const isDayTimerPhase = (phase: NightPhaseName): phase is DayTimerPhase =>
  DAY_TIMER_PHASES.includes(phase as DayTimerPhase);

const applyElapsedToPhaseTimers = (
  previousTimers: Record<NightPhaseName, PhaseTimerState>,
  elapsedSeconds: number,
) => {
  if (elapsedSeconds <= 0) {
    return previousTimers;
  }

  return NIGHT_PHASES.reduce(
    (accumulator, phase) => {
      const timer = previousTimers[phase];

      if (!timer.running) {
        accumulator[phase] = timer;
        return accumulator;
      }

      const nextRemaining = Math.max(0, timer.remaining - elapsedSeconds);
      accumulator[phase] = {
        remaining: nextRemaining,
        running: nextRemaining > 0,
      };

      return accumulator;
    },
    {} as Record<NightPhaseName, PhaseTimerState>,
  );
};

const VI_PHASE_LABELS: Record<NightPhaseName, string> = {
  Werewolves: 'Ma Sói',
  Seer: 'Tiên Tri',
  Bodyguard: 'Bảo Vệ',
  Witch: 'Phù Thủy',
  Cupid: 'Thần Tình Yêu',
  Whitewolf: 'Sói Trắng',
  'The Doppelgänger': 'Kẻ Sao Chép',
  Discussion: 'Thảo luận',
  Vote: 'Bỏ phiếu',
  Lynch: 'Xử tử',
};

const VI_ACTION_NOTE_TEMPLATES: Record<string, string> = {
  werewolf_attack: '{name} bị Ma Sói tấn công.',
  witch_killed: '{name} bị Phù Thủy giết.',
  witch_saved: '{name} được Phù Thủy cứu.',
  seer_checked: '{name} đã bị Tiên Tri soi.',
  whitewolf_killed: '{name} bị Sói Trắng giết.',
  village_vote_killed: '{name} chết do dân làng bỏ phiếu.',
  cursed_turned_werewolf: '{name} đã biến thành Ma Sói.',
  fox_sensed_werewolf: '{name} cảm nhận thấy Ma Sói ở gần.',
  fox_sensed_clear: '{name} không cảm nhận thấy Ma Sói ở gần.',
  cupid_link_lovers: '{name} đã liên kết hai tình nhân.',
  hunter_set_revenge_target: '{name} đã chọn mục tiêu trả thù.',
  doppel_copy_player: '{name} đã sao chép vai trò của một người.',
  seer_check_player: '{name} đã soi một người chơi.',
  enchantress_mark_target: '{name} đã phù phép một người chơi.',
  witch_save_target: '{name} đã dùng bình cứu.',
  witch_kill_target: '{name} đã dùng bình độc.',
  bodyguard_choose_target: '{name} đã chọn một người để bảo vệ.',
  bodyguard_protect: '{name} đã được Bảo Vệ bảo vệ.',
};

const VI_ACTION_LABELS: Record<string, string> = {
  werewolf_attack: 'Bị Ma Sói tấn công',
  witch_killed: 'Bị Phù Thủy giết',
  village_vote_killed: 'Chết do dân làng bỏ phiếu',
  witch_saved: 'Được Phù Thủy cứu',
  seer_checked: 'Bị Tiên Tri soi',
  whitewolf_killed: 'Bị Sói Trắng giết',
  cursed_turned_werewolf: 'Kẻ Bị Nguyền biến thành Ma Sói',
  fox_sensed_werewolf: 'Cáo cảm nhận có Ma Sói',
  fox_sensed_clear: 'Cáo không cảm nhận thấy Ma Sói',
  hunter_set_revenge_target: 'Chọn mục tiêu trả thù',
  cupid_link_lovers: 'Liên kết tình nhân',
  doppel_copy_player: 'Sao chép vai trò',
  seer_check_player: 'Soi người chơi',
  enchantress_mark_target: 'Phù phép người chơi',
  witch_save_target: 'Cứu',
  witch_kill_target: 'Giết',
  bodyguard_choose_target: 'Chọn người bảo vệ',
};

const VI_CHECKLIST_LABELS: Record<string, string> = {
  'Lovers linked': 'Đã liên kết tình nhân',
  'Heal potion used': 'Đã dùng bình cứu',
  'Poison potion used': 'Đã dùng bình độc',
  'Cursed turned into Werewolf': 'Kẻ Bị Nguyền đã biến thành Ma Sói',
  'Sensing used this night': 'Đã dùng năng lực cảm nhận trong đêm',
  'Role copied at game start': 'Đã sao chép vai trò lúc bắt đầu',
};
const SPECIAL_ROLE_ICONS: Partial<Record<RoleName, string>> = {
  Seer: '🔮',
  'Apprentice Seer': '🔭',
  Bodyguard: '🛡',
  Witch: '🧪',
  Enchantress: '✨',
  Hunter: '🏹',
  Cupid: '❤️',
  'Little Girl': '👧',
  Elder: '👑',
  Strongman: '💪',
  Thief: '🗝',
  Scapegoat: '🐐',
  Fox: '🦊',
  Tanner: '🧵',
  Cursed: '☠️',
  Whitewolf: '🐺',
  'The Doppelgänger': '🪞',
};

const STATUS_BADGE_ICONS = {
  checked: '👁',
  enchanted: '✨',
  copied: '🪞',
  lover: '❤️',
  protected: '🛡',
  strongman: '💪',
  strongmanPending: '⏳',
  cursedPending: '🐺',
  elder: '👑',
  hunterTarget: '🎯',
} as const;

const SPECIAL_ROLE_SET = new Set<RoleName>(SPECIAL_ROLES);

export default function TrackerScreen() {
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 390;
  const gridItemWidth = isNarrowScreen ? '100%' : '48%';

  const {
    tracker,
    counts,
    generated,
    setTrackerPlayerAlive,
    setTrackerPlayerRole,
    resetTracker,
    language,
    toggleLanguage,
  } = useGame();
  const t = uiText[language].tracker;
  const playerActionsTabLabel =
    language === 'vi' ? 'Người chơi & Hành động' : 'Players & Actions';
  const guideTabLabel = language === 'vi' ? 'Hướng dẫn' : 'Guide';
  const timersTabLabel = language === 'vi' ? 'Bộ đếm giờ' : 'Timers';
  const specialChecksTabLabel =
    language === 'vi' ? 'Kiểm tra vai đặc biệt' : 'Special Role Checks';
  const localizedRoleLabel = (role: RoleName) => getRoleLabel(language, role);
  const phaseLabel = (phase: NightPhaseName) =>
    language === 'vi' ? VI_PHASE_LABELS[phase] : phase;
  const actionNoteText = (action: PlayerNightAction, playerName: string) => {
    if (language !== 'vi') {
      return action.noteTemplate.replace('{name}', playerName);
    }

    const template = VI_ACTION_NOTE_TEMPLATES[action.key];
    return (template ?? action.noteTemplate).replace('{name}', playerName);
  };

  const joinedLovers = (loverNames: string[]) =>
    loverNames.join(language === 'vi' ? ' và ' : ' & ');
  const [phaseDurationInput, setPhaseDurationInput] = useState(
    String(DEFAULT_PHASE_SECONDS),
  );
  const [phaseTimers, setPhaseTimers] = useState(buildDefaultPhaseTimers);
  const [dayTimerInputs, setDayTimerInputs] = useState<
    Record<DayTimerPhase, string>
  >(buildDefaultDayTimerInputs);
  const [activeTrackerTab, setActiveTrackerTab] =
    useState<TrackerTabKey>('players-actions');
  const [specialChecklistState, setSpecialChecklistState] = useState(
    buildInitialSpecialChecklistState,
  );
  const [currentNight, setCurrentNight] = useState(1);
  const [nightNoteInput, setNightNoteInput] = useState('');
  const [nightLog, setNightLog] = useState<NightLogEntry[]>([]);
  const [isNightLogModalVisible, setIsNightLogModalVisible] = useState(false);
  const [selectedNightLog, setSelectedNightLog] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [appliedActionHistory, setAppliedActionHistory] = useState<
    LastAppliedNightAction[]
  >([]);
  const [bodyguardProtectedPlayerIds, setBodyguardProtectedPlayerIds] =
    useState<string[]>([]);
  const [seerCheckedPlayerIds, setSeerCheckedPlayerIds] = useState<string[]>(
    [],
  );
  const [seerSourcePlayerId, setSeerSourcePlayerId] = useState<string | null>(
    null,
  );
  const [isSeerTargetModalVisible, setIsSeerTargetModalVisible] =
    useState(false);
  const [enchantressMarkedPlayerIds, setEnchantressMarkedPlayerIds] = useState<
    string[]
  >([]);
  const [enchantressSourcePlayerId, setEnchantressSourcePlayerId] = useState<
    string | null
  >(null);
  const [isEnchantressTargetModalVisible, setIsEnchantressTargetModalVisible] =
    useState(false);
  const [doppelCopiedPlayerIds, setDoppelCopiedPlayerIds] = useState<string[]>(
    [],
  );
  const [doppelSourcePlayerId, setDoppelSourcePlayerId] = useState<
    string | null
  >(null);
  const [isDoppelTargetModalVisible, setIsDoppelTargetModalVisible] =
    useState(false);
  const [pendingDoppelCopy, setPendingDoppelCopy] =
    useState<PendingDoppelCopy | null>(null);
  const [pendingHunterRevenge, setPendingHunterRevenge] =
    useState<PendingHunterRevenge | null>(null);
  const [cupidLinkedPlayerIds, setCupidLinkedPlayerIds] = useState<string[]>(
    [],
  );
  const [cupidSourcePlayerId, setCupidSourcePlayerId] = useState<string | null>(
    null,
  );
  const [isCupidTargetModalVisible, setIsCupidTargetModalVisible] =
    useState(false);
  const [cupidSelectedLoverIds, setCupidSelectedLoverIds] = useState<string[]>(
    [],
  );
  const [werewolfAttackedPlayerIds, setWerewolfAttackedPlayerIds] = useState<
    string[]
  >([]);
  const [whitewolfAttackedPlayerIds, setWhitewolfAttackedPlayerIds] = useState<
    string[]
  >([]);
  const [pendingCursedTransformPlayerIds, setPendingCursedTransformPlayerIds] =
    useState<string[]>([]);
  const [strongmanSurvivedPlayerIds, setStrongmanSurvivedPlayerIds] = useState<
    string[]
  >([]);
  const [witchSourcePlayerId, setWitchSourcePlayerId] = useState<string | null>(
    null,
  );
  const [isWitchSaveTargetModalVisible, setIsWitchSaveTargetModalVisible] =
    useState(false);
  const [isWitchKillTargetModalVisible, setIsWitchKillTargetModalVisible] =
    useState(false);
  const [bodyguardSourcePlayerId, setBodyguardSourcePlayerId] = useState<
    string | null
  >(null);
  const [isBodyguardTargetModalVisible, setIsBodyguardTargetModalVisible] =
    useState(false);
  const [hunterSourcePlayerId, setHunterSourcePlayerId] = useState<
    string | null
  >(null);
  const [isHunterTargetModalVisible, setIsHunterTargetModalVisible] =
    useState(false);
  const [isRoleEditModalVisible, setIsRoleEditModalVisible] = useState(false);
  const [roleEditStep, setRoleEditStep] = useState<RoleEditStep>('role');
  const [roleEditSelectedRole, setRoleEditSelectedRole] =
    useState<RoleName | null>(null);
  const [roleEditSelectedPlayerIds, setRoleEditSelectedPlayerIds] = useState<
    string[]
  >([]);
  const [
    lastNightBodyguardProtectedPlayerId,
    setLastNightBodyguardProtectedPlayerId,
  ] = useState<string | null>(null);

  const aliveCount = tracker.filter((player) => player.alive).length;
  const deadCount = tracker.length - aliveCount;
  const lastAppliedAction = appliedActionHistory[0] ?? null;

  const hasRunningTimer = useMemo(
    () => NIGHT_PHASES.some((phase) => phaseTimers[phase].running),
    [phaseTimers],
  );

  const activeSpecialChecklistRoles = useMemo(
    () =>
      (Object.keys(SPECIAL_ROLE_CHECKLISTS) as SpecialChecklistRole[]).filter(
        (role) => generated && counts[role] > 0,
      ),
    [counts, generated],
  );

  const roleEditSourceRoleOptions = useMemo(
    () =>
      ROLE_DISPLAY_ORDER.filter((role) =>
        tracker.some((player) => player.role === role),
      ),
    [tracker],
  );

  const roleEditMaxSelectable = useMemo(() => {
    if (!roleEditSelectedRole) {
      return 0;
    }

    const configuredCount = counts[roleEditSelectedRole];

    if (configuredCount > 0) {
      return configuredCount;
    }

    return tracker.filter((player) => player.role === roleEditSelectedRole)
      .length;
  }, [counts, roleEditSelectedRole, tracker]);

  const selectedPlayer = useMemo(
    () => tracker.find((player) => player.id === selectedPlayerId) ?? null,
    [selectedPlayerId, tracker],
  );

  const roleEditSelectedPlayers = useMemo(() => {
    const selectedPlayerIds = new Set(roleEditSelectedPlayerIds);

    return tracker.filter((player) => selectedPlayerIds.has(player.id));
  }, [roleEditSelectedPlayerIds, tracker]);

  const witchSaveTargetPlayerIds = useMemo(
    () =>
      Array.from(
        new Set([...werewolfAttackedPlayerIds, ...whitewolfAttackedPlayerIds]),
      ),
    [werewolfAttackedPlayerIds, whitewolfAttackedPlayerIds],
  );
  const nightLogByNight = useMemo(() => {
    const grouped: Record<number, NightLogEntry[]> = {};

    nightLog.forEach((entry) => {
      if (!grouped[entry.night]) {
        grouped[entry.night] = [];
      }

      grouped[entry.night].push(entry);
    });

    const nights: number[] = [];

    Object.keys(grouped).forEach((nightValue) => {
      nights.push(Number(nightValue));
    });

    nights.sort((left, right) => right - left);

    return { grouped, nights };
  }, [nightLog]);

  const selectedNightLogEntries =
    selectedNightLog === null
      ? []
      : (nightLogByNight.grouped[selectedNightLog] ?? []);

  const availableNightActions = useMemo(() => {
    if (!selectedPlayer) {
      return [];
    }

    const baseActions = PLAYER_NIGHT_ACTIONS.filter((action) => {
      if (action.requiresRole && counts[action.requiresRole] <= 0) {
        return false;
      }

      if (
        action.key === 'whitewolf_killed' &&
        selectedPlayer.role !== 'Werewolf'
      ) {
        return false;
      }

      return true;
    });

    const roleActions = ROLE_SPECIFIC_ACTIONS[selectedPlayer.role] ?? [];
    const contextualActions: PlayerNightAction[] = [];

    if (selectedPlayer.role === 'Hunter') {
      contextualActions.push(HUNTER_SET_REVENGE_TARGET_ACTION);
    }

    if (selectedPlayer.role === 'Cupid') {
      contextualActions.push(CUPID_LINK_LOVERS_ACTION);
    }

    if (selectedPlayer.role === 'The Doppelgänger') {
      contextualActions.push(DOPPEL_COPY_PLAYER_ACTION);
    }

    if (selectedPlayer.role === 'Seer') {
      contextualActions.push(SEER_CHECK_PLAYER_ACTION);
    }

    if (selectedPlayer.role === 'Enchantress') {
      contextualActions.push(ENCHANTRESS_MARK_TARGET_ACTION);
    }

    if (selectedPlayer.role === 'Bodyguard') {
      contextualActions.push(BODYGUARD_CHOOSE_TARGET_ACTION);
    }

    if (selectedPlayer.role === 'Witch') {
      contextualActions.push(
        {
          ...WITCH_SAVE_TARGET_ACTION,
          disabled: specialChecklistState.Witch[0] ?? false,
        },
        WITCH_KILL_TARGET_ACTION,
      );
    }

    const filteredRoleActions = roleActions.filter(
      (action) => !action.requiresRole || counts[action.requiresRole] > 0,
    );
    const filteredContextualActions = contextualActions.filter(
      (action) => !action.requiresRole || counts[action.requiresRole] > 0,
    );

    return [
      ...baseActions,
      ...filteredRoleActions,
      ...filteredContextualActions,
    ];
  }, [counts, selectedPlayer, specialChecklistState]);

  const nightGuideSteps = useMemo(() => {
    const aliveRoles = new Set(
      tracker.filter((player) => player.alive).map((player) => player.role),
    );
    const rolesInGame = new Set(tracker.map((player) => player.role));

    return NIGHT_GUIDE_STEPS.filter((step) => {
      if (step.evenNightOnly && currentNight % 2 !== 0) {
        return false;
      }

      if (!step.requiresRole) {
        return !step.firstNightOnly || currentNight === 1;
      }

      const shouldCallRole = SPECIAL_ROLE_SET.has(step.requiresRole)
        ? rolesInGame.has(step.requiresRole)
        : aliveRoles.has(step.requiresRole);

      return shouldCallRole && (!step.firstNightOnly || currentNight === 1);
    });
  }, [currentNight, tracker]);
  const previousPhaseTimersRef = useRef<Record<
    NightPhaseName,
    PhaseTimerState
  > | null>(null);
  const timerLastSyncedAtRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const apprenticePromotionLogRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasRunningTimer) {
      timerLastSyncedAtRef.current = null;
      return;
    }

    timerLastSyncedAtRef.current = Date.now();

    const intervalId = setInterval(() => {
      const now = Date.now();
      const lastSyncedAt = timerLastSyncedAtRef.current ?? now;
      const elapsedSeconds = Math.floor((now - lastSyncedAt) / 1000);

      if (elapsedSeconds <= 0) {
        return;
      }

      timerLastSyncedAtRef.current = lastSyncedAt + elapsedSeconds * 1000;
      setPhaseTimers((previousTimers) =>
        applyElapsedToPhaseTimers(previousTimers, elapsedSeconds),
      );
    }, 250);

    return () => clearInterval(intervalId);
  }, [hasRunningTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (!hasRunningTimer) {
        return;
      }

      if (
        (previousState === 'inactive' || previousState === 'background') &&
        nextState === 'active'
      ) {
        const now = Date.now();
        const lastSyncedAt = timerLastSyncedAtRef.current ?? now;
        const elapsedSeconds = Math.floor((now - lastSyncedAt) / 1000);

        timerLastSyncedAtRef.current = now;

        if (elapsedSeconds > 0) {
          setPhaseTimers((previousTimers) =>
            applyElapsedToPhaseTimers(previousTimers, elapsedSeconds),
          );
        }

        return;
      }

      if (nextState === 'active') {
        timerLastSyncedAtRef.current = Date.now();
      }
    });

    return () => subscription.remove();
  }, [hasRunningTimer]);

  useEffect(() => {
    const previousTimers = previousPhaseTimersRef.current;

    if (previousTimers) {
      const hasFinishedTimer = NIGHT_PHASES.some((phase) => {
        const previous = previousTimers[phase];
        const current = phaseTimers[phase];

        return (
          previous.running &&
          previous.remaining > 0 &&
          current.remaining === 0 &&
          !current.running
        );
      });

      if (hasFinishedTimer) {
        Vibration.vibrate(300);
      }
    }

    previousPhaseTimersRef.current = phaseTimers;
  }, [phaseTimers]);

  useEffect(() => {
    setSpecialChecklistState(buildInitialSpecialChecklistState());
  }, [generated, counts]);

  useEffect(() => {
    const hasAliveSeer = tracker.some(
      (player) => player.role === 'Seer' && player.alive,
    );

    if (hasAliveSeer) {
      return;
    }

    const apprenticeSeer = tracker.find(
      (player) => player.role === 'Apprentice Seer' && player.alive,
    );

    if (!apprenticeSeer) {
      return;
    }

    const promotionKey = `${currentNight}-${apprenticeSeer.id}`;

    if (apprenticePromotionLogRef.current.has(promotionKey)) {
      return;
    }

    apprenticePromotionLogRef.current.add(promotionKey);
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const promotionEntry: NightLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      night: currentNight,
      text:
        language === 'vi'
          ? `Tiên tri tập sự ${apprenticeSeer.name} đã thăng cấp thành Tiên tri.`
          : `Apprentice Seer ${apprenticeSeer.name} has been promoted to Seer.`,
      createdAt: timestamp,
    };

    setNightLog((previous) => [promotionEntry, ...previous]);
    setTrackerPlayerRole(apprenticeSeer.id, 'Seer');
  }, [currentNight, language, setTrackerPlayerRole, tracker]);

  useEffect(() => {
    if (!isNightLogModalVisible) {
      return;
    }

    if (nightLogByNight.nights.length === 0) {
      setSelectedNightLog(null);
      return;
    }

    if (
      selectedNightLog === null ||
      !nightLogByNight.grouped[selectedNightLog]
    ) {
      setSelectedNightLog(nightLogByNight.nights[0]);
    }
  }, [isNightLogModalVisible, nightLogByNight, selectedNightLog]);

  const getConfiguredDurationForPhase = (phase: NightPhaseName) => {
    if (isDayTimerPhase(phase)) {
      return normalizeDuration(dayTimerInputs[phase]);
    }

    return normalizeDuration(phaseDurationInput);
  };

  const togglePhaseTimer = (phase: NightPhaseName) => {
    const configuredDuration = getConfiguredDurationForPhase(phase);

    setPhaseTimers((previousTimers) => {
      const current = previousTimers[phase];
      const shouldRestart = current.remaining === 0;

      return {
        ...previousTimers,
        [phase]: {
          remaining: shouldRestart ? configuredDuration : current.remaining,
          running: !current.running,
        },
      };
    });
  };

  const resetPhaseTimer = (phase: NightPhaseName) => {
    const configuredDuration = getConfiguredDurationForPhase(phase);

    setPhaseTimers((previousTimers) => ({
      ...previousTimers,
      [phase]: {
        remaining: configuredDuration,
        running: false,
      },
    }));
  };

  const applyDayTimerDuration = (phase: DayTimerPhase) => {
    const configuredDuration = normalizeDuration(dayTimerInputs[phase]);

    setDayTimerInputs((previous) => ({
      ...previous,
      [phase]: String(configuredDuration),
    }));

    setPhaseTimers((previousTimers) => ({
      ...previousTimers,
      [phase]: {
        remaining: configuredDuration,
        running: false,
      },
    }));
  };

  const toggleSpecialChecklistItem = (
    role: SpecialChecklistRole,
    itemIndex: number,
  ) => {
    setSpecialChecklistState((previousState) => ({
      ...previousState,
      [role]: previousState[role].map((itemChecked, currentIndex) =>
        currentIndex === itemIndex ? !itemChecked : itemChecked,
      ),
    }));
  };

  const addNightNote = () => {
    const trimmed = nightNoteInput.trim();
    if (!trimmed) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const entry: NightLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      night: currentNight,
      text: trimmed,
      createdAt: timestamp,
    };

    setNightLog((previous) => [entry, ...previous]);
    setNightNoteInput('');
  };

  const openNightLogModal = () => {
    const defaultNight = nightLogByNight.nights[0] ?? currentNight;
    setSelectedNightLog(defaultNight);
    setIsNightLogModalVisible(true);
  };

  const moveToNextNight = () => {
    const cursedTransforms = tracker.filter(
      (player) =>
        pendingCursedTransformPlayerIds.includes(player.id) &&
        player.alive &&
        player.role === 'Cursed',
    );

    cursedTransforms.forEach((player) => {
      setTrackerPlayerRole(player.id, 'Werewolf');
    });

    if (cursedTransforms.length > 0) {
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Cursed: [true],
      }));
    }

    const strongmanDeaths = tracker.filter(
      (player) =>
        strongmanSurvivedPlayerIds.includes(player.id) && player.alive,
    );

    strongmanDeaths.forEach((player) => {
      setTrackerPlayerAlive(player.id, false);

      if (cupidLinkedPlayerIds.includes(player.id)) {
        const linkedLoverId = cupidLinkedPlayerIds.find(
          (id) => id !== player.id,
        );
        if (!linkedLoverId) {
          return;
        }

        const linkedLover = tracker.find(
          (candidate) => candidate.id === linkedLoverId,
        );

        if (linkedLover?.alive) {
          setTrackerPlayerAlive(linkedLover.id, false);
        }
      }

      resolvePendingHunterRevengeOnDeath(player.id);
    });

    setLastNightBodyguardProtectedPlayerId(
      bodyguardProtectedPlayerIds[0] ?? null,
    );
    setCurrentNight((previous) => previous + 1);
    setNightNoteInput('');
    setBodyguardProtectedPlayerIds([]);
    setLastNightBodyguardProtectedPlayerId(null);
    setWerewolfAttackedPlayerIds([]);
    setWhitewolfAttackedPlayerIds([]);
    setPendingCursedTransformPlayerIds([]);
    setStrongmanSurvivedPlayerIds([]);
    setSeerCheckedPlayerIds([]);
    setEnchantressMarkedPlayerIds([]);
    setDoppelCopiedPlayerIds([]);
    setAppliedActionHistory([]);
  };

  const clearNightLog = () => {
    setNightLog([]);
    setNightNoteInput('');
    setCurrentNight(1);
    setIsNightLogModalVisible(false);
    setSelectedNightLog(null);
    setAppliedActionHistory([]);
    setBodyguardProtectedPlayerIds([]);
    setLastNightBodyguardProtectedPlayerId(null);
    setWerewolfAttackedPlayerIds([]);
    setWhitewolfAttackedPlayerIds([]);
    setPendingCursedTransformPlayerIds([]);
    setStrongmanSurvivedPlayerIds([]);
    setSeerCheckedPlayerIds([]);
    setEnchantressMarkedPlayerIds([]);
    setDoppelCopiedPlayerIds([]);
    setCupidLinkedPlayerIds([]);
    setPendingHunterRevenge(null);
    apprenticePromotionLogRef.current.clear();
  };

  const appendNightLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const entry: NightLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      night: currentNight,
      text,
      createdAt: timestamp,
    };

    setNightLog((previous) => [entry, ...previous]);
    return entry.id;
  };

  const recordAppliedAction = (action: LastAppliedNightAction) => {
    setAppliedActionHistory((previous) => [action, ...previous]);
  };

  const closeRoleEditModal = () => {
    setIsRoleEditModalVisible(false);
    setRoleEditStep('role');
    setRoleEditSelectedRole(null);
    setRoleEditSelectedPlayerIds([]);
  };

  const openRoleEditModal = () => {
    setSelectedPlayerId(null);
    setRoleEditStep('role');
    setRoleEditSelectedRole(null);
    setRoleEditSelectedPlayerIds([]);
    setIsRoleEditModalVisible(true);
  };

  const goBackInRoleEditModal = () => {
    if (roleEditStep === 'assign') {
      setRoleEditStep('player');
      return;
    }

    if (roleEditStep === 'player') {
      setRoleEditStep('role');
      setRoleEditSelectedRole(null);
      setRoleEditSelectedPlayerIds([]);
      return;
    }

    closeRoleEditModal();
  };

  const selectRoleEditSourceRole = (role: RoleName) => {
    const maxSelectable = counts[role] > 0 ? counts[role] : tracker.length;
    const initiallySelectedPlayerIds = tracker
      .filter((player) => player.role === role)
      .slice(0, maxSelectable)
      .map((player) => player.id);

    setRoleEditSelectedRole(role);
    setRoleEditSelectedPlayerIds(initiallySelectedPlayerIds);
    setRoleEditStep('player');
  };

  const toggleRoleEditPlayer = (playerId: string) => {
    setRoleEditSelectedPlayerIds((previous) => {
      if (previous.includes(playerId)) {
        return previous.filter((id) => id !== playerId);
      }

      if (
        roleEditMaxSelectable <= 0 ||
        previous.length >= roleEditMaxSelectable
      ) {
        return previous;
      }

      return [...previous, playerId];
    });
  };

  const proceedRoleEditToAssign = () => {
    if (!roleEditSelectedRole || roleEditSelectedPlayerIds.length === 0) {
      return;
    }

    setRoleEditStep('assign');
  };

  const applyRoleEditToSelectedPlayers = () => {
    if (!roleEditSelectedRole) {
      closeRoleEditModal();
      return;
    }

    if (roleEditSelectedPlayerIds.length === 0) {
      return;
    }

    const selectedPlayerIds = new Set(roleEditSelectedPlayerIds);
    const targetRole = roleEditSelectedRole;
    const currentRoleHolders = tracker.filter(
      (player) => player.role === targetRole,
    );
    const additions = tracker.filter(
      (player) =>
        selectedPlayerIds.has(player.id) && player.role !== targetRole,
    );
    const removableCurrentRoleHolders = currentRoleHolders.filter(
      (player) => !selectedPlayerIds.has(player.id),
    );

    if (additions.length > removableCurrentRoleHolders.length) {
      return;
    }

    additions.forEach((targetPlayer, index) => {
      const swapPlayer = removableCurrentRoleHolders[index];
      setTrackerPlayerRole(targetPlayer.id, targetRole);
      setTrackerPlayerRole(swapPlayer.id, targetPlayer.role);
    });

    if (additions.length > 0) {
      const updatedPlayers = tracker.filter((player) =>
        selectedPlayerIds.has(player.id),
      );
      const updatedPlayerNames = updatedPlayers
        .map((player) => player.name)
        .join(', ');

      appendNightLog(
        language === 'vi'
          ? `Đã gán vai ${localizedRoleLabel(targetRole)} cho: ${updatedPlayerNames}.`
          : `Assigned role ${localizedRoleLabel(targetRole)} to: ${updatedPlayerNames}.`,
      );
      setAppliedActionHistory([]);
    }

    closeRoleEditModal();
  };

  const applyNightActionToPlayer = (action: PlayerNightAction) => {
    if (!selectedPlayer) {
      return;
    }

    const selectedPlayerId = selectedPlayer.id;
    const selectedPlayerName = selectedPlayer.name;
    const previousAlive = selectedPlayer.alive;
    const previousRole = selectedPlayer.role;
    const nextAlive = action.aliveAfter;
    const nextRole = action.roleAfter ?? previousRole;
    const previousWasProtectedByBodyguard =
      bodyguardProtectedPlayerIds.includes(selectedPlayerId);
    const previousWitchChecklist = [...specialChecklistState.Witch];
    const previousCursedChecklist = [...specialChecklistState.Cursed];
    const previousCupidChecklist = [...specialChecklistState.Cupid];
    const previousDoppelChecklist = [
      ...specialChecklistState['The Doppelgänger'],
    ];
    const previousFoxChecklist = [...specialChecklistState.Fox];
    const previousSeerCheckedPlayerIds = [...seerCheckedPlayerIds];
    const previousDoppelCopiedPlayerIds = [...doppelCopiedPlayerIds];
    const previousCupidLinkedPlayerIds = [...cupidLinkedPlayerIds];
    const previousWerewolfAttackedPlayerIds = [...werewolfAttackedPlayerIds];
    const previousWhitewolfAttackedPlayerIds = [...whitewolfAttackedPlayerIds];
    const previousPendingCursedTransformPlayerIds = [
      ...pendingCursedTransformPlayerIds,
    ];
    const previousStrongmanSurvivedPlayerIds = [...strongmanSurvivedPlayerIds];

    let changedAlive = false;
    let changedRole = false;
    let nextWasProtectedByBodyguard = previousWasProtectedByBodyguard;
    let noteText = actionNoteText(action, selectedPlayerName);
    let nextWitchChecklist = previousWitchChecklist;
    let nextCursedChecklist = previousCursedChecklist;
    let nextCupidChecklist = previousCupidChecklist;
    let nextDoppelChecklist = previousDoppelChecklist;
    let nextFoxChecklist = previousFoxChecklist;
    let nextSeerCheckedPlayerIds = previousSeerCheckedPlayerIds;
    let nextDoppelCopiedPlayerIds = previousDoppelCopiedPlayerIds;
    let nextCupidLinkedPlayerIds = previousCupidLinkedPlayerIds;
    let nextWerewolfAttackedPlayerIds = previousWerewolfAttackedPlayerIds;
    let nextWhitewolfAttackedPlayerIds = previousWhitewolfAttackedPlayerIds;
    let nextPendingCursedTransformPlayerIds =
      previousPendingCursedTransformPlayerIds;
    let nextStrongmanSurvivedPlayerIds = previousStrongmanSurvivedPlayerIds;
    let previousPendingDoppelCopy = pendingDoppelCopy
      ? { ...pendingDoppelCopy }
      : null;
    let nextPendingDoppelCopy = previousPendingDoppelCopy;
    let secondaryChangedRole = false;
    let secondaryRoleChangePlayerId: string | undefined;
    let secondaryPreviousRole: RoleName | undefined;
    let secondaryNextRole: RoleName | undefined;
    let previousPendingHunterRevenge = pendingHunterRevenge
      ? { ...pendingHunterRevenge }
      : null;
    let nextPendingHunterRevenge = previousPendingHunterRevenge;
    let secondaryChangedAlive = false;
    let secondaryAliveChangePlayerId: string | undefined;
    let secondaryPreviousAlive: boolean | undefined;
    let secondaryNextAlive: boolean | undefined;
    let tertiaryChangedAlive = false;
    let tertiaryAliveChangePlayerId: string | undefined;
    let tertiaryPreviousAlive: boolean | undefined;
    let tertiaryNextAlive: boolean | undefined;

    if (action.key === 'seer_check_player') {
      setSeerSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsSeerTargetModalVisible(true);
      return;
    }

    if (action.key === 'enchantress_mark_target') {
      setEnchantressSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsEnchantressTargetModalVisible(true);
      return;
    }

    if (action.key === 'doppel_copy_player') {
      setDoppelSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsDoppelTargetModalVisible(true);
      return;
    }

    if (action.key === 'cupid_link_lovers') {
      setCupidSourcePlayerId(selectedPlayerId);
      setCupidSelectedLoverIds([]);
      setSelectedPlayerId(null);
      setIsCupidTargetModalVisible(true);
      return;
    }

    if (action.key === 'witch_save_target') {
      if (specialChecklistState.Witch[0]) {
        return;
      }

      setWitchSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsWitchSaveTargetModalVisible(true);
      return;
    }

    if (action.key === 'witch_kill_target') {
      setWitchSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsWitchKillTargetModalVisible(true);
      return;
    }

    if (action.key === 'bodyguard_choose_target') {
      setBodyguardSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsBodyguardTargetModalVisible(true);
      return;
    }

    if (action.key === 'hunter_set_revenge_target') {
      setHunterSourcePlayerId(selectedPlayerId);
      setSelectedPlayerId(null);
      setIsHunterTargetModalVisible(true);
      return;
    }

    if (
      action.key === 'whitewolf_killed' &&
      selectedPlayer.role !== 'Werewolf'
    ) {
      return;
    }

    if (action.key === 'bodyguard_protect') {
      nextWasProtectedByBodyguard = true;
      setBodyguardProtectedPlayerIds((previous) =>
        previous.includes(selectedPlayerId)
          ? previous
          : [...previous, selectedPlayerId],
      );
    }

    if (action.key === 'werewolf_attack' && previousWasProtectedByBodyguard) {
      noteText =
        language === 'vi'
          ? `${selectedPlayerName} bị Ma Sói tấn công nhưng sống sót nhờ được Bảo Vệ bảo vệ.`
          : `${selectedPlayerName} was attacked by Werewolves but survived due to Bodyguard protection.`;
    } else if (
      action.key === 'werewolf_attack' &&
      selectedPlayer.role === 'Cursed'
    ) {
      noteText =
        language === 'vi'
          ? `${selectedPlayerName} bị Ma Sói tấn công và sẽ hóa Ma Sói vào đầu đêm sau.`
          : `${selectedPlayerName} was attacked by Werewolves and will transform into a Werewolf at the start of next night.`;
      nextPendingCursedTransformPlayerIds =
        previousPendingCursedTransformPlayerIds.includes(selectedPlayerId)
          ? previousPendingCursedTransformPlayerIds
          : [...previousPendingCursedTransformPlayerIds, selectedPlayerId];
      setPendingCursedTransformPlayerIds(nextPendingCursedTransformPlayerIds);
    } else if (
      action.key === 'werewolf_attack' &&
      selectedPlayer.role === 'Strongman' &&
      !previousStrongmanSurvivedPlayerIds.includes(selectedPlayerId)
    ) {
      noteText =
        language === 'vi'
          ? `${selectedPlayerName} bị Ma Sói tấn công nhưng sống sót nhờ Lực Sĩ. ${selectedPlayerName} sẽ tự động chết vào đầu đêm sau.`
          : `${selectedPlayerName} was attacked by Werewolves and survived as Strongman. ${selectedPlayerName} will die automatically at the start of the next night.`;
      nextStrongmanSurvivedPlayerIds = [
        ...previousStrongmanSurvivedPlayerIds,
        selectedPlayerId,
      ];
      setStrongmanSurvivedPlayerIds(nextStrongmanSurvivedPlayerIds);
    } else if (
      action.key === 'werewolf_attack' &&
      selectedPlayer.role === 'Strongman'
    ) {
      noteText =
        language === 'vi'
          ? `${selectedPlayerName} đã được đánh dấu sống sót với vai Lực Sĩ và sẽ tự động chết vào đầu đêm sau.`
          : `${selectedPlayerName} has already been marked as Strongman survivor and will die automatically at the start of the next night.`;
    } else if (typeof nextAlive === 'boolean') {
      changedAlive = true;
      setTrackerPlayerAlive(selectedPlayerId, nextAlive);

      if (
        nextAlive === false &&
        previousPendingCursedTransformPlayerIds.includes(selectedPlayerId)
      ) {
        nextPendingCursedTransformPlayerIds =
          previousPendingCursedTransformPlayerIds.filter(
            (id) => id !== selectedPlayerId,
          );
        setPendingCursedTransformPlayerIds(nextPendingCursedTransformPlayerIds);
      }

      if (
        nextAlive === false &&
        previousStrongmanSurvivedPlayerIds.includes(selectedPlayerId)
      ) {
        nextStrongmanSurvivedPlayerIds =
          previousStrongmanSurvivedPlayerIds.filter(
            (id) => id !== selectedPlayerId,
          );
        setStrongmanSurvivedPlayerIds(nextStrongmanSurvivedPlayerIds);
      }

      if (nextAlive === false) {
        const loverDeathResult =
          resolveLinkedLoverDeathOnDeath(selectedPlayerId);
        tertiaryChangedAlive = loverDeathResult.tertiaryChangedAlive;
        tertiaryAliveChangePlayerId =
          loverDeathResult.tertiaryAliveChangePlayerId;
        tertiaryPreviousAlive = loverDeathResult.tertiaryPreviousAlive;
        tertiaryNextAlive = loverDeathResult.tertiaryNextAlive;
        noteText += loverDeathResult.loverDeathNote;

        if (
          loverDeathResult.tertiaryAliveChangePlayerId &&
          previousStrongmanSurvivedPlayerIds.includes(
            loverDeathResult.tertiaryAliveChangePlayerId,
          )
        ) {
          nextStrongmanSurvivedPlayerIds =
            nextStrongmanSurvivedPlayerIds.filter(
              (id) => id !== loverDeathResult.tertiaryAliveChangePlayerId,
            );
          setStrongmanSurvivedPlayerIds(nextStrongmanSurvivedPlayerIds);
        }

        const inheritanceResult =
          resolvePendingDoppelInheritanceOnDeath(selectedPlayerId);
        previousPendingDoppelCopy = inheritanceResult.previousPendingDoppelCopy;
        nextPendingDoppelCopy = inheritanceResult.nextPendingDoppelCopy;
        secondaryChangedRole = inheritanceResult.secondaryChangedRole;
        secondaryRoleChangePlayerId =
          inheritanceResult.secondaryRoleChangePlayerId;
        secondaryPreviousRole = inheritanceResult.secondaryPreviousRole;
        secondaryNextRole = inheritanceResult.secondaryNextRole;
        noteText += inheritanceResult.inheritanceNote;

        const hunterRevengeResult =
          resolvePendingHunterRevengeOnDeath(selectedPlayerId);
        previousPendingHunterRevenge =
          hunterRevengeResult.previousPendingHunterRevenge;
        nextPendingHunterRevenge = hunterRevengeResult.nextPendingHunterRevenge;
        secondaryChangedAlive = hunterRevengeResult.secondaryChangedAlive;
        secondaryAliveChangePlayerId =
          hunterRevengeResult.secondaryAliveChangePlayerId;
        secondaryPreviousAlive = hunterRevengeResult.secondaryPreviousAlive;
        secondaryNextAlive = hunterRevengeResult.secondaryNextAlive;
        if (!tertiaryChangedAlive && hunterRevengeResult.tertiaryChangedAlive) {
          tertiaryChangedAlive = true;
          tertiaryAliveChangePlayerId =
            hunterRevengeResult.tertiaryAliveChangePlayerId;
          tertiaryPreviousAlive = hunterRevengeResult.tertiaryPreviousAlive;
          tertiaryNextAlive = hunterRevengeResult.tertiaryNextAlive;
        }
        noteText += hunterRevengeResult.revengeNote;

        if (
          hunterRevengeResult.secondaryAliveChangePlayerId &&
          previousStrongmanSurvivedPlayerIds.includes(
            hunterRevengeResult.secondaryAliveChangePlayerId,
          )
        ) {
          nextStrongmanSurvivedPlayerIds =
            nextStrongmanSurvivedPlayerIds.filter(
              (id) => id !== hunterRevengeResult.secondaryAliveChangePlayerId,
            );
          setStrongmanSurvivedPlayerIds(nextStrongmanSurvivedPlayerIds);
        }
      } else {
        const hunterSurviveResult =
          resolvePendingHunterRevengeOnSurvive(selectedPlayerId);
        secondaryChangedAlive = hunterSurviveResult.secondaryChangedAlive;
        secondaryAliveChangePlayerId =
          hunterSurviveResult.secondaryAliveChangePlayerId;
        secondaryPreviousAlive = hunterSurviveResult.secondaryPreviousAlive;
        secondaryNextAlive = hunterSurviveResult.secondaryNextAlive;
        tertiaryChangedAlive = hunterSurviveResult.tertiaryChangedAlive;
        tertiaryAliveChangePlayerId =
          hunterSurviveResult.tertiaryAliveChangePlayerId;
        tertiaryPreviousAlive = hunterSurviveResult.tertiaryPreviousAlive;
        tertiaryNextAlive = hunterSurviveResult.tertiaryNextAlive;
        noteText += hunterSurviveResult.surviveNote;

        const loverSurviveResult =
          resolveLinkedLoverSurvivalOnSurvive(selectedPlayerId);
        if (!tertiaryChangedAlive) {
          tertiaryChangedAlive = loverSurviveResult.tertiaryChangedAlive;
          tertiaryAliveChangePlayerId =
            loverSurviveResult.tertiaryAliveChangePlayerId;
          tertiaryPreviousAlive = loverSurviveResult.tertiaryPreviousAlive;
          tertiaryNextAlive = loverSurviveResult.tertiaryNextAlive;
        }
        noteText += loverSurviveResult.loverSurviveNote;
      }
    }

    if (action.key === 'werewolf_attack') {
      nextWerewolfAttackedPlayerIds =
        previousWerewolfAttackedPlayerIds.includes(selectedPlayerId)
          ? previousWerewolfAttackedPlayerIds
          : [...previousWerewolfAttackedPlayerIds, selectedPlayerId];
      setWerewolfAttackedPlayerIds(nextWerewolfAttackedPlayerIds);
    }

    if (action.key === 'whitewolf_killed') {
      nextWhitewolfAttackedPlayerIds =
        previousWhitewolfAttackedPlayerIds.includes(selectedPlayerId)
          ? previousWhitewolfAttackedPlayerIds
          : [...previousWhitewolfAttackedPlayerIds, selectedPlayerId];
      setWhitewolfAttackedPlayerIds(nextWhitewolfAttackedPlayerIds);
    }

    if (nextRole !== previousRole) {
      changedRole = true;
      setTrackerPlayerRole(selectedPlayerId, nextRole);
    }

    if (action.key === 'witch_saved') {
      nextWitchChecklist = [true, previousWitchChecklist[1] ?? false];
      nextWerewolfAttackedPlayerIds = previousWerewolfAttackedPlayerIds.filter(
        (id) => id !== selectedPlayerId,
      );
      nextWhitewolfAttackedPlayerIds =
        previousWhitewolfAttackedPlayerIds.filter(
          (id) => id !== selectedPlayerId,
        );
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Witch: nextWitchChecklist,
      }));
      setWerewolfAttackedPlayerIds(nextWerewolfAttackedPlayerIds);
      setWhitewolfAttackedPlayerIds(nextWhitewolfAttackedPlayerIds);
    }

    if (action.key === 'witch_killed') {
      nextWitchChecklist = [previousWitchChecklist[0] ?? false, true];
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Witch: nextWitchChecklist,
      }));
    }

    if (action.key === 'cursed_turned_werewolf') {
      nextCursedChecklist = [true];
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Cursed: nextCursedChecklist,
      }));
    }

    if (action.key === 'cupid_linked') {
      nextCupidChecklist = [true];
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Cupid: nextCupidChecklist,
      }));
    }

    if (action.key.startsWith('doppel_copy_')) {
      nextDoppelChecklist = [true];
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        'The Doppelgänger': nextDoppelChecklist,
      }));
    }

    if (
      action.key === 'fox_sensed_werewolf' ||
      action.key === 'fox_sensed_clear'
    ) {
      nextFoxChecklist = [true];
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Fox: nextFoxChecklist,
      }));
    }

    const logEntryId = appendNightLog(noteText);

    recordAppliedAction({
      playerId: selectedPlayerId,
      previousAlive,
      changedAlive,
      previousRole,
      changedRole,
      nextRole,
      logEntryId,
      previousWasProtectedByBodyguard,
      nextWasProtectedByBodyguard,
      previousWitchChecklist,
      nextWitchChecklist,
      previousCursedChecklist,
      nextCursedChecklist,
      previousCupidChecklist,
      nextCupidChecklist,
      previousDoppelChecklist,
      nextDoppelChecklist,
      previousFoxChecklist,
      nextFoxChecklist,
      previousSeerCheckedPlayerIds,
      nextSeerCheckedPlayerIds,
      previousDoppelCopiedPlayerIds,
      nextDoppelCopiedPlayerIds,
      previousCupidLinkedPlayerIds,
      nextCupidLinkedPlayerIds,
      previousWerewolfAttackedPlayerIds,
      nextWerewolfAttackedPlayerIds,
      previousWhitewolfAttackedPlayerIds,
      nextWhitewolfAttackedPlayerIds,
      previousPendingCursedTransformPlayerIds,
      nextPendingCursedTransformPlayerIds,
      previousStrongmanSurvivedPlayerIds,
      nextStrongmanSurvivedPlayerIds,
      previousPendingDoppelCopy,
      nextPendingDoppelCopy,
      secondaryChangedRole,
      secondaryRoleChangePlayerId,
      secondaryPreviousRole,
      secondaryNextRole,
      previousPendingHunterRevenge,
      nextPendingHunterRevenge,
      secondaryChangedAlive,
      secondaryAliveChangePlayerId,
      secondaryPreviousAlive,
      secondaryNextAlive,
      tertiaryChangedAlive,
      tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive,
      tertiaryNextAlive,
    });

    setSelectedPlayerId(null);
  };

  const undoLastAction = () => {
    if (!lastAppliedAction) {
      return;
    }

    if (lastAppliedAction.changedAlive) {
      setTrackerPlayerAlive(
        lastAppliedAction.playerId,
        lastAppliedAction.previousAlive,
      );
    }

    if (lastAppliedAction.changedRole) {
      setTrackerPlayerRole(
        lastAppliedAction.playerId,
        lastAppliedAction.previousRole,
      );
    }

    if (
      lastAppliedAction.secondaryChangedRole &&
      lastAppliedAction.secondaryRoleChangePlayerId &&
      lastAppliedAction.secondaryPreviousRole
    ) {
      setTrackerPlayerRole(
        lastAppliedAction.secondaryRoleChangePlayerId,
        lastAppliedAction.secondaryPreviousRole,
      );
    }

    if (Object.hasOwn(lastAppliedAction, 'previousPendingDoppelCopy')) {
      setPendingDoppelCopy(lastAppliedAction.previousPendingDoppelCopy ?? null);
    }

    if (Object.hasOwn(lastAppliedAction, 'previousPendingHunterRevenge')) {
      setPendingHunterRevenge(
        lastAppliedAction.previousPendingHunterRevenge ?? null,
      );
    }

    if (
      Object.hasOwn(
        lastAppliedAction,
        'previousPendingCursedTransformPlayerIds',
      )
    ) {
      setPendingCursedTransformPlayerIds(
        lastAppliedAction.previousPendingCursedTransformPlayerIds ?? [],
      );
    }

    if (
      lastAppliedAction.secondaryChangedAlive &&
      lastAppliedAction.secondaryAliveChangePlayerId &&
      typeof lastAppliedAction.secondaryPreviousAlive === 'boolean'
    ) {
      setTrackerPlayerAlive(
        lastAppliedAction.secondaryAliveChangePlayerId,
        lastAppliedAction.secondaryPreviousAlive,
      );
    }

    if (
      lastAppliedAction.tertiaryChangedAlive &&
      lastAppliedAction.tertiaryAliveChangePlayerId &&
      typeof lastAppliedAction.tertiaryPreviousAlive === 'boolean'
    ) {
      setTrackerPlayerAlive(
        lastAppliedAction.tertiaryAliveChangePlayerId,
        lastAppliedAction.tertiaryPreviousAlive,
      );
    }

    if (
      lastAppliedAction.previousBodyguardProtectedPlayerIds &&
      lastAppliedAction.nextBodyguardProtectedPlayerIds
    ) {
      const previousProtected =
        lastAppliedAction.previousBodyguardProtectedPlayerIds;
      const nextProtected = lastAppliedAction.nextBodyguardProtectedPlayerIds;
      if (
        previousProtected.length !== nextProtected.length ||
        previousProtected.some((id, index) => id !== nextProtected[index])
      ) {
        setBodyguardProtectedPlayerIds([...previousProtected]);
      }
    } else if (
      lastAppliedAction.previousWasProtectedByBodyguard !==
      lastAppliedAction.nextWasProtectedByBodyguard
    ) {
      setBodyguardProtectedPlayerIds((previous) => {
        if (lastAppliedAction.previousWasProtectedByBodyguard) {
          return previous.includes(lastAppliedAction.playerId)
            ? previous
            : [...previous, lastAppliedAction.playerId];
        }

        return previous.filter((id) => id !== lastAppliedAction.playerId);
      });
    }

    if (
      lastAppliedAction.previousWitchChecklist[0] !==
        lastAppliedAction.nextWitchChecklist[0] ||
      lastAppliedAction.previousWitchChecklist[1] !==
        lastAppliedAction.nextWitchChecklist[1]
    ) {
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Witch: [...lastAppliedAction.previousWitchChecklist],
      }));
    }

    if (
      lastAppliedAction.previousCursedChecklist[0] !==
      lastAppliedAction.nextCursedChecklist[0]
    ) {
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Cursed: [...lastAppliedAction.previousCursedChecklist],
      }));
    }

    if (
      lastAppliedAction.previousCupidChecklist[0] !==
      lastAppliedAction.nextCupidChecklist[0]
    ) {
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Cupid: [...lastAppliedAction.previousCupidChecklist],
      }));
    }

    if (
      lastAppliedAction.previousDoppelChecklist[0] !==
      lastAppliedAction.nextDoppelChecklist[0]
    ) {
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        'The Doppelgänger': [...lastAppliedAction.previousDoppelChecklist],
      }));
    }

    if (
      lastAppliedAction.previousFoxChecklist[0] !==
      lastAppliedAction.nextFoxChecklist[0]
    ) {
      setSpecialChecklistState((previousState) => ({
        ...previousState,
        Fox: [...lastAppliedAction.previousFoxChecklist],
      }));
    }

    if (
      lastAppliedAction.previousSeerCheckedPlayerIds.length !==
        lastAppliedAction.nextSeerCheckedPlayerIds.length ||
      lastAppliedAction.previousSeerCheckedPlayerIds.some(
        (id, index) => id !== lastAppliedAction.nextSeerCheckedPlayerIds[index],
      )
    ) {
      setSeerCheckedPlayerIds([
        ...lastAppliedAction.previousSeerCheckedPlayerIds,
      ]);
    }

    if (
      lastAppliedAction.previousEnchantressMarkedPlayerIds &&
      lastAppliedAction.nextEnchantressMarkedPlayerIds
    ) {
      const previousEnchantressMarked =
        lastAppliedAction.previousEnchantressMarkedPlayerIds;
      const nextEnchantressMarked =
        lastAppliedAction.nextEnchantressMarkedPlayerIds;
      if (
        previousEnchantressMarked.length !== nextEnchantressMarked.length ||
        previousEnchantressMarked.some(
          (id, index) => id !== nextEnchantressMarked[index],
        )
      ) {
        setEnchantressMarkedPlayerIds([...previousEnchantressMarked]);
      }
    }

    if (
      lastAppliedAction.previousDoppelCopiedPlayerIds.length !==
        lastAppliedAction.nextDoppelCopiedPlayerIds.length ||
      lastAppliedAction.previousDoppelCopiedPlayerIds.some(
        (id, index) =>
          id !== lastAppliedAction.nextDoppelCopiedPlayerIds[index],
      )
    ) {
      setDoppelCopiedPlayerIds([
        ...lastAppliedAction.previousDoppelCopiedPlayerIds,
      ]);
    }

    if (
      lastAppliedAction.previousCupidLinkedPlayerIds.length !==
        lastAppliedAction.nextCupidLinkedPlayerIds.length ||
      lastAppliedAction.previousCupidLinkedPlayerIds.some(
        (id, index) => id !== lastAppliedAction.nextCupidLinkedPlayerIds[index],
      )
    ) {
      setCupidLinkedPlayerIds([
        ...lastAppliedAction.previousCupidLinkedPlayerIds,
      ]);
    }

    if (
      lastAppliedAction.previousWerewolfAttackedPlayerIds.length !==
        lastAppliedAction.nextWerewolfAttackedPlayerIds.length ||
      lastAppliedAction.previousWerewolfAttackedPlayerIds.some(
        (id, index) =>
          id !== lastAppliedAction.nextWerewolfAttackedPlayerIds[index],
      )
    ) {
      setWerewolfAttackedPlayerIds([
        ...lastAppliedAction.previousWerewolfAttackedPlayerIds,
      ]);
    }

    if (
      lastAppliedAction.previousWhitewolfAttackedPlayerIds &&
      lastAppliedAction.nextWhitewolfAttackedPlayerIds
    ) {
      const previousWhitewolfAttacked =
        lastAppliedAction.previousWhitewolfAttackedPlayerIds;
      const nextWhitewolfAttacked =
        lastAppliedAction.nextWhitewolfAttackedPlayerIds;
      if (
        previousWhitewolfAttacked.length !== nextWhitewolfAttacked.length ||
        previousWhitewolfAttacked.some(
          (id, index) => id !== nextWhitewolfAttacked[index],
        )
      ) {
        setWhitewolfAttackedPlayerIds([...previousWhitewolfAttacked]);
      }
    }

    if (
      lastAppliedAction.previousStrongmanSurvivedPlayerIds &&
      lastAppliedAction.nextStrongmanSurvivedPlayerIds
    ) {
      const previousStrongmanSurvived =
        lastAppliedAction.previousStrongmanSurvivedPlayerIds;
      const nextStrongmanSurvived =
        lastAppliedAction.nextStrongmanSurvivedPlayerIds;
      if (
        previousStrongmanSurvived.length !== nextStrongmanSurvived.length ||
        previousStrongmanSurvived.some(
          (id, index) => id !== nextStrongmanSurvived[index],
        )
      ) {
        setStrongmanSurvivedPlayerIds([...previousStrongmanSurvived]);
      }
    }

    setNightLog((previous) =>
      previous.filter((entry) => entry.id !== lastAppliedAction.logEntryId),
    );
    setAppliedActionHistory((previous) => previous.slice(1));
  };

  const handleResetTracker = () => {
    resetTracker();
    setPhaseDurationInput(String(DEFAULT_PHASE_SECONDS));
    setPhaseTimers(buildDefaultPhaseTimers());
    setDayTimerInputs(buildDefaultDayTimerInputs());
    setSpecialChecklistState(buildInitialSpecialChecklistState());
    setCurrentNight(1);
    setNightNoteInput('');
    setNightLog([]);
    setIsNightLogModalVisible(false);
    setSelectedNightLog(null);
    setSelectedPlayerId(null);
    setAppliedActionHistory([]);
    setBodyguardProtectedPlayerIds([]);
    setLastNightBodyguardProtectedPlayerId(null);
    setWerewolfAttackedPlayerIds([]);
    setWhitewolfAttackedPlayerIds([]);
    setPendingCursedTransformPlayerIds([]);
    setStrongmanSurvivedPlayerIds([]);
    setSeerCheckedPlayerIds([]);
    setSeerSourcePlayerId(null);
    setIsSeerTargetModalVisible(false);
    setEnchantressMarkedPlayerIds([]);
    setEnchantressSourcePlayerId(null);
    setIsEnchantressTargetModalVisible(false);
    setDoppelCopiedPlayerIds([]);
    setDoppelSourcePlayerId(null);
    setIsDoppelTargetModalVisible(false);
    setPendingDoppelCopy(null);
    setPendingHunterRevenge(null);
    setCupidLinkedPlayerIds([]);
    setCupidSourcePlayerId(null);
    setIsCupidTargetModalVisible(false);
    setCupidSelectedLoverIds([]);
    setWitchSourcePlayerId(null);
    setIsWitchSaveTargetModalVisible(false);
    setIsWitchKillTargetModalVisible(false);
    setBodyguardSourcePlayerId(null);
    setIsBodyguardTargetModalVisible(false);
    setHunterSourcePlayerId(null);
    setIsHunterTargetModalVisible(false);
    setRoleEditStep('role');
    setRoleEditSelectedRole(null);
    setRoleEditSelectedPlayerIds([]);
    setIsRoleEditModalVisible(false);
  };

  const resolvePendingDoppelInheritanceOnDeath = (deadPlayerId: string) => {
    const previousPendingDoppelCopy = pendingDoppelCopy
      ? { ...pendingDoppelCopy }
      : null;

    let nextPendingDoppelCopy = previousPendingDoppelCopy;
    let secondaryChangedRole = false;
    let secondaryRoleChangePlayerId: string | undefined;
    let secondaryPreviousRole: RoleName | undefined;
    let secondaryNextRole: RoleName | undefined;
    let inheritanceNote = '';

    if (pendingDoppelCopy?.targetId === deadPlayerId) {
      const doppelPlayer = tracker.find(
        (player) => player.id === pendingDoppelCopy.doppelId,
      );

      if (doppelPlayer && doppelPlayer.role !== pendingDoppelCopy.copiedRole) {
        secondaryChangedRole = true;
        secondaryRoleChangePlayerId = doppelPlayer.id;
        secondaryPreviousRole = doppelPlayer.role;
        secondaryNextRole = pendingDoppelCopy.copiedRole;
        setTrackerPlayerRole(doppelPlayer.id, pendingDoppelCopy.copiedRole);
        inheritanceNote =
          language === 'vi'
            ? ` ${doppelPlayer.name} đã thừa hưởng vai ${localizedRoleLabel(pendingDoppelCopy.copiedRole)}.`
            : ` ${doppelPlayer.name} inherited ${pendingDoppelCopy.copiedRole}.`;
      }

      setPendingDoppelCopy(null);
      nextPendingDoppelCopy = null;
    }

    return {
      previousPendingDoppelCopy,
      nextPendingDoppelCopy,
      secondaryChangedRole,
      secondaryRoleChangePlayerId,
      secondaryPreviousRole,
      secondaryNextRole,
      inheritanceNote,
    };
  };

  const resolveLinkedHunterDeath = (
    linkedPlayerId: string,
    isHunterDead: boolean,
    hunterId: string,
  ) => {
    let secondaryChangedAlive = false;
    let secondaryAliveChangePlayerId: string | undefined;
    let secondaryPreviousAlive: boolean | undefined;
    let secondaryNextAlive: boolean | undefined;
    let tertiaryChangedAlive = false;
    let tertiaryAliveChangePlayerId: string | undefined;
    let tertiaryPreviousAlive: boolean | undefined;
    let tertiaryNextAlive: boolean | undefined;
    let revengeNote = '';

    const linkedPlayer = tracker.find((player) => player.id === linkedPlayerId);

    if (linkedPlayer?.alive) {
      secondaryChangedAlive = true;
      secondaryAliveChangePlayerId = linkedPlayer.id;
      secondaryPreviousAlive = linkedPlayer.alive;
      secondaryNextAlive = false;

      // Hunter-linked elimination bypasses Bodyguard protection.
      setBodyguardProtectedPlayerIds((previous) =>
        previous.filter((id) => id !== linkedPlayer.id),
      );
      setTrackerPlayerAlive(linkedPlayer.id, false);

      const loverDeathResult = resolveLinkedLoverDeathOnDeath(linkedPlayer.id);
      tertiaryChangedAlive = loverDeathResult.tertiaryChangedAlive;
      tertiaryAliveChangePlayerId =
        loverDeathResult.tertiaryAliveChangePlayerId;
      tertiaryPreviousAlive = loverDeathResult.tertiaryPreviousAlive;
      tertiaryNextAlive = loverDeathResult.tertiaryNextAlive;

      if (isHunterDead) {
        const hunterPlayer = tracker.find((player) => player.id === hunterId);
        revengeNote =
          language === 'vi'
            ? ` ${hunterPlayer?.name ?? localizedRoleLabel('Hunter')} đã liên kết sinh tử với ${linkedPlayer.name}, nên ${linkedPlayer.name} cũng chết.${loverDeathResult.loverDeathNote}`
            : ` ${hunterPlayer?.name ?? 'Hunter'} was survival-linked with ${linkedPlayer.name}, so ${linkedPlayer.name} also died.${loverDeathResult.loverDeathNote}`;
      } else {
        revengeNote =
          language === 'vi'
            ? ` ${linkedPlayer.name} đã liên kết sinh tử với mục tiêu được chọn, nên cũng chết.${loverDeathResult.loverDeathNote}`
            : ` ${linkedPlayer.name} was survival-linked to the selected target, so ${linkedPlayer.name} also died.${loverDeathResult.loverDeathNote}`;
      }
    }

    return {
      secondaryChangedAlive,
      secondaryAliveChangePlayerId,
      secondaryPreviousAlive,
      secondaryNextAlive,
      tertiaryChangedAlive,
      tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive,
      tertiaryNextAlive,
      revengeNote,
    };
  };

  const resolvePendingHunterRevengeOnDeath = (deadPlayerId: string) => {
    const previousPendingHunterRevenge = pendingHunterRevenge
      ? { ...pendingHunterRevenge }
      : null;

    let nextPendingHunterRevenge = previousPendingHunterRevenge;
    let secondaryChangedAlive = false;
    let secondaryAliveChangePlayerId: string | undefined;
    let secondaryPreviousAlive: boolean | undefined;
    let secondaryNextAlive: boolean | undefined;
    let tertiaryChangedAlive = false;
    let tertiaryAliveChangePlayerId: string | undefined;
    let tertiaryPreviousAlive: boolean | undefined;
    let tertiaryNextAlive: boolean | undefined;
    let revengeNote = '';

    const link = pendingHunterRevenge;
    const isHunterDead = link?.hunterId === deadPlayerId;

    if (link && isHunterDead) {
      const linkedPlayerId = link.targetId;
      const linkedDeathResult = resolveLinkedHunterDeath(
        linkedPlayerId,
        isHunterDead,
        link.hunterId,
      );

      secondaryChangedAlive = linkedDeathResult.secondaryChangedAlive;
      secondaryAliveChangePlayerId =
        linkedDeathResult.secondaryAliveChangePlayerId;
      secondaryPreviousAlive = linkedDeathResult.secondaryPreviousAlive;
      secondaryNextAlive = linkedDeathResult.secondaryNextAlive;
      tertiaryChangedAlive = linkedDeathResult.tertiaryChangedAlive;
      tertiaryAliveChangePlayerId =
        linkedDeathResult.tertiaryAliveChangePlayerId;
      tertiaryPreviousAlive = linkedDeathResult.tertiaryPreviousAlive;
      tertiaryNextAlive = linkedDeathResult.tertiaryNextAlive;
      revengeNote = linkedDeathResult.revengeNote;
    }

    return {
      previousPendingHunterRevenge,
      nextPendingHunterRevenge,
      secondaryChangedAlive,
      secondaryAliveChangePlayerId,
      secondaryPreviousAlive,
      secondaryNextAlive,
      tertiaryChangedAlive,
      tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive,
      tertiaryNextAlive,
      revengeNote,
    };
  };

  const resolvePendingHunterRevengeOnSurvive = (survivorPlayerId: string) => {
    let secondaryChangedAlive = false;
    let secondaryAliveChangePlayerId: string | undefined;
    let secondaryPreviousAlive: boolean | undefined;
    let secondaryNextAlive: boolean | undefined;
    let tertiaryChangedAlive = false;
    let tertiaryAliveChangePlayerId: string | undefined;
    let tertiaryPreviousAlive: boolean | undefined;
    let tertiaryNextAlive: boolean | undefined;
    let surviveNote = '';

    if (!pendingHunterRevenge) {
      return {
        secondaryChangedAlive,
        secondaryAliveChangePlayerId,
        secondaryPreviousAlive,
        secondaryNextAlive,
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        surviveNote,
      };
    }

    let linkedPlayerId: string | null = null;

    if (pendingHunterRevenge.hunterId === survivorPlayerId) {
      linkedPlayerId = pendingHunterRevenge.targetId;
    }

    if (!linkedPlayerId) {
      return {
        secondaryChangedAlive,
        secondaryAliveChangePlayerId,
        secondaryPreviousAlive,
        secondaryNextAlive,
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        surviveNote,
      };
    }

    const linkedPlayer = tracker.find((player) => player.id === linkedPlayerId);
    if (!linkedPlayer || linkedPlayer.alive) {
      return {
        secondaryChangedAlive,
        secondaryAliveChangePlayerId,
        secondaryPreviousAlive,
        secondaryNextAlive,
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        surviveNote,
      };
    }

    secondaryChangedAlive = true;
    secondaryAliveChangePlayerId = linkedPlayer.id;
    secondaryPreviousAlive = linkedPlayer.alive;
    secondaryNextAlive = true;
    setTrackerPlayerAlive(linkedPlayer.id, true);

    const loverSurviveResult = resolveLinkedLoverSurvivalOnSurvive(
      linkedPlayer.id,
    );
    tertiaryChangedAlive = loverSurviveResult.tertiaryChangedAlive;
    tertiaryAliveChangePlayerId =
      loverSurviveResult.tertiaryAliveChangePlayerId;
    tertiaryPreviousAlive = loverSurviveResult.tertiaryPreviousAlive;
    tertiaryNextAlive = loverSurviveResult.tertiaryNextAlive;

    surviveNote =
      language === 'vi'
        ? ` ${linkedPlayer.name} cũng sống vì đã được Thợ Săn liên kết sinh tử.${loverSurviveResult.loverSurviveNote}`
        : ` ${linkedPlayer.name} also survives because of Hunter survival link.${loverSurviveResult.loverSurviveNote}`;

    return {
      secondaryChangedAlive,
      secondaryAliveChangePlayerId,
      secondaryPreviousAlive,
      secondaryNextAlive,
      tertiaryChangedAlive,
      tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive,
      tertiaryNextAlive,
      surviveNote,
    };
  };

  const resolveLinkedLoverDeathOnDeath = (deadPlayerId: string) => {
    let tertiaryChangedAlive = false;
    let tertiaryAliveChangePlayerId: string | undefined;
    let tertiaryPreviousAlive: boolean | undefined;
    let tertiaryNextAlive: boolean | undefined;
    let loverDeathNote = '';

    if (!cupidLinkedPlayerIds.includes(deadPlayerId)) {
      return {
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        loverDeathNote,
      };
    }

    const linkedLoverId = cupidLinkedPlayerIds.find(
      (id) => id !== deadPlayerId,
    );
    if (!linkedLoverId) {
      return {
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        loverDeathNote,
      };
    }

    const linkedLover = tracker.find((player) => player.id === linkedLoverId);
    if (!linkedLover?.alive) {
      return {
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        loverDeathNote,
      };
    }

    tertiaryChangedAlive = true;
    tertiaryAliveChangePlayerId = linkedLover.id;
    tertiaryPreviousAlive = linkedLover.alive;
    tertiaryNextAlive = false;
    setTrackerPlayerAlive(linkedLover.id, false);
    loverDeathNote =
      language === 'vi'
        ? ` ${linkedLover.name} đã chết vì đau buồn khi tình nhân liên kết qua đời.`
        : ` ${linkedLover.name} died of heartbreak as the linked lover.`;

    return {
      tertiaryChangedAlive,
      tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive,
      tertiaryNextAlive,
      loverDeathNote,
    };
  };

  const resolveLinkedLoverSurvivalOnSurvive = (survivorPlayerId: string) => {
    let tertiaryChangedAlive = false;
    let tertiaryAliveChangePlayerId: string | undefined;
    let tertiaryPreviousAlive: boolean | undefined;
    let tertiaryNextAlive: boolean | undefined;
    let loverSurviveNote = '';

    if (!cupidLinkedPlayerIds.includes(survivorPlayerId)) {
      return {
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        loverSurviveNote,
      };
    }

    const linkedLoverId = cupidLinkedPlayerIds.find(
      (id) => id !== survivorPlayerId,
    );
    if (!linkedLoverId) {
      return {
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        loverSurviveNote,
      };
    }

    const linkedLover = tracker.find((player) => player.id === linkedLoverId);
    if (!linkedLover || linkedLover.alive) {
      return {
        tertiaryChangedAlive,
        tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive,
        tertiaryNextAlive,
        loverSurviveNote,
      };
    }

    tertiaryChangedAlive = true;
    tertiaryAliveChangePlayerId = linkedLover.id;
    tertiaryPreviousAlive = linkedLover.alive;
    tertiaryNextAlive = true;
    setTrackerPlayerAlive(linkedLover.id, true);
    loverSurviveNote =
      language === 'vi'
        ? ` ${linkedLover.name} cũng sống vì tình nhân liên kết đã sống.`
        : ` ${linkedLover.name} also survives because the linked lover survives.`;

    return {
      tertiaryChangedAlive,
      tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive,
      tertiaryNextAlive,
      loverSurviveNote,
    };
  };

  const applyWitchSaveToTarget = (targetPlayerId: string) => {
    const witch = tracker.find((player) => player.id === witchSourcePlayerId);
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!witch || !target) {
      setIsWitchSaveTargetModalVisible(false);
      setWitchSourcePlayerId(null);
      return;
    }

    const previousWitchChecklist = [...specialChecklistState.Witch];
    const nextWitchChecklist: boolean[] = [
      true,
      previousWitchChecklist[1] ?? false,
    ];
    const previousWerewolfAttackedPlayerIds = [...werewolfAttackedPlayerIds];
    const previousWhitewolfAttackedPlayerIds = [...whitewolfAttackedPlayerIds];
    const nextWerewolfAttackedPlayerIds =
      previousWerewolfAttackedPlayerIds.filter((id) => id !== targetPlayerId);
    const nextWhitewolfAttackedPlayerIds =
      previousWhitewolfAttackedPlayerIds.filter((id) => id !== targetPlayerId);
    const previousStrongmanSurvivedPlayerIds = [...strongmanSurvivedPlayerIds];
    const previousPendingCursedTransformPlayerIds = [
      ...pendingCursedTransformPlayerIds,
    ];

    const linkedLoverSaveResult =
      resolveLinkedLoverSurvivalOnSurvive(targetPlayerId);
    const linkedHunterSaveResult =
      resolvePendingHunterRevengeOnSurvive(targetPlayerId);

    setTrackerPlayerAlive(targetPlayerId, true);
    setSpecialChecklistState((previousState) => ({
      ...previousState,
      Witch: nextWitchChecklist,
    }));
    setWerewolfAttackedPlayerIds(nextWerewolfAttackedPlayerIds);
    setWhitewolfAttackedPlayerIds(nextWhitewolfAttackedPlayerIds);

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${witch.name} đã cứu ${target.name}.${linkedHunterSaveResult.surviveNote}${linkedLoverSaveResult.loverSurviveNote}`
        : `${witch.name} saved ${target.name}.${linkedHunterSaveResult.surviveNote}${linkedLoverSaveResult.loverSurviveNote}`,
    );

    recordAppliedAction({
      playerId: targetPlayerId,
      previousAlive: target.alive,
      changedAlive: target.alive !== true,
      previousRole: target.role,
      changedRole: false,
      nextRole: target.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist,
      nextWitchChecklist,
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds,
      nextWerewolfAttackedPlayerIds,
      previousWhitewolfAttackedPlayerIds,
      nextWhitewolfAttackedPlayerIds,
      previousPendingCursedTransformPlayerIds,
      nextPendingCursedTransformPlayerIds:
        previousPendingCursedTransformPlayerIds,
      previousStrongmanSurvivedPlayerIds,
      nextStrongmanSurvivedPlayerIds: previousStrongmanSurvivedPlayerIds,
      previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      secondaryChangedAlive: linkedHunterSaveResult.secondaryChangedAlive,
      secondaryAliveChangePlayerId:
        linkedHunterSaveResult.secondaryAliveChangePlayerId,
      secondaryPreviousAlive: linkedHunterSaveResult.secondaryPreviousAlive,
      secondaryNextAlive: linkedHunterSaveResult.secondaryNextAlive,
      tertiaryChangedAlive:
        linkedHunterSaveResult.tertiaryChangedAlive ||
        linkedLoverSaveResult.tertiaryChangedAlive,
      tertiaryAliveChangePlayerId:
        linkedHunterSaveResult.tertiaryAliveChangePlayerId ??
        linkedLoverSaveResult.tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive:
        linkedHunterSaveResult.tertiaryPreviousAlive ??
        linkedLoverSaveResult.tertiaryPreviousAlive,
      tertiaryNextAlive:
        linkedHunterSaveResult.tertiaryNextAlive ??
        linkedLoverSaveResult.tertiaryNextAlive,
    });

    setIsWitchSaveTargetModalVisible(false);
    setWitchSourcePlayerId(null);
  };

  const applyWitchKillToTarget = (targetPlayerId: string) => {
    const witch = tracker.find((player) => player.id === witchSourcePlayerId);
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!witch || !target) {
      setIsWitchKillTargetModalVisible(false);
      setWitchSourcePlayerId(null);
      return;
    }

    const previousWitchChecklist = [...specialChecklistState.Witch];
    const nextWitchChecklist: boolean[] = [
      previousWitchChecklist[0] ?? false,
      true,
    ];
    const previousPendingCursedTransformPlayerIds = [
      ...pendingCursedTransformPlayerIds,
    ];
    const nextPendingCursedTransformPlayerIds =
      previousPendingCursedTransformPlayerIds.filter(
        (id) => id !== targetPlayerId,
      );
    const inheritanceResult =
      resolvePendingDoppelInheritanceOnDeath(targetPlayerId);
    const loverDeathResult = resolveLinkedLoverDeathOnDeath(targetPlayerId);
    const hunterRevengeResult =
      resolvePendingHunterRevengeOnDeath(targetPlayerId);
    const previousStrongmanSurvivedPlayerIds = [...strongmanSurvivedPlayerIds];
    let nextStrongmanSurvivedPlayerIds = [...strongmanSurvivedPlayerIds];

    if (previousStrongmanSurvivedPlayerIds.includes(targetPlayerId)) {
      nextStrongmanSurvivedPlayerIds = nextStrongmanSurvivedPlayerIds.filter(
        (id) => id !== targetPlayerId,
      );
    }

    if (
      loverDeathResult.tertiaryAliveChangePlayerId &&
      previousStrongmanSurvivedPlayerIds.includes(
        loverDeathResult.tertiaryAliveChangePlayerId,
      )
    ) {
      nextStrongmanSurvivedPlayerIds = nextStrongmanSurvivedPlayerIds.filter(
        (id) => id !== loverDeathResult.tertiaryAliveChangePlayerId,
      );
    }

    if (
      hunterRevengeResult.secondaryAliveChangePlayerId &&
      previousStrongmanSurvivedPlayerIds.includes(
        hunterRevengeResult.secondaryAliveChangePlayerId,
      )
    ) {
      nextStrongmanSurvivedPlayerIds = nextStrongmanSurvivedPlayerIds.filter(
        (id) => id !== hunterRevengeResult.secondaryAliveChangePlayerId,
      );
    }

    setStrongmanSurvivedPlayerIds(nextStrongmanSurvivedPlayerIds);

    setTrackerPlayerAlive(targetPlayerId, false);
    setPendingCursedTransformPlayerIds(nextPendingCursedTransformPlayerIds);
    setSpecialChecklistState((previousState) => ({
      ...previousState,
      Witch: nextWitchChecklist,
    }));

    const logEntryId = appendNightLog(
      `${
        language === 'vi'
          ? `${witch.name} đã giết ${target.name}.`
          : `${witch.name} killed ${target.name}.`
      }${loverDeathResult.loverDeathNote}${inheritanceResult.inheritanceNote}${hunterRevengeResult.revengeNote}`,
    );

    recordAppliedAction({
      playerId: targetPlayerId,
      previousAlive: target.alive,
      changedAlive: target.alive !== false,
      previousRole: target.role,
      changedRole: false,
      nextRole: target.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist,
      nextWitchChecklist,
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      previousPendingCursedTransformPlayerIds,
      nextPendingCursedTransformPlayerIds,
      previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      previousPendingDoppelCopy: inheritanceResult.previousPendingDoppelCopy,
      nextPendingDoppelCopy: inheritanceResult.nextPendingDoppelCopy,
      secondaryChangedRole: inheritanceResult.secondaryChangedRole,
      secondaryRoleChangePlayerId:
        inheritanceResult.secondaryRoleChangePlayerId,
      secondaryPreviousRole: inheritanceResult.secondaryPreviousRole,
      secondaryNextRole: inheritanceResult.secondaryNextRole,
      previousPendingHunterRevenge:
        hunterRevengeResult.previousPendingHunterRevenge,
      nextPendingHunterRevenge: hunterRevengeResult.nextPendingHunterRevenge,
      secondaryChangedAlive: hunterRevengeResult.secondaryChangedAlive,
      secondaryAliveChangePlayerId:
        hunterRevengeResult.secondaryAliveChangePlayerId,
      secondaryPreviousAlive: hunterRevengeResult.secondaryPreviousAlive,
      secondaryNextAlive: hunterRevengeResult.secondaryNextAlive,
      tertiaryChangedAlive:
        loverDeathResult.tertiaryChangedAlive ||
        hunterRevengeResult.tertiaryChangedAlive,
      tertiaryAliveChangePlayerId:
        loverDeathResult.tertiaryAliveChangePlayerId ??
        hunterRevengeResult.tertiaryAliveChangePlayerId,
      tertiaryPreviousAlive:
        loverDeathResult.tertiaryPreviousAlive ??
        hunterRevengeResult.tertiaryPreviousAlive,
      tertiaryNextAlive:
        loverDeathResult.tertiaryNextAlive ??
        hunterRevengeResult.tertiaryNextAlive,
      previousStrongmanSurvivedPlayerIds,
      nextStrongmanSurvivedPlayerIds,
    });

    setIsWitchKillTargetModalVisible(false);
    setWitchSourcePlayerId(null);
  };

  const applyHunterRevengeTarget = (targetPlayerId: string) => {
    const hunter = tracker.find((player) => player.id === hunterSourcePlayerId);
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!hunter || !target?.alive) {
      setIsHunterTargetModalVisible(false);
      setHunterSourcePlayerId(null);
      return;
    }

    const previousPendingHunterRevenge = pendingHunterRevenge
      ? { ...pendingHunterRevenge }
      : null;

    if (!hunter.alive) {
      const previousPendingCursedTransformPlayerIds = [
        ...pendingCursedTransformPlayerIds,
      ];
      const nextPendingCursedTransformPlayerIds =
        previousPendingCursedTransformPlayerIds.filter(
          (id) => id !== targetPlayerId,
        );
      const inheritanceResult =
        resolvePendingDoppelInheritanceOnDeath(targetPlayerId);
      const loverDeathResult = resolveLinkedLoverDeathOnDeath(targetPlayerId);
      const hunterRevengeResult =
        resolvePendingHunterRevengeOnDeath(targetPlayerId);
      const previousStrongmanSurvivedPlayerIds = [
        ...strongmanSurvivedPlayerIds,
      ];
      let nextStrongmanSurvivedPlayerIds = [...strongmanSurvivedPlayerIds];

      if (previousStrongmanSurvivedPlayerIds.includes(targetPlayerId)) {
        nextStrongmanSurvivedPlayerIds = nextStrongmanSurvivedPlayerIds.filter(
          (id) => id !== targetPlayerId,
        );
      }

      if (
        loverDeathResult.tertiaryAliveChangePlayerId &&
        previousStrongmanSurvivedPlayerIds.includes(
          loverDeathResult.tertiaryAliveChangePlayerId,
        )
      ) {
        nextStrongmanSurvivedPlayerIds = nextStrongmanSurvivedPlayerIds.filter(
          (id) => id !== loverDeathResult.tertiaryAliveChangePlayerId,
        );
      }

      if (
        hunterRevengeResult.secondaryAliveChangePlayerId &&
        previousStrongmanSurvivedPlayerIds.includes(
          hunterRevengeResult.secondaryAliveChangePlayerId,
        )
      ) {
        nextStrongmanSurvivedPlayerIds = nextStrongmanSurvivedPlayerIds.filter(
          (id) => id !== hunterRevengeResult.secondaryAliveChangePlayerId,
        );
      }

      setStrongmanSurvivedPlayerIds(nextStrongmanSurvivedPlayerIds);
      setPendingCursedTransformPlayerIds(nextPendingCursedTransformPlayerIds);

      // Hunter revenge shot bypasses Bodyguard protection.
      setBodyguardProtectedPlayerIds((previous) =>
        previous.filter((id) => id !== targetPlayerId),
      );
      setTrackerPlayerAlive(targetPlayerId, false);
      setPendingHunterRevenge(null);

      const logEntryId = appendNightLog(
        `${
          language === 'vi'
            ? `${hunter.name} đã chết nên bắn ${target.name} ngay lập tức.`
            : `${hunter.name} is already dead, so ${target.name} dies immediately from revenge shot.`
        }${loverDeathResult.loverDeathNote}${inheritanceResult.inheritanceNote}${hunterRevengeResult.revengeNote}`,
      );

      recordAppliedAction({
        playerId: targetPlayerId,
        previousAlive: target.alive,
        changedAlive: true,
        previousRole: target.role,
        changedRole: false,
        nextRole: target.role,
        logEntryId,
        previousWasProtectedByBodyguard: false,
        nextWasProtectedByBodyguard: false,
        previousWitchChecklist: [...specialChecklistState.Witch],
        nextWitchChecklist: [...specialChecklistState.Witch],
        previousCursedChecklist: [...specialChecklistState.Cursed],
        nextCursedChecklist: [...specialChecklistState.Cursed],
        previousCupidChecklist: [...specialChecklistState.Cupid],
        nextCupidChecklist: [...specialChecklistState.Cupid],
        previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
        nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
        previousFoxChecklist: [...specialChecklistState.Fox],
        nextFoxChecklist: [...specialChecklistState.Fox],
        previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
        nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
        previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
        nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
        previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
        nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
        previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
        nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
        previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
        nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
        previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
        nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
        previousPendingDoppelCopy: inheritanceResult.previousPendingDoppelCopy,
        nextPendingDoppelCopy: inheritanceResult.nextPendingDoppelCopy,
        secondaryChangedRole: inheritanceResult.secondaryChangedRole,
        secondaryRoleChangePlayerId:
          inheritanceResult.secondaryRoleChangePlayerId,
        secondaryPreviousRole: inheritanceResult.secondaryPreviousRole,
        secondaryNextRole: inheritanceResult.secondaryNextRole,
        previousPendingHunterRevenge,
        nextPendingHunterRevenge: hunterRevengeResult.nextPendingHunterRevenge,
        secondaryChangedAlive: hunterRevengeResult.secondaryChangedAlive,
        secondaryAliveChangePlayerId:
          hunterRevengeResult.secondaryAliveChangePlayerId,
        secondaryPreviousAlive: hunterRevengeResult.secondaryPreviousAlive,
        secondaryNextAlive: hunterRevengeResult.secondaryNextAlive,
        tertiaryChangedAlive:
          loverDeathResult.tertiaryChangedAlive ||
          hunterRevengeResult.tertiaryChangedAlive,
        tertiaryAliveChangePlayerId:
          loverDeathResult.tertiaryAliveChangePlayerId ??
          hunterRevengeResult.tertiaryAliveChangePlayerId,
        tertiaryPreviousAlive:
          loverDeathResult.tertiaryPreviousAlive ??
          hunterRevengeResult.tertiaryPreviousAlive,
        tertiaryNextAlive:
          loverDeathResult.tertiaryNextAlive ??
          hunterRevengeResult.tertiaryNextAlive,
        previousStrongmanSurvivedPlayerIds,
        nextStrongmanSurvivedPlayerIds,
        previousPendingCursedTransformPlayerIds,
        nextPendingCursedTransformPlayerIds,
      });

      setIsHunterTargetModalVisible(false);
      setHunterSourcePlayerId(null);
      return;
    }

    const nextPendingHunterRevenge: PendingHunterRevenge = {
      hunterId: hunter.id,
      targetId: target.id,
    };

    setPendingHunterRevenge(nextPendingHunterRevenge);

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${hunter.name} đã chọn ${target.name} làm mục tiêu trả thù khi Thợ Săn chết.`
        : `${hunter.name} selected ${target.name} for revenge shot when Hunter dies.`,
    );

    recordAppliedAction({
      playerId: hunter.id,
      previousAlive: hunter.alive,
      changedAlive: false,
      previousRole: hunter.role,
      changedRole: false,
      nextRole: hunter.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist: [...specialChecklistState.Witch],
      nextWitchChecklist: [...specialChecklistState.Witch],
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      previousPendingDoppelCopy: pendingDoppelCopy
        ? { ...pendingDoppelCopy }
        : null,
      nextPendingDoppelCopy: pendingDoppelCopy
        ? { ...pendingDoppelCopy }
        : null,
      previousPendingHunterRevenge,
      nextPendingHunterRevenge,
    });

    setIsHunterTargetModalVisible(false);
    setHunterSourcePlayerId(null);
  };

  const applyBodyguardProtectToTarget = (targetPlayerId: string) => {
    const bodyguard = tracker.find(
      (player) => player.id === bodyguardSourcePlayerId,
    );
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!bodyguard || !target) {
      setIsBodyguardTargetModalVisible(false);
      setBodyguardSourcePlayerId(null);
      return;
    }

    if (lastNightBodyguardProtectedPlayerId === targetPlayerId) {
      return;
    }

    const previousBodyguardProtectedPlayerIds = [
      ...bodyguardProtectedPlayerIds,
    ];
    const nextBodyguardProtectedPlayerIds = [targetPlayerId];

    setBodyguardProtectedPlayerIds(nextBodyguardProtectedPlayerIds);

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${bodyguard.name} đã bảo vệ ${target.name} trong đêm này.`
        : `${bodyguard.name} protected ${target.name} for this night.`,
    );

    recordAppliedAction({
      playerId: targetPlayerId,
      previousAlive: target.alive,
      changedAlive: false,
      previousRole: target.role,
      changedRole: false,
      nextRole: target.role,
      logEntryId,
      previousWasProtectedByBodyguard:
        previousBodyguardProtectedPlayerIds.includes(targetPlayerId),
      nextWasProtectedByBodyguard: true,
      previousWitchChecklist: [...specialChecklistState.Witch],
      nextWitchChecklist: [...specialChecklistState.Witch],
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      previousBodyguardProtectedPlayerIds,
      nextBodyguardProtectedPlayerIds,
    });

    setIsBodyguardTargetModalVisible(false);
    setBodyguardSourcePlayerId(null);
  };

  const applySeerCheckToTarget = (targetPlayerId: string) => {
    const seer = tracker.find((player) => player.id === seerSourcePlayerId);
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!seer || !target) {
      setIsSeerTargetModalVisible(false);
      setSeerSourcePlayerId(null);
      return;
    }

    const previousSeerCheckedPlayerIds = [...seerCheckedPlayerIds];
    const nextSeerCheckedPlayerIds = previousSeerCheckedPlayerIds.includes(
      targetPlayerId,
    )
      ? previousSeerCheckedPlayerIds
      : [...previousSeerCheckedPlayerIds, targetPlayerId];

    setSeerCheckedPlayerIds(nextSeerCheckedPlayerIds);

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${seer.name} đã soi ${target.name} trong đêm.`
        : `${seer.name} checked ${target.name} during the night.`,
    );

    recordAppliedAction({
      playerId: seer.id,
      previousAlive: seer.alive,
      changedAlive: false,
      previousRole: seer.role,
      changedRole: false,
      nextRole: seer.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist: [...specialChecklistState.Witch],
      nextWitchChecklist: [...specialChecklistState.Witch],
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds,
      nextSeerCheckedPlayerIds,
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
    });

    setIsSeerTargetModalVisible(false);
    setSeerSourcePlayerId(null);
  };

  const applyEnchantressMarkToTarget = (targetPlayerId: string) => {
    const enchantress = tracker.find(
      (player) => player.id === enchantressSourcePlayerId,
    );
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!enchantress || !target) {
      setIsEnchantressTargetModalVisible(false);
      setEnchantressSourcePlayerId(null);
      return;
    }

    const previousEnchantressMarkedPlayerIds = [...enchantressMarkedPlayerIds];
    const nextEnchantressMarkedPlayerIds = [targetPlayerId];

    setEnchantressMarkedPlayerIds(nextEnchantressMarkedPlayerIds);

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${enchantress.name} đã phù phép ${target.name} trong đêm.`
        : `${enchantress.name} cast a spell on ${target.name} during the night.`,
    );

    recordAppliedAction({
      playerId: enchantress.id,
      previousAlive: enchantress.alive,
      changedAlive: false,
      previousRole: enchantress.role,
      changedRole: false,
      nextRole: enchantress.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist: [...specialChecklistState.Witch],
      nextWitchChecklist: [...specialChecklistState.Witch],
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousEnchantressMarkedPlayerIds,
      nextEnchantressMarkedPlayerIds,
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
    });

    setIsEnchantressTargetModalVisible(false);
    setEnchantressSourcePlayerId(null);
  };

  const applyDoppelCopyToTarget = (targetPlayerId: string) => {
    const doppel = tracker.find((player) => player.id === doppelSourcePlayerId);
    const target = tracker.find((player) => player.id === targetPlayerId);

    if (!doppel || !target) {
      setIsDoppelTargetModalVisible(false);
      setDoppelSourcePlayerId(null);
      return;
    }

    const previousDoppelCopiedPlayerIds = [...doppelCopiedPlayerIds];
    const nextDoppelCopiedPlayerIds = previousDoppelCopiedPlayerIds.includes(
      targetPlayerId,
    )
      ? previousDoppelCopiedPlayerIds
      : [...previousDoppelCopiedPlayerIds, targetPlayerId];

    setDoppelCopiedPlayerIds(nextDoppelCopiedPlayerIds);
    setSpecialChecklistState((previousState) => ({
      ...previousState,
      'The Doppelgänger': [true],
    }));
    const previousPendingDoppelCopy = pendingDoppelCopy
      ? { ...pendingDoppelCopy }
      : null;
    const nextPendingDoppelCopy: PendingDoppelCopy = {
      doppelId: doppel.id,
      targetId: target.id,
      copiedRole: target.role,
    };
    setPendingDoppelCopy(nextPendingDoppelCopy);

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${doppel.name} đã sao chép ${target.name}. Sẽ thừa hưởng vai ${localizedRoleLabel(target.role)} khi ${target.name} chết.`
        : `${doppel.name} copied ${target.name}. Inherits ${target.role} when ${target.name} dies.`,
    );

    recordAppliedAction({
      playerId: doppel.id,
      previousAlive: doppel.alive,
      changedAlive: false,
      previousRole: doppel.role,
      changedRole: false,
      nextRole: doppel.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist: [...specialChecklistState.Witch],
      nextWitchChecklist: [...specialChecklistState.Witch],
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [...specialChecklistState.Cupid],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [true],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousDoppelCopiedPlayerIds,
      nextDoppelCopiedPlayerIds,
      previousCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      nextCupidLinkedPlayerIds: [...cupidLinkedPlayerIds],
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      previousWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      nextWhitewolfAttackedPlayerIds: [...whitewolfAttackedPlayerIds],
      previousBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      nextBodyguardProtectedPlayerIds: [...bodyguardProtectedPlayerIds],
      previousPendingDoppelCopy,
      nextPendingDoppelCopy,
    });

    setIsDoppelTargetModalVisible(false);
    setDoppelSourcePlayerId(null);
  };

  const toggleCupidLoverSelection = (playerId: string) => {
    setCupidSelectedLoverIds((previous) => {
      if (previous.includes(playerId)) {
        return previous.filter((id) => id !== playerId);
      }

      if (previous.length >= 2) {
        return previous;
      }

      return [...previous, playerId];
    });
  };

  const applyCupidLinkedLovers = () => {
    const cupid = tracker.find((player) => player.id === cupidSourcePlayerId);
    if (!cupid || cupidSelectedLoverIds.length !== 2) {
      return;
    }

    const loverNames = cupidSelectedLoverIds
      .map((id) => tracker.find((player) => player.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    const previousCupidLinkedPlayerIds = [...cupidLinkedPlayerIds];
    const nextCupidLinkedPlayerIds = [...cupidSelectedLoverIds];

    setCupidLinkedPlayerIds(nextCupidLinkedPlayerIds);
    setSpecialChecklistState((previousState) => ({
      ...previousState,
      Cupid: [true],
    }));

    const logEntryId = appendNightLog(
      language === 'vi'
        ? `${cupid.name} đã liên kết tình nhân: ${joinedLovers(loverNames)}.`
        : `${cupid.name} linked lovers: ${joinedLovers(loverNames)}.`,
    );

    recordAppliedAction({
      playerId: cupid.id,
      previousAlive: cupid.alive,
      changedAlive: false,
      previousRole: cupid.role,
      changedRole: false,
      nextRole: cupid.role,
      logEntryId,
      previousWasProtectedByBodyguard: false,
      nextWasProtectedByBodyguard: false,
      previousWitchChecklist: [...specialChecklistState.Witch],
      nextWitchChecklist: [...specialChecklistState.Witch],
      previousCursedChecklist: [...specialChecklistState.Cursed],
      nextCursedChecklist: [...specialChecklistState.Cursed],
      previousCupidChecklist: [...specialChecklistState.Cupid],
      nextCupidChecklist: [true],
      previousDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      nextDoppelChecklist: [...specialChecklistState['The Doppelgänger']],
      previousFoxChecklist: [...specialChecklistState.Fox],
      nextFoxChecklist: [...specialChecklistState.Fox],
      previousSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      nextSeerCheckedPlayerIds: [...seerCheckedPlayerIds],
      previousDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      nextDoppelCopiedPlayerIds: [...doppelCopiedPlayerIds],
      previousCupidLinkedPlayerIds,
      nextCupidLinkedPlayerIds,
      previousWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
      nextWerewolfAttackedPlayerIds: [...werewolfAttackedPlayerIds],
    });

    setIsCupidTargetModalVisible(false);
    setCupidSourcePlayerId(null);
    setCupidSelectedLoverIds([]);
  };

  const renderPhaseCard = (phase: NightPhaseName) => (
    <View key={phase} style={[styles.phaseCard, { width: gridItemWidth }]}>
      {isDayTimerPhase(phase) && (
        <View style={styles.dayTimerInputRow}>
          <TextInput
            keyboardType="number-pad"
            value={dayTimerInputs[phase]}
            onChangeText={(value) =>
              setDayTimerInputs((previous) => ({
                ...previous,
                [phase]: value,
              }))
            }
            placeholder="45"
            placeholderTextColor="#687089"
            style={styles.dayTimerInput}
          />
          <Pressable
            style={styles.dayTimerSetButton}
            onPress={() => applyDayTimerDuration(phase)}
          >
            <Text style={styles.dayTimerSetButtonText}>{t.set}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.phaseHeaderRow}>
        <Text style={styles.phaseName}>{phaseLabel(phase)}</Text>
        <Text style={styles.phaseTime}>
          {formatSeconds(phaseTimers[phase].remaining)}
        </Text>
      </View>

      <View style={styles.phaseButtonRow}>
        <Pressable
          style={
            phaseTimers[phase].running ? styles.pauseButton : styles.startButton
          }
          onPress={() => togglePhaseTimer(phase)}
        >
          <Text
            style={
              phaseTimers[phase].running
                ? styles.pauseButtonText
                : styles.startButtonText
            }
          >
            {phaseTimers[phase].running ? t.pause : t.start}
          </Text>
        </Pressable>

        <Pressable
          style={styles.resetPhaseButton}
          onPress={() => resetPhaseTimer(phase)}
        >
          <Text style={styles.resetPhaseButtonText}>{t.reset}</Text>
        </Pressable>
      </View>
    </View>
  );

  const localizedActionLabel = (action: PlayerNightAction) => {
    if (language !== 'vi') {
      return action.label;
    }

    return VI_ACTION_LABELS[action.key] ?? action.label;
  };

  const localizedChecklistLabel = (label: string) => {
    if (language !== 'vi') {
      return label;
    }

    return VI_CHECKLIST_LABELS[label] ?? label;
  };

  const localizedNightGuideStep = (step: NightGuideStep) => {
    if (language !== 'vi') {
      return step;
    }

    const doppel = localizedRoleLabel('The Doppelgänger');
    const thief = localizedRoleLabel('Thief');
    const cupid = localizedRoleLabel('Cupid');
    const bodyguard = localizedRoleLabel('Bodyguard');
    const werewolf = localizedRoleLabel('Werewolf');
    const strongman = localizedRoleLabel('Strongman');
    const cursed = localizedRoleLabel('Cursed');
    const whitewolf = localizedRoleLabel('Whitewolf');
    const witch = localizedRoleLabel('Witch');
    const enchantress = localizedRoleLabel('Enchantress');
    const hunter = localizedRoleLabel('Hunter');
    const seer = localizedRoleLabel('Seer');
    const fox = localizedRoleLabel('Fox');
    const littleGirl = localizedRoleLabel('Little Girl');

    switch (step.id) {
      case 'sleep':
        return {
          ...step,
          title: 'Bắt đầu đêm',
          call: 'Mọi người nhắm mắt. Quản trò xác nhận yên lặng.',
          notes: 'Dừng ngắn trước mỗi lượt gọi vai để chuyển nhịp rõ ràng.',
        };
      case 'doppelganger':
        return {
          ...step,
          title: `${doppel} chọn`,
          call: `${doppel} thức dậy và chỉ một người để sao chép.`,
          notes: 'Ghi lại mục tiêu được sao chép một cách kín đáo.',
        };
      case 'thief':
        return {
          ...step,
          title: `${thief} quyết định`,
          call: `${thief} thức dậy và có thể đổi vai nếu bàn chơi cho phép.`,
          notes: 'Chỉ áp dụng ở đêm đầu tiên.',
        };
      case 'cupid':
        return {
          ...step,
          title: `${cupid} liên kết`,
          call: `${cupid} thức dậy và chọn hai tình nhân.`,
          notes: `Báo cho hai tình nhân trong im lặng rồi ${cupid} ngủ lại.`,
        };
      case 'bodyguard':
        return {
          ...step,
          title: `${bodyguard} bảo vệ`,
          call: `${bodyguard} thức dậy và chọn một người để bảo vệ.`,
          notes: `Người được bảo vệ sống sót trước đòn tấn công của ${werewolf} trong đêm.`,
        };
      case 'werewolves':
        return {
          ...step,
          title: `${werewolf} hành động`,
          call: `${werewolf} thức dậy, chọn một mục tiêu rồi ngủ lại.`,
          notes: `Dùng hành động trên thẻ người chơi để ghi nhận. ${strongman} và ${cursed} sẽ tự động cập nhật ở đêm kế.`,
        };
      case 'whitewolf':
        return {
          ...step,
          title: `${whitewolf} hành động`,
          call: `${whitewolf} thức dậy ở các đêm chẵn để hành động đặc biệt theo luật bàn.`,
          notes: `Thường xử lý ngay sau ${werewolf} ở các đêm 2, 4, 6... nếu bàn chơi không dùng thứ tự khác.`,
        };
      case 'witch':
        return {
          ...step,
          title: `${witch} dùng thuốc`,
          call: `${witch} thức dậy và có thể cứu hoặc giết theo số thuốc còn lại.`,
          notes: `Dùng hành động modal sẽ tự cập nhật checklist của ${witch}.`,
        };
      case 'enchantress':
        return {
          ...step,
          title: `${enchantress} phù phép`,
          call: `${enchantress} thức dậy và chọn một người để phù phép theo luật bàn chơi.`,
          notes: `Xử lý hiệu ứng phù phép theo biến thể mà bàn chơi đang dùng.`,
        };
      case 'hunter':
        return {
          ...step,
          title: `${hunter} chỉ định mục tiêu`,
          call: `${hunter} thức dậy và chọn một mục tiêu trả thù nếu bàn chơi dùng luật này.`,
          notes: `Khi ${hunter} chết, mục tiêu đã chỉ định sẽ chết ngay lập tức.`,
        };
      case 'seer':
        return {
          ...step,
          title: `${seer} soi`,
          call: `${seer} thức dậy và soi một người chơi.`,
          notes: `Tiết lộ thông tin kín cho ${seer} rồi ${seer} ngủ lại.`,
        };
      case 'fox':
        return {
          ...step,
          title: `${fox} cảm nhận`,
          call: `${fox} thức dậy và dùng năng lực cảm nhận nếu bàn có bật luật này.`,
          notes: `Bỏ qua nếu bàn chơi không dùng năng lực ${fox} ban đêm.`,
        };
      case 'little-girl':
        return {
          ...step,
          title: `Nhắc ${littleGirl}`,
          call: `${littleGirl} chỉ được nhìn trộm nếu bàn chơi cho phép.`,
          notes: 'Áp dụng thống nhất quy tắc công bằng của nhóm.',
        };
      case 'resolve':
        return {
          ...step,
          title: 'Tổng kết & Trời sáng',
          call: 'Xử lý hiệu ứng rồi thông báo trời sáng và kết quả.',
          notes: 'Ghi log diễn biến chính trước khi vào thảo luận/bỏ phiếu.',
        };
      default:
        return step;
    }
  };

  const modalPlayerGridItemWidth: '100%' | '48%' = isNarrowScreen
    ? '100%'
    : '48%';

  const renderModalPlayerGrid = (
    options: {
      key: string;
      player: { id: string; name: string; role: RoleName; alive: boolean };
      disabled?: boolean;
      selected?: boolean;
      source?: boolean;
      helperText?: string;
      onPress?: () => void;
    }[],
  ) => (
    <View style={styles.modalPlayerGrid}>
      {options.map((option) => {
        const card = (
          <>
            <View style={styles.modalPlayerCardTopRow}>
              <Text
                style={[
                  styles.modalPlayerCardName,
                  option.disabled && styles.modalActionButtonTextDisabled,
                ]}
                numberOfLines={1}
              >
                {option.player.name}
              </Text>
              <View
                style={[
                  styles.modalPlayerDot,
                  option.player.alive
                    ? styles.playerDotAlive
                    : styles.playerDotDead,
                ]}
              />
            </View>

            <Text
              style={[
                styles.modalPlayerCardRole,
                option.disabled && styles.modalActionButtonTextDisabled,
              ]}
              numberOfLines={1}
            >
              {localizedRoleLabel(option.player.role)}
            </Text>

            {option.helperText ? (
              <Text
                style={[
                  styles.modalPlayerCardHelper,
                  option.disabled && styles.modalActionButtonTextDisabled,
                ]}
                numberOfLines={2}
              >
                {option.helperText}
              </Text>
            ) : null}
          </>
        );

        const baseCardStyles = [
          styles.modalPlayerCard,
          { width: modalPlayerGridItemWidth },
          option.selected && styles.modalPlayerCardSelected,
          option.source && styles.modalPlayerCardSource,
          option.disabled && styles.modalPlayerCardDisabled,
        ];

        if (option.onPress) {
          return (
            <Pressable
              key={option.key}
              style={baseCardStyles}
              disabled={option.disabled}
              onPress={option.onPress}
            >
              {card}
            </Pressable>
          );
        }

        return (
          <View key={option.key} style={baseCardStyles}>
            {card}
          </View>
        );
      })}
    </View>
  );

  let roleEditSubtitle = '';

  if (roleEditStep === 'role') {
    roleEditSubtitle =
      language === 'vi'
        ? 'Chọn vai trò cần chỉnh sửa'
        : 'Choose a role to edit';
  } else if (roleEditStep === 'player' || roleEditStep === 'assign') {
    const currentRoleLabel = roleEditSelectedRole
      ? localizedRoleLabel(roleEditSelectedRole)
      : '';

    if (roleEditStep === 'player') {
      roleEditSubtitle =
        language === 'vi'
          ? `Chọn người chơi để gán vai ${currentRoleLabel} (${roleEditSelectedPlayerIds.length}/${roleEditMaxSelectable})`
          : `Choose players to assign ${currentRoleLabel} (${roleEditSelectedPlayerIds.length}/${roleEditMaxSelectable})`;
    } else {
      roleEditSubtitle =
        language === 'vi'
          ? `Xác nhận gán vai ${currentRoleLabel} cho ${roleEditSelectedPlayerIds.length} người chơi.`
          : `Confirm assigning ${currentRoleLabel} to ${roleEditSelectedPlayerIds.length} players.`;
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.statsHeader}>
        <View style={styles.statsBlock}>
          <Text style={styles.statsLabel}>{t.alive}</Text>
          <Text style={[styles.statsValue, styles.aliveValue]}>
            {aliveCount}
          </Text>
        </View>
        <View style={styles.statsBlock}>
          <Text style={styles.statsLabel}>{t.dead}</Text>
          <Text style={[styles.statsValue, styles.deadValue]}>{deadCount}</Text>
        </View>
        <Pressable style={styles.langHeaderButton} onPress={toggleLanguage}>
          <Text style={styles.langHeaderButtonText}>
            {uiText[language].langButton}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.screenTitle}>{t.title}</Text>

        <View style={styles.trackerTabsRow}>
          <Pressable
            style={[
              styles.trackerTabButton,
              { width: gridItemWidth },
              activeTrackerTab === 'players-actions' &&
                styles.trackerTabButtonActive,
            ]}
            onPress={() => setActiveTrackerTab('players-actions')}
          >
            <Text
              style={[
                styles.trackerTabButtonText,
                activeTrackerTab === 'players-actions' &&
                  styles.trackerTabButtonTextActive,
              ]}
            >
              {playerActionsTabLabel}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.trackerTabButton,
              { width: gridItemWidth },
              activeTrackerTab === 'guide' && styles.trackerTabButtonActive,
            ]}
            onPress={() => setActiveTrackerTab('guide')}
          >
            <Text
              style={[
                styles.trackerTabButtonText,
                activeTrackerTab === 'guide' &&
                  styles.trackerTabButtonTextActive,
              ]}
            >
              {guideTabLabel}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.trackerTabButton,
              { width: gridItemWidth },
              activeTrackerTab === 'timers' && styles.trackerTabButtonActive,
            ]}
            onPress={() => setActiveTrackerTab('timers')}
          >
            <Text
              style={[
                styles.trackerTabButtonText,
                activeTrackerTab === 'timers' &&
                  styles.trackerTabButtonTextActive,
              ]}
            >
              {timersTabLabel}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.trackerTabButton,
              { width: gridItemWidth },
              activeTrackerTab === 'special-checks' &&
                styles.trackerTabButtonActive,
            ]}
            onPress={() => setActiveTrackerTab('special-checks')}
          >
            <Text
              style={[
                styles.trackerTabButtonText,
                activeTrackerTab === 'special-checks' &&
                  styles.trackerTabButtonTextActive,
              ]}
            >
              {specialChecksTabLabel}
            </Text>
          </Pressable>
        </View>

        {activeTrackerTab === 'guide' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.nightGuideTitle}</Text>
            <Text style={styles.sectionSubtitle}>
              {t.nightGuideSubtitle} {currentNight}.
            </Text>

            <View style={styles.nightGuideList}>
              {nightGuideSteps.map((step, index) => {
                const localizedStep = localizedNightGuideStep(step);

                return (
                  <View key={step.id} style={styles.nightGuideItem}>
                    <Text style={styles.nightGuideItemTitle}>
                      {index + 1}. {localizedStep.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {activeTrackerTab === 'timers' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.phaseTimersTitle}</Text>
            <Text style={styles.sectionSubtitle}>{t.phaseTimersSubtitle}</Text>
            <View style={styles.gridContainer}>
              {DAY_TIMER_PHASES.map(renderPhaseCard)}
            </View>
          </View>
        )}

        {activeTrackerTab === 'players-actions' && (
          <>
            <View style={styles.gridContainer}>
              {tracker.map((player) => (
                <Pressable
                  key={player.id}
                  style={[
                    styles.playerCard,
                    { width: gridItemWidth },
                    (player.role === 'Werewolf' ||
                      player.role === 'Whitewolf') &&
                      styles.playerCardWolf,
                    !player.alive && styles.playerCardDead,
                  ]}
                  onPress={() => setSelectedPlayerId(player.id)}
                >
                  <View>
                    <Text
                      style={[
                        styles.playerName,
                        !player.alive && styles.playerNameDead,
                      ]}
                    >
                      {player.name}
                    </Text>
                    <Text
                      style={[
                        styles.playerRole,
                        !player.alive && styles.playerRoleDead,
                      ]}
                    >
                      {localizedRoleLabel(player.role)}
                    </Text>
                    {SPECIAL_ROLE_ICONS[player.role] && (
                      <View style={styles.roleIconWrap}>
                        <Text style={styles.roleIconText}>
                          {SPECIAL_ROLE_ICONS[player.role]}
                        </Text>
                      </View>
                    )}
                    {seerCheckedPlayerIds.includes(player.id) && (
                      <View style={styles.checkedIconWrap}>
                        <Text style={styles.checkedIconText}>
                          {STATUS_BADGE_ICONS.checked}
                        </Text>
                      </View>
                    )}
                    {enchantressMarkedPlayerIds.includes(player.id) && (
                      <View style={styles.enchantedIconWrap}>
                        <Text style={styles.enchantedIconText}>
                          {STATUS_BADGE_ICONS.enchanted}
                        </Text>
                      </View>
                    )}
                    {doppelCopiedPlayerIds.includes(player.id) && (
                      <View style={styles.copiedIconWrap}>
                        <Text style={styles.copiedIconText}>
                          {STATUS_BADGE_ICONS.copied}
                        </Text>
                      </View>
                    )}
                    {cupidLinkedPlayerIds.includes(player.id) && (
                      <View style={styles.loverIconWrap}>
                        <Text style={styles.loverIconText}>
                          {STATUS_BADGE_ICONS.lover}
                        </Text>
                      </View>
                    )}
                    {bodyguardProtectedPlayerIds.includes(player.id) && (
                      <View style={styles.protectedIconWrap}>
                        <Text style={styles.protectedIconText}>
                          {STATUS_BADGE_ICONS.protected}
                        </Text>
                      </View>
                    )}
                    {player.role === 'Strongman' && (
                      <View style={styles.strongmanIconWrap}>
                        <Text style={styles.strongmanIconText}>
                          {strongmanSurvivedPlayerIds.includes(player.id)
                            ? STATUS_BADGE_ICONS.strongmanPending
                            : STATUS_BADGE_ICONS.strongman}
                        </Text>
                      </View>
                    )}
                    {pendingCursedTransformPlayerIds.includes(player.id) && (
                      <View style={styles.cursedPendingIconWrap}>
                        <Text style={styles.cursedPendingIconText}>
                          {STATUS_BADGE_ICONS.cursedPending}
                        </Text>
                      </View>
                    )}
                    {player.role === 'Elder' && (
                      <View style={styles.elderIconWrap}>
                        <Text style={styles.elderIconText}>
                          {STATUS_BADGE_ICONS.elder}
                        </Text>
                      </View>
                    )}
                    {pendingHunterRevenge?.targetId === player.id && (
                      <View style={styles.hunterTargetIconWrap}>
                        <Text style={styles.hunterTargetIconText}>
                          {STATUS_BADGE_ICONS.hunterTarget}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      styles.playerDot,
                      player.alive
                        ? styles.playerDotAlive
                        : styles.playerDotDead,
                    ]}
                  />
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.nightHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>{t.developmentsTitle}</Text>
                  <Text style={styles.sectionSubtitle}>
                    {t.currentNight}: {currentNight}
                  </Text>
                </View>
              </View>

              <TextInput
                value={nightNoteInput}
                onChangeText={setNightNoteInput}
                placeholder={t.notePlaceholder}
                placeholderTextColor="#687089"
                multiline
                style={styles.nightNoteInput}
              />

              <View style={styles.nightActionRow}>
                <Pressable
                  style={styles.addNightNoteButton}
                  onPress={addNightNote}
                >
                  <Text style={styles.addNightNoteButtonText}>{t.addNote}</Text>
                </Pressable>
                <Pressable
                  style={styles.clearNightLogButton}
                  onPress={clearNightLog}
                >
                  <Text style={styles.clearNightLogButtonText}>
                    {t.clearLog}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.undoRow}>
                <Pressable
                  style={[
                    styles.undoButton,
                    !lastAppliedAction && styles.undoButtonDisabled,
                  ]}
                  disabled={!lastAppliedAction}
                  onPress={undoLastAction}
                >
                  <Text
                    style={[
                      styles.undoButtonText,
                      !lastAppliedAction && styles.undoButtonTextDisabled,
                    ]}
                  >
                    {t.undo}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.viewLogButton}
                  onPress={openNightLogModal}
                >
                  <Text style={styles.viewLogButtonText}>{t.viewLog}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {activeTrackerTab === 'special-checks' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t.specialChecksTitle}</Text>
            <Text style={styles.sectionSubtitle}>
              {t.specialChecksSubtitle}
            </Text>

            {activeSpecialChecklistRoles.length > 0 ? (
              <View style={styles.gridContainer}>
                {activeSpecialChecklistRoles.map((role) => (
                  <View
                    key={role}
                    style={[styles.specialRoleCard, { width: gridItemWidth }]}
                  >
                    <Text style={styles.specialRoleTitle}>
                      {localizedRoleLabel(role)}
                    </Text>

                    {SPECIAL_ROLE_CHECKLISTS[role].map((checkLabel, index) => {
                      const checked = specialChecklistState[role][index];

                      return (
                        <Pressable
                          key={`${role}-${checkLabel}`}
                          style={styles.checkRow}
                          onPress={() =>
                            toggleSpecialChecklistItem(role, index)
                          }
                        >
                          <View
                            style={[
                              styles.checkbox,
                              checked && styles.checkboxChecked,
                            ]}
                          >
                            {checked && (
                              <Text style={styles.checkboxMark}>✓</Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.checkLabel,
                              checked && styles.checkLabelChecked,
                            ]}
                          >
                            {localizedChecklistLabel(checkLabel)}
                          </Text>
                        </Pressable>
                      );
                    })}

                    {role === 'Cupid' && cupidLinkedPlayerIds.length > 0 && (
                      <View style={styles.linkedLoversWrap}>
                        <Text style={styles.linkedLoversLabel}>
                          {t.linkedLovers}
                        </Text>
                        {cupidLinkedPlayerIds.map((id) => {
                          const playerName =
                            tracker.find((player) => player.id === id)?.name ??
                            id;

                          return (
                            <Text
                              key={`lover-${id}`}
                              style={styles.linkedLoversName}
                            >
                              - {playerName}
                            </Text>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={selectedPlayer !== null}
        onRequestClose={() => setSelectedPlayerId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.chooseNightState}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedPlayer?.name}{' '}
              {selectedPlayer
                ? `(${localizedRoleLabel(selectedPlayer.role)})`
                : ''}
            </Text>

            <View style={styles.modalActionList}>
              {availableNightActions.map((action) => (
                <Pressable
                  key={action.key}
                  style={[
                    styles.modalActionButton,
                    action.disabled && styles.modalActionButtonDisabled,
                  ]}
                  disabled={action.disabled}
                  onPress={() => applyNightActionToPlayer(action)}
                >
                  <Text
                    style={[
                      styles.modalActionButtonText,
                      action.disabled && styles.modalActionButtonTextDisabled,
                    ]}
                  >
                    {localizedActionLabel(action)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setSelectedPlayerId(null)}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isRoleEditModalVisible}
        onRequestClose={closeRoleEditModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.roleEditModalCard]}>
            <Text style={styles.modalTitle}>{t.editRole}</Text>
            <Text style={styles.modalSubtitle}>{roleEditSubtitle}</Text>

            <ScrollView
              style={styles.roleEditList}
              contentContainerStyle={styles.modalActionList}
              showsVerticalScrollIndicator
            >
              {roleEditStep === 'role' &&
                roleEditSourceRoleOptions.map((role) => (
                  <Pressable
                    key={`role-edit-source-${role}`}
                    style={styles.modalActionButton}
                    onPress={() => selectRoleEditSourceRole(role)}
                  >
                    <Text style={styles.modalActionButtonText}>
                      {localizedRoleLabel(role)}
                    </Text>
                  </Pressable>
                ))}

              {roleEditStep === 'player' &&
                renderModalPlayerGrid(
                  tracker.map((player) => {
                    const selected = roleEditSelectedPlayerIds.includes(
                      player.id,
                    );
                    const limitReached =
                      !selected &&
                      roleEditSelectedPlayerIds.length >= roleEditMaxSelectable;

                    return {
                      key: `role-edit-player-${player.id}`,
                      player,
                      selected,
                      disabled: limitReached,
                      onPress: () => toggleRoleEditPlayer(player.id),
                    };
                  }),
                )}

              {roleEditStep === 'assign' &&
                renderModalPlayerGrid(
                  roleEditSelectedPlayers.map((player) => ({
                    key: `role-edit-selected-${player.id}`,
                    player,
                    selected: true,
                  })),
                )}

              {roleEditStep === 'role' &&
                roleEditSourceRoleOptions.length === 0 && (
                  <Text style={styles.modalEmptyText}>
                    {language === 'vi'
                      ? 'Hiện chưa có vai trò nào trong ván để chỉnh sửa.'
                      : 'There are no roles in this game to edit yet.'}
                  </Text>
                )}

              {roleEditStep === 'player' && tracker.length === 0 && (
                <Text style={styles.modalEmptyText}>
                  {language === 'vi'
                    ? 'Hiện không có người chơi nào trong ván.'
                    : 'There are no players in this game yet.'}
                </Text>
              )}

              {roleEditStep === 'assign' &&
                roleEditSelectedPlayers.length === 0 && (
                  <Text style={styles.modalEmptyText}>
                    {language === 'vi'
                      ? 'Chưa chọn người chơi nào để gán vai.'
                      : 'No players are selected for role assignment.'}
                  </Text>
                )}
            </ScrollView>

            {roleEditStep !== 'role' && (
              <Pressable
                style={styles.modalConfirmButton}
                onPress={goBackInRoleEditModal}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {language === 'vi' ? 'Quay lại' : 'Back'}
                </Text>
              </Pressable>
            )}

            {roleEditStep === 'player' && (
              <Pressable
                style={[
                  styles.modalConfirmButton,
                  roleEditSelectedPlayerIds.length === 0 &&
                    styles.modalConfirmButtonDisabled,
                ]}
                disabled={roleEditSelectedPlayerIds.length === 0}
                onPress={proceedRoleEditToAssign}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {language === 'vi' ? 'Tiếp tục' : 'Continue'}
                </Text>
              </Pressable>
            )}

            {roleEditStep === 'assign' && (
              <Pressable
                style={[
                  styles.modalConfirmButton,
                  roleEditSelectedPlayerIds.length === 0 &&
                    styles.modalConfirmButtonDisabled,
                ]}
                disabled={roleEditSelectedPlayerIds.length === 0}
                onPress={applyRoleEditToSelectedPlayers}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {language === 'vi' ? 'Gán vai trò' : 'Apply role'}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.modalCancelButton}
              onPress={closeRoleEditModal}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isHunterTargetModalVisible}
        onRequestClose={() => {
          setIsHunterTargetModalVisible(false);
          setHunterSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.hunterChoose}</Text>
            <Text style={styles.modalSubtitle}>{t.hunterNote}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter(
                    (player) =>
                      player.id !== hunterSourcePlayerId && player.alive,
                  )
                  .map((player) => ({
                    key: `hunter-target-${player.id}`,
                    player,
                    onPress: () => applyHunterRevengeTarget(player.id),
                  })),
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsHunterTargetModalVisible(false);
                setHunterSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isBodyguardTargetModalVisible}
        onRequestClose={() => {
          setIsBodyguardTargetModalVisible(false);
          setBodyguardSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.bodyguardChoose}</Text>
            <Text style={styles.modalSubtitle}>{t.bodyguardNote}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter((player) => player.alive)
                  .map((player) => {
                    const isBlocked =
                      lastNightBodyguardProtectedPlayerId === player.id;

                    return {
                      key: `bodyguard-target-${player.id}`,
                      player,
                      disabled: isBlocked,
                      helperText: isBlocked ? t.protectedLastNight : undefined,
                      onPress: () => applyBodyguardProtectToTarget(player.id),
                    };
                  }),
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsBodyguardTargetModalVisible(false);
                setBodyguardSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isWitchSaveTargetModalVisible}
        onRequestClose={() => {
          setIsWitchSaveTargetModalVisible(false);
          setWitchSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.witchSaveTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.witchSaveNote}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter((player) =>
                    witchSaveTargetPlayerIds.includes(player.id),
                  )
                  .map((player) => ({
                    key: `witch-save-target-${player.id}`,
                    player,
                    onPress: () => applyWitchSaveToTarget(player.id),
                  })),
              )}

              {witchSaveTargetPlayerIds.length === 0 && (
                <Text style={styles.modalEmptyText}>{t.witchSaveEmpty}</Text>
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsWitchSaveTargetModalVisible(false);
                setWitchSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isWitchKillTargetModalVisible}
        onRequestClose={() => {
          setIsWitchKillTargetModalVisible(false);
          setWitchSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.witchKillTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.chooseOneTarget}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter((player) => player.id !== witchSourcePlayerId)
                  .map((player) => ({
                    key: `witch-kill-target-${player.id}`,
                    player,
                    onPress: () => applyWitchKillToTarget(player.id),
                  })),
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsWitchKillTargetModalVisible(false);
                setWitchSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isCupidTargetModalVisible}
        onRequestClose={() => {
          setIsCupidTargetModalVisible(false);
          setCupidSourcePlayerId(null);
          setCupidSelectedLoverIds([]);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.cupidChoose}</Text>
            <Text style={styles.modalSubtitle}>
              {t.selected}: {cupidSelectedLoverIds.length} / 2
            </Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker.map((player) => {
                  const selected = cupidSelectedLoverIds.includes(player.id);
                  const isCupidSource = player.id === cupidSourcePlayerId;

                  return {
                    key: `cupid-target-${player.id}`,
                    player,
                    selected,
                    source: isCupidSource,
                    helperText: isCupidSource
                      ? localizedRoleLabel('Cupid')
                      : undefined,
                    onPress: () => toggleCupidLoverSelection(player.id),
                  };
                }),
              )}
            </ScrollView>

            <Pressable
              style={[
                styles.modalConfirmButton,
                cupidSelectedLoverIds.length !== 2 &&
                  styles.modalConfirmButtonDisabled,
              ]}
              disabled={cupidSelectedLoverIds.length !== 2}
              onPress={applyCupidLinkedLovers}
            >
              <Text style={styles.modalConfirmButtonText}>
                {t.confirmLovers}
              </Text>
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsCupidTargetModalVisible(false);
                setCupidSourcePlayerId(null);
                setCupidSelectedLoverIds([]);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isDoppelTargetModalVisible}
        onRequestClose={() => {
          setIsDoppelTargetModalVisible(false);
          setDoppelSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.doppelChoose}</Text>
            <Text style={styles.modalSubtitle}>{t.doppelTarget}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter((player) => player.id !== doppelSourcePlayerId)
                  .map((player) => ({
                    key: `doppel-target-${player.id}`,
                    player,
                    onPress: () => applyDoppelCopyToTarget(player.id),
                  })),
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsDoppelTargetModalVisible(false);
                setDoppelSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isEnchantressTargetModalVisible}
        onRequestClose={() => {
          setIsEnchantressTargetModalVisible(false);
          setEnchantressSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.enchantressChoose}</Text>
            <Text style={styles.modalSubtitle}>{t.enchantressNote}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter((player) => player.id !== enchantressSourcePlayerId)
                  .map((player) => ({
                    key: `enchantress-target-${player.id}`,
                    player,
                    onPress: () => applyEnchantressMarkToTarget(player.id),
                  })),
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsEnchantressTargetModalVisible(false);
                setEnchantressSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isNightLogModalVisible}
        onRequestClose={() => setIsNightLogModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.nightLogModalCard]}>
            <Text style={styles.modalTitle}>{t.nightLogTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.nightLogHint}</Text>

            {nightLogByNight.nights.length === 0 ? (
              <View style={styles.nightLogModalList}>
                <Text style={styles.emptyNightLogText}>{t.noDevelopments}</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.nightLogTabsScroll}
                  contentContainerStyle={styles.nightLogTabsContainer}
                >
                  {nightLogByNight.nights.map((nightValue) => {
                    const selected = selectedNightLog === nightValue;

                    return (
                      <Pressable
                        key={`night-log-tab-${nightValue}`}
                        style={[
                          styles.nightLogTab,
                          selected && styles.nightLogTabSelected,
                        ]}
                        onPress={() => setSelectedNightLog(nightValue)}
                      >
                        <Text
                          style={[
                            styles.nightLogTabText,
                            selected && styles.nightLogTabTextSelected,
                          ]}
                        >
                          {t.nightWord} {nightValue}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <ScrollView style={styles.nightLogModalList}>
                  {selectedNightLogEntries.map((entry) => (
                    <View key={entry.id} style={styles.nightLogItem}>
                      <View style={styles.nightLogMetaRow}>
                        <Text style={styles.nightLogNight}>
                          {t.nightWord} {entry.night}
                        </Text>
                        <Text style={styles.nightLogTime}>
                          {entry.createdAt}
                        </Text>
                      </View>
                      <Text style={styles.nightLogText}>{entry.text}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setIsNightLogModalVisible(false)}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isSeerTargetModalVisible}
        onRequestClose={() => {
          setIsSeerTargetModalVisible(false);
          setSeerSourcePlayerId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.seerChoose}</Text>
            <Text style={styles.modalSubtitle}>{t.chooseOneTarget}</Text>

            <ScrollView style={styles.modalPlayerGridScroll}>
              {renderModalPlayerGrid(
                tracker
                  .filter((player) => player.id !== seerSourcePlayerId)
                  .map((player) => ({
                    key: `seer-target-${player.id}`,
                    player,
                    onPress: () => applySeerCheckToTarget(player.id),
                  })),
              )}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                setIsSeerTargetModalVisible(false);
                setSeerSourcePlayerId(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <View style={styles.footerActionRow}>
          <Pressable
            style={styles.editRolesFooterButton}
            onPress={openRoleEditModal}
          >
            <Text style={styles.editRolesFooterButtonText}>{t.editRole}</Text>
          </Pressable>
          <Pressable
            style={styles.resetTrackerButton}
            onPress={handleResetTracker}
          >
            <Text style={styles.resetTrackerButtonText}>{t.resetTracker}</Text>
          </Pressable>
          <Pressable
            style={styles.nextNightFooterButton}
            onPress={moveToNextNight}
          >
            <Text style={styles.nextNightFooterButtonText}>{t.nextNight}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  statsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statsBlock: {
    flex: 1,
    alignItems: 'center',
  },
  langHeaderButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  langHeaderButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statsValue: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
  },
  aliveValue: {
    color: '#6E9D6A',
  },
  deadValue: {
    color: COLORS.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
  },
  screenSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  trackerTabsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  trackerTabButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trackerTabButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  trackerTabButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  trackerTabButtonTextActive: {
    color: COLORS.accent,
  },
  strongmanHintText: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  sectionCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  nightGuideList: {
    marginTop: 12,
  },
  nightGuideItem: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  nightGuideItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  nightGuideCall: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.text,
  },
  nightGuideNotes: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  phaseTopRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceMuted,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  applyButton: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  gridContainer: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  phaseCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
    paddingRight: 6,
  },
  phaseTime: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },
  phaseButtonRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  dayTimerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dayTimerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  dayTimerSetButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTimerSetButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  phaseGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  phaseGroupHeaderRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nightToggleButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nightToggleButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  specialRoleCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  specialRoleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2433',
  },
  checkRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#C43D31',
    backgroundColor: '#C43D31',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  checkLabel: {
    marginLeft: 10,
    flex: 1,
    fontSize: 13,
    color: '#1E2433',
  },
  checkLabelChecked: {
    textDecorationLine: 'line-through',
    color: '#687089',
  },
  linkedLoversWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF3',
  },
  linkedLoversLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2433',
  },
  linkedLoversName: {
    marginTop: 3,
    fontSize: 12,
    color: '#687089',
  },
  nightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  nightNoteInput: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#1E2433',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  nightActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  addNightNoteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C43D31',
    backgroundColor: '#C43D31',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addNightNoteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearNightLogButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    backgroundColor: '#F7F8FC',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  clearNightLogButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2433',
  },
  undoRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  undoButton: {
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewLogButton: {
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewLogButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2433',
  },
  undoButtonDisabled: {
    backgroundColor: '#F2F4FB',
  },
  undoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2433',
  },
  undoButtonTextDisabled: {
    color: '#9AA0B5',
  },
  nightLogList: {
    marginTop: 12,
  },
  emptyNightLogText: {
    fontSize: 13,
    color: '#687089',
  },
  nightLogItem: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  nightLogMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nightLogNight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2433',
  },
  nightLogTime: {
    fontSize: 12,
    color: '#687089',
  },
  nightLogText: {
    marginTop: 6,
    fontSize: 13,
    color: '#1E2433',
    lineHeight: 18,
  },
  startButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    borderColor: '#C43D31',
    backgroundColor: '#C43D31',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pauseButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    borderColor: '#D9DDE8',
    backgroundColor: '#C9CFDE',
  },
  pauseButtonText: {
    color: '#1E2433',
    fontSize: 14,
    fontWeight: '700',
  },
  resetPhaseButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    borderColor: '#D9DDE8',
    backgroundColor: '#F7F8FC',
  },
  resetPhaseButtonText: {
    color: '#1E2433',
    fontSize: 14,
    fontWeight: '700',
  },
  playerCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 12,
    backgroundColor: '#F7F8FC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  playerCardWolf: {
    borderColor: '#C43D31',
  },
  playerCardDead: {
    opacity: 0.6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2433',
  },
  playerNameDead: {
    color: '#687089',
    textDecorationLine: 'line-through',
  },
  playerRole: {
    marginTop: 2,
    fontSize: 11,
    color: '#687089',
  },
  roleIconWrap: {
    marginTop: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  roleIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E2433',
  },
  playerRoleDead: {
    textDecorationLine: 'line-through',
  },
  checkedIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  checkedIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E2433',
  },
  enchantedIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#8F7A42',
    borderRadius: 999,
    backgroundColor: '#FFF6DC',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  enchantedIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#725200',
  },
  copiedIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  copiedIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E2433',
  },
  loverIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E8B7B7',
    borderRadius: 999,
    backgroundColor: '#FFF3F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  loverIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A23030',
  },
  protectedIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  protectedIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E2433',
  },
  elderIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E3D9B0',
    borderRadius: 999,
    backgroundColor: '#FFFBEF',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  elderIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6A5600',
  },
  strongmanIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#C8DAB8',
    borderRadius: 999,
    backgroundColor: '#F3FAED',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  strongmanIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E5D2E',
  },
  cursedPendingIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D2B26B',
    borderRadius: 999,
    backgroundColor: '#FFF6E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cursedPendingIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#725200',
  },
  hunterTargetIconWrap: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#EBCB8A',
    borderRadius: 999,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hunterTargetIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A4E00',
  },
  playerDot: {
    width: 10,
    height: 10,
    marginTop: 2,
    borderRadius: 999,
  },
  playerDotAlive: {
    backgroundColor: '#6E9D6A',
  },
  playerDotDead: {
    backgroundColor: '#C43D31',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  roleEditModalCard: {
    maxHeight: '80%',
  },
  nightLogModalCard: {
    maxHeight: '85%',
  },
  nightLogTabsScroll: {
    marginTop: 12,
    maxHeight: 42,
  },
  nightLogTabsContainer: {
    gap: 8,
  },
  nightLogTab: {
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 999,
    backgroundColor: '#F7F8FC',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  nightLogTabSelected: {
    borderColor: '#C43D31',
    backgroundColor: '#FDEDED',
  },
  nightLogTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2433',
  },
  nightLogTabTextSelected: {
    color: '#A23030',
  },
  nightLogModalList: {
    marginTop: 12,
    maxHeight: 360,
  },
  roleEditList: {
    marginTop: 12,
    maxHeight: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E2433',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#687089',
  },
  modalActionList: {
    gap: 8,
  },
  modalPlayerGridScroll: {
    marginTop: 12,
    maxHeight: 360,
  },
  modalPlayerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalPlayerCard: {
    borderWidth: 1,
    borderColor: '#D9DDE8',
    backgroundColor: '#F7F8FC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  modalPlayerCardSelected: {
    borderColor: '#C43D31',
    backgroundColor: '#FDEDED',
  },
  modalPlayerCardSource: {
    borderColor: '#C43D31',
  },
  modalPlayerCardDisabled: {
    borderColor: '#D9DDE8',
    backgroundColor: '#F2F4FB',
  },
  modalPlayerCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalPlayerCardName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E2433',
  },
  modalPlayerCardRole: {
    marginTop: 3,
    fontSize: 12,
    color: '#687089',
  },
  modalPlayerCardHelper: {
    marginTop: 4,
    fontSize: 11,
    color: '#A23030',
    fontWeight: '600',
  },
  modalPlayerDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  modalActionButton: {
    borderWidth: 1,
    borderColor: '#D9DDE8',
    backgroundColor: '#F7F8FC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  modalActionButtonSelected: {
    borderColor: '#C43D31',
    backgroundColor: '#FDEDED',
  },
  modalActionButtonDisabled: {
    borderColor: '#D9DDE8',
    backgroundColor: '#F2F4FB',
  },
  modalActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2433',
  },
  modalActionButtonTextDisabled: {
    color: '#9AA0B5',
  },
  modalEmptyText: {
    fontSize: 13,
    color: '#687089',
  },
  modalConfirmButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C43D31',
    borderRadius: 10,
    backgroundColor: '#C43D31',
    alignItems: 'center',
    paddingVertical: 11,
  },
  modalConfirmButtonDisabled: {
    borderColor: '#D9DDE8',
    backgroundColor: '#C9CFDE',
  },
  modalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCancelButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2433',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#D9DDE8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  footerActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editRolesFooterButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9DDE8',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  editRolesFooterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2433',
  },
  nextNightFooterButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#6E9D6A',
    backgroundColor: '#6E9D6A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextNightFooterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resetTrackerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C43D31',
    backgroundColor: '#C43D31',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  resetTrackerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
