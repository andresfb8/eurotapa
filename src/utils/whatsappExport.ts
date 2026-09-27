import { Participant } from '../types/contest';

/**
 * Generates an elegant WhatsApp-friendly message with the tasting schedule.
 * Contains ONLY participant names and time slots (no dish spoilers, keeping tapas secret!).
 */
export function formatTastingScheduleForWhatsApp(title: string, participants: Participant[]): string {
  const sorted = [...participants].sort((a, b) => a.tastingOrder - b.tastingOrder);

  let message = `🏆 *${title.toUpperCase()} — ORDEN DE COCINA* 🏆\n\n`;
  message += `¡Aquí tenéis los turnos oficiales para organizar los tiempos en la cocina!\n`;
  message += `_Recordad que las tapas son secretas hasta el momento de la cata._\n\n`;

  sorted.forEach((p, index) => {
    const timeStr = p.tastingTime ? ` [${p.tastingTime}]` : '';
    message += `*#${index + 1}* Chef: *${p.name}*${timeStr}\n`;
  });

  message += `\nEntrad a vuestro portal con vuestro código para preparar vuestra ficha secreta.`;
  message += `\n✨ _¡A los fogones y buena suerte!_ ✨`;
  return message;
}
