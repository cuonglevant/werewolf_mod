# Werewolf Moderator (Expo + NativeWind)

Moderator utility app for running Werewolf sessions with:

- Setup Screen: player count input + manual special-role toggles.
- Deck Screen: exact counts of each role card to deal.
- Moderator Tracker Screen: simple active-role list with alive/dead toggles.

## Tech

- Expo Router
- React Native
- NativeWind (Tailwind-style classes via `className`)

## Run

1. Install dependencies

   ```bash
   npm install
   ```

2. Start Expo

   ```bash
   npm run start
   ```

3. Open Android/iOS/Web from Expo output.

## Logic Rules

- Werewolf counts are auto-assigned by standard ratios:
  - 3-5 players: 1 werewolf
  - 6-8 players: 2 werewolves
  - 9-11 players: 3 werewolves
  - 12-15 players: 4 werewolves
  - 16+ players: floor(players / 4), minimum 4
- Special roles can be toggled manually: Seer, Bodyguard, Witch, Hunter, Cupid.
- Remaining seats are filled with Villagers.

## Validation Commands

- Lint:

  ```bash
  npm run lint
  ```

- Type-check:

  ```bash
  npx tsc --noEmit
  ```
