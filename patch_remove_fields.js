const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/colaboradores/page.tsx', 'utf-8');

// 1. Remove Variável Input Field
const varStr = `              <Field label="Variável">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">R$</span>
                  <Input inputMode="numeric" className="pl-9" placeholder="0,00" value={form.variable_salary} onChange={(e) => update("variable_salary", maskCurrencyInput(e.target.value))} />
                </div>
              </Field>`;
code = code.replace(varStr, '');

// 2. Remove Comissão Input Field
const comStr = `              <Field label="Comissão">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">R$</span>
                  <Input inputMode="numeric" className="pl-9" placeholder="0,00" value={form.commission} onChange={(e) => update("commission", maskCurrencyInput(e.target.value))} />
                </div>
              </Field>`;
code = code.replace(comStr, '');

fs.writeFileSync('src/app/dashboard/colaboradores/page.tsx', code);
