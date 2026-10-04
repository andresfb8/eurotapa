import { Member, Team } from '../types/contest';
import { teamLabel } from './teams';

/**
 * Generates an elegant WhatsApp-friendly message with the tasting schedule.
 * Contains ONLY team names and time slots (no dish spoilers, keeping tapas secret!).
 */
export function formatTastingScheduleForWhatsApp(
  title: string,
  teams: Team[],
  members: Member[]
): string {
  const sorted = [...teams].sort((a, b) => a.tastingOrder - b.tastingOrder);

  let message = `🏆 *${title.toUpperCase()} — ORDEN DE COCINA* 🏆\n\n`;
  message += `¡Aquí tenéis los turnos oficiales para organizar los tiempos en la cocina!\n`;
  message += `_Recordad que las tapas son secretas hasta el momento de la cata._\n\n`;

  sorted.forEach((team, index) => {
    const timeStr = team.tastingTime ? ` [${team.tastingTime}]` : '';
    message += `*#${index + 1}* Equipo: *${teamLabel(team, members)}*${timeStr}\n`;
  });

  message += `\nEntrad a vuestro portal con vuestro PIN personal para preparar la ficha secreta de vuestro plato.`;
  message += `\n✨ _¡A los fogones y buena suerte!_ ✨`;
  return message;
}

/** Reminder for members who have not sealed their vote yet, ready to paste in the group chat. */
export function formatVotingReminder(
  title: string,
  pendingNames: string[],
  accessUrl: string
): string {
  let message = `⏳ *${title.toUpperCase()} — RECORDATORIO DE VOTACIÓN* ⏳\n\n`;

  if (pendingNames.length === 0) {
    message += `¡Todos los votos están sellados! Nos vemos en la Gran Gala.`;
    return message;
  }

  message += `Aún faltan ${pendingNames.length} voto${pendingNames.length === 1 ? '' : 's'} por sellar:\n`;
  pendingNames.forEach((name) => {
    message += `• ${name}\n`;
  });
  message += `\nEntrad a vuestro portal con vuestro PIN y repartid vuestros puntos:`;
  message += `\n${accessUrl}`;
  return message;
}
