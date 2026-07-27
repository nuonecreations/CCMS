import { UseGuards, Controller, Get, Query, Param, Post, Body, Patch, Delete } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('call-queue')
  getCallQueue(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.customersService.getCallQueue({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('worksiteCode') worksiteCode?: string,
  ) {
    return this.customersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
      worksiteCode,
    });
  }

  @Get('calls/log')
  getCallLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.customersService.getCallLogs({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(parseInt(id, 10));
  }

  @Post(':id/calls')
  logCall(@Param('id') id: string, @Body() data: any) {
    return this.customersService.logCall(parseInt(id, 10), data);
  }

  @Post(':id/complaints')
  createComplaint(@Param('id') id: string, @Body() data: any) {
    return this.customersService.createComplaint(parseInt(id, 10), data);
  }

  @Patch('complaints/:id')
  updateComplaint(@Param('id') id: string, @Body() data: any) {
    return this.customersService.updateComplaint(parseInt(id, 10), data);
  }

  @Get('complaints/all')
  async getComplaints() {
    return { data: await this.customersService.getComplaints() };
  }

  @Delete('complaints/:id')
  async deleteComplaint(@Param('id') id: string) {
    return this.customersService.deleteComplaint(+id);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() data: any) {
    return this.customersService.addPayment(parseInt(id, 10), data);
  }
}
