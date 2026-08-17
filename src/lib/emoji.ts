export function suggestTripEmoji(name: string): string {
  const lower = name.toLowerCase();
  
  if (lower.includes('leros') || lower.includes('island') || lower.includes('crete') || lower.includes('mykonos') || lower.includes('santorini') || lower.includes('rhodes') || lower.includes('bali') || lower.includes('ibiza') || lower.includes('capri')) {
    return '🏝️';
  }
  if (lower.includes('beach') || lower.includes('summer') || lower.includes('coast') || lower.includes('sea') || lower.includes('ocean')) {
    return '🏖️';
  }
  if (lower.includes('ski') || lower.includes('snow') || lower.includes('alps') || lower.includes('winter') || lower.includes('mountain') || lower.includes('hike') || lower.includes('trek')) {
    return '🏔️';
  }
  if (lower.includes('paris') || lower.includes('london') || lower.includes('rome') || lower.includes('tokyo') || lower.includes('berlin') || lower.includes('amsterdam') || lower.includes('barcelona') || lower.includes('madrid') || lower.includes('city') || lower.includes('istanbul')) {
    return '🌆';
  }
  if (lower.includes('road') || lower.includes('drive') || lower.includes('car') || lower.includes('trip') || lower.includes('camper') || lower.includes('van')) {
    return '🚗';
  }
  if (lower.includes('flight') || lower.includes('plane') || lower.includes('air') || lower.includes('euro') || lower.includes('asia') || lower.includes('usa')) {
    return '✈️';
  }
  if (lower.includes('camp') || lower.includes('tent') || lower.includes('forest') || lower.includes('nature') || lower.includes('lake')) {
    return '⛺';
  }
  if (lower.includes('sail') || lower.includes('boat') || lower.includes('yacht') || lower.includes('cruise')) {
    return '⛵';
  }
  if (lower.includes('food') || lower.includes('dine') || lower.includes('taste') || lower.includes('wine') || lower.includes('beer') || lower.includes('fest')) {
    return '🍷';
  }
  if (lower.includes('party') || lower.includes('bachelor') || lower.includes('bachelorette') || lower.includes('birthday') || lower.includes('celebrat')) {
    return '🎉';
  }
  if (lower.includes('cottage') || lower.includes('cabin') || lower.includes('house') || lower.includes('villa')) {
    return '🏡';
  }
  return '✈️';
}

export const POPULAR_EMOJIS = [
  '🏝️', '🏖️', '✈️', '🚗', '🏔️', '🌆', '⛺', '⛵', '🎉', '🏡',
  '🍷', '🍕', '🍻', '🛵', '🚆', '🎡', '🏰', '🗺️', '🏄‍♂️', '⛷️'
];
