import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class WorksitesService {
  async findAll() {
    const worksites = await prisma.worksite.findMany({
      include: {
        _count: {
          select: { customers: true },
        },
        customers: {
          include: {
            arrearsSnapshots: {
              orderBy: { snapshotDate: 'desc' },
              take: 1,
            },
            commitments: {
              where: { status: 'PAID' },
            }
          },
        },
      },
    });

    return worksites.map(ws => {
      let totalArrears = 0;
      let collectedAmount = 0;
      for (const customer of ws.customers) {
        if (customer.arrearsSnapshots.length > 0) {
          totalArrears += Number(customer.arrearsSnapshots[0].arrearsAmount || 0);
        }
        for (const commitment of customer.commitments) {
          collectedAmount += Number(commitment.promisedAmount || 0);
        }
      }
      const { customers, ...rest } = ws;
      return {
        ...rest,
        totalArrears,
        collectedAmount,
        remainingArrears: totalArrears - collectedAmount
      };
    });
  }
}
