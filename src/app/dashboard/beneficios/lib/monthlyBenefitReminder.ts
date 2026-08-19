export const checkMonthlyBenefitReminder = (
  currentDay: number,
  reminderDay: number,
  hasPending: boolean
) => {
  if (currentDay < reminderDay) {
    return { shouldNotify: false, reason: "Dia configurado ainda não chegou" };
  }
  
  if (currentDay >= reminderDay && hasPending) {
    return { shouldNotify: true, reason: "Dia configurado chegou e há pendências" };
  }
  
  return { shouldNotify: false, reason: "Dia configurado chegou e não há pendências" };
};
