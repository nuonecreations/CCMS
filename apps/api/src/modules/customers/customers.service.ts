import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class CustomersService {
  async findAll(query: { page?: number; pageSize?: number; search?: string; worksiteCode?: string }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {};
    if (query.search) {
      where.OR = [
        { accountNumber: { contains: query.search } },
        { customerName: { contains: query.search } },
      ];
    }
    if (query.worksiteCode) {
      where.worksiteCode = query.worksiteCode;
    }

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          worksite: true,
          arrearsSnapshots: {
            orderBy: { snapshotDate: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: number) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        worksite: true,
        arrearsSnapshots: {
          orderBy: { snapshotDate: 'desc' },
        },
        calls: true,
        commitments: true,
        complaints: true,
        followUps: true,
      },
    });
  }

  async getCallQueue(query: { page?: number; pageSize?: number }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let customers = await prisma.customer.findMany({
      where: {
        calls: {
          none: {
            callDate: {
              gte: today,
            },
          },
        },
      },
      include: {
        worksite: true,
        arrearsSnapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 1,
        },
      },
    });

    customers = customers.filter(c => 
      c.arrearsSnapshots[0] && Number(c.arrearsSnapshots[0].arrearsAmount) > 100000
    );

    const priorityOrder: Record<string, number> = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      NORMAL: 4,
    };

    customers.sort((a, b) => {
      const worksiteCompare = (a.worksiteCode || '').localeCompare(b.worksiteCode || '');
      if (worksiteCompare !== 0) return worksiteCompare;
      const pA = a.arrearsSnapshots[0]?.priority || 'NORMAL';
      const pB = b.arrearsSnapshots[0]?.priority || 'NORMAL';
      return priorityOrder[pA] - priorityOrder[pB];
    });

    const total = customers.length;
    const data = customers.slice(skip, skip + pageSize);

    return { data, total, page, pageSize };
  }

  async logCall(customerId: number, data: any) {
    return prisma.call.create({
      data: {
        customerId,
        callType: data.callType || 'OUTBOUND',
        callOutcome: data.callOutcome,
        notes: data.notes,
        customerResponse: data.customerResponse,
        assignedSection: data.assignedSection,
        finalStatus: data.finalStatus || 'OPEN',
        nextFollowupDate: data.nextFollowupDate ? new Date(data.nextFollowupDate) : undefined,
        commitments: (data.promiseDate && data.promisedAmount) ? {
          create: {
            customerId,
            promisedAmount: data.promisedAmount,
            promiseDate: new Date(data.promiseDate),
            notes: data.notes,
          }
        } : undefined
      }
    });
  }

  async getCallLogs(query: { page?: number; pageSize?: number }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.call.findMany({
        skip,
        take: pageSize,
        orderBy: { callDate: 'desc' },
        include: {
          customer: {
            include: { worksite: true }
          },
          commitments: true
        }
      }),
      prisma.call.count()
    ]);

    return { data, total, page, pageSize };
  }

  async createComplaint(customerId: number, data: any) {
    const complaintNumber = `CMP-${Date.now()}`;
    return prisma.complaint.create({
      data: {
        customerId,
        complaintNumber,
        category: data.category,
        description: data.description,
        priority: data.priority || 'NORMAL',
        status: data.status || 'NEW',
        assignedTo: data.assignedTo
      }
    });
  }

  async updateComplaint(complaintId: number, data: any) {
    return prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: data.status,
        assignedTo: data.assignedTo,
        resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
        priority: data.priority
      }
    });
  }

  async getComplaints() {
    return prisma.complaint.findMany({
      include: { customer: true },
      orderBy: { createdAt: 'desc' }
    });
  }
  async deleteComplaint(id: number) {
    return prisma.complaint.delete({ where: { id } });
  }

  async addPayment(customerId: number, data: { amount: number; date: string; notes?: string }) {
    return prisma.paymentCommitment.create({
      data: {
        customerId,
        promisedAmount: data.amount,
        promiseDate: new Date(data.date),
        actualPaymentDate: new Date(data.date),
        status: 'PAID',
        notes: data.notes || 'Payment Received via System',
      },
    });
  }
}
