import * as cheerio from 'cheerio';

export const cleanText = (text: string): string => {
  return text?.replace(/\s+/g, ' ').trim() || '';
};

const byId = (id: string): string => `[id="${id.replace(/"/g, '\\"')}"]`;

export const getAdjacentField = ($: cheerio.CheerioAPI, labelPattern: string | RegExp, section?: string): string => {
  const sectionSelector = section ? byId(section) : null;
  const labelsToLook = sectionSelector
    ? `${sectionSelector} label, ${sectionSelector} ~ label, ${sectionSelector} ~ * label`
    : 'label';
  const labels = $(labelsToLook).toArray();
  for (const label of labels) {
    const text = $(label).text();
    if (typeof labelPattern === 'string' ? text.includes(labelPattern) : labelPattern.test(text)) {
      const nextDiv = $(label).next('div.controls');
      if (nextDiv.length) {
        return cleanText(nextDiv.text());
      }
    }
  }
  return '';
};

type InstituicaoGrupoRelacao = {
  nome: string;
  sigla?: string | null;
  uf?: string | null;
  tipoRelacao: 'SEDE' | 'PARCEIRA';
  unidade?: string | {
    nome?: string | null;
    uf?: string | null;
  } | null;
};

const normalizeText = (text: string): string => (
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);


const addInstitutionRelation = (
  target: InstituicaoGrupoRelacao[],
  input: InstituicaoGrupoRelacao,
) => {
  const nome = cleanText(input.nome);
  if (!nome || nome === 'N/A') return;

  const unidade = typeof input.unidade === 'string'
    ? { nome: cleanText(input.unidade), uf: null }
    : {
        nome: input.unidade?.nome ? cleanText(input.unidade.nome) : null,
        uf: input.unidade?.uf ? cleanText(input.unidade.uf) : null,
      };
  const unidadeNome = unidade.nome || null;
  const unidadeUf = unidade.uf || null;
  const uf = input.uf ? cleanText(input.uf) : null;
  const key = `${input.tipoRelacao}|${normalizeText(nome)}|${normalizeText(uf || '')}|${normalizeText(unidadeNome || '')}|${normalizeText(unidadeUf || '')}`;
  const exists = target.some(
    (item) => {
      const itemUnidade = typeof item.unidade === 'string'
        ? { nome: item.unidade, uf: null }
        : item.unidade;
      return `${item.tipoRelacao}|${normalizeText(item.nome)}|${normalizeText(item.uf || '')}|${normalizeText(itemUnidade?.nome || '')}|${normalizeText(itemUnidade?.uf || '')}` === key;
    },
  );

  if (!exists) {
    target.push({
      nome,
      sigla: input.sigla ? cleanText(input.sigla) : null,
      uf,
      tipoRelacao: input.tipoRelacao,
      unidade: unidadeNome || unidadeUf ? { nome: unidadeNome, uf: unidadeUf } : null,
    });
  }
};


export class DGPExtractor {
  extractPartnerInstitutions(html: string){
    const $ = cheerio.load(html);
    let details = {
      nome: "",
      sigla: "",
      uf: "",
      unidade: {
        nome: "",
        uf: ""
      }
    };
    details.nome = getAdjacentField($, /Nome Fantasia:/)
    details.sigla = getAdjacentField($, /Sigla:/)
    details.uf = getAdjacentField($, /UF:/)
    details.unidade.nome = getAdjacentField($, /Unidade:/, 'idFormVisualizarParceira:painelUnidade')
    details.unidade.uf = getAdjacentField($, /UF:/, 'idFormVisualizarParceira:painelUnidade')


    return details;
  }
  /**
   * Extrai detalhes de um único Pesquisador (Pesquisador/Estudante)
   */
  extractRHDetails(html: string) {
    const $ = cheerio.load(html);
    const details = {
      lattes: '',
      areas: [] as string[],
      grupos: [] as string[],
      linhas: [] as string[],
    };

    const lattesMatch = html.match(/espelhorh\/(\d{16})/);
    if (lattesMatch) details.lattes = lattesMatch[1];

    const areasLabel = $('label').filter((_, el) => /Áreas de atuação:/.test($(el).text()));
    if (areasLabel.length) {
      areasLabel.next('div.controls').find('li').each((_, li) => {
        details.areas.push(cleanText($(li).text()));
      });
    }

    $('tbody[id*="tblEspelhoRHGPAtuacao_data"] tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 2 && !$(tds[0]).attr('colspan')) {
        details.grupos.push(cleanText($(tds[0]).text()));
      }
    });

    $('tbody[id*="tblEspelhoRHLPAtuacao_data"] tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 2 && !$(tds[0]).attr('colspan')) {
        details.linhas.push(cleanText($(tds[0]).text()));
      }
    });

    return details;
  }

  /**
   * Extrai detalhes de uma Linha de Pesquisa
   */
  extractLineDetails(html: string, expectedTitle: string) {
    const $ = cheerio.load(html);
    const line = {
      idDgp: "",
      nome: expectedTitle,
      objetivo: 'Não Identificado',
      areasConhecimento: [] as string[],
      palavrasChave: [] as string[],
      setoresAplicacao: [] as string[],
    };

    const idMatch = html.match(/espelholinha\/(\d{16})/);
    if (idMatch) {
      line.idDgp = idMatch[1];
    } else {
      const hiddenId = $('input[id*="idGrupoPesquisa"], input[name*="idGrupoPesquisa"]').val();
      if (hiddenId && typeof hiddenId === 'string' && /\d{16}/.test(hiddenId)) {
        line.idDgp = hiddenId;
      }
    }

    const container = $('#linhaPesquisa');
    if (container.length) {
      const objLabel = container.find('label.control-label').first()
      if (objLabel.length) {
        line.objetivo = cleanText(objLabel.next('div.controls').text());
      }
    }

    const sections = {
      palavraChave: 'palavrasChave',
      areaConhecimento: 'areasConhecimento',
      setorAplicacao: 'setoresAplicacao',
    } as const;

    for (const [id, target] of Object.entries(sections)) {
      $(`#${id} li`).each((_, li) => {
        const text = cleanText($(li).text());
        if (text) line[target].push(text);
      });
    }

    return line;
  }

  /**
   * Consolida a extração completa do espelho do grupo
   */
  extractGroupMirror(html: string, linesMap: Map<string, ReturnType<typeof this.extractLineDetails>>, rhDetailsMap: Map<string, ReturnType<typeof this.extractRHDetails>>, instMap: Map<string, ReturnType<typeof this.extractPartnerInstitutions>>) {
    const $ = cheerio.load(html);
    const data: any = {
      idDgp: '000000',
      nome: 'N/A',
      situacao: "",
      repercussao: '',
      area: 'N/A',
      instituicao: 'N/A',
      anoFormacao: 'N/A',
      endereco: {},
      membros: [],
      linhas: [],
    };

    const idMatch = html.match(/espelhogrupo\/(\d{16})/);
    if (idMatch) {
      data.idDgp = idMatch[1];
    } else {
      const hiddenId = $('input[id*="idGrupoPesquisa"], input[name*="idGrupoPesquisa"]').val();
      if (hiddenId && typeof hiddenId === 'string' && /\d{16}/.test(hiddenId)) {
        data.idDgp = hiddenId;
      }
    }

    const h1 = $('#tituloImpressao h1');
    if (h1.length) {
      const h1Clone = h1.clone();
      h1Clone.find('div, img').remove();
      data.nome = cleanText(h1Clone.text());
    }
    data.situacao = getAdjacentField($,  /Situação do grupo/);
    data.anoFormacao = getAdjacentField($, /Ano de formação/);
    data.area = getAdjacentField($, /Área predominante/);
    data.instituicao = getAdjacentField($, /Instituição do grupo/);
    data.unidade = getAdjacentField($, /Unidade/) || null;
    data.instituicoes = [];
    addInstitutionRelation(data.instituicoes, {
      nome: data.instituicao,
      tipoRelacao: 'SEDE',
      unidade: { nome: data.unidade, uf: null },
    });
   
    data.email = getAdjacentField($, /Contato do grupo/) || null;
    const rawTelefone = getAdjacentField($, /Telefone/);
    data.telefone = rawTelefone ? rawTelefone.replace(/_$/, '').trim() : null;
    data.website = getAdjacentField($, /Website/) || null;

    const rawLat = parseFloat(getAdjacentField($, /Latitude/));
    const rawLng = parseFloat(getAdjacentField($, /Longitude/));
    data.latitude = (!isNaN(rawLat) && rawLat !== 0) ? rawLat : null;
    data.longitude = (!isNaN(rawLng) && rawLng !== 0) ? rawLng : null;

    const addr = $('#endereco');
    if (addr.length) {
      data.endereco = {
        cep: getAdjacentField($, 'CEP') || null,
        localidade: getAdjacentField($, 'Localidade') || null,
        uf: getAdjacentField($, 'UF') || null,
        bairro: getAdjacentField($, 'Bairro') || null,
        complemento: getAdjacentField($, 'Complemento') || null,
        numero: getAdjacentField($, 'Número') || null,
        logradouro: getAdjacentField($, 'Logradouro') || null,
      };
    }

    $('#repercussao p').each((_, p) => {
      if (!$(p).attr('align')) {
        data.repercussao += cleanText($(p).text()) + '\n';
      }
    });
    data.repercussao = data.repercussao.trim();

    // Líderes
    const lideresLabel = $('label').filter((_, el) => /Líder\(es\) do grupo:/.test($(el).text()));
    const lideresList: string[] = [];
    if (lideresLabel.length) {
       const controlsDiv = lideresLabel.next('div.controls').clone();
       controlsDiv.find('script, button, a, form, style, .ui-button, .ui-tooltip').remove();
       controlsDiv.text().split(/,|\n/).forEach(n => {
           const nome = cleanText(n);
           if (nome && nome.length > 2) lideresList.push(nome);
       });
    }
    data.lideres = lideresList;

    // RH (Membros)
    $('#recursosHumanos table[role="grid"]').each((_, table) => {
      const prevH4 = $(table).prev('h4').text().toLowerCase();
      if (prevH4.includes('egressos')) return;

      const headers = $(table).find('th').map((_, th) => $(th).text().toLowerCase()).get();
      if (!headers.length || headers.some(h => h.includes('período') || h.includes('periodo'))) return;

      const categoryLabel = headers[0];
      $(table).find('tbody tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length >= 2 && !$(tds[0]).attr('colspan')) {
          const nome = cleanText($(tds[0]).text());
          const formacaoTable = cleanText($(tds[1]).text());

          let categoria = 'PESQUISADOR';
          if (categoryLabel.includes('pesquisador')) {
            categoria = 'PESQUISADOR';
          } else if (categoryLabel.includes('estudante')) {
            categoria = 'ESTUDANTE';
          } else if (categoryLabel.includes('técnico') || categoryLabel.includes('tecnico')) {
            categoria = 'TECNICO';
          } else if (categoryLabel.includes('estrangeiro')) {
            categoria = 'ESTRANGEIRO';
          }

          const isLider = lideresList.some(
            l => l.trim().toLowerCase() === nome.trim().toLowerCase()
          );

          const extra = rhDetailsMap.get(nome)!;
          data.membros.push({
            nome,
            lattes: extra.lattes || '',
            formacaoAcademica: formacaoTable || '',
            categoriaLattes: categoria,
            eLider: isLider,
            areas: extra.areas || [],
            gruposAssociados: extra.grupos || [],
            linhasAssociadas: extra.linhas || [],
          });
        }
      });
    });

    linesMap.forEach((lineDetails, lineName) => {
      data.linhas.push(lineDetails);
    });
    instMap.forEach((instDetails, instName) => {
      addInstitutionRelation(data.instituicoes, {
        nome: instDetails.nome || instName,
        sigla: instDetails.sigla || null,
        uf: instDetails.uf || null,
        tipoRelacao: 'PARCEIRA',
        unidade: {
          nome: instDetails.unidade?.nome || null,
          uf: instDetails.unidade?.uf || null,
        },
      });
    })

    return data;
  }
}
