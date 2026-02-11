---
name: witch_decide
requiresPhase: night_witch
listensTo: [werewolf_kill]
requires:
  context: [wolfVictimName, hasSavePotion, hasPoisonPotion]
responseFormat: "ACTION: save|poison|none\nTARGET: <player name if poisoning>"
---
## Witch Night Phase

Choose ONE action:
- SAVE: Use your antidote to rescue the wolf victim
- POISON: Kill any alive player with your poison
- NONE: Do nothing and save your potions

Respond in this EXACT format:
ACTION: save|poison|none
TARGET: <player name if poisoning, otherwise leave empty>
