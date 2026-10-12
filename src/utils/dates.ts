/** "3 de octubre" style date for the day the draw was made; empty when the value is not a valid date. */
export function formatDrawDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}
