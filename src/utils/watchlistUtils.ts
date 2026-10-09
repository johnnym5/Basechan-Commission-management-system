const WATCHLIST_STORAGE_KEY = 'basechan_starred_schools_v1';

export const getWatchlist = (): string[] => {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const toggleWatchlist = (schoolIdOrName: string): string[] => {
  const current = getWatchlist();
  const index = current.indexOf(schoolIdOrName);
  let updated: string[];

  if (index >= 0) {
    updated = current.filter((id) => id !== schoolIdOrName);
  } else {
    updated = [...current, schoolIdOrName];
  }

  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save watchlist to localStorage:', err);
  }

  return updated;
};

export const isStarred = (watchlist: string[], schoolIdOrName: string): boolean => {
  return watchlist.includes(schoolIdOrName);
};
