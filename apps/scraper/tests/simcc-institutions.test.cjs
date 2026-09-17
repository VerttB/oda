const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { isSimccInstitution, SIMCC_INSTITUTIONS } = require('@oda/shared-types');
const { selectDgpRowsForScope } = require('../src/common/dgpScope');

test('reconhece as instituicoes do SIMCC com sigla, acentos e nome completo', () => {
    assert.equal(SIMCC_INSTITUTIONS.length, 11);
    assert.equal(isSimccInstitution('Universidade Federal da Bahia - UFBA'), true);
    assert.equal(isSimccInstitution('Universidade Federal do Recôncavo da Bahia - UFRB'), true);
    assert.equal(isSimccInstitution('Instituto Gonçalo Moniz'), true);
    assert.equal(isSimccInstitution('Escola Bahiana de Medicina e Saúde Pública'), true);
});

test('nao confunde IFBA com IF Baiano nem aceita outra instituicao', () => {
    assert.equal(isSimccInstitution('Instituto Federal de Educação, Ciência e Tecnologia Baiano - IFBAIANO'), false);
    assert.equal(isSimccInstitution('Universidade Católica do Salvador - UCSAL'), false);
});

test('escopo SIMCC seleciona todos os grupos reconhecidos sem aplicar take', () => {
    const rows = [
        { dgpId: '1111111111111111', instituicao: 'Universidade Federal da Bahia - UFBA' },
        { dgpId: '2222222222222222', instituicao: 'Universidade do Estado da Bahia - UNEB' },
        { dgpId: '3333333333333333', instituicao: 'Universidade Catolica do Salvador - UCSAL' },
    ];

    assert.deepEqual(
        selectDgpRowsForScope(rows, 'simcc', 1).map(row => row.dgpId),
        ['1111111111111111', '2222222222222222'],
    );
});

test('escopo padrao continua respeitando take', () => {
    const rows = [
        { dgpId: '1111111111111111', instituicao: 'Instituicao A' },
        { dgpId: '2222222222222222', instituicao: 'Instituicao B' },
    ];

    assert.deepEqual(
        selectDgpRowsForScope(rows, 'default', 1).map(row => row.dgpId),
        ['1111111111111111'],
    );
});
