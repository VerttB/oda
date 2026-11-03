import { BadRequestException } from '@nestjs/common';

export type BooleanExpression =
  | { kind: 'term'; value: string; phrase: boolean }
  | { kind: 'not'; child: BooleanExpression }
  | { kind: 'and'; left: BooleanExpression; right: BooleanExpression }
  | { kind: 'or'; left: BooleanExpression; right: BooleanExpression };

type Token = { kind: 'term' | 'phrase' | 'AND' | 'OR' | 'NOT' | '(' | ')'; value: string };

export function hasBooleanOperators(input: string): boolean {
  // Aspas também são sintaxe de busca (frase); parênteses sem operadores são texto comum.
  if (input.includes('"')) return true;
  return /(?:^|[\s()])(?:AND|OR|NOT)(?=$|[\s()])/u.test(input);
}

const invalid = (message: string): never => {
  throw new BadRequestException(`Busca booleana inválida: ${message}`);
};

export function parseProductionSearch(input: string): BooleanExpression {
  if (hasBooleanOperators(input)) return parseBooleanExpression(input);
  if (!input.trim() || input.length > 500) invalid('use de 1 a 500 caracteres.');
  if (!/[\p{L}\p{N}]/u.test(input)) invalid('informe letras ou números.');
  if (input.trim().split(/\s+/u).length > 32) invalid('use no máximo 32 termos.');
  // O PostgreSQL converte o texto comum com plainto_tsquery: todos os termos (AND).
  return { kind: 'term', value: input.trim(), phrase: false };
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  let terms = 0;
  while (position < input.length) {
    const char = input[position];
    if (/\s/u.test(char)) { position++; continue; }
    if (char === '(' || char === ')') {
      tokens.push({ kind: char, value: char });
      position++;
      continue;
    }
    let value: string;
    let kind: Token['kind'];
    if (char === '"') {
      const end = input.indexOf('"', position + 1);
      if (end < 0) invalid('aspas não fechadas.');
      value = input.slice(position + 1, end).trim();
      kind = 'phrase';
      position = end + 1;
    } else {
      const match = input.slice(position).match(/^[^\s()"]+/u)!;
      value = match[0];
      kind = ['AND', 'OR', 'NOT'].includes(value) ? value as Token['kind'] : 'term';
      position += value.length;
    }
    if (kind === 'term' || kind === 'phrase') {
      if (!/[\p{L}\p{N}]/u.test(value)) invalid('cada termo ou frase deve conter letras ou números.');
      if (++terms > 32) invalid('use no máximo 32 termos ou frases.');
    }
    tokens.push({ kind, value });
  }
  return tokens;
}

// Rejeita expressões que casariam mesmo com um documento sem nenhum termo.
// Isso inclui NOT isolado e alternativas amplas como "fisica OR NOT plasma".
function matchesWithoutTerms(node: BooleanExpression): boolean {
  if (node.kind === 'term') return false;
  if (node.kind === 'not') return !matchesWithoutTerms(node.child);
  return node.kind === 'and'
    ? matchesWithoutTerms(node.left) && matchesWithoutTerms(node.right)
    : matchesWithoutTerms(node.left) || matchesWithoutTerms(node.right);
}

export function parseBooleanExpression(input: string): BooleanExpression {
  if (!input.trim() || input.length > 500) invalid('use de 1 a 500 caracteres.');
  const tokens = tokenize(input);
  let cursor = 0;
  const peek = () => tokens[cursor]?.kind;

  function unary(depth: number): BooleanExpression {
    const token = tokens[cursor++];
    if (!token) invalid('operador sem termo à direita.');
    if (token.kind === 'NOT') return { kind: 'not', child: unary(depth) };
    if (token.kind === '(') {
      if (depth >= 5) invalid('use no máximo cinco níveis de parênteses.');
      const child = or(depth + 1);
      if (peek() !== ')') invalid('parênteses não fechados.');
      cursor++;
      return child;
    }
    if (token.kind === 'term' || token.kind === 'phrase') {
      return { kind: 'term', value: token.value, phrase: token.kind === 'phrase' };
    }
    return invalid(`termo esperado antes de "${token.value}".`);
  }

  function and(depth: number): BooleanExpression {
    let left = unary(depth);
    while (peek() && peek() !== 'OR' && peek() !== ')') {
      if (peek() === 'AND') cursor++;
      left = { kind: 'and', left, right: unary(depth) };
    }
    return left;
  }

  function or(depth: number): BooleanExpression {
    let left = and(depth);
    while (peek() === 'OR') {
      cursor++;
      left = { kind: 'or', left, right: and(depth) };
    }
    return left;
  }

  const expression = or(0);
  if (cursor !== tokens.length) invalid('parêntese de fechamento inesperado.');
  if (matchesWithoutTerms(expression)) invalid('exija um termo positivo em cada alternativa de OR.');
  return expression;
}
