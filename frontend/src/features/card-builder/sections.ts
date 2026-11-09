import type { SectionDefinition } from '../../shared/types';

export function leafSections(sections: SectionDefinition[]) {
  return sections.filter((section) => Boolean(section.parent_key));
}

export function resolveSection(sections: SectionDefinition[], selected: string) {
  const section =
    sections.find((section) => section.key === selected) ??
    sections.find((section) => !section.parent_key);
  return sections.find((child) => child.parent_key === section?.key) ?? section;
}
