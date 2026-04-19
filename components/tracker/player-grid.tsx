import { type RoleName } from '@/src/game/roles';
import React, { memo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Card } from '../ui/card';

interface Player {
  id: string;
  name: string;
  role: RoleName;
  alive: boolean;
}

interface PlayerGridProps {
  players: Player[];
  onPlayerPress: (playerId: string) => void;
  getRoleLabel: (role: RoleName) => string;
  getRoleIcon: (role: RoleName) => string | undefined;
  getStatusIcons: (player: Player) => string[];
  isNarrowScreen: boolean;
}

const PlayerGridComponent = ({
  players,
  onPlayerPress,
  getRoleLabel,
  getRoleIcon,
  getStatusIcons,
  isNarrowScreen,
}: PlayerGridProps) => {
  const { width } = useWindowDimensions();
  const cardWidth = isNarrowScreen ? width - 32 : (width - 40) / 2;

  return (
    <View className="flex-row flex-wrap justify-between mt-4">
      {players.map((player) => {
        const statusIcons = getStatusIcons(player);
        const roleIcon = getRoleIcon(player.role);
        const isWolf =
          player.role === 'Werewolf' || player.role === 'Whitewolf';
        const isDead = player.alive === false;

        return (
          <Card
            key={player.id}
            className={`mb-3 p-3 min-h-[140px] flex-row items-center justify-between ${
              isDead ? 'opacity-60' : ''
            } ${isWolf ? 'border-accent' : 'border-border'}`}
            style={{ width: cardWidth }}
          >
            <Pressable
              className="flex-1 flex-row items-center justify-between h-full"
              onPress={() => onPlayerPress(player.id)}
            >
              <View className="flex-1 pr-2">
                <Text
                  className={`text-base font-bold text-text ${isDead ? 'text-text-muted line-through' : ''}`}
                  numberOfLines={1}
                >
                  {player.name}
                </Text>

                <Text
                  className={`text-xs text-text-muted mt-1 ${isDead ? 'line-through' : ''}`}
                  numberOfLines={1}
                >
                  {getRoleLabel(player.role)}
                </Text>

                {roleIcon && (
                  <View className="mt-2 self-start bg-surface border border-border rounded-full px-4 py-1">
                    <Text className="text-xl">{roleIcon}</Text>
                  </View>
                )}

                {statusIcons.length > 0 && (
                  <View className="flex-row flex-wrap gap-1 mt-2">
                    {statusIcons.map((icon, idx) => (
                      <View
                        key={`${player.id}-status-${idx}`}
                        className="bg-surface border border-border rounded-full px-2 py-0.5"
                      >
                        <Text className="text-[10px]">{icon}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View
                className={`w-3 h-3 rounded-full ${player.alive ? 'bg-[#6E9D6A]' : 'bg-accent'}`}
              />
            </Pressable>
          </Card>
        );
      })}
    </View>
  );
};

export const PlayerGrid = memo(PlayerGridComponent);
PlayerGrid.displayName = 'PlayerGrid';
