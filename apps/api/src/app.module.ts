import { Module } from '@nestjs/common';
import { ImportModule } from './modules/imports/import.module';
import { CustomersModule } from './modules/customers/customers.module';
import { WorksitesModule } from './modules/worksites/worksites.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [ImportModule, CustomersModule, WorksitesModule, AuthModule, UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
