const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keywordIdentity, keywordSearchKey } = require('../dist/lattes/keywordIdentity');

test('identidade preserva símbolos e qualificadores importantes', () => {
    assert.notEqual(keywordIdentity('C'), keywordIdentity('C++'));
    assert.notEqual(keywordIdentity('C++'), keywordIdentity('C#'));
    assert.notEqual(keywordIdentity('com diabetes'), keywordIdentity('sem diabetes'));
    assert.equal(keywordIdentity('  CIÊNCIA   da Computação '), 'ciência da computação');
});

test('chave de busca ignora acentos sem apagar símbolos', () => {
    assert.equal(keywordSearchKey('Ciência'), keywordSearchKey('CIENCIA'));
    assert.notEqual(keywordSearchKey('C++'), keywordSearchKey('C#'));
});
