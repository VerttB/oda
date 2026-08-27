export type TabType = 'discover' | 'groups' | 'publications' | 'institutions' | 'docs';

export interface Author {
  id: string;
  name: string;
  role: string;
  avatar: string;
  institution?: string;
  citationsCount?: number;
}

export interface ResearchArticle {
  id: string;
  title: string;
  abstract: string;
  tags: string[];
  author: Author;
  citations: number;
  field: 'Computer Science' | 'Biology' | 'Physics' | 'Medicine' | 'Cognitive Science';
  publicationDate: string;
  journal?: string;
  doi?: string;
  pdfUrl?: string;
}

export interface ResearchGroupSummary {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  icon: 'biotech' | 'public' | 'psychology' | 'hub' | 'code' | 'cpu';
}

export interface ResearchLine {
  title: string;
  isMainFocus: boolean;
  area: string;
  description: string;
  keywords: string[];
  applicationSectors: string[];
}

export interface ResearchGroupDetail {
  id: string;
  name: string;
  primaryArea: string;
  secondaryTag: string;
  description: string;
  stats: {
    members: number;
    publications: number;
    projects: number;
    formationYear: number;
    location: string;
  };
  coverImage: string;
  institutionalAffiliation: {
    hostInstitution: {
      name: string;
      code: string;
    };
    partnerInstitutions: {
      name: string;
      code: string;
    }[];
  };
  contactInfo: {
    website: string;
    email: string;
    socialHandle: string;
  };
  researchLines: ResearchLine[];
  leaders: Author[];
  members: Author[];
}

export interface ResearcherProfile {
  id: string;
  name: string;
  role: string;
  institution: string;
  avatar: string;
  stats: {
    hIndex: number;
    citations: string;
    publications: number;
    yearsActive: number;
  };
  interests: string[];
  affiliatedGroups: {
    id: string;
    name: string;
    role: string;
    iconType: 'ai' | 'linguistics' | 'cognitive';
  }[];
  selectedPublications: {
    id: string;
    title: string;
    authors: string;
    journal: string;
    year: number;
    citations: number;
    pdfAvailable: boolean;
  }[];
}

export interface FilterState {
  fieldsOfStudy: string[];
  publicationDate: string;
  searchQuery: string;
}
