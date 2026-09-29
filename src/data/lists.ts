// Curated study lists (Blind 75, NeetCode 150, Grind 75, ...).
// Slugs are LeetCode title slugs and must exist in public/leetcode-catalog.json.

export type StudyListSection = { title: string; slugs: string[] };

export type StudyList = {
  id: string;
  name: string;
  /** Short label for chips, e.g. "NC150". */
  short: string;
  description: string;
  /** Who created / popularised the list. */
  source?: string;
  sections: StudyListSection[];
};

export const STUDY_LISTS: StudyList[] = [];

export function getList(id: string | undefined | null): StudyList | undefined {
  return id ? STUDY_LISTS.find((l) => l.id === id) : undefined;
}

export function listSlugs(list: StudyList): string[] {
  return list.sections.flatMap((s) => s.slugs);
}
