export const SOLEMN_OCCASIONS = new Set(['Funeral']);

export function counterLabel(occasion, count) {
  const solemn = SOLEMN_OCCASIONS.has(occasion);

  if (count === 0) {
    return solemn ? 'Be the first to share a memory' : 'Be the first to leave a message';
  }

  if (solemn) {
    return `${count} ${count === 1 ? 'memory' : 'memories'} shared`;
  }
  return `${count} ${count === 1 ? 'message' : 'messages'} and counting`;
}
