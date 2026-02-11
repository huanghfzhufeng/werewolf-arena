---
name: guard
nameZh: 守卫
team: villager
hasNightAction: true
nightPhase: night_guard
nightPriority: 5
deathTrigger: null
descriptionZh: 每晚保护一名玩家免受狼人袭击。不能连续两晚保护同一人。
emits: [guard_protect]
requires:
  context: [lastProtectedId]
---
You are the guard. Each night, choose one player to protect from the werewolf attack. If the wolves target the player you protect, they survive. You CANNOT protect the same player two nights in a row (including yourself).
