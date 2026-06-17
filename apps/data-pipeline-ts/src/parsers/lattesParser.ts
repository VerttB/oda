import * as cheerio from 'cheerio';
import { cleanText } from './dgpParser';

export class LattesParser {
  /**
   * Extrai informações básicas do currículo
   */
  extractBasicInfo(html: string) {
    const $ = cheerio.load(html);
    const basic = {
      resumo: '',
      orcid_id: '',
      nomes_citacoes: [] as string[],
      nacionalidade: '',
      ultima_att_lattes: '',
    };

    const infoAutor = $('.informacoes-autor');
    if (infoAutor.length) {
      basic.ultima_att_lattes = cleanText(infoAutor.find('li').last().text());
    }

    const resumo = $('p.resumo');
    if (resumo.length) {
      basic.resumo = cleanText(resumo.text());
    }

    const start = $('a[name="Identificacao"]');
    if (start.length) {
      const parentDiv = start.next('div');
      parentDiv.find('.text-align-right').each((_, div) => {
        const key = cleanText($(div).find('b').text());
        const valueDiv = $(div).next('.layout-cell-9');
        if (valueDiv.length) {
          let value = cleanText(valueDiv.text());
          
          if (key.includes('País de Nacionalidade')) basic.nacionalidade = value;
          if (key.includes('Orcid iD')) {
             if (value.startsWith('?')) value = value.slice(1).trim();
             basic.orcid_id = value;
          }
          if (key.includes('Nome em citações bibliográficas')) {
            basic.nomes_citacoes = value.split(';').map(n => n.trim()).filter(Boolean);
          }
        }
      });
    }

    return basic;
  }

  /**
   * Extrai a URL da foto do pesquisador
   */
  extractPhotoUrl(html: string) {
    const $ = cheerio.load(html);
    const img = $('img.foto');
    if (img.length) {
      return img.attr('src') || '';
    }
    return '';
  }

  /**
   * Extrai detalhes dos projetos (pesquisa, extensão, etc.)
   */
  extractProjectDetails(html: string) {
    const $ = cheerio.load(html);
    const projects: any = {
      projeto_pesquisa: [],
      projeto_extensao: [],
      projeto_desenvolvimento: [],
      outros_projetos: [],
    };

    const keysMap = {
      ProjetosPesquisa: 'projeto_pesquisa',
      ProjetosExtensao: 'projeto_extensao',
      ProjetosDesenvolvimento: 'projeto_desenvolvimento',
      OutrosProjetos: 'outros_projetos',
    } as const;

    for (const [anchor, target] of Object.entries(keysMap)) {
      const aTag = $(`a[name="${anchor}"]`);
      if (!aTag.length) continue;

      const sectionDiv = aTag.next('.layout-cell.layout-cell-12.data-cell');
      if (!sectionDiv.length) continue;

      sectionDiv.find('.layout-cell-3.text-align-right').each((_, div) => {
        const bTag = $(div).find('b');
        if (!bTag.length) return;

        const period = cleanText(bTag.text());
        if (!period || !period.includes('-')) return;

        const [start, end] = period.split('-').map(s => s.trim());
        const project: any = {
          nome: '',
          descrição: '',
          integrantes: '',
          ano_inicio: start,
          ano_fim: end,
        };

        const nameDiv = $(div).next('div');
        if (nameDiv.length) {
          project.nome = cleanText(nameDiv.text());
          
          // Busca descrição e integrantes nos divs subsequentes
          let current = nameDiv.next('div');
          while (current.length) {
            const text = cleanText(current.text());
            if (text.includes('Descrição:') || text.includes('Integrantes:')) {
               const lines = current.text().split('\n').map(l => l.trim()).filter(Boolean);
               lines.forEach(line => {
                  if (line.startsWith('Descrição:')) project.descrição = line.replace('Descrição:', '').trim();
                  if (line.startsWith('Integrantes:')) project.integrantes = line.replace('Integrantes:', '').trim();
               });
               break;
            }
            if (text && !text.includes('Projeto certificado')) break; // Parar se encontrar outro conteúdo útil
            current = current.next('div');
          }
        }
        projects[target].push(project);
      });
    }

    return projects;
  }

  /**
   * Extrai detalhes dos eventos
   */
  extractEventDetails(html: string) {
    const $ = cheerio.load(html);
    const events: any = {
      evento_participacao: [],
      evento_organizacao: [],
    };

    const keysMap = {
      ParticipacaoEventos: 'evento_participacao',
      OrganizacaoEventos: 'evento_organizacao',
    } as const;

    for (const [anchor, target] of Object.entries(keysMap)) {
      const seen = new Set<string>();
      const aTag = $(`a[name="${anchor}"]`);
      if (!aTag.length) continue;

      const headerDiv = aTag.next('.inst_back');
      if (!headerDiv.length) continue;

      headerDiv.nextAll('.layout-cell-11').each((_, div) => {
        const span = $(div).find('span');
        if (!span.length) return;

        const text = cleanText(span.text());
        // Regex para capturar: Nome do Evento 2024. (Tipo)
        const match = text.match(/(.+?)\s*(\b\d{4}\b)\.\s*\((.+?)\)/);
        if (match) {
          const nome = match[1].trim();
          if (!seen.has(nome)) {
            events[target].push({
              nome,
              ano: match[2].trim(),
              tipo: match[3].trim(),
            });
            seen.add(nome);
          }
        }
      });
    }

    return events;
  }
}
