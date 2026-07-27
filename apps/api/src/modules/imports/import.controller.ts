import { UseGuards, Controller, Post, UploadedFile, UseInterceptors, Body, BadRequestException, Param, Delete, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get()
  async getImports() {
    return this.importService.getImports();
  }

  @Post('arrears/preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Excel file is required.');
    return this.importService.preview(file.buffer, file.originalname);
  }

  @Post('arrears/confirm')
  @UseInterceptors(FileInterceptor('file'))
  async confirm(
    @UploadedFile() file: Express.Multer.File,
    @Body('reportPeriod') reportPeriod?: string,
  ) {
    if (!file) throw new BadRequestException('Excel file is required.');
    return this.importService.confirmImport(file.buffer, file.originalname, reportPeriod);
  }

  @Roles('ADMIN')
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
