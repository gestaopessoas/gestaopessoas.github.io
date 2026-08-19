# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ponto_edicao.spec.ts >> Ponto - Edição de horas >> Deve acessar configurações e verificar histórico de ponto
- Location: e2e\ponto_edicao.spec.ts:48:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard**" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: Entrar
        - generic [ref=e7]: Acesse o painel de gestao de pessoas da ACPO.
      - generic [ref=e8]:
        - generic [ref=e9]: Invalid login credentials
        - generic [ref=e10]:
          - generic [ref=e11]: E-mail
          - textbox "E-mail" [ref=e12]: bruno.goncalves@acpo.com.br
        - generic [ref=e13]:
          - generic [ref=e14]: Senha
          - textbox "Senha" [ref=e15]: ACPO@2026
      - button "Entrar" [ref=e17]
  - button "Open Next.js Dev Tools" [ref=e23] [cursor=pointer]
  - alert [ref=e27]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Ponto - Edição de horas', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Autenticação
  6  |     await page.goto('/login');
  7  |     await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
  8  |     await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
  9  |     await page.click('button[type="submit"]');
> 10 |     await page.waitForURL('**/dashboard**', { timeout: 60000 });
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  11 |   });
  12 | 
  13 |   test('Deve visualizar e editar o ponto de um colaborador na aba diário', async ({ page }) => {
  14 |     // Acessa a página de Ponto
  15 |     await page.goto('/dashboard/ponto');
  16 |     
  17 |     // Clica na aba de Lançamentos Manuais
  18 |     await page.click('button:has-text("Lançamentos Manuais")');
  19 | 
  20 |     // Espera a tabela carregar e mostrar registros 
  21 |     // Pode estar vazia inicialmente se não houver colaboradores ativos ou se mock for necessário, 
  22 |     // mas a UI deve renderizar "Nenhum registro" ou a tabela
  23 |     await expect(page.locator('text=Apontamentos Diários')).toBeVisible();
  24 |     await expect(page.locator('text=Data do Ponto')).toBeVisible();
  25 | 
  26 |     // Como estamos em E2E em um banco que não sabemos os dados exatos, 
  27 |     // apenas validamos se a tabela ou o botão "Editar" de algum registro existe.
  28 |     // Se existir, clicamos e tentamos editar.
  29 |     const editarButton = page.locator('button:has-text("Editar")').first();
  30 |     
  31 |     if (await editarButton.isVisible()) {
  32 |       await editarButton.click();
  33 |       
  34 |       // O input de motivo deve aparecer
  35 |       const motivoInput = page.getByPlaceholder('Motivo (obrigatório)');
  36 |       await expect(motivoInput).toBeVisible();
  37 |       
  38 |       // Preenche um motivo e cancela para não afetar o banco real de testes
  39 |       await motivoInput.fill('Teste automatizado E2E');
  40 |       
  41 |       const cancelarBtn = page.locator('button:has-svg.lucide-x').first();
  42 |       await cancelarBtn.click();
  43 |       
  44 |       await expect(motivoInput).not.toBeVisible();
  45 |     }
  46 |   });
  47 | 
  48 |   test('Deve acessar configurações e verificar histórico de ponto', async ({ page }) => {
  49 |     // Acessa configurações
  50 |     await page.goto('/dashboard/configuracoes');
  51 |     
  52 |     // Clica na aba Histórico do Ponto
  53 |     await page.click('button:has-text("Histórico do Ponto")');
  54 |     
  55 |     // Espera carregar e verifica a presença do título da tabela
  56 |     await expect(page.locator('text=Histórico de Edição de Ponto')).toBeVisible();
  57 |     await expect(page.getByPlaceholder('Buscar por colaborador...')).toBeVisible();
  58 |   });
  59 | });
  60 | 
```