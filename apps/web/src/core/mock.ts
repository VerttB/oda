import { type ResearchArticle,type ResearchGroupSummary,type ResearchGroupDetail, type ResearcherProfile } from './interfaces';

export const MOCK_ARTICLES: ResearchArticle[] = [
  {
    id: 'art-1',
    title: 'Algorithmic Bias in Predictive Policing Models',
    abstract: 'A comprehensive review of algorithmic fairness in predictive policing, analyzing datasets from major metropolitan areas to identify systemic biases and propose mitigation strategies.',
    tags: ['AI Ethics', 'Peer Reviewed'],
    author: {
      id: 'author-e-vance',
      name: 'Dr. E. Vance',
      role: 'Associate Professor',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCqdZWXLizGJ7j01uVQH5eJoklhisTp4ZNR6vy_oQX6G7vFN9wAsZ9_cTh6wQUo5sK6MszCxDK1Q3N1Q4q1xHqdWoW1F4O3i0cCUXHTdFAwuYN60wNw8PBvWHIA6q0dup9N1DxYcUKVN4bhfntto2rBhUc4KyP4hv51w2yCB0pWLjwhd4snfhQYq-XMu6wUW-B1am2n1aVmOOXWo21DIvVWmKnYKk7ljXdxo54vS-7utKozgHgX9vdj',
      institution: 'Stanford University'
    },
    citations: 142,
    field: 'Computer Science',
    publicationDate: '2024-01-15',
    journal: 'Journal of Artificial Intelligence Ethics, Vol. 8',
    doi: '10.1016/j.aie.2024.01.004'
  },
  {
    id: 'art-2',
    title: 'Topological Qubits at Room Temperature',
    abstract: 'We present experimental evidence of topological stabilization of qubits operating near room temperature using a novel graphene-based lattice structure.',
    tags: ['Quantum Computing', 'Open Access'],
    author: {
      id: 'author-chen-et-al',
      name: 'A. Chen et al.',
      role: 'Principal Researcher',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5aD6SOQZyNjCAEoRHlUQJTZgJsxaUNrzBJ3iuhYmzKyEozN0o27js-MQp_pCY4JXER1GT3NdZexVs7isXI6zOSC5Apmahhs0zja4C1V-DBAN576-MaHUpaucznBowurCvatygJmq-9b2koqikZrZvIbQwXLcXHPZwDD46QZ4hA-JVKALnK1feggoxZDQfdC1eR-rO-psFEFocWoG9iUSQNG4Wjf2kfatDpAZ_P8Wlid0yv8EHZCAO',
      institution: 'Max Planck Institute'
    },
    citations: 89,
    field: 'Physics',
    publicationDate: '2023-11-20',
    journal: 'Nature Quantum Information, 34(4)',
    doi: '10.1038/s41534-023-00789-2'
  },
  {
    id: 'art-3',
    title: 'Synthetic Biology Circuits for Targeted Oncology Delivery',
    abstract: 'Engineered cellular logic gates implemented within synthetic bacterial strains demonstrate high selectivity in tumor microenvironment sensing and payload release.',
    tags: ['Synthetic Biology', 'Preprint'],
    author: {
      id: 'author-sarah-jenkins',
      name: 'Dr. Sarah Jenkins',
      role: 'Postdoctoral Fellow',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTByR863c-ADuvSMo4teqCnL1UkHT0_MEdoEdQUkIYKv8TGUYkkVl3zS9LrWdn6wa6CPLbWEWg6k97YEo79CEN-8topeFBiqZcow433A8GUr1og6TX0EOrG5yyyLRlK26xt_b1NjXR8IC3L3QF5cy-FnhQRIo7BgQzWq5sy5S2FvoOwKrLmx44Y_sWiyD5GoJLHWBZ2-FQ4-h5fRzEj5onL06VoG1tMA5W1ATznK8DNkfvlMabIen6',
      institution: 'MIT Synthetic Biology Center'
    },
    citations: 64,
    field: 'Biology',
    publicationDate: '2023-09-12',
    journal: 'Cellular & Molecular Bioengineering',
    doi: '10.1007/s12195-023-00774-1'
  },
  {
    id: 'art-4',
    title: 'High-Resolution Neural Decoding via Low-Power Edge Accelerators',
    abstract: 'A quantized Transformer architecture implemented on custom ASICs achieving real-time invasive motor cortex decoding with sub-5ms latency and milliwatt power consumption.',
    tags: ['Neuroengineering', 'Peer Reviewed'],
    author: {
      id: 'author-elena-rostova',
      name: 'Dr. Elena Rostova',
      role: 'Professor of Computational Linguistics',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB68LF8ioTigmnBpzASI-EXJ7TAw7CzhmDjvT-M9cQIe7M4wgE55AlT-QTN8DVyyk0fD8PZOmDKUiE4etvoFu-hgemc52e20MXlvSKN7oARbxAKS3MwyJuDtIvw1GNGFFtTng7G_cDhnXV1nQv5UF81daM-LgYLa-UQxima0x0ZgocLbPEY0iieJcqJbBoyMI-5dm3BgnsMkfEgPPfkSSfanDdZaK0RBj9gcVGMvxm8fGajOmieKp7n',
      institution: 'Massachusetts Institute of Technology'
    },
    citations: 215,
    field: 'Medicine',
    publicationDate: '2024-02-01',
    journal: 'IEEE Transactions on Biomedical Circuits and Systems',
    doi: '10.1109/TBCAS.2024.3359012'
  }
];

export const MOCK_RESEARCH_GROUPS: ResearchGroupSummary[] = [
  {
    id: 'grp-synbio',
    name: 'SynBio Initiative',
    description: 'Advancing synthetic biology through open-source genetic circuits.',
    membersCount: 1200,
    icon: 'biotech'
  },
  {
    id: 'grp-climate',
    name: 'Climate Data Lab',
    description: 'Analyzing global climate datasets for predictive modeling.',
    membersCount: 3450,
    icon: 'public'
  },
  {
    id: 'grp-cognitive',
    name: 'Cognitive Systems',
    description: 'Intersection of neuroscience and artificial neural networks.',
    membersCount: 890,
    icon: 'psychology'
  }
];

export const MOCK_GROUP_DETAIL: ResearchGroupDetail = {
  id: 'DGP-44521',
  name: 'Sistemas de Aprendizado de Máquina Avançados',
  primaryArea: 'Inteligência Artificial Generativa',
  secondaryTag: 'Grupo de Pesquisa',
  description: 'Desenvolvendo arquiteturas neurais escaláveis para linguagens de baixos recursos. Focamos em reduzir a lacuna entre modelos de parâmetros massivos e sistemas eficientes implantáveis em borda sem comprometer a integridade inferencial.',
  stats: {
    members: 24,
    publications: 156,
    projects: 12,
    formationYear: 2018,
    location: 'São Paulo, SP'
  },
  coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-hih7Y5m3lR7ii9XZ7ORR3nmbpfenb7637uRlUXHFMvMp1DiysgMQwfKuuTLvphNOAocLubArhhnjbZWUqugqV04GYkfne-NlVqoM9Siw6Wb4d8MVR74aN9L2rNafs9iuWLZCcb1P-u-I0a-I7uZPWVsuUsb4bJx9y4OBpi-RNhKu1heYexXIfcMXS7p80ejiTq76xVUuLDowAg9Ijk_mSLlPORehK_kBZM-4vXs8UPugvCrxcaRf',
  institutionalAffiliation: {
    hostInstitution: {
      name: 'Universidade de São Paulo',
      code: 'USP'
    },
    partnerInstitutions: [
      { name: 'FAPESP', code: 'FAPESP' },
      { name: 'CNPq', code: 'CNPq' },
      { name: 'CGI.br', code: 'CGI.br' },
      { name: 'CAPES', code: 'CAPES' }
    ]
  },
  contactInfo: {
    website: 'https://oda-platform.org/groups/sistemas-ml',
    email: 'email@oda-platform.org',
    socialHandle: '@oda_research'
  },
  researchLines: [
    {
      title: 'Otimização de LLM',
      isMainFocus: true,
      area: 'Inteligência Artificial',
      description: 'Investigando novas técnicas de poda, quantização e destilação de conhecimento para implantar modelos de linguagem em hardware restrito.',
      keywords: ['Quantização', 'Poda', 'Destilação', 'Eficiência'],
      applicationSectors: [
        'Saúde Digital',
        'Automação Industrial',
        'Processamento de Linguagem Natural'
      ]
    },
    {
      title: 'Modelos Fundacionais para Bioinformática',
      isMainFocus: false,
      area: 'Ciência da Computação & Bioinformática',
      description: 'Modelos de difusão geométrica aplicados ao enovelamento tridimensional de proteínas e triagem virtual de candidatos a fármacos.',
      keywords: ['Difusão Geométrica', 'Enovelamento', 'Docking', 'Transformers'],
      applicationSectors: [
        'Desenvolvimento Farmacêutico',
        'Biotecnologia Médica'
      ]
    }
  ],
  leaders: [
    {
      id: 'author-elena-rostova',
      name: 'Dr. Elena Rostova',
      role: 'Investigadora Principal',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB68LF8ioTigmnBpzASI-EXJ7TAw7CzhmDjvT-M9cQIe7M4wgE55AlT-QTN8DVyyk0fD8PZOmDKUiE4etvoFu-hgemc52e20MXlvSKN7oARbxAKS3MwyJuDtIvw1GNGFFtTng7G_cDhnXV1nQv5UF81daM-LgYLa-UQxima0x0ZgocLbPEY0iieJcqJbBoyMI-5dm3BgnsMkfEgPPfkSSfanDdZaK0RBj9gcVGMvxm8fGajOmieKp7n',
      institution: 'USP / MIT'
    }
  ],
  members: [
    {
      id: 'author-elena-rostova',
      name: 'Dr. Elena Rostova',
      role: 'Principal Investigator',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB68LF8ioTigmnBpzASI-EXJ7TAw7CzhmDjvT-M9cQIe7M4wgE55AlT-QTN8DVyyk0fD8PZOmDKUiE4etvoFu-hgemc52e20MXlvSKN7oARbxAKS3MwyJuDtIvw1GNGFFtTng7G_cDhnXV1nQv5UF81daM-LgYLa-UQxima0x0ZgocLbPEY0iieJcqJbBoyMI-5dm3BgnsMkfEgPPfkSSfanDdZaK0RBj9gcVGMvxm8fGajOmieKp7n'
    },
    {
      id: 'author-james-chen',
      name: 'James Chen, Ph.D.',
      role: 'Senior Researcher',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJUBWwPjnNLomIG6njYbqkjl-Txrctart6PloNRzk9HzAT8F2Yb4d4kWK435R69FRrrBY93inUDNcBj0WfEkDkzi0byU98zFNbBmHx-sTA1m1Fos66ZjQcXhsbr0-mTGN7Abf5guufGUx-xzD1Jvwpgp6CyaplpI4F_jUHL7S7p4R_jfTqmYvze7t7V3gtwlfs7HdunsFeq8Sv6WkMtcTV5GC-srUNmN8cGP4pXhu-qOLYCgv_tonb'
    },
    {
      id: 'author-sarah-jenkins',
      name: 'Sarah Jenkins',
      role: 'Postdoctoral Fellow',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTByR863c-ADuvSMo4teqCnL1UkHT0_MEdoEdQUkIYKv8TGUYkkVl3zS9LrWdn6wa6CPLbWEWg6k97YEo79CEN-8topeFBiqZcow433A8GUr1og6TX0EOrG5yyyLRlK26xt_b1NjXR8IC3L3QF5cy-FnhQRIo7BgQzWq5sy5S2FvoOwKrLmx44Y_sWiyD5GoJLHWBZ2-FQ4-h5fRzEj5onL06VoG1tMA5W1ATznK8DNkfvlMabIen6'
    },
    {
      id: 'author-marcus-vance',
      name: 'Dr. Marcus Vance',
      role: 'Core Faculty',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANPghv5awnbZftG9RhS0TxOIR8-RXf0NJ1nY4vYf4c0FItQH9SKc2MGkKLL0vsBhNfI_ghuejP1-JYz4PkSixSfszBYWzFXS0YrW50SPfa4wj2Kuexxx-GEc1Lssi6cd0nVNENZSxfFaNfdJZGRqFR0WRsFHtKdCdW5JFSHlPcN6qHyhkWTqicRXhlvZgYshsbBTr0zOypf1azAmrEZolW1vLJzQxi7StWrsNrJWFwkNzwxA-1ynjh'
    }
  ]
};

export const MOCK_RESEARCHER_PROFILE: ResearcherProfile = {
  id: 'author-elena-rostova',
  name: 'Dr. Elena Rostova',
  role: 'Professor of Computational Linguistics',
  institution: 'Massachusetts Institute of Technology',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxhK2xo8sIbQ52tVy7iuOxgoO0WuUHo5m8dQvLddi_HzWp6uEeP1PE7Th7zZL2532tNZPm0Snt4n13v5eq491Yw_dVHyI7559GJjIPUCtpvnbErH2isocIMOUfFGBdLouZ2o9v4_p33kSNGLrwgV1wwJSU2yDjWqlEup0ctXmQnj2rpJifydRrwWbY0glnPGViUnVEuY6ltpom1-EWOscX_BAwwTpAy2cYvt-icDYf-yv0g3sbItpK',
  stats: {
    hIndex: 42,
    citations: '12.4k',
    publications: 156,
    yearsActive: 18
  },
  interests: [
    'NLP',
    'Machine Learning',
    'Syntax',
    'Semantics',
    'Cognitive Science',
    'Graph Neural Networks'
  ],
  affiliatedGroups: [
    {
      id: 'grp-1',
      name: 'Advanced Machine Learning Systems',
      role: 'Principal Investigator',
      iconType: 'ai'
    },
    {
      id: 'grp-2',
      name: 'MIT NLP Lab',
      role: 'Senior Member',
      iconType: 'linguistics'
    },
    {
      id: 'grp-3',
      name: 'Cognitive Computing Initiative',
      role: 'Core Faculty',
      iconType: 'cognitive'
    }
  ],
  selectedPublications: [
    {
      id: 'pub-1',
      title: 'Emergent Syntactic Structures in Large Language Models',
      authors: 'Rostova, E., Chen, J., & Smith, A.',
      journal: 'Journal of Computational Linguistics, 49(2), 345-380.',
      year: 2023,
      citations: 412,
      pdfAvailable: true
    },
    {
      id: 'pub-2',
      title: 'Graph-Based Semantic Parsing for Low-Resource Languages',
      authors: 'Rostova, E., & Kumar, V.',
      journal: 'Proceedings of ACL 2022, 1102-1115.',
      year: 2022,
      citations: 289,
      pdfAvailable: true
    },
    {
      id: 'pub-3',
      title: 'Rethinking Attention Mechanisms in Cognitive Modeling',
      authors: 'Davis, M., Rostova, E., & Lee, S.',
      journal: 'Cognitive Science, 45(8), e13042.',
      year: 2021,
      citations: 156,
      pdfAvailable: false
    }
  ]
};
