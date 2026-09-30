import { Situacao } from '@oda/database';
import { EtlInputError } from './etlFile';

export function mapDgpGroupSituation(value: unknown): Situacao {
    if (typeof value !== 'string' || !value.trim()) {
        throw new EtlInputError('Situação do grupo ausente no JSON do DGP.');
    }

    const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');

    if (normalized === 'certificado' || normalized.startsWith('certificado mas sem atualizacao')) {
        return Situacao.CERTIFICADO;
    }
    if (normalized === 'em preenchimento') return Situacao.EM_PREENCHIMENTO;
    if (normalized === 'excluido') return Situacao.EXCLUIDO;
    if (normalized === 'aguardando certificacao') return Situacao.AGUARDANDO_CERTIFICACAO;

    throw new EtlInputError(`Situação do grupo DGP não reconhecida: "${value.trim()}".`);
}
