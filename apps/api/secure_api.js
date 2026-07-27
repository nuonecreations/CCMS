const fs = require('fs');
const path = require('path');

function secureController(filePath, adminOnly) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('JwtAuthGuard')) {
    const importRegex = /import\s+{[^}]*}\s+from\s+'@nestjs\/common';/;
    if (!content.includes('UseGuards')) {
      content = content.replace(importRegex, (match) => match.replace('{', '{ UseGuards, '));
    }
    
    let imports = `import { JwtAuthGuard } from '../auth/jwt-auth.guard';\n`;
    if (adminOnly) {
      imports += `import { RolesGuard } from '../auth/roles.guard';\nimport { Roles } from '../auth/roles.decorator';\n`;
    }
    content = content.replace(/(import .*;\n)+/g, (match) => match + imports);
    
    let decorator = `@UseGuards(JwtAuthGuard)\n`;
    if (adminOnly) {
      decorator = `@UseGuards(JwtAuthGuard, RolesGuard)\n@Roles('ADMIN')\n`;
    }
    content = content.replace(/@Controller\([^)]*\)/, (match) => decorator + match);
    
    fs.writeFileSync(filePath, content);
    console.log('Secured:', filePath);
  }
}

const controllers = [
  { p: 'src/modules/imports/import.controller.ts', admin: true },
  { p: 'src/modules/worksites/worksites.controller.ts', admin: false },
  { p: 'src/modules/customers/customers.controller.ts', admin: false },
];

controllers.forEach(c => {
  const fullPath = path.join(__dirname, c.p);
  if (fs.existsSync(fullPath)) {
    secureController(fullPath, c.admin);
  }
});
