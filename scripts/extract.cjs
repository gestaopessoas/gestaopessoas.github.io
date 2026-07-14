const fs = require('fs');

const ocrText = `
Carla Liziane Carrion Rockembach Coordenador(a) Compras (C-0079) BRL Compras carla.carrion@acpo.com.br Sede Administrativa AP
Claudia da Fonseca Leitzke Supervisor(a) Administrativo(a) (C-0160) BRL Núcleo Administrativo claudia@acpo.com.br Sede Administrativa CE
Jennifer Cazaubon da Silva Diretor(a) Administrativo(a) e Financeiro(a) (C-0157) BRL Direção jennifer.cazaubon@acpo.com.br Sede Administrativa EA
Leonardo Bederode dos Santos Coordenador(a) de SMS (C-0023) BRL Segurança do Trabalho leonardo.bederode@acpo.com.br Sede Administrativa EA
Luis Carlos Falcão Tuchtenhagen Analista Técnico - (pós-obra) (C-0136) BRL Assistência Técnica (Pós-Obra) luis.falcao@acpo.com.br Assistência Técnica P
Patricia Juarez Rodrigues Coordenador (a) de Qualidade (C-0021) BRL Sistema de Gestão da Qualidade patricia.rodrigues@acpo.com.br Sede Administrativa AEP
Patricia Peres Gonçalves Supervisor(a) Técnico(a) (C-0162) BRL Núcleo Técnico Sede patricia@acpo.com.br Sede Administrativa EA
Tacio Fernandes Ornos Diretor Estratégico BRL Direção tacio.ornos@acpo.com.br Sede Administrativa AP
Carlos Eduardo Silva da Silva Coordenador de Obras (C-0024) BRL Engenharia (1) carlos.eduardo@acpo.com.br Solanas AP
Cleudete Maria Costa Gomes Analista Contábil (Fiscal) - (C-0120) BRL Contabilidade cleo.gomes@acpo.com.br Sede Administrativa EA
Daiane Pinto Duarte Analista de RH (C-0083) BRL Recursos Humanos daiane.duarte@acpo.com.br Sede Administrativa PA
Diogo Antônio dos Santos Soares Analista de RH (C-0083) BRL Recursos Humanos diogo.soares@acpo.com.br Sede Administrativa E
Egicleide Dias Silva Técnico(a) em Segurança do Trabalho (C-0052) BRL Segurança do Trabalho egicleide.dias@acpo.com.br SPE MOOV AP
Flavio Tadeu de Lima Freitas Junior Coordenador de Obras (C-0024) BRL Engenharia (2) flavio.freitas@acpo.com.br Reserva Home Club PA
Gabriel Eduardo Melo Hepp Analista Técnico(a) - Obras (C-0136) BRL Engenharia (1) gabriel.hepp@acpo.com.br Solanas EA
Gabriela Torres Silveira Técnico(a) em edificações - Sede (C-0050) BRL Orçamentos - Técnico gabriela.torres@acpo.com.br Sede Administrativa CE
Guilherme Louzada de Freitas Assistente de Compras (C-0110) BRL Compras guilherme.freitas@acpo.com.br Sede Administrativa AP
Joice Alexandra Dos Santos Gonçalves Analista Técnico(a) - Obras (C-0136) BRL Engenharia (2) joice.alexandra@acpo.com.br Joy Residence EA
Jorge Airton Ramaje Junior Coordenador de Obras (C-0024) BRL Engenharia (1) jorge.ramaje@acpo.com.br SPE MOOV E
Luiz Fernando Agostinho Período de Experiência BRL Almoxarifado (1) agostinho.fernando@yahoo.com.br Sede Administrativa PE
Matheus Vargas Zborowski Analista de TI (C-0075) BRL T.I. matheus.zborowski@acpo.com.br Sede Administrativa E
Piero Costa Fernandes Almoxarife (C-0001) BRL Almoxarifado (1) piero.fernandes@acpo.com.br SPE MOOV CEP
Priscila Hirschmann da Cruz Analista Comercial (C-0147) BRL Comercial priscila.cruz@acpo.com.br Sede Administrativa C
Vitoria Teixeira Pinto Coordenador (a) de Planejamento (C-0172) BRL Planejamento vitoria.pinto@acpo.com.br Sede Administrativa PEA
Cyntia Vasques Bender Coordenador(a) de Projetos (C-0056) BRL Projetos cyntia.bender@acpo.com.br Sede Administrativa E
Rafael de Almeida Coelho Diretor Operacional (C-0151) BRL Direção rafael@acpo.com.br Sede Administrativa APE
Ana Helena Dias Méndez Coordenador(a) de Novos Negócios (C-0158) BRL Novos Negócios ana.dias@acpo.com.br Sede Administrativa EC
Daniel Costa da Silveira Projetista - Complementar (C-0047) BRL Projetos daniel.silveira@acpo.com.br Sede Administrativa AP
Felipe Almeida Coelho Mestre de Obras (C-0042) BRL Operação (2) felipe.coelho@acpo.com.br Connect Duque Powered by Housi EC
Gilmar Vergara Lopes Analista Administrativo (C-0139) BRL Administrativos de obra gilmar@acpo.com.br SPE MOOV PA
Ruy Alberto Quincozes Porto Coordenador de Obras (C-0024) BRL Engenharia (2) ruy.porto@acpo.com.br Connect Duque Powered by Housi AP
Victoria Iglesia Gomes Maurente Projetista - Complementar (C-0047) BRL Projetos victoria.maurente@acpo.com.br Sede Administrativa AEP
Osvaldo Luis Gimenes Amaro Presidente BRL Presidência osvaldo@acpo.com.br Sede Administrativa E
Fernanda Clenir Hernandes da Silva Analista Contábil (Fiscal) - (C-0120) BRL Contabilidade fernanda.hernandes@acpo.com.br Sede Administrativa EA
Jeniffer Pertili Bouchahine Coordenador(a) Comercial (C-0090) BRL Comercial jeniffer.pertili@acpo.com.br Sede Administrativa CE
Eugênia Lucas Souza Analista Administrativo - SAC (C-0139) BRL Serviço de Atendimento ao Cliente eugenia.souza@acpo.com.br Sede Administrativa CA
Murilo Vasconcelos Machado Psicólogo(a) Organizacional (C-0118) BRL Gestão de Pessoas murilo.machado@acpo.com.br Sede Administrativa PA
Tanara de Oliveira Wonglon Alves Coordenador de Obras (C-0024) BRL Engenharia (2) tanara.alves@acpo.com.br Joy Residence EP
Rodrigo Dias Lemos Coordenador de Manutenção (C-0146) BRL Manutenção rodrigo.lemos@acpo.com.br Sede Administrativa EC
Wesley Martins de Souza Analista Técnico(a) - Obras (C-0136) BRL Engenharia (1) wesley.souza@acpo.com.br Life RG C
Andrei Carvalho Aquino Analista Financeiro - Contas a Pagar (C-0073) BRL Financeiro andrei.aquino@acpo.com.br Sede Administrativa PA
Everson Ferraz de Almeida Mestre de Obras (C-0042) BRL Operação (2) everson@acpo.com.br Direct
Alessandro Soares Cardoso Mestre de Obras (C-0042) BRL Operação (1) alessandro.cardoso@acpo.com.br SPE MOOV PC
Cristina Cidade Rodrigues Coordenador(a) Financeiro(a) - (C-0066) BRL Financeiro cristina.rodrigues@acpo.com.br Sede Administrativa CPE
Thais Shaillene Costa Analista Técnico(a) - Obras (C-0136) BRL Engenharia (2) thais.costa@acpo.com.br Connect Duque Powered by Housi PC
Valdilene Negrao de Farias Técnico(a) em Segurança do Trabalho (C-0052) BRL Segurança do Trabalho valdilene.farias@acpo.com.br Connect Duque Powered by Housi EP
Luis Mariano Cedrez Macedo Mestre de Obras (C-0042) BRL Operação (2) luis.macedo@acpo.com.br Reserva Home Club EA
Otávio Saraiva Loth Auxiliar Técnico (C-0013) BRL Engenharia (2) otavio.loth@acpo.com.br Reserva Home Club CE
Nathali dos Santos Porto Auxiliar Administrativo - Financeiro (C-0009) BRL Financeiro nathali.porto@acpo.com.br Sede Administrativa PA
Ana Laura Farias Nunes Pereira Analista Técnico(a) - Obras (C-0136) BRL Engenharia (1) ana.pereira@acpo.com.br Solanas PC
Matheus Fonseca Rodrigues Diretor Comercial (C-0156) BRL Direção matheus.rodrigues@acpo.com.br Sede Administrativa EC
Talita Nunes Soares Assistente de Orçamentos - (C-0107) BRL Orçamentos - Técnico talita.soares@acpo.com.br Sede Administrativa PA
Thauany Vergara Brum Assistente Técnico (C-0055) BRL Engenharia (1) thauany.brum@acpo.com.br Solanas EC
Claison de Paula da Fonseca Mecânico Líder (C-0071) BRL Manutenção claison.fonseca@gmail.com Sede Administrativa A
Moacir da Silva Bilhalva Chapista de Veículos (C-0127) BRL Manutenção moacirbilhalva@yahoo.com.br Sede Administrativa 
Alexandre da Silva Mecânico (C-0130) BRL Manutenção alexandeacpo@gmail.com Sede Administrativa E
Simone Marques Gomes Auxiliar de Serviços Gerais (C-0057) BRL Conservação simonemgomes720@gmail.com Sede Administrativa E
Diego dos Anjos Rockembach Vigia (C-0053) BRL Apoio/Segurança rockembach.diego1985@gmail.com Sede Administrativa AP
Dagoberto Antunes Leal Presidente (Conselho) BRL Presidência dagoberto@acpo.com.br Sede Administrativa 
Gabriela Rodrigues Rubim Coordenador(a) Comercial (C-0090) BRL Comercial gabriela.rubim@acpo.com.br Sede Administrativa CEP
Luana Braiz Gonçalves Projetista - Legalizações (C-0047) BRL Projetos luana.braiz@acpo.com.br Sede Administrativa CE
Rafaela Dias Gonçalves Assistente Técnico (pós-obra) (C-0055) BRL Assistência Técnica (Pós-Obra) rafaela.dias@acpo.com.br Sede Administrativa AE
Maicon Borges Cardoso Mestre de Obras (C-0042) BRL Operação (1) maicon.cardoso@acpo.com.br Moov 2 EC
Leonardo Karini Leitzke Auxiliar Administrativo - Financeiro (C-0009) BRL Financeiro leonardo.karini@acpo.com.br Sede Administrativa EA
Pedro Ezequiel Bauer Nunes De Almeida Analista de Marketing (C-150) BRL Marketing pedro.ezequiel@acpo.com.br Sede Administrativa P
Fábio Pereira Leal Coordenador de Obras (C-0024) BRL Engenharia (1) fabio.leal@acpo.com.br Moov 2 A
Alessandra Dias Alves Assistente de Orçamentos - (C-0107) BRL Orçamentos - Técnico alessandra.alves@acpo.com.br Sede Administrativa AP
Maurício Silva Vieira Projetista (C-0047) BRL Projetos mauricio.vieira@acpo.com.br Sede Administrativa AP
Gregori Das Neves Reinhardt Assistente Técnico de Qualidade (C-0006) BRL Engenharia (2) gregori.reinhardt@acpo.com.br Connect Duque Powered by Housi PE
Vaneza Brum Horner Auxiliar de Serviços Gerais (C-0057) BRL Conservação brumvaneza@gmail.com Sede Administrativa CPE
Hans Krumreich Maltzhan Assistente Técnico (C-0055) BRL Engenharia (2) hans.maltzhan@acpo.com.br Direct PCE
Giovana Oliveira de Andrade Analista de Marketing (C-150) BRL Marketing giovana.andrade@acpo.com.br Sede Administrativa EC
Eduardo Soria Marques Viabilizador de Vendas (C-0164) BRL Comercial eduardo.marques@acpo.com.br Sede Administrativa CP
Adriane Silveira dos Santos Coordenador(a) Comercial (C-0090) BRL Comercial adriane.santos@acpo.com.br Sede Administrativa CE
Natália Lohmann D' Ávila Projetista (C-0047) BRL Projetos natalia.lohmann@acpo.com.br Sede Administrativa AP
Jorge Langlois Bouchahine Coordenador(a) Comercial (C-0090) BRL Comercial jorge.bouchahine@acpo.com.br Sede Administrativa ACP
Giovana Martins da Silva Jovem Aprendiz (C-0076) BRL Outro giovana.silva@acpo.com.br Sede Administrativa EC
Henrique Oliveira Janner Auxiliar Técnico (C-0013) BRL Engenharia (1) henrique.janner@acpo.com.br SPE MOOV PC
Bruna Fick Pacheco Projetista - Complementar (C-0047) BRL Projetos bruna.fick@acpo.com.br Sede Administrativa EC
Eliziane Rochel Gonçalves Assistente de Marketing (C-0128) BRL Marketing eliziane.rochel@acpo.com.br Sede Administrativa EAP
Magno Peres de Oliveira Mestre de Obras (C-0042) BRL Operação (2) magno.oliveira@acpo.com.br Joy Residence E
Daniel de Paula Martins Auxiliar de Almoxarifado (C-0010) BRL Almoxarifado (2) danielmartinsdm4266779@gmail.com Joy Residence EP
Guilherme Borges Lages Auxiliar Administrativo (OBRAS) (C-0009) BRL Administrativos de obra guilherme.lages@acpo.com.br Connect Duque Powered by Housi P
Carina Medeiros Almoxarife (C-0001) BRL Almoxarifado (2) carina.medeiros@acpo.com.br Connect Duque Powered by Housi EP
Andressa Corrêa de Barros Assistente Técnico (C-0055) BRL Engenharia (2) andressa.barros@acpo.com.br Reserva Home Club PEA
Dilsilene Rosa da Fonseca Analista Técnico(a) - Obras (C-0136) BRL Engenharia (1) dilsilene.fonseca@acpo.com.br Moov 2 E
Joice Peres Ramos Auxiliar de Segurança do Trabalho (C-0100) BRL Segurança do Trabalho joice.ramos@acpo.com.br Moov 2 CE
Claudiane Rafaela Carvalho da Rocha Almoxarife (C-0001) BRL Almoxarifado (1) claucarvalhocr2@gmail.com Moov 2 EC
Cassio Peter Lautenschlager Assistente Técnico (pós-obra) (C-0055) BRL Engenharia (1) cassio.lautenschlager@acpo.com.br Riviera AEP
Miriam Costa Alves Auxiliar Administrativo (SAC) (C-0009) BRL Serviço de Atendimento ao Cliente miriam.alves@acpo.com.br Sede Administrativa E
Taiane de Freitas Gonçalves Auxiliar de Controladoria (C-0131) BRL Controladoria taiane.goncalves@acpo.com.br Sede Administrativa PA
Milene Valli Quadros Almoxarife (C-0001) BRL Almoxarifado (2) milene.quadros@acpo.com.br Joy Residence EP
Bruna Valeria de Moraes Amaral Coordenador (a) Contábil BRL Contabilidade bruna.amaral@acpo.com.br Sede Administrativa EC
Lucas Montano Boetege Assistente Técnico (C-0055) BRL Engenharia (1) lucas.boetege@acpo.com.br Moov 2 CE
Paulo Roberto dos Santos Salum Assistente Técnico (C-0055) BRL Engenharia (1) paulo.salum@acpo.com.br Solanas 
Tamara Bohrer Rickes Auxiliar Técnico (C-0013) BRL Engenharia (1) tamara.rickes@acpo.com.br SPE MOOV AEC
Pierre Silveira da Cruz Encarregado de Civil (C-0084) BRL Operação (1) pierre153398@gmail.com Solanas PC
Lieser Almeida Wickbolt Auxiliar Administrativo (OBRAS) (C-0009) BRL Administrativos de obra lieseralmeida@gmail.com Joy Residence CE
Joyce Caroline da Silva Marques Assistente Comercial (C-0005) BRL Comercial joyceec.moraes@gmail.com Sede Administrativa CP
Jeruza da Silva Machado Auxiliar Administrativo (OBRAS) (C-0009) BRL Administrativos de obra adm.86@outlook.com Solanas CE
Julia Cardoso Würdig Advogado(a) (C-0109) BRL Jurídico juliaawurdig@gmail.com Sede Administrativa AP
Daniela Antiqueira dos Santos Analista Comercial (C-0147) BRL Comercial daniiantiqueira@gmail.com Sede Administrativa 
Jacqueline Corrêa moraes Técnico(a) em Segurança do Trabalho (C-0052) BRL Segurança do Trabalho jacquemoraestst@gmail.com Joy Residence EPC
Mauricio Nunes de Oliveira Assistente Técnico (pós-obra) (C-0055) BRL Assistência Técnica (Pós-Obra) mauricio.nunes.oliv@gmail.com Assistência Técnica PC
Ederson Rogerio Martins dos Passos Almoxarife (C-0001) BRL Almoxarifado (1) rogeriopassos130882@gmail.com Solanas 
Fabricio Da Silva Wasieleski Pereira Auxiliar Técnico de Qualidade (C-0132) BRL Engenharia (1) fabriciosengcivil@gmail.com SPE MOOV E
Rafaela Cardoso Pereira Auxiliar Técnico (C-0013) BRL Engenharia (1) rafaela170302@gmail.com Life RG PC
Jonathas Rafael Ucker Viabilizador de Vendas (C-0164) BRL Comercial jonathasucker6@gmail.com Sede Administrativa 
Fabiana Madruga Gonçalves Auxiliar Administrativo - Financeiro (C-0009) BRL Financeiro fabianagmadruga@gmail.com Sede Administrativa EP
Nathália Dorow dos Santos Auxiliar técnico(a) - Pós-obra (C-0013) BRL Assistência Técnica (Pós-Obra) nathaliadorow@gmail.com Assistência Técnica AP
Krisley Marques Gonçalves Assistente Técnico (C-0055) BRL Engenharia (2) krismarquesg@gmail.com Joy Residence A
Laís da Cruz de Lima Jovem Aprendiz (C-0076) BRL Outro lais.lima@acpo.com.br Sede Administrativa PA
Manoela de Borba Prohl Jovem Aprendiz (C-0076) BRL Outro manoela.prohl@acpo.com.br Sede Administrativa 
Vitoria Rosário Rosa Quevedo Auxiliar de Contabilidade (C-0072) BRL Contabilidade vitoria.quevedo@acpo.com.br Sede Administrativa AP
Alessandra costa cardoso Assistente financeiro - Cobrança (C-0007) BRL Financeiro alessandra.ac953@gmail.com Sede Administrativa AP
ketlen guimarães cavalheiro Período de Experiência BRL Comercial ketlenguimaraes10@gmail.com Sede Administrativa EP
Kevin Leal Dias Auxiliar Administrativo (OBRAS) (C-0009) BRL Administrativos de obra kevinrkr@hotmail.com Life RG CE
Leonardo Mulling Sainz Auxiliar Técnico de Qualidade (C-0132) BRL Engenharia (1) leonardo.m.sainz@gmail.com Moov 2 PA
Bruno de Souza Gonçalves Psicólogo(a) Organizacional (C-0118) BRL Gestão de Pessoas bruno.goncalves@acpo.com.br Sede Administrativa PE
Francine Rodrigues Duarte Jovem Aprendiz (C-0076) BRL Outro francineduarte2023@gmail.com Sede Administrativa P
Kaiane Medina Teixeira Período de Experiência BRL Recepção medinateixeirakaiane@yahoo.com.br Sede Administrativa A
Otávio Rockembach Machado Período de Experiência BRL Engenharia (2) otaviormachado10@gmail.com Joy Residence AP
Suelen Dias Cavalheiro Auxiliar de Serviços Gerais (C-0057) BRL Conservação suelendias2907@gmail.com Sede Administrativa 
Isaias de jesus Fernandes Período de Experiência BRL Almoxarifado (2) isaiasfernandes147@gmail.com Joy 2 PC
João Paulo Ferreira Porto Período de Experiência BRL Operação (2) joaopaulofpengenharia@gmail.com Connect Duque Powered by Housi PAE
Ludson Kennedy valadão Ayres Período de Experiência BRL Engenharia (2) ludsonkennedym@gmail.com Joy 2 
Nicolas Coelho Boetege Período de Experiência BRL Engenharia (1) nicolasboetege02@gmail.com Solanas CE
Alessandro Machado Barros Período de Experiência BRL Compras alessandro.m.barros@gmail.com Sede Administrativa AP
Larissa Moreira Romero Período de Experiência BRL Orçamentos - Técnico larisrmr@gmail.com Sede Administrativa EA
Pamela Sell dos Santos Período de Experiência BRL Jurídico pamelaselldossantos@gmail.com Sede Administrativa EA
Samuel Borba Soares Período de Experiência BRL Segurança do Trabalho samuel_borbasoares@hotmail.com Solanas CEP
Thales Ferreira Franco Período de Experiência BRL Financeiro thales.franco@gmail.com Sede Administrativa EP
Maria Conceição Da Silva Ferreira Período de Experiência BRL Financeiro maria_conceicao_ferreira@hotmail.com Sede Administrativa 
Érica Azevedo Paz ESTAGIÁRIO (A) ENGENHARIA CIVIL CANTEIRO BRL Engenharia (2) erica.paz03@gmail.com A
`;

const lines = ocrText.trim().split('\n');
const results = [];

for (let line of lines) {
    if (!line.includes('BRL')) continue;

    // The line format is: [Nome] [Cargo] BRL [Departamento] [Email] [Unidade] [Perfil?]
    // Let's split by BRL
    const parts = line.split(' BRL ');
    if (parts.length !== 2) continue;
    
    let left = parts[0].trim();
    let right = parts[1].trim();

    // From left: Nome and Cargo. Cargo often has (C-XXXX) or ends before it.
    // We can assume Cargo starts with the last 2-4 words if no (C-XXXX), but usually it has it.
    // Looking at the data, let's use a regex to capture Cargo. 
    // Cargo usually ends right before BRL. Let's find common keywords or split by the first occurrence of a known title (Coordenador, Supervisor, Diretor, Analista, Técnico, etc.)
    const cargoMatches = left.match(/(Coordenador|Supervisor|Diretor|Analista|Técnico|Assistente|Mecânico|Chapista|Vigia|Presidente|Projetista|Mestre|Psicólogo|Auxiliar|Encarregado|Advogado|Jovem|Período|ESTAGIÁRIO)(.*)/i);
    let nome = left;
    let cargo = '';
    
    if (cargoMatches) {
        cargo = cargoMatches[0].trim();
        nome = left.substring(0, left.length - cargo.length).trim();
    } else {
        // fallback
        const words = left.split(' ');
        if (words.length > 2) {
            cargo = words.slice(-2).join(' ');
            nome = words.slice(0, -2).join(' ');
        }
    }

    // Right side: [Departamento] [Email] [Unidade] [Perfil]
    // Email is easy to find
    const emailMatch = right.match(/\\S+@\\S+/);
    let email = '';
    let departamento = '';
    let rest = right;
    
    if (emailMatch) {
        email = emailMatch[0];
        const emailIndex = right.indexOf(email);
        departamento = right.substring(0, emailIndex).trim();
        rest = right.substring(emailIndex + email.length).trim();
    } else {
        // "A" is the only email missing for Érica
        if (nome.includes('Érica')) {
            email = 'erica.paz03@gmail.com';
            departamento = 'Engenharia (2)';
            rest = 'A';
        }
    }

    // Unidade and Perfil are in 'rest'
    // Perfil is usually 1-3 uppercase letters at the very end.
    const perfilMatch = rest.match(/\\s+([A-Z]{1,3})$/);
    let unidadeRaw = rest;
    if (perfilMatch) {
        unidadeRaw = rest.substring(0, rest.length - perfilMatch[0].length).trim();
    }

    // Determine Sede vs Obra
    let unidadeType = 'Obra';
    const uLower = unidadeRaw.toLowerCase();
    if (uLower.includes('sede') || uLower.includes('direct') || uLower.includes('assistência técnica')) {
        unidadeType = 'Sede';
    }

    results.push({
        nome: nome,
        departamento: departamento,
        email: email,
        cargo: cargo,
        unidade: unidadeType,
        unidade_raw: unidadeRaw
    });
}

fs.writeFileSync('colaboradores_extraidos.json', JSON.stringify(results, null, 2));
console.log('Saved ' + results.length + ' records.');
