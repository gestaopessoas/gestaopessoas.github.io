// O PostgREST corta TODA resposta em 1.000 linhas (`max_rows`), sem erro e sem aviso.
// `.limit(10000)` nao resolve: continua voltando 1.000. Foi assim que o turnover
// mostrou 35,1% no lugar de 37,3% por meses, e que o preenchimento automatico de
// salario falhava calado para cargo no fim do alfabeto (2.464 linhas em salary_table).
//
// `buscarTudo` pede pagina por pagina ate a ultima vir incompleta.

const TAMANHO_DA_PAGINA = 1000;

type Resposta<T> = { data: T[] | null; error: unknown };

export async function buscarTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  tamanhoDaPagina: number = TAMANHO_DA_PAGINA,
): Promise<T[]> {
  const tudo: T[] = [];

  for (let pagina = 0; ; pagina++) {
    const de = pagina * tamanhoDaPagina;
    const { data, error } = await consulta(de, de + tamanhoDaPagina - 1);
    if (error) throw error;
    if (!data?.length) break;

    tudo.push(...data);
    // Pagina incompleta e a ultima. Pagina cheia pode ser a ultima tambem — nesse caso
    // a proxima volta vazia e o laco para ali.
    if (data.length < tamanhoDaPagina) break;
  }

  return tudo;
}
