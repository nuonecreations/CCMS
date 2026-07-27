import { UseGuards,  Controller, Get } from '@nestjs/common';
import { WorksitesService } from './worksites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('worksites')
export class WorksitesController {
  constructor(private readonly worksitesService: WorksitesService) {}

  @Get()
  findAll() {
    return this.worksitesService.findAll();
  }
}
