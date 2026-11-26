const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { isSimccInstitution, SIMCC_INSTITUTIONS } = require('@oda/shared-types');
const { selectDgpRowsForScope } = require('../src/common/dgpScope');

test('reconhece as instituicoes do SIMCC com sigla, acentos e nome completo', () => {
    assert.equal(SIMCC_INSTITUTIONS.length, 12);
    assert.equal(isSimccInstitution('Universidade Federal da Bahia - UFBA'), true);
    assert.equal(isSimccInstitution('Universidade Federal do Recôncavo da Bahia - UFRB'), true);
    assert.equal(isSimccInstitution('Instituto Gonçalo Moniz'), true);
    assert.equal(isSimccInstitution('Escola Bahiana de Medicina e Saúde Pública'), true);
    assert.equal(isSimccInstitution('Universidade SENAI CIMATEC'), true);
    assert.equal(isSimccInstitution('Centro Integrado de Manufatura e Tecnologia'), true);
    assert.equal(isSimccInstitution('SENAI - Departamento Regional da Bahia - SENAI/DR/BA'), false);
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
        { dgpId: '4444444444444444', instituicao: 'Universidade SENAI CIMATEC' },
        { dgpId: '5555555555555555', instituicao: 'SENAI - Departamento Regional da Bahia - SENAI/DR/BA' },
        { dgpId: '6666666666666666', instituicao: 'SENAI - Departamento Regional da Bahia - SENAI/DR/BA' },
    ];

    assert.deepEqual(
        selectDgpRowsForScope(rows, 'simcc', 1, new Set(['3333333333333333', '5555555555555555'])).map(row => row.dgpId),
        ['1111111111111111', '2222222222222222', '4444444444444444', '5555555555555555'],
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
