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

export class DGPExtractor {
  /**
   * Extrai detalhes do Recursos Humanos (Pesquisador/Estudante)
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
      nome: expectedTitle,
      objetivo: 'Não Identificado',
      areas_conhecimento: [] as string[],
      palavras_chave: [] as string[],
      setores_aplicacao: [] as string[],
    };

    const container = $('#linhaPesquisa');
    if (container.length) {
      const objLabel = container.find('label').filter((_, el) => /Objetivo/i.test($(el).text()));
      if (objLabel.length) {
        line.objetivo = cleanText(objLabel.parent().next('div.controls').text());
      }
    }

    const sections = {
      palavraChave: 'palavras_chave',
      areaConhecimento: 'areas_conhecimento',
      setorAplicacao: 'setores_aplicacao',
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
  extractGroupMirror(html: string, linesPopups: string[], rhDetailsMap: Map<string, any>) {
    const $ = cheerio.load(html);
    const data: any = {
      id_dgp: '000000',
      nome: 'N/A',
      situacao: "",
      repercussao: '',
      area: 'N/A',
      instituicao: 'N/A',
      ano_formacao: 'N/A',
      endereco: {},
      membros: [],
      linhas: [],
    };

    const idMatch = html.match(/espelhogrupo\/(\d{16})/);
    if (idMatch) {
      data.id_dgp = idMatch[1];
    } else {
      const hiddenId = $('input[id*="idGrupoPesquisa"], input[name*="idGrupoPesquisa"]').val();
      if (hiddenId && typeof hiddenId === 'string' && /\d{16}/.test(hiddenId)) {
        data.id_dgp = hiddenId;
      }
    }

    const h1 = $('#tituloImpressao h1');
    if (h1.length) {
      const h1Clone = h1.clone();
      h1Clone.find('div, img').remove();
      data.nome = cleanText(h1Clone.text());
    }
    data.situacao = getAdjacentField($,  /Situação do grupo/)
    data.ano_formacao = getAdjacentField($, /Ano de formação/);
    data.area = getAdjacentField($, /Área predominante/);
    data.instituicao = getAdjacentField($, /Instituição do grupo/);

    const addr = $('#endereco');
    if (addr.length) {
      data.endereco = {
        cep: getAdjacentField($, 'CEP'),
        localidade: getAdjacentField($, 'Localidade'),
        uf: getAdjacentField($, 'UF'),
        bairro: getAdjacentField($, 'Bairro'),
        complemento: getAdjacentField($, 'Complemento'),
        numero: getAdjacentField($, 'Número'),
        logradouro: getAdjacentField($, 'Logradouro'),
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
       lideresLabel.next('div.controls').text().split(',').forEach(n => {
           const nome = cleanText(n);
           if (nome) lideresList.push(nome);
       });
    }

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
            categoria = lideresList.includes(nome) ? 'LIDER' : 'PESQUISADOR';
          } else if (categoryLabel.includes('estudante')) {
            categoria = 'ESTUDANTE';
          } else if (categoryLabel.includes('técnico') || categoryLabel.includes('tecnico')) {
            categoria = 'TECNICO';
          } else if (categoryLabel.includes('estrangeiro')) {
            categoria = 'ESTRANGEIRO';
          }

          const extra = rhDetailsMap.get(nome) || {};
          data.membros.push({
            nome,
            lattes: extra.lattes || '',
            formacao_academica: formacaoTable || extra.titulacao || '',
            categoria_lattes: categoria,
            areas: extra.areas || [],
            grupos_associados: extra.grupos || [],
            linhas_associadas: extra.linhas || [],
          });
        }
      });
    });

    // Linhas
    let lineIdx = 0;
    $('#linhaPesquisa tbody tr').each((_, tr) => {
       const tds = $(tr).find('td');
       if (tds.length > 0 && !$(tds[0]).attr('colspan')) {
           const title = cleanText($(tds[0]).text());
           const popupHtml = linesPopups[lineIdx] || '';
           data.linhas.push(this.extractLineDetails(popupHtml, title));
           lineIdx++;
       }
    });

    return data;
  }
}
