import type { RoleName, SpecialRole } from '@/src/game/roles';
import type { AppLanguage } from '@/src/state/game-context';

const ROLE_LABELS: Record<AppLanguage, Record<RoleName, string>> = {
  en: {
    Werewolf: 'Werewolf',
    Villager: 'Villager',
    Seer: 'Seer',
    'Apprentice Seer': 'Apprentice Seer',
    Bodyguard: 'Bodyguard',
    Witch: 'Witch',
    Enchantress: 'Enchantress',
    Hunter: 'Hunter',
    Cupid: 'Cupid',
    'Little Girl': 'Little Girl',
    Elder: 'Elder',
    Strongman: 'Strongman',
    Thief: 'Thief',
    Scapegoat: 'Scapegoat',
    Fox: 'Fox',
    Tanner: 'Tanner',
    Cursed: 'Cursed',
    Whitewolf: 'Whitewolf',
    'The Doppelgänger': 'The Doppelgänger',
  },
  vi: {
    Werewolf: 'Sói',
    Villager: 'Dân Làng',
    Seer: 'Tiên Tri',
    'Apprentice Seer': 'Tiên Tri Tập Sự',
    Bodyguard: 'Bảo Vệ',
    Witch: 'Phù Thủy',
    Enchantress: 'Kẻ Phù Phép',
    Hunter: 'Thợ Săn',
    Cupid: 'Thần Cupid',
    'Little Girl': 'Cô Bé Ti Hí',
    Elder: 'Già Làng',
    Strongman: 'Cứng Cỏi',
    Thief: 'Kẻ Trộm',
    Scapegoat: 'Kẻ Thế Mạng',
    Fox: 'Cáo',
    Tanner: 'Chán Đời',
    Cursed: 'Kẻ Bị Nguyền',
    Whitewolf: 'Sói Trắng',
    'The Doppelgänger': 'Nhân Bản',
  },
};

export const getRoleLabel = (language: AppLanguage, role: RoleName): string =>
  ROLE_LABELS[language][role];

export const SPECIAL_ROLE_DESCRIPTIONS_VI: Record<SpecialRole, string> = {
  Seer: 'Soi một người chơi mỗi đêm.',
  'Apprentice Seer': 'Sẽ trở thành Tiên Tri khi Tiên Tri đã chết.',
  Bodyguard: 'Bảo vệ một người khỏi bị tấn công.',
  Witch: 'Có 1 bình cứu và 1 bình độc.',
  Enchantress: 'Yểm một người chơi vào ban đêm theo luật bàn chơi.',
  Hunter: 'Khi chết có thể kéo theo một người.',
  Cupid: 'Liên kết 2 tình nhân lúc bắt đầu game.',
  'Little Girl': 'Có thể nhìn trộm trong lượt Ma Sói.',
  Elder: 'Lá phiếu được tính thành 2 phiếu khi bỏ phiếu ban ngày.',
  Strongman:
    'Sống sót sau 1 lần bị Ma Sói tấn công, sau đó tự chết ở đầu đêm sau.',
  Thief: 'Có thể đổi vai sớm theo luật bàn chơi.',
  Scapegoat: 'Bị xử khi làng hòa phiếu.',
  Fox: 'Có thể cảm nhận Ma Sói ở gần.',
  Tanner: 'Thắng nếu bị dân làng xử tử.',
  Cursed: 'Sẽ hóa Ma Sói nếu bị Ma Sói tấn công.',
  Whitewolf: 'Ma Sói đặc biệt có năng lực đêm riêng.',
  'The Doppelgänger': 'Sao chép một vai trò lúc bắt đầu game.',
};
