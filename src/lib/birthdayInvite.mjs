// Convite de foto do mural de aniversariantes: a mensagem que o RH manda no WhatsApp.
//
// Mora aqui, e não dentro da tela, porque o texto tem três buracos que só ficam certos
// juntos (nome, link e prazo) e porque número de telefone é o tipo de coisa que quebra em
// silêncio: o wa.me abre uma conversa vazia em vez de dar erro.

// "BRUNO DE SOUZA GONÇALVES" no cadastro vira "Bruno" na mensagem. Gritar o nome inteiro
// numa saudação soa a cobrança, não a convite.
export function firstName(name) {
  const primeiro = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!primeiro) return "";
  return primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase();
}

// O wa.me exige o número com código do país e só dígitos. Fixo (10) e celular (11) são os
// dois formatos que o cadastro aceita; qualquer outra coisa devolve null, e a tela desliga
// o botão em vez de abrir uma conversa com ninguém.
export function whatsappNumber(phone) {
  const digitos = (phone ?? "").replace(/\D/g, "");
  if (digitos.startsWith("55") && [12, 13].includes(digitos.length)) return digitos;
  if ([10, 11].includes(digitos.length)) return "55" + digitos;
  return null;
}

export function birthdayPhotoMessage({ name, link, deadline }) {
  return `Seu aniversário está chegando! 🎉 Envie sua foto para a nossa homenagem

Olá, ${firstName(name)}, tudo bem?

O seu aniversário está quase aí e nós não poderíamos deixar de celebrar com você! 🎈

Para prepararmos o nosso mural de aniversariantes e deixarmos a homenagem bem com a sua cara, gostaríamos que você escolhesse e nos enviasse uma foto bem legal.

Basta acessar o link abaixo e fazer o envio:

🔗 ${link}

⚠️ Observação importante: Caso a foto não seja enviada até o dia ${deadline}, não se preocupe! Utilizaremos a foto padrão que já consta em seu cadastro para não deixarmos a data passar em branco.

Qualquer dúvida com o link, é só avisar.

Um abraço,
RH ACPO`;
}

export function whatsappLink(phone, mensagem) {
  const numero = whatsappNumber(phone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
