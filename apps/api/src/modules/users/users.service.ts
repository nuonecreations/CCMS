import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

@Injectable()
export class UsersService implements OnModuleInit {
  async onModuleInit() {
    // Seed initial admin if not exists
    const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          name: 'System Administrator'
        }
      });
      console.log('Default admin created (admin / admin123)');
    }
  }

  async findOneByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  async findAll() {
    return prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true }
    });
  }

  async create(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        role: data.role
      },
      select: { id: true, username: true, name: true, role: true }
    });
  }

  async update(id: number, data: any) {
    const updateData: any = {
      username: data.username,
      name: data.name,
      role: data.role
    };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    return prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, name: true, role: true }
    });
  }

  async changePassword(id: number, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: { id: true }
    });
  }

  async remove(id: number) {
    return prisma.user.delete({ where: { id } });
  }
}
