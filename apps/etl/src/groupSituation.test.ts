import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Situacao } from '@oda/database';
import { mapDgpGroupSituation } from './commom/groupSituation';

test('mapeia as situações oficiais do DGP para o enum persistido', () => {
    assert.equal(mapDgpGroupSituation('Certificado'), Situacao.CERTIFICADO);
    assert.equal(mapDgpGroupSituation('Certificado, mas sem atualização'), Situacao.CERTIFICADO);
    assert.equal(mapDgpGroupSituation('Em preenchimento'), Situacao.EM_PREENCHIMENTO);
    assert.equal(mapDgpGroupSituation('Excluído'), Situacao.EXCLUIDO);
    assert.equal(mapDgpGroupSituation('Aguardando certificação'), Situacao.AGUARDANDO_CERTIFICACAO);
});

test('normaliza caixa, acentos e espaços sem aceitar situações desconhecidas', () => {
    assert.equal(mapDgpGroupSituation('  AGUARDANDO   CERTIFICACAO  '), Situacao.AGUARDANDO_CERTIFICACAO);
    assert.throws(() => mapDgpGroupSituation(''), /ausente/);
    assert.throws(() => mapDgpGroupSituation('Situação desconhecida'), /não reconhecida/);
});
