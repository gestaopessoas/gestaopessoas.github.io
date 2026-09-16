-- O formulário de /enviar-foto passou a redimensionar e recomprimir no navegador antes de
-- subir (src/lib/imageCompress.mjs): 1600 px no maior lado, JPEG 82. Foto de celular sai de
-- 3–12 MB para algo em torno de 300 KB.
--
-- Compressão de client não vale como limite — some para quem chamar a API direto com a anon
-- key. O teto de 15 MiB existia para caber foto de celular sem compressão, e não precisa mais
-- ser tão largo. Fica em 8 MiB: com folga para o caminho de fallback, que sobe o original
-- quando o navegador não decodifica o arquivo (HEIC fora do Safari).
UPDATE storage.buckets
SET file_size_limit = 8388608
WHERE id = 'employee-photos';
