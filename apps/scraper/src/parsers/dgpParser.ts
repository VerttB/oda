import * as cheerio from 'cheerio';

export const cleanText = (text: string): string => {
  return text?.replace(/\s+/g, ' ').trim() || '';
};

export const getAdjacentField = ($: cheerio.CheerioAPI, labelPattern: string | RegExp): string => {
  const labels = $('label').toArray();
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
  tipoRelacao: 'SEDE' | 'PARCEIRA';
  unidade?: string | null;
};

const normalizeText = (text: string): string => (
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const hasPartnerInstitutionContext = (text: string): boolean => {
  const normalized = normalizeText(text);
  return normalized.includes('instituic') && normalized.includes('parceir');
};

const addInstitutionRelation = (
  target: InstituicaoGrupoRelacao[],
  input: InstituicaoGrupoRelacao,
) => {
  const nome = cleanText(input.nome);
  if (!nome || nome === 'N/A') return;

  const unidade = input.unidade ? cleanText(input.unidade) : null;
  const key = `${input.tipoRelacao}|${normalizeText(nome)}|${normalizeText(unidade || '')}`;
  const exists = target.some(
    (item) => `${item.tipoRelacao}|${normalizeText(item.nome)}|${normalizeText(item.unidade || '')}` === key,
  );

  if (!exists) {
    target.push({ nome, tipoRelacao: input.tipoRelacao, unidade });
  }
};

const getElementContextText = ($: cheerio.CheerioAPI, element: any): string => {
  const current = $(element);
  const headings = current.prevAll('h1, h2, h3, h4, h5, legend, label, .control-label').slice(0, 3).text();
  const parentHeadings = current.parent().prevAll('h1, h2, h3, h4, h5, legend, label, .control-label').slice(0, 3).text();
  const containerText = current.closest('[id], .control-group, .controls, fieldset, section, div').first().text();
  return cleanText(`${headings} ${parentHeadings} ${containerText}`);
};

const extractPartnerInstitutions = ($: cheerio.CheerioAPI): InstituicaoGrupoRelacao[] => {
  const parceiros: InstituicaoGrupoRelacao[] = [];

  $('table').each((_, table) => {
    const contextText = getElementContextText($, table);
    if (!hasPartnerInstitutionContext(contextText)) return;

    const headers = $(table).find('thead th, tr:first-child th, tr:first-child td')
      .map((__, th) => normalizeText(cleanText($(th).text())))
      .get();
    const instituicaoIndex = headers.findIndex((header) => header.includes('instituic'));
    const unidadeIndex = headers.findIndex((header) => header.includes('unidade'));

    $(table).find('tbody tr, tr').each((__, tr) => {
      const cells = $(tr).find('td');
      if (!cells.length || $(tr).find('th').length) return;

      const nomeCellIndex = instituicaoIndex >= 0 ? instituicaoIndex : 0;
      const unidadeCellIndex = unidadeIndex >= 0 ? unidadeIndex : 1;
      const nome = cleanText($(cells[nomeCellIndex]).text());
      const unidade = cells.length > unidadeCellIndex ? cleanText($(cells[unidadeCellIndex]).text()) : null;

      addInstitutionRelation(parceiros, {
        nome,
        tipoRelacao: 'PARCEIRA',
        unidade,
      });
    });
  });

  $('[id*="parceir"], [class*="parceir"]').each((_, container) => {
    const contextText = getElementContextText($, container);
    if (!hasPartnerInstitutionContext(contextText)) return;

    $(container).find('li').each((__, li) => {
      addInstitutionRelation(parceiros, {
        nome: cleanText($(li).text()),
        tipoRelacao: 'PARCEIRA',
      });
    });
  });

  return parceiros;
};

export class DGPExtractor {
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
  extractGroupMirror(html: string, linesMap: Map<string, ReturnType<typeof this.extractLineDetails>>, rhDetailsMap: Map<string, ReturnType<typeof this.extractRHDetails>>) {
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
      unidade: data.unidade,
    });
    for (const instituicao of extractPartnerInstitutions($)) {
      addInstitutionRelation(data.instituicoes, instituicao);
    }
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
    // Linhas
    // let lineIdx = 0;
    // $('#linhaPesquisa tbody tr').each((_, tr) => {
    //    const tds = $(tr).find('td');
    //    if (tds.length > 0 && !$(tds[0]).attr('colspan')) {
    //        const title = cleanText($(tds[0]).text());
    //        const popupHtml = linesPopups[lineIdx] || '';
    //        data.linhas.push(this.extractLineDetails(popupHtml, title));
    //        lineIdx++;
    //    }
    // });

    return data;
  }
}
