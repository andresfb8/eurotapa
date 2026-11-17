import { Member, Team } from '../types/contest';
import { teamLabel } from './teams';

/**
 * Ready-to-send private message for one participant: who it is for, the code they have to type and
 * the link that opens the contest. The organizer copies this from the panel and pastes it in
 * WhatsApp, so nobody has to guess their PIN.
 */
export function formatParticipantAccessMessage(
  title: string,
  memberName: string,
  pin: string,
  accessUrl: string
): string {
  let message = `🏆 *${title.toUpperCase()}* 🏆\n\n`;
  message += `Hola ${memberName}: ya está abierto tu espacio del concurso.\n\n`;
  message += `🔑 Tu código personal es *${pin}*\n\n`;
  message += `👉 Abre este enlace y escribe tu código:\n${accessUrl}\n\n`;
  message += `Guárdate este mensaje: el código es tuyo y sirve para entrar desde cualquier móvil.`;
  return message;
}

/** The same message in a single list, to copy every access at once. */
export function formatAllAccessMessages(
  title: string,
  members: { name: string; pin: string }[],
  linkFor: (pin: string) => string
): string {
  const blocks = members.map(
    (member) => `${member.name} — código *${member.pin}*\n${linkFor(member.pin)}`
  );
  let message = `🏆 *${title.toUpperCase()}* — ACCESOS PERSONALES\n\n`;
  message += `Cada persona entra con su código en su propio enlace:\n\n`;
  message += blocks.join('\n\n');
  message += `\n\nNo compartas el código de otra persona: es su voto.`;
  return message;
}

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

  message += `\nEntrad con vuestro enlace personal para preparar la ficha secreta de vuestra tapa. El día del concurso votaréis desde ahí.`;
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
  message += `\nEntra en el concurso con tu código personal y sella tu voto antes de que empiece la gala:`;
  message += `\n${accessUrl}`;
  return message;
}
