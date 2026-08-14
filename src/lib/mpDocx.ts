// Gera a MP de contratação em DOCX seguindo o formulário impresso da ACPO
// (Assinatura.pdf, Rev.04): faixa dourada, seções numeradas em badge, rótulo
// cinza sobre caixa branca, bloco de aprovações e rodapé de controle.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
} from "docx";

// TODO(bruno): confirmar o codigo de controle do documento; no PDF ele sai
// ilegivel na extracao. Trocar aqui quando tiver o texto exato.
export const MP_CONTROL_CODE = "ACPO-RH-FOR-001";
export const MP_REVISION = "Rev.04";

const GOLD = "DEAA30";
const PANEL = "F4F4F4";
const BOX_BORDER = "C9CCCE";
const LABEL_TEXT = "4B5057";
const TITLE_TEXT = "2B2F33";
const WHITE = "FFFFFF";

const FONT = "Calibri";

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
  /** Texto livre quando a razão é "Outros". */
  customReason: string;
  replacementOf: string;
  justification: string;
  createdAt: string;
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
const boxBorder: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: BOX_BORDER };

const text = (value: string, opts: { size?: number; bold?: boolean; color?: string; caps?: boolean } = {}) =>
  new TextRun({
    text: opts.caps ? value.toUpperCase() : value,
    font: FONT,
    size: opts.size ?? 18,
    bold: opts.bold,
    color: opts.color ?? TITLE_TEXT,
  });

/** Rótulo pequeno em cinza, como no formulário impresso. */
const label = (value: string) =>
  new Paragraph({
    spacing: { before: 60, after: 30 },
    children: [text(value, { size: 15, color: LABEL_TEXT })],
  });

/** Caixa branca com borda fina onde entra o valor preenchido. */
const box = (value: string, lines = 1) =>
  new Paragraph({
    spacing: { after: 80, line: 300 },
    border: { top: boxBorder, bottom: boxBorder, left: boxBorder, right: boxBorder },
    shading: { fill: WHITE },
    children: [
      text(value || "", { size: 18 }),
      // Linhas extras dão altura à caixa sem depender de altura de célula.
      ...Array.from({ length: Math.max(0, lines - 1) }, () => new TextRun({ break: 1 })),
    ],
  });

const field = (name: string, value: string, lines = 1) => [label(name), box(value, lines)];

const inlineField = (name: string, value: string, lines = 1) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [text(name, { size: 15, color: LABEL_TEXT })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { after: 40, line: 300 },
                border: { top: boxBorder, bottom: boxBorder, left: boxBorder, right: boxBorder },
                shading: { fill: WHITE },
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


/** Célula de layout: sem bordas, com o fundo cinza do painel da seção. */
const panelCell = (children: (Paragraph | Table)[], width: number) =>
  new TableCell({
    children,
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: noBorders,
    shading: { fill: PANEL },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
  });

const layoutTable = (rows: TableRow[]) =>
  new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders });

/** Faixa dourada de largura total. */
const goldRule = (before = 60, after = 60) =>
  new Paragraph({
    spacing: { before, after },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
    children: [],
  });

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

/** Cabeçalho da seção: badge dourado com o número + título. */
const sectionHeader = (number: string, title: string) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 7, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: { fill: GOLD },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [text(number, { bold: true, size: 18, color: WHITE })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 93, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { left: 140 },
            children: [
              new Paragraph({ children: [text(title, { bold: true, size: 18, caps: true })] }),
            ],
          }),
        ],
      }),
    ],
  });

const checkbox = (checked: boolean, value: string) =>
  new Paragraph({
    spacing: { after: 40 },
    children: [text(`${checked ? "☒" : "☐"} ${value}`, { size: 17 })],
  });

/** Bloco de assinatura: cabeçalho cinza e área com linha dourada embaixo. */
const signatureCell = (title: string) =>
  new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: boxBorder,
      bottom: boxBorder,
      left: boxBorder,
      right: boxBorder,
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        shading: { fill: PANEL },
        children: [text(title, { bold: true, size: 17 })],
      }),
      spacer(400),
      new Paragraph({
        spacing: { before: 240, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD } },
        children: [],
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

  const titleCell = new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text("MP", { bold: true, size: 26 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text("Movimentação de Pessoal", { size: 16, caps: true, color: LABEL_TEXT })],
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
    goldRule(120, 200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [text("FORMULÁRIO DE CONTRATAÇÃO", { bold: true, size: 22, caps: true })],
    }),
    spacer(),
  ];
}

function sectionGestao(data: MpContratacaoData): Table {
  const reason = data.reason || "";
  const isOutra = Boolean(reason) && reason !== "Aumento de quadro" && reason !== "Substituição";
  const outraText = isOutra ? (reason === "Outros" ? data.customReason : reason) : "";

  return layoutTable([
    new TableRow({
      children: [
        panelCell(
          [
            ...field("Requisição da vaga (Solicitado por)", data.requestedBy),
            label("Razão da movimentação"),
            checkbox(reason === "Aumento de quadro", "Aumento de quadro"),
            checkbox(reason === "Substituição", "Substituição"),
            checkbox(isOutra, `Outra: ${outraText}`),
            ...field("Substituição de", data.replacementOf),
          ],
          48,
        ),
        panelCell([...field("Justificativa / Observações", data.justification, 10)], 52),
      ],
    }),
  ]);
}

/** Monta o documento da MP de contratação. */
export function buildMpContratacaoDocument(data: MpContratacaoData): Document {
  const children: ISectionOptions["children"] = [
    ...header(data),

    sectionHeader("01", "Identificação"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Nome do candidato", data.candidateName)], 50),
          panelCell([...field("Telefone", data.phone)], 50),
        ],
      }),
      new TableRow({
        children: [
          panelCell([...field("E-mail", data.email)], 50),
          panelCell([...field("Matrícula / Ficha", data.registration)], 50),
        ],
      }),
    ]),
    spacer(),

    sectionHeader("02", "Função e alocação"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Cargo", data.role)], 34),
          panelCell([...field("Nível (plano de carreira)", data.level)], 33),
          panelCell([...field("Código do perfil", data.profileCode)], 33),
        ],
      }),
      new TableRow({
        children: [
          panelCell([...field("Local", data.location)], 34),
          panelCell([...field("Setor", data.sector)], 33),
          panelCell([...field("Centro de custo", data.costCenter)], 33),
        ],
      }),
    ]),
    spacer(),

    sectionHeader("03", "Contrato"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Modalidade", data.modality)], 34),
          panelCell([...field("Remuneração", data.salary)], 33),
          panelCell([...field("Horário / Escala", data.schedule)], 33),
        ],
      }),
      new TableRow({
        children: [panelCell([...field("Benefícios", data.benefits, 2)], 100)],
      }),
    ]),
    spacer(),

    sectionHeader("04", "Gestão da vaga"),
    sectionGestao(data),
    spacer(),

    sectionHeader("05", "Aprovações"),
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
          panelCell([...field("Verificado por", "")], 50),
          panelCell([...field("Vigência", "____ / ____ / ________")], 50),
        ],
      }),
    ]),
    goldRule(160, 60),
    layoutTable([
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [text(`MP criada em: ${data.createdAt}`, { size: 15, color: LABEL_TEXT })],
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [text("REV.: 04", { size: 15, color: GOLD, bold: true })],
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
  logo?: { data: ArrayBuffer | Uint8Array; width: number; height: number };
};

function headerMovimentacao(data: MpMovimentacaoData): (Paragraph | Table)[] {
  const logoCell = new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
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

  const titleCell = new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [text("MP", { bold: true, size: 26 })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [text("MOVIMENTAÇÃO DE PESSOAL", { size: 16, caps: true, color: LABEL_TEXT })],
      }),
    ],
  });

  return [
    layoutTable([new TableRow({ children: [logoCell, titleCell] })]),
    goldRule(120, 200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [text("ALTERAÇÕES DE PESSOAL", { bold: true, size: 22, caps: true })],
    }),
    goldRule(0, 200),
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

    sectionHeader("01", "Identificação do Colaborador"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([...field("Nome do(a) colaborador(a)", data.candidateName)], 70),
          panelCell([...field("Telefone", data.phone)], 30),
        ],
      }),
      new TableRow({
        children: [
          panelCell([...field("E-mail", data.email)], 50),
          panelCell([...field("Matrícula", data.registration)], 25),
          panelCell([...field("Ficha", data.ficha)], 25),
        ],
      }),
    ]),
    spacer(),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                sectionHeader("02", "Dados Atuais"),
                layoutTable([
                  new TableRow({ children: [panelCell([inlineField("Cargo", data.current.role)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Nível", data.current.level)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Local", data.current.location)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Setor", data.current.sector)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Centro de custo", data.current.costCenter)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Código do perfil", data.current.profileCode)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Modalidade", data.current.modality)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Remuneração", data.current.salary)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Benefícios", data.current.benefits, 2)], 100)] }),
                ])
              ]
            }),
            arrowCell,
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                sectionHeader("03", "Dados Alterados"),
                layoutTable([
                  new TableRow({ children: [panelCell([inlineField("Cargo", data.newData.role)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Nível", data.newData.level)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Local", data.newData.location)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Setor", data.newData.sector)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Centro de custo", data.newData.costCenter)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Código do perfil", data.newData.profileCode)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Modalidade", data.newData.modality)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Remuneração", data.newData.salary)], 100)] }),
                  new TableRow({ children: [panelCell([inlineField("Benefícios", data.newData.benefits, 3)], 100)] }),
                ])
              ]
            }),
          ]
        })
      ]
    }),
    spacer(),

    sectionHeader("04", "Detalhamento da Alteração"),
    layoutTable([
      new TableRow({
        children: [
          panelCell([
            label("Razão da movimentação"),
            checkbox(data.reason === "Promoção", "Promoção"),
            checkbox(data.reason === "Transferência de local", "Transferência de local"),
            checkbox(data.reason === "Alteração de salário", "Alteração de salário"),
            checkbox(data.reason === "Inclusão / Alteração de benefício", "Inclusão / Alteração de benefício"),
            checkbox(!["Promoção", "Transferência de local", "Alteração de salário", "Inclusão / Alteração de benefício"].includes(data.reason), `Outra: ${data.reason === 'Outros' ? data.customReason : (['Promoção', 'Transferência de local', 'Alteração de salário', 'Inclusão / Alteração de benefício'].includes(data.reason) ? '' : data.reason)}`),
          ], 48),
          panelCell([...field("Justificativa / Observações", data.justification, 8)], 52),
        ],
      }),
    ]),
    spacer(),

    sectionHeader("05", "Aprovações"),
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
          panelCell([...field("Verificado por", "")], 50),
          panelCell([...field("Vigência", "____ / ____ / ________")], 50),
        ],
      }),
    ]),
    goldRule(160, 60),
    new Paragraph({
      children: [text(`MP criada em: ${data.createdAt}`, { size: 15, color: LABEL_TEXT })],
    }),
  ];

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 567, bottom: 567, left: 680, right: 680 },
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
