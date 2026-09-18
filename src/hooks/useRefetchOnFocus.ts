"use client";

import { useEffect, useRef } from "react";

// Central do Candidato, Entrevistas e Banco de Talentos leem as MESMAS tabelas, cada uma com
// seu próprio fetch no mount e nenhum estado em comum. Quem exclui numa das telas não avisa as
// outras: a linha continua na tela irmã até alguém recarregar na mão.
//
// Em vez de um event bus entre páginas, a deixa é o navegador: quando a aba volta ao foco, os
// dados são refeitos. Cobre os dois casos reais — duas abas abertas, e sair da tela e voltar.
//
// ponytail: teto conhecido — não atualiza com a aba em foco o tempo todo (dois usuários
// mexendo ao mesmo tempo, um deles parado na tela). Se isso passar a importar, o passo
// seguinte é subscription realtime do Supabase nas tabelas, não encurtar um intervalo.
export function useRefetchOnFocus(refetch: () => void) {
  // A referência mantém o efeito preso ao ciclo de vida da tela; sem ela, um refetch recriado
  // a cada render remove e registra o listener de novo em todo render.
  const atual = useRef(refetch);
  atual.current = refetch;

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atual.current();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);
}
