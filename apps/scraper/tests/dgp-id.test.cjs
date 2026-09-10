const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { assertValidDgpIds, isValidDgpId } = require('../src/common/dgpId');

test('aceita somente ID DGP com exatamente 16 digitos', () => {
    assert.equal(isValidDgpId('0000000000000001'), true);
    for (const value of ['--help', '123', '12345678901234567', '123456789012345a']) {
        assert.equal(isValidDgpId(value), false);
    }
});

test('rejeita a lista inteira antes de processar quando existe ID invalido', () => {
    assert.throws(() => assertValidDgpIds(['0000000000000001', '--help']), /--help/);
});
