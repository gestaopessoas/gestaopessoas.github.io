const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/beneficios/page.tsx', 'utf-8');

// 1. Add import
code = code.replace(
  'import { exportLunchListPdf } from "./lunchListPdf";',
  'import { exportLunchListPdf } from "./lunchListPdf";\nimport { MonthlyBenefitsTab } from "./MonthlyBenefitsTab";'
);

// 2. Add Tab Trigger
const tabsListEnd = `          <TabsTrigger value="almoco" className="flex gap-2">
            <Utensils className="w-4 h-4" />
            <span>Almoço Sede</span>
          </TabsTrigger>`;
const newTabsListEnd = `          <TabsTrigger value="almoco" className="flex gap-2">
            <Utensils className="w-4 h-4" />
            <span>Almoço Sede</span>
          </TabsTrigger>
          <TabsTrigger value="mensais" className="flex gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Lançamentos Mensais</span>
          </TabsTrigger>`;
          
// First I also need to make sure DollarSign is imported.
code = code.replace('UserMinus,\n', 'UserMinus,\n  DollarSign,\n');

code = code.replace(tabsListEnd, newTabsListEnd);

// 3. Add Tab Content at the end of the file before `</Tabs>`
const tabsContentEnd = `        </Tabs>
      </CardContent>
    </Card>
  );
}`;
const newTabsContentEnd = `          <TabsContent value="mensais">
            <MonthlyBenefitsTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}`;
code = code.replace(tabsContentEnd, newTabsContentEnd);

// Fix grid cols of TabsList to 5 instead of 4
code = code.replace('className="grid w-full grid-cols-4 mb-4"', 'className="grid w-full grid-cols-5 mb-4"');

fs.writeFileSync('src/app/dashboard/beneficios/page.tsx', code);
