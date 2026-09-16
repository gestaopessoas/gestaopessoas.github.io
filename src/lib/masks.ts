export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const maskCpf = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const maskPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const maskCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

// Número de endereço não é numérico puro: "123A" e "S/N" são válidos.
// Restringe a dígitos, letras e barra — o suficiente para barrar texto corrido.
export const maskAddressNumber = (value: string) => value.replace(/[^\dA-Za-z/]/g, "").slice(0, 10);

export const maskUf = (value: string) => value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);

// Telefone brasileiro: 10 dígitos (fixo) ou 11 (celular com o 9).
export const isValidPhone = (value: string) => [10, 11].includes(onlyDigits(value).length);

// O nome do arquivo vem do dispositivo do candidato e vira caminho no Supabase
// Storage. Espaço, acento, parêntese e separador de path ("../") viram hífen; o
// UUID que acompanha o caminho garante unicidade sem depender do nome.
export const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
