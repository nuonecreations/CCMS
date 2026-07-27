const fs = require('fs');

let srv = fs.readFileSync('src/modules/customers/customers.service.ts', 'utf8');
if (!srv.includes('async deleteComplaint(')) {
  srv = srv.replace(/}\s*$/, `
  async updateComplaint(id: number, data: any) {
    return prisma.complaint.update({
      where: { id },
      data: {
        category: data.category,
        description: data.description,
        priority: data.priority,
        status: data.status,
        assignedTo: data.assignedTo
      }
    });
  }

  async deleteComplaint(id: number) {
    return prisma.complaint.delete({ where: { id } });
  }
}
`);
  fs.writeFileSync('src/modules/customers/customers.service.ts', srv);
  console.log('Updated customers.service.ts');
}

let ctrl = fs.readFileSync('src/modules/customers/customers.controller.ts', 'utf8');
if (!ctrl.includes('deleteComplaint(')) {
  if (!ctrl.includes('Delete }')) ctrl = ctrl.replace(/@nestjs\/common';/, `, Delete } from '@nestjs/common';`);
  ctrl = ctrl.replace(/}\s*$/, `
  @Delete('complaints/:id')
  async deleteComplaint(@Param('id') id: string) {
    return this.customersService.deleteComplaint(+id);
  }
}
`);
  fs.writeFileSync('src/modules/customers/customers.controller.ts', ctrl);
  console.log('Updated customers.controller.ts');
}
