/**
 * `pdf-parse` não publica tipos e não há @types no projeto. A superfície usada
 * aqui é só o texto extraído (scripts/reconciliation_engine/parsers/dominioPdf.ts).
 */
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    version: string;
    info: Record<string, unknown>;
    metadata: unknown;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PdfParseResult>;

  export default pdfParse;
}
