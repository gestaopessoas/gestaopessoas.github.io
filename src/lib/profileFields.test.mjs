import assert from 'node:assert/strict';
import { resolveProfileFields, validarSenha, forcaSenha, SENHA_MINIMA } from './profileFields.mjs';

// Caso 1: usuário COM colaborador vinculado — os três campos vêm do cadastro e vão com cadeado.
const comVinculo = resolveProfileFields({
  employee: { id: 'e1', name: 'Ana Souza', role: 'Analista de RH', phone: '(53) 99999-0000' },
  profile: { name: 'ana.souza' },
  preferences: { custom_role: 'Especialista em Gestão de Pessoas', custom_phone: 'Ramal 204' },
});
assert.equal(comVinculo.vinculado, true);
assert.equal(comVinculo.employeeId, 'e1');
assert.equal(comVinculo.name.value, 'Ana Souza');      // e não o "ana.souza" do profiles
assert.equal(comVinculo.role.value, 'Analista de RH'); // e não o texto livre das preferências
assert.equal(comVinculo.phone.value, '(53) 99999-0000');
assert.equal(comVinculo.name.cadeado, true);
assert.equal(comVinculo.role.destino, 'employees');
assert.equal(comVinculo.name.destino, 'employees+profiles');

// Caso 2: usuário SEM colaborador vinculado — caso normal, não erro. Tudo como era antes.
const semVinculo = resolveProfileFields({
  employee: null,
  profile: { name: 'Bruno TI' },
  preferences: { custom_role: 'Suporte', custom_phone: 'Ramal 11' },
});
assert.equal(semVinculo.vinculado, false);
assert.equal(semVinculo.employeeId, null);
assert.equal(semVinculo.name.value, 'Bruno TI');
assert.equal(semVinculo.role.value, 'Suporte');
assert.equal(semVinculo.phone.value, 'Ramal 11');
assert.equal(semVinculo.name.cadeado, false);
assert.equal(semVinculo.role.destino, 'profile_preferences');

// Cadastro com campo em branco não vira "undefined" na tela.
const vazio = resolveProfileFields({ employee: { id: 'e2', name: 'Só o nome' } });
assert.equal(vazio.role.value, '');
assert.equal(vazio.phone.value, '');

// Banco fora do ar / consulta sem retorno: não quebra e cai no caso sem vínculo.
assert.equal(resolveProfileFields().vinculado, false);
assert.equal(resolveProfileFields({}).name.value, '');

console.log('ok — resolveProfileFields cobre com vínculo e sem vínculo');

// Senha: cada recusa diz o que fazer.
assert.match(validarSenha('novaSenha1', 'novaSenha1', ''), /senha atual/i);
assert.match(validarSenha('', '', 'atual123'), /senha nova/i);
assert.match(validarSenha('abc1', 'abc1', 'atual123'), new RegExp(String(SENHA_MINIMA)));
assert.match(validarSenha('senhasemnumero', 'senhasemnumero', 'atual123'), /letras e n[úu]meros/i);
// O erro de digitação que trancava a pessoa para fora da conta.
assert.match(validarSenha('novaSenha1', 'novaSenha2', 'atual123'), /n[ãa]o conferem/i);
assert.match(validarSenha('atual1234', 'atual1234', 'atual1234'), /igual/i);
assert.equal(validarSenha('novaSenha1', 'novaSenha1', 'atual123'), null);

assert.equal(forcaSenha('curta1'), 0);
assert.equal(forcaSenha('senhaboa1'), 2);
assert.equal(forcaSenha('SenhaBoa1!'), 4);

console.log('ok — validarSenha recusa com motivo e força é só indicador');
