import re


def limpar_texto(texto):
    return texto.replace("¿", "-").replace("  ", " ").strip()

def get_campo_adjacente(soup, nome_campo):
    label = soup.find('label', string=re.compile(nome_campo, re.IGNORECASE))
    if label:
        content = label.find_next_sibling('div', class_='controls')
        return content.get_text(strip=True) if content else ""
    return ""