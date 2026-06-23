export interface PageGroupItemInfo {
    nome: string;
    area: string;
    instituicao: string;
    key: string;
}

export interface RequestType{
    url: string,
    userData: { chave: string, direction: string},
    uniqueKey: string
}

interface ResearcherSimple{
    lattesId: string
    nome: string
}
interface Address{
    bairro?: string,
    uf: string
    localidade: string,
    cep?: string
    lat?: number
    long?: number
}
export interface GroupType{
    id_dgp: string,
    nome: string,
    situacao: string,
    repercussao: string,
    area: string,
    instituicao: 'N/A',
    ano_formacao: number,
    endereco: Address,
    membros: ResearcherSimple,
    linhas: [],
}

export interface Formation{
    anoInicio?: string,
    anoFim?: string,
    nome?: string,
}

export interface Article{
    titulo: string,
    doi?: string,
    volume?:string,
    issn?:string,
    nomePeriodico?:string
    paginaInicial?:string
    ano?:string
}

export interface FullPaper{
    titulo: string,
    ano?:string,
    doi?:string,
}

export interface BookChapters{
    titulo: string,
    ano?:string,
    doi?:string,
    volume?: string,
    paginas?:string,
}