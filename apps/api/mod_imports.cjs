const fs = require('fs');

let srv = fs.readFileSync('src/modules/imports/import.service.ts', 'utf8');
if (!srv.includes('async systemReset(')) {
  srv = srv.replace(/}\s*$/, `
  async deleteImport(id: number) {
    await prisma.arrearsSnapshot.deleteMany({ where: { importId: id } });
    await prisma.importRowError.deleteMany({ where: { importId: id } });
    await prisma.arrearsImport.delete({ where: { id } });
    return { success: true };
  }

  async systemReset() {
    await prisma.arrearsSnapshot.deleteMany();
    await prisma.importRowError.deleteMany();
    await prisma.arrearsImport.deleteMany();
    await prisma.complaint.deleteMany();
    await prisma.followUp.deleteMany();
    await prisma.paymentCommitment.deleteMany();
    await prisma.call.deleteMany();
    await prisma.customer.deleteMany();
    // Do not delete Worksites or Users
    return { success: true };
  }
}
`);
  fs.writeFileSync('src/modules/imports/import.service.ts', srv);
  console.log('Updated import.service.ts');
}

let ctrl = fs.readFileSync('src/modules/imports/import.controller.ts', 'utf8');
if (!ctrl.includes('deleteImport(')) {
  if (!ctrl.includes('Param,')) ctrl = ctrl.replace(/@nestjs\/common';/, `, Param, Delete } from '@nestjs/common';`);
  ctrl = ctrl.replace(/}\s*$/, `
  @Delete(':id')
  async deleteImport(@Param('id') id: string) {
    return this.importService.deleteImport(+id);
  }

  @Roles('SUPER_ADMIN')
  @Post('system-reset')
  async systemReset() {
    return this.importService.systemReset();
  }
}
`);
  fs.writeFileSync('src/modules/imports/import.controller.ts', ctrl);
  console.log('Updated import.controller.ts');
}
