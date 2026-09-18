// Regras do modal de perfil: de onde vem cada campo, e o que é senha aceitável.
//
// Nome, cargo e telefone moram de verdade no cadastro do colaborador (`employees`). O modal
// gravava tudo isso em `profiles` / `profile_preferences`, então a pessoa mudava o cargo no
// perfil e o cadastro dela continuava dizendo outra coisa.
//
// O vínculo é `employees.user_id` → `auth.users(id)`, e `profiles.id` é esse mesmo id.
// Usuário SEM colaborador vinculado é caso normal, não erro: os campos continuam como antes,
// sem cadeado e sem aviso.

export const AVISO_CADASTRO = "Isto também altera seu cadastro de colaborador no RH.";

export function resolveProfileFields({ employee, profile, preferences } = {}) {
  const vinculado = !!(employee && employee.id);
  const prefs = preferences ?? {};
  const campo = (doCadastro, doPerfil) => ({
    value: (vinculado ? doCadastro : doPerfil) ?? "",
    // `cadeado` é o que decide se a tela mostra o lápis e pede confirmação antes de gravar.
    cadeado: vinculado,
    destino: vinculado ? "employees" : "profile_preferences",
  });

  return {
    vinculado,
    employeeId: vinculado ? employee.id : null,
    name: {
      ...campo(employee?.name, profile?.name),
      // O nome tem espelho em `profiles.name` mesmo com vínculo: é o que o resto do app lê.
      destino: vinculado ? "employees+profiles" : "profiles",
    },
    role: campo(employee?.role, prefs.custom_role),
    phone: campo(employee?.phone, prefs.custom_phone),
  };
}

// Mínimo de senha. É validação de conveniência: a barreira de verdade tem que estar ligada no
// próprio Supabase Auth (Authentication > Policies), senão qualquer chamada direta à API passa.
export const SENHA_MINIMA = 8;

export function validarSenha(nova, confirmacao, atual) {
  if (!atual) return "Informe a senha atual para trocar de senha.";
  if (!nova) return "Informe a senha nova.";
  if (nova.length < SENHA_MINIMA) return `A senha nova precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (!/[a-zA-Z]/.test(nova) || !/[0-9]/.test(nova)) return "A senha nova precisa misturar letras e números.";
  if (nova !== confirmacao) return "As senhas não conferem. Digite a mesma senha nos dois campos.";
  if (nova === atual) return "A senha nova é igual à atual.";
  return null;
}

// Só para o indicador visual. Não decide nada — quem decide é validarSenha.
export function forcaSenha(senha) {
  const s = senha ?? "";
  if (s.length < SENHA_MINIMA) return 0;
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(s)).length;
}
