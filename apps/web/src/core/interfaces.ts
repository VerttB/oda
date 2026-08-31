export type TabType = 
  | 'directory' 
  | 'researchers' 
  | 'productions' 
  | 'docs' 
  | 'discover' 
  | 'groups' 
  | 'publications' 
  | 'institutions';

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
  field: string;
  publicationDate: string;
  journal?: string;
  doi?: string;
  pdfUrl?: string;
}

export interface DirectoryGroupItem {
  id: string;
  name: string;
  institution: string;
  knowledgeArea: string;
  status: 'Active' | 'Archived';
  uf: string;
  since: string;
  membersCount?: number;
  leaders?: string[];
  description?: string;
  linesOfResearch?: string[];
}

export interface ResearcherItem {
  id: string;
  name: string;
  institution: string;
  uf?: string;
  degree?: string;
  title?: string;
  department?: string;
  yearIndexed?: string;
  isPQFellow?: boolean;
  bolsaProdutividade?: string;
  isActive?: boolean;
  avatar?: string;
  avatarUrl?: string;
  initials?: string;
  citationsCount: number;
  hIndex: number;
  productionsCount?: number;
  lattesId: string;
  primaryArea?: string;
  field?: string;
  bio?: string;
  groups?: string[];
}

export interface ProductionItem {
  id: string;
  title: string;
  authors: string[] | string;
  venue?: string;
  journalOrConference?: string;
  year: number | string;
  qualis?: string;
  type: string;
  openAccess?: boolean;
  isOpenAccess?: boolean;
  citations?: number;
  doi?: string;
  url?: string;
  abstract?: string;
  groupName?: string;
  institution?: string;
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

