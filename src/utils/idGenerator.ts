export function normalizeSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function normalizeUniversitySlug(name: string): string {
  const noise = ['the', 'university', 'of', 'college', 'school', 'institute', 'institution'];
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(w => !noise.includes(w))
    .join('_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/^_|_$/g, '') || normalizeSlug(name);
}

export function generateCompositeId(
  universityName: string,
  intake: string,
  aggregator: string,
  studyLevel: string
): string {
  return `${normalizeUniversitySlug(universityName)}__${normalizeSlug(intake)}__${normalizeSlug(aggregator)}__${studyLevel}`;
}
