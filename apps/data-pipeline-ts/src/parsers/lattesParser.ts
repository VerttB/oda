import * as cheerio from 'cheerio';
import { cleanText } from './dgpParser';
import { Article, BookChapters, Formation, FullPaper } from '../common/interfaces';
import { Element } from 'crawlee';

export class LattesParser {
  /**
   * Extrai informações básicas do currículo
   */
  extractBasicInfo(html: string) {
    const $ = cheerio.load(html);
    const basic = {
      resumo: '',
      orcidId: '',
      lattes: '',
      nomesCitacoes: [] as string[],
      nacionalidade: '',
      ultimaAttLattes: '',
    };

    const infoAutor = $('.informacoes-autor');
    if (infoAutor.length) {
      const att_lattes_element = infoAutor.find('li').last()
      basic.ultimaAttLattes = cleanText(att_lattes_element.text());
      basic.lattes = cleanText(att_lattes_element.prev("li").find("span").last().text())
    }
  
    const resumo = $('p.resumo');
    if (resumo.length) {
      basic.resumo = cleanText(resumo.text());
    }

    const start = $('a[name="Identificacao"]');
    if (start.length) {
      const parentDiv = start.nextAll('div.layout-cell-12').first()
      parentDiv.find('.text-align-right').each((_, div) => {
        const key = cleanText($(div).find('b').text());
        const valueDiv = $(div).nextAll('.layout-cell-9').first();
        if (valueDiv.length) {
          let value = cleanText(valueDiv.text());
          if (key.includes('País de Nacionalidade')) basic.nacionalidade = value;
          if (key.includes('Orcid iD')) {
             if (value.startsWith('?')) value = value.slice(1).trim();
             basic.orcidId = value;
          }
          if (key.includes('Nome em citações bibliográficas')) {
            basic.nomesCitacoes = value.split(';').map(n => n.trim());
          }
        }
      });
    }

    return basic;
  }


  extractPhotoUrl(html: string) {
    const $ = cheerio.load(html);
    const img = $('img.foto');
    if (img.length) {
      return img.attr('src') || '';
    }
    return '';
  }

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

      const sectionDiv = aTag.nextAll('.layout-cell.layout-cell-12.data-cell').first();
      if (!sectionDiv.length) continue;
      sectionDiv.find('.layout-cell-3.text-align-right').each((_, div) => {
        const bTag = $(div).find('b');
        if (!bTag.length) return;

        const period = cleanText(bTag.text());
        if (!period || !period.includes('-')) return;

        const [start, end] = period.split('-').map(s => s.trim());
        const project = {
          nome: '',
          descricao: '',
          integrantes: [] as {nome: string, tipo: string}[],
          anoInicio: start,
          anoFim: end,
        };

        const nameDiv = $(div).next('div');
        if (nameDiv.length) {
          project.nome = cleanText(nameDiv.text());
          
          let emptyDiv = nameDiv.next('div');
          let descDiv = emptyDiv.next("div")
          
          while(descDiv){
            let text = descDiv.text()
            if(text.includes("Projeto certificado")){
              descDiv = descDiv.next("div")
              continue
            }
            if(text.includes("Descrição:") || text.includes("Integrantes:")) break;
            descDiv = descDiv.next("div")
          }

          if(descDiv){
            const rawText = descDiv.html()
            let text = rawText?.split(/<[^>]+>/g) || []
            text.forEach(line => {
              if (line.includes("Descrição: ")) project.descricao = line.replace("Descrição: ", "").replace("\n", "")
              if (line.includes("Integrantes: ")) {
                line = line.replace("Integrantes: ", "")
                let integrantes = line.split("/")
                integrantes.forEach((integrante,index) => {
                  const integranteDividido = integrante.split("-")
                  project.integrantes.push({nome: integranteDividido[0], tipo: integranteDividido[1]})
                })
              
              }
            })
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

      const headerDiv = aTag.nextAll('div.inst_back').first();
      if (!headerDiv.length) continue;

      let current = headerDiv.next();
      while (current.length) {
        if (current.is('a[name]') || current.find('a[name]').length || current.is('div.inst_back')) {
          break;
        }

        let cell11 = current.hasClass('layout-cell-11') ? current : current.find('div.layout-cell-11');
        if (cell11.length) {
          const span = cell11.find('span');
          if (span.length) {
            const text = cleanText(span.text());
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
          }
        }
        current = current.next();
      }
    }

    return events;
  }

  extractFormationDetails(html: string){
    const $ = cheerio.load(html)
    const formacoes = {
      formacoes: [] as Formation[]
    }
    const aTag = $("a[name='FormacaoAcademicaTitulacao']")
    if(!aTag){
      return
    }
    const mainDiv = aTag.nextAll("div.layout-cell-12").first()
    if(!mainDiv){
      return
    }
    mainDiv.find(".layout-cell-3").each((_, div) => {
      const newFormation: Formation = {}
      const bTag = $(div).find("b")
      const years = bTag.text().split("-");
      newFormation.anoInicio = years[0] || ""
      newFormation.anoFim = years[1] || ""
      const divTag = $(div).next(".layout-cell-9").text().split(".")
      newFormation.nome = divTag[0]
      
      formacoes.formacoes.push(newFormation)
    })
    
    return formacoes
  }

  extractProductionDetails(html: string){
    const producoes = {
      artigos: [...this.extractArticlesDetails(html), ...this.extractFullPapers(html)] as (Article|FullPaper)[],
      livrosCapitulos: [...this.extractBookChapters(html), ...this.extractPublishedBooks(html)]
      
    }
    this.extractBookChapters(html)
    return producoes
  }

  private extractArticlesDetails(html: string){
    const $ = cheerio.load(html)
    const productions: Article[] = []
    const articlesDivTag = $("div[id='artigos-completos']")
   
    articlesDivTag.find("div.artigo-completo").each((_,div) => {
      const infoDiv = $(div).find("div.layout-cell-11")
      const newArticle = {} as Article
      newArticle.ano = infoDiv.find("span[data-tipo-ordenacao='ano']").text() || ""
      const url = infoDiv.find("span[cvuri]").attr("cvuri")

      const query = url?.split("?")[1] || "";
      const regex = /([^&=]+)=((?:(?!&\w+=).)*)/g;

      let resultado = {} as any;
      let match;
      while ((match = regex.exec(query)) !== null) {
        resultado[match[1]] = match[2];
      }

      newArticle.issn = resultado.issn || ""
      newArticle.nomePeriodico = resultado.nomePeriodico || ""
      newArticle.titulo = resultado.titulo || ""
      newArticle.doi = resultado.doi || ""
      newArticle.volume = resultado.volume || ""
      newArticle.paginaInicial = resultado.paginaInicial || ""
      // infoDiv.find("span[cvuri]").attr("cvuri")?.map(info => {
      //   const url = new URL("http://error" + )
      //   if(info.includes("issn=")){
      //     newArticle.issn = info.replace("issn=", "")
      //   }
      //   if(info.includes("nomePeriodico")){
      //     newArticle.nomePeriodico = info.replace("nomePeriodico=", "") || ""
      //   }
      //   if(info.includes("volume")){
      //     const replace = info.replace("volume", "") || ""
      //     newArticle.volume = replace
      //   }
      //   if(info.includes("doi")){
      //     const doiIndex = info.indexOf("doi")
      //     newArticle.doi = info.slice(doiIndex+4)
      //   }

      //   if(info.includes("paginaInicial")){
      //     newArticle.volume = info.replace("paginaInicial","") || ""
      //   }
      //   if(info.includes("titulo")){
      //     newArticle.titulo = info.replace("titulo","")
      //   }
      // })
      productions.push(newArticle)
    })

   

    return productions
  }

  private extractFullPapers(html: string){
    const $ = cheerio.load(html)
    const fullPapers:FullPaper[] = []
    const aTag = $("a[name='TrabalhosPublicadosAnaisCongresso']")
    if(aTag.length == 0) return fullPapers
    const allSiblings = aTag.closest("div.cita-artigos").nextUntil("div.cita-artigos");
    if(allSiblings.length == 0) return fullPapers
    const allSpan = allSiblings.find("span.transform");
    if(allSpan.length == 0) return fullPapers
    allSpan.each((_, span) => {
      const doiRef = $(span).find("a.icone-doi").attr("href")
      const doiIndex = doiRef?.search(/\d/)
      const doi = doiRef?.slice(doiIndex)
      const bTag = $(span).find('b');
  
  let textoAposB = "";

  if (bTag.length > 0) {
    let currentSibling = bTag[0].nextSibling;
    while (currentSibling) {
      if (currentSibling.nodeType === 3) {
        textoAposB += currentSibling.nodeValue;
      } 
      else if (currentSibling.nodeType === 1) {
        textoAposB += $(currentSibling).text();
      }
      currentSibling = currentSibling.nextSibling;
    }
  }

  const finalResult = textoAposB.replace(/^\s*\.\s*/, '').trim().split(" . ");
  if(finalResult.length > 1) finalResult.shift()
  const inIndex = finalResult[0].indexOf("In:")
  const titulo = finalResult[0].slice(0, inIndex)
  const slicedResult = finalResult[0].slice(inIndex)
  const ano = slicedResult.match(/\b\d{4}\b/)?.[0]
  fullPapers.push({titulo, ano, doi})
    })

    return fullPapers
  }

  private extractBookChapters(html: string){
    const $ = cheerio.load(html);
    const bookChapters:BookChapters[] = []
    const aTag = $("a[name='LivrosCapitulos']").last()
    if(aTag.length == 0) return bookChapters
    const allSiblings = aTag.closest("div.cita-artigos").nextUntil("div.cita-artigos");
    if(allSiblings.length == 0) return bookChapters
    const allSpan = allSiblings.find("span.transform");
    if(allSpan.length == 0) return bookChapters
    allSpan.each((_, span) => {
      const doiRef = $(span).find("a.icone-doi").attr("href")
      const doiIndex = doiRef?.search(/\d/)
      const doi = doiRef?.slice(doiIndex)
      const textoAposB = this.handleBTagText($,span)
  const finalResult = textoAposB.replace(/^\s*\.\s*/, '').trim().split(" . ");
  let indexToLookAt = 0
  while(finalResult.length > 1) {
    if(finalResult[0].includes("In: ")){
      finalResult[1] = `${finalResult[0]}${finalResult[1]}`  
    }
    
  finalResult.shift()
  
}
  if(finalResult[0].includes("In: ")) indexToLookAt = finalResult[0].indexOf("In: ")
  else if(indexToLookAt <= 0) indexToLookAt = finalResult[0].indexOf("1ed.")
  else indexToLookAt = finalResult[0].indexOf(". ")
  const inIndex = finalResult[0].indexOf("In:")
  const titulo = finalResult[0].slice(0, indexToLookAt)
  const ano = finalResult[0].slice(indexToLookAt).match(/\b\d{4}\b/)?.[0]
  const paginas = finalResult[0].slice(finalResult[0].indexOf("p. ")+2)
  const volumesUnclear = finalResult[0].slice(finalResult[0].indexOf("v. ")+2)
  const volume = volumesUnclear.slice(0, volumesUnclear.indexOf(","))
  
  bookChapters.push({titulo, ano, doi, paginas, volume })
    })

    return bookChapters
  }
  private extractPublishedBooks(html: string){
    const $ = cheerio.load(html);
    const bookChapters:BookChapters[] = []
    const aTag = $("a[name='LivrosCapitulos']").first()
    if(aTag.length == 0) return bookChapters
    const allSiblings = aTag.closest("div.cita-artigos").nextUntil("div.cita-artigos");
    if(allSiblings.length == 0) return bookChapters
    const allSpan = allSiblings.find("span.transform");
    if(allSpan.length == 0) return bookChapters
    allSpan.each((_, span) => {
      const doiRef = $(span).find("a.icone-doi").attr("href")
      const doiIndex = doiRef?.search(/\d/)
      const doi = doiRef?.slice(doiIndex)
      const textoAposB = this.handleBTagText($,span)

      const finalResult = textoAposB.replace(/^\s*\.\s*/, '').trim().split(" . ");
      if(finalResult.length > 1) finalResult.shift()
      const titulo = finalResult[0].slice(0, finalResult[0].indexOf("."))
      const ano = finalResult[0].match(/\b\d{4}\b/)?.[0]
      let volume = ""
      if(finalResult[0].indexOf("v. ") >=0){
        const volumesUnclear = finalResult[0].slice(finalResult[0].indexOf("v. ")+2)
        volume = volumesUnclear.slice(0, volumesUnclear.indexOf(".")).replace("v", "")
      }
      const paginas = finalResult[0].match(/\d{1,4}p/)?.[0].replace("p","")
      bookChapters.push({ titulo, ano, doi, volume, paginas})
    })

    return bookChapters
  }

  private handleBTagText($:cheerio.CheerioAPI,span: Element){
     const bTag = $(span).find('b');
    
    let textoAposB = "";

  if (bTag.length > 0) {
    let currentSibling = bTag[0].nextSibling;
    while (currentSibling) {
      if (currentSibling.nodeType === 3) {
        textoAposB += currentSibling.nodeValue;
      } 
      else if (currentSibling.nodeType === 1) {
        textoAposB += $(currentSibling).text();
      }
      currentSibling = currentSibling.nextSibling;
    }
  }

  return textoAposB
  }

}


