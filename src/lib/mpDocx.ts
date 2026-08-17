// Gera a MP de contratação em DOCX seguindo o formulário impresso da ACPO
// (Assinatura.pdf, Rev.04): faixa dourada, seções numeradas em badge, rótulo
// cinza sobre caixa branca, bloco de aprovações e rodapé de controle.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
} from "docx";
// Com extensão: o teste roda em node, que exige o caminho explícito no ESM.
import { mpIcon, type MpIcon } from "./mpIcons.ts";

export const MP_REVISION = "REV.: 04";

// Amostrados pixel a pixel de Formulario_Contratacao_ACPO_EDITAVEL_FINAL.pdf.
const GOLD = "C98A1F"; // reguas, linha de assinatura, "REV.: 04"
const GOLD_BADGE = "BE7F03"; // preenchimento do badge numerado
const TITLE_TEXT = "0B2138"; // navy dos titulos
const LABEL_TEXT = "334155"; // rotulos dos campos
const BOX_BORDER = "C9CCCE"; // borda das caixas brancas
const RULE = "D8DBDE"; // regua fina que segue o titulo da secao
const FRAME = "B0B4BC"; // moldura da pagina
const WHITE = "FFFFFF";

const FONT = "Calibri";
/** Ícones de linha ao lado dos rótulos, na altura do texto do rótulo. */
const ICON_SIZE = 11;

export type MpContratacaoData = {
  candidateName: string;
  phone: string;
  email: string;
  registration: string;
  role: string;
  level: string;
  profileCode: string;
  location: string;
  sector: string;
  costCenter: string;
  modality: string;
  salary: string;
  schedule: string;
  benefits: string;
  requestedBy: string;
  /** Razão escolhida no formulário (marca o checkbox correspondente). */
  reason: string;
  /** Texto livre quando a razão é "Outra". */
  customReason: string;
  replacementOf: string;
  justification: string;
  createdAt: string;
  /** Usuário logado que gerou a MP. */
  generatedBy: string;
  verifiedBy: string;
  effectiveDate: string;
  /** Logo da unidade, já baixado pela página. */
  logo?: { data: ArrayBuffer | Uint8Array; width: number; height: number };
};

/** Lê largura/altura do cabeçalho IHDR de um PNG e escala para a largura pedida. */
export function pngSize(buffer: ArrayBuffer | Uint8Array, targetWidth: number) {
  const view = new DataView(buffer instanceof Uint8Array ? buffer.buffer : buffer);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height) return { width: targetWidth, height: targetWidth };
  return { width: targetWidth, height: Math.round((height / width) * targetWidth) };
}

const noBorder: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
/**
 * Para tabelas: sem `insideHorizontal`/`insideVertical` o Word desenha as
 * divisórias internas por conta própria, já que as células não trazem borda.
 */
const noTableBorders = { ...noBorders, insideHorizontal: noBorder, insideVertical: noBorder };
const boxBorder: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: BOX_BORDER };

const text = (value: string, opts: { size?: number; bold?: boolean; color?: string; caps?: boolean } = {}) =>
  new TextRun({
    text: opts.caps ? value.toUpperCase() : value,
    font: FONT,
    size: opts.size ?? 18,
    bold: opts.bold,
    color: opts.color ?? TITLE_TEXT,
  });

/** Rótulo pequeno em cinza, com o ícone de linha do formulário impresso. */
const label = (value: string, icon?: MpIcon) =>
  new Paragraph({
    spacing: { before: 40, after: 20 },
    children: [
      ...(icon
        ? [
            new ImageRun({
              type: "png",
              data: mpIcon(icon),
              transformation: { width: ICON_SIZE, height: ICON_SIZE },
            }),
            new TextRun({ text: "  " }),
          ]
        : []),
      text(value, { size: 15, color: LABEL_TEXT }),
    ],
  });

/** Caixa branca com borda fina onde entra o valor preenchido. */
const box = (value: string, lines = 1) =>
  new Paragraph({
    spacing: { after: 50, line: 260 },
    border: { top: boxBorder, bottom: boxBorder, left: boxBorder, right: boxBorder },
    shading: { fill: WHITE },
    children: [
      text(value || "", { size: 18 }),
      // Linhas extras dão altura à caixa sem depender de altura de célula.
      ...Array.from({ length: Math.max(0, lines - 1) }, () => new TextRun({ break: 1 })),
    ],
  });

const field = (name: string, value: string, icon?: MpIcon, lines = 1) => [
  label(name, icon),
  box(value, lines),
];

const inlineField = (name: string, value: string, icon?: MpIcon, lines = 1) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: noTableBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [label(name, icon)],
          }),
          // A borda vai na célula, não no parágrafo: bordas laterais de
          // parágrafo somem quando a célula não tem margem para desenhá-las.
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            borders: { top: boxBorder, bottom: boxBorder, left: boxBorder, right: boxBorder },
            shading: { fill: WHITE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              new Paragraph({
                spacing: { after: 0, line: 260 },
                children: [
                  text(value || "", { size: 18 }),
                  ...Array.from({ length: Math.max(0, lines - 1) }, () => new TextRun({ break: 1 })),
                ],
              })
            ],
          }),
        ],
      }),
    ],
  });


/**
 * Célula de layout dos campos. O formulário impresso é branco — o painel cinza
 * que existia aqui não vem da referência.
 */
// Sem `borders` próprio: borda de célula vence borda de tabela no Word, e isso
// apagaria o card de `cardTable`. Quem não quer borda usa `layoutTable`.
const panelCell = (children: (Paragraph | Table)[], width: number, columnSpan?: number) =>
  new TableCell({
    children,
    width: { size: width, type: WidthType.PERCENTAGE },
    columnSpan,
    shading: { fill: WHITE },
    margins: { top: 40, bottom: 40, left: 120, right: 120 },
  });

const layoutTable = (rows: TableRow[]) =>
  new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: noTableBorders,
  });

/**
 * Envolve os campos de uma seção no card de borda fina do formulário impresso.
 * O preenchimento do card na referência é #FCFCFC contra uma página #FEFEFE —
 * imperceptível no papel, então só a borda é reproduzida.
 */
const cardTable = (rows: TableRow[]) =>
  new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
  });

/** Faixa dourada de largura total. */
const goldRule = (before = 60, after = 60) =>
  new Paragraph({
    spacing: { before, after },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
    children: [],
  });

const spacer = (after = 80) => new Paragraph({ spacing: { after }, children: [] });

/**
 * O Word funde duas tabelas coladas uma na outra, e aí o cabeçalho da seção
 * herda as colunas da tabela de campos — o badge vira uma faixa dourada. Este
 * parágrafo de altura zero separa as duas sem ocupar espaço.
 */
const tableBreak = () =>
  new Paragraph({
    spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACTLY },
    children: [],
  });

/** Moldura fina em volta do conteúdo, como a borda do formulário impresso. */
const framePart: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: FRAME, space: 18 };
const pageFrame = {
  pageBorders: { offsetFrom: PageBorderOffsetFrom.TEXT, display: PageBorderDisplay.ALL_PAGES },
  pageBorderTop: framePart,
  pageBorderRight: framePart,
  pageBorderBottom: framePart,
  pageBorderLeft: framePart,
};

/**
 * Cabeçalho da seção como no formulário impresso: badge dourado com o número,
 * título navy em caixa alta, e uma régua cinza fina ocupando o resto da linha.
 * `titleWidth` sobe nas colunas estreitas da MP de movimentação, onde o título
 * divide 45% da página com a coluna vizinha.
 */
const sectionHeader = (number: string, title: string, titleWidth = 34): (Paragraph | Table)[] => [
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Sem layout fixo o Word reparte as colunas pelo conteúdo e o badge come a linha.
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { fill: GOLD_BADGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 30, bottom: 30, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [text(number, { bold: true, size: 17, color: WHITE })],
              }),
            ],
          }),
          new TableCell({
            width: { size: titleWidth, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { left: 120 },
            children: [
              new Paragraph({ children: [text(title, { bold: true, size: 18, caps: true })] }),
            ],
          }),
          // Régua que acompanha o título até a margem.
          new TableCell({
            width: { size: 100 - 6 - titleWidth, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 60 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
                children: [],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
  tableBreak(),
];

const checkbox = (checked: boolean, value: string) =>
  new Paragraph({
    spacing: { after: 40 },
    children: [
      text(`${checked ? "☒" : "☐"} ${value}`, {
        size: checked ? 19 : 17,
        bold: checked,
        color: checked ? GOLD : LABEL_TEXT,
      }),
    ],
  });

/** Bloco de assinatura: título, espaço para assinar, linha dourada e legenda. */
const signatureCell = (title: string) =>
  new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: boxBorder,
      bottom: boxBorder,
      left: boxBorder,
      right: boxBorder,
    },
    margins: { left: 220, right: 220 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 60 },
        children: [text(title, { bold: true, size: 17 })],
      }),
      spacer(400),
      new Paragraph({
        spacing: { before: 240, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
        children: [],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 80 },
        children: [text("Assinatura", { size: 15, color: LABEL_TEXT })],
      }),
    ],
  });

function header(data: MpContratacaoData): (Paragraph | Table)[] {
  const logoCell = new TableCell({
    width: { size: 34, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: data.logo
          ? [
              new ImageRun({
                type: "png",
                data: data.logo.data,
                transformation: { width: data.logo.width, height: data.logo.height },
              }),
            ]
          : [],
      }),
    ],
  });

  // Divisória vertical fina entre o logo e o bloco "MP", como no impresso.
  const titleCell = new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
    verticalAlign: VerticalAlign.CENTER,
    margins: { left: 240 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text("MP", { bold: true, size: 26 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text("Movimentação de Pessoal", { size: 15, caps: true, color: LABEL_TEXT })],
      }),
    ],
  });

  const codeCell = new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [],
  });

  return [
    layoutTable([new TableRow({ children: [logoCell, titleCell, codeCell] })]),
    goldRule(100, 160),
    pageTitle("Formulário de Contratação"),
    spacer(60),
  ];
}

/** Título da página entre duas réguas douradas curtas, como no impresso. */
function pageTitle(title: string): Table {
  const rule = (width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      borders: noBorders,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          spacing: { before: 40, after: 40 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
          children: [],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: noTableBorders,
    rows: [
      new TableRow({
        children: [
          rule(22),
          new TableCell({
            width: { size: 56, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 40, after: 40 },
                children: [text(title, { bold: true, size: 22, caps: true })],
              }),
            ],
          }),
          rule(22),
        ],
      }),
    ],
  });
}

function sectionGestao(data: MpContratacaoData): Table {
  const reason = data.reason || "";
  const isOutra = Boolean(reason) && reason !== "Aumento de quadro" && reason !== "Substituição";
  const outraText = isOutra ? (reason === "Outra" ? data.customReason : reason) : "";

  return layoutTable([
    new TableRow({
      children: [
        panelCell(
          [
            ...field("Requisição da vaga (Solicitado por)", data.requestedBy, "userCheck"),
            label("Razão da movimentação", "clipboard"),
            checkbox(reason === "Aumento de quadro", "Aumento de quadro"),
            checkbox(reason === "Substituição", "Substituição"),
            checkbox(isOutra, `Outra: ${outraText}`),
            ...field("Substituição de", data.replacementOf, "user"),
          ],
          48,
        ),
        panelCell([...field("Justificativa / Observações", data.justification, "message", 11)], 52),
      ],
    }),
  ]);
}

/** Monta o documento da MP de contratação. */
export function buildMpContratacaoDocument(data: MpContratacaoData): Document {
  const children: ISectionOptions["children"] = [
    ...header(data),

    ...sectionHeader("01", "Identificação"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Nome do candidato", data.candidateName, "user")], 50),
          panelCell([...field("Telefone", data.phone, "phone")], 50),
        ],
      }),
      new TableRow({
        children: [
          panelCell([...field("E-mail", data.email, "mail")], 50),
          panelCell([...field("Matrícula / Ficha", data.registration, "badge")], 50),
        ],
      }),
    ]),
    spacer(),

    ...sectionHeader("02", "Função e alocação"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Cargo", data.role, "briefcase")], 34),
          panelCell([...field("Nível (plano de carreira)", data.level, "level")], 33),
          panelCell([...field("Código do perfil", data.profileCode, "user")], 33),
        ],
      }),
      new TableRow({
        children: [
          panelCell([...field("Local", data.location, "pin")], 34),
          panelCell([...field("Setor", data.sector, "building")], 33),
          panelCell([...field("Centro de custo", data.costCenter, "money")], 33),
        ],
      }),
    ]),
    spacer(),

    // O impresso traz três colunas aqui; Horário / Escala não é impresso.
    ...sectionHeader("03", "Contrato"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Modalidade", data.modality, "file")], 34),
          panelCell([...field("Remuneração", data.salary, "money")], 33),
          panelCell([...field("Benefícios", data.benefits, "gift")], 33),
        ],
      }),
    ]),
    spacer(),

    ...sectionHeader("04", "Gestão da vaga"),
    sectionGestao(data),
    spacer(),

    ...sectionHeader("05", "Aprovações"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            signatureCell("Coordenador / Requisitante"),
            signatureCell("Diretoria / Presidência"),
          ],
        }),
      ],
    }),
    spacer(200),

    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Verificado por", data.verifiedBy, "userCheck")], 50),
          panelCell([...field("Vigência", data.effectiveDate || "____ / ____ / ________", "calendar")], 50),
        ],
      }),
    ]),
    layoutTable([
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  text(`MP criada em: ${data.createdAt}`, { size: 15, color: LABEL_TEXT }),
                  ...(data.generatedBy
                    ? [text(`   ·   Gerada por: ${data.generatedBy}`, { size: 15, color: LABEL_TEXT })]
                    : []),
                ],
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [text(MP_REVISION, { size: 15, color: GOLD, bold: true })],
              })
            ]
          }),
        ],
      }),
    ]),
  ];

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            // A4 com margens estreitas, como o formulário impresso.
            size: { width: 11906, height: 16838 },
            margin: { top: 567, bottom: 567, left: 680, right: 680 },
            borders: pageFrame,
          },
        },
        children,
      },
    ],
  });
}

/** Gera o .docx pronto para download. */
export const buildMpContratacaoDocx = (data: MpContratacaoData): Promise<Blob> =>
  Packer.toBlob(buildMpContratacaoDocument(data));


export type MpMovimentacaoData = {
  candidateName: string;
  phone: string;
  email: string;
  registration: string;
  ficha: string;
  current: {
    role: string;
    level: string;
    location: string;
    sector: string;
    costCenter: string;
    profileCode: string;
    modality: string;
    salary: string;
    benefits: string;
  };
  newData: {
    role: string;
    level: string;
    location: string;
    sector: string;
    costCenter: string;
    profileCode: string;
    modality: string;
    salary: string;
    benefits: string;
  };
  reason: string;
  customReason: string;
  justification: string;
  requestedBy: string;
  createdAt: string;
  /** Usuário logado que gerou a MP. */
  generatedBy: string;
  verifiedBy: string;
  effectiveDate: string;
  logo?: { data: ArrayBuffer | Uint8Array; width: number; height: number };
};

function headerMovimentacao(data: MpMovimentacaoData): (Paragraph | Table)[] {
  const logoCell = new TableCell({
    width: { size: 34, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: data.logo
          ? [
              new ImageRun({
                type: "png",
                data: data.logo.data,
                transformation: { width: data.logo.width, height: data.logo.height },
              }),
            ]
          : [],
      }),
    ],
  });

  // Como no impresso: divisória fina e o bloco "MP" logo à direita dela.
  const titleCell = new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
    verticalAlign: VerticalAlign.CENTER,
    margins: { left: 240 },
    children: [
      new Paragraph({ children: [text("MP", { bold: true, size: 26 })] }),
      new Paragraph({
        children: [text("Movimentação de Pessoal", { size: 15, caps: true, color: LABEL_TEXT })],
      }),
    ],
  });

  const codeCell = new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [],
  });

  return [
    layoutTable([new TableRow({ children: [logoCell, titleCell, codeCell] })]),
    goldRule(100, 160),
    pageTitle("Alterações de Pessoal"),
    spacer(60),
  ];
}

const arrowCell = new TableCell({
  width: { size: 10, type: WidthType.PERCENTAGE },
  borders: noBorders,
  verticalAlign: VerticalAlign.CENTER,
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [text("→", { size: 24, bold: true, color: GOLD })],
    })
  ]
});

export function buildMpMovimentacaoDocument(data: MpMovimentacaoData): Document {
  const children: ISectionOptions["children"] = [
    ...headerMovimentacao(data),

    ...sectionHeader("01", "Identificação do Colaborador"),
    // Card único de 3 colunas: com layout fixo a grade vem da primeira linha,
    // então o nome ocupa duas colunas em vez de a linha ter contagem própria.
    cardTable([
      new TableRow({
        children: [
          panelCell([...field("Nome do(a) colaborador(a)", data.candidateName, "user")], 75, 2),
          panelCell([...field("Telefone", data.phone, "phone")], 25),
        ],
      }),
      new TableRow({
        children: [
          panelCell([...field("E-mail", data.email, "mail")], 50),
          panelCell([...field("Matrícula", data.registration, "badge")], 25),
          panelCell([...field("Ficha", data.ficha, "file")], 25),
        ],
      }),
    ]),
    spacer(),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noTableBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                ...sectionHeader("02", "Dados Atuais"),
                cardTable([
                  new TableRow({ children: [panelCell([inlineField("Cargo", data.current.role, "briefcase")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Nível", data.current.level, "level")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Local", data.current.location, "pin")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Setor", data.current.sector, "building")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Centro de custo", data.current.costCenter, "money")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Código do perfil", data.current.profileCode, "user")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Modalidade", data.current.modality, "file")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Remuneração", data.current.salary, "money")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Benefícios", data.current.benefits, "gift", 2)], 100)] }),
                ])
              ]
            }),
            arrowCell,
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                ...sectionHeader("03", "Dados Alterados"),
                cardTable([
                  new TableRow({ children: [panelCell([inlineField("Cargo", data.newData.role, "briefcase")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Nível", data.newData.level, "level")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Local", data.newData.location, "pin")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Setor", data.newData.sector, "building")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Centro de custo", data.newData.costCenter, "money")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Código do perfil", data.newData.profileCode, "user")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Modalidade", data.newData.modality, "file")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Remuneração", data.newData.salary, "money")], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Benefícios", data.newData.benefits, "gift", 3)], 100)] }),
                ])
              ]
            }),
          ]
        })
      ]
    }),
    spacer(),

    ...sectionHeader("04", "Detalhamento da Alteração"),
    cardTable([
      new TableRow({
        children: [
          panelCell([
            label("Razão da movimentação", "clipboard"),
            checkbox(data.reason === "Promoção", "Promoção"),
            checkbox(data.reason === "Progressão Horizontal", "Progressão Horizontal"),
            checkbox(data.reason === "Reajuste Anual", "Reajuste Anual"),
            checkbox(data.reason === "Enquadramento", "Enquadramento"),
          ], 48),
          panelCell([...field("Justificativa / Observações", data.justification, "message", 8)], 52),
        ],
      }),
    ]),
    spacer(),

    ...sectionHeader("05", "Aprovações"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            signatureCell("Coordenador / Requisitante"),
            signatureCell("Diretoria / Presidência"),
          ],
        }),
      ],
    }),
    spacer(60),

    cardTable([
      new TableRow({
        children: [
          panelCell([inlineField("Verificado por:", data.verifiedBy, "userCheck")], 50),
          panelCell([inlineField("Vigência:", data.effectiveDate || "____ / ____ / ________", "calendar")], 50),
        ],
      }),
    ]),
    spacer(40),
    layoutTable([
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  text(`MP criada em: ${data.createdAt}`, { size: 15, color: LABEL_TEXT }),
                  ...(data.generatedBy
                    ? [text(`   ·   Gerada por: ${data.generatedBy}`, { size: 15, color: LABEL_TEXT })]
                    : []),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [text(MP_REVISION, { size: 15, color: GOLD, bold: true })],
              }),
            ],
          }),
        ],
      }),
    ]),
  ];

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 567, bottom: 567, left: 680, right: 680 },
            borders: pageFrame,
          },
        },
        children,
      },
    ],
  });
}

/** Gera o .docx pronto para download (Movimentação). */
export const buildMpMovimentacaoDocx = (data: MpMovimentacaoData): Promise<Blob> =>
  Packer.toBlob(buildMpMovimentacaoDocument(data));
