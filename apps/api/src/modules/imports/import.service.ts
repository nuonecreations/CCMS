import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient, ImportStatus, Priority } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parseAccountNumber } from '../../common/account-number';

const prisma = new PrismaClient();

type ImportRow = {
  name?: string;
  address?: string;
  mobile?: string;
  accountNumber?: string;
  category?: string;
  totalDue: number | null;
  lastPaymentDate: Date | null;
  pendingPayment: number | null;
  paymentDate: Date | null;
  arrears: number | null;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')  // non-breaking & zero-width chars
    .replace(/[\r\n]+/g, ' ')  // line breaks inside cells
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculatePriority(amount: number | null): Priority {
  if (!amount) return Priority.NORMAL;
  if (amount >= 1000000) return Priority.CRITICAL;
  if (amount >= 500000) return Priority.HIGH;
  if (amount >= 250000) return Priority.MEDIUM;
  return Priority.NORMAL;
}

@Injectable()
export class ImportService {
  async getImports() {
    return prisma.arrearsImport.findMany({
      orderBy: { importedAt: 'desc' },
      take: 20
    });
  }

  async preview(buffer: Buffer, fileName: string) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Auto-detect the header row by scanning for the row containing 'Account'
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(allRows.length, 15); i++) {
      const row = allRows[i];
      if (Array.isArray(row)) {
        const hasAccount = row.some((cell) =>
          normalizeHeader(cell).includes('account')
        );
        if (hasAccount) {
          headerRowIndex = i;
          break;
        }
      }
    }

    console.log(`[Import] Header row detected at index: ${headerRowIndex}`);

    // Re-parse with correct header row using range option
    const ref = sheet['!ref'];
    if (!ref) throw new BadRequestException('Excel file is empty.');
    const range = XLSX.utils.decode_range(ref);
    range.s.r = headerRowIndex; // start from the header row
    sheet['!ref'] = XLSX.utils.encode_range(range);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    if (!rows.length) throw new BadRequestException('Excel file is empty or has no data rows.');

    const rawHeaders = Object.keys(rows[0] ?? {});
    console.log('[Import] Raw headers detected:', rawHeaders);
    console.log('[Import] Normalized headers:', rawHeaders.map(normalizeHeader));

    const findColumn = (...keywords: string[]) =>
      rawHeaders.find((h) => {
        const norm = normalizeHeader(h);
        return keywords.some((kw) => norm === kw || norm.includes(kw));
      });

    const accountColumn = findColumn('account no', 'account number', 'account num', 'acc no', 'acc. no');
    if (!accountColumn) throw new BadRequestException(
      `Account Number column was not found. Detected columns: [${rawHeaders.join(', ')}]`
    );

    const parsedRows: ImportRow[] = [];
    const errors: any[] = [];

    rows.forEach((raw, index) => {
      const accountNumber = String(raw[accountColumn] ?? '').trim();
      const parsed = parseAccountNumber(accountNumber);
      if (!parsed || parsed.regionCode !== '31') {
        errors.push({
          rowNumber: index + 2,
          accountNo: accountNumber || null,
          errorCode: !parsed ? 'INVALID_ACCOUNT_NUMBER' : 'OUTSIDE_REGION',
          message: !parsed ? 'Invalid account number format.' : 'Account is outside active region 31.',
          rawData: raw,
        });
        return;
      }

      const get = (...names: string[]) => {
        const key = Object.keys(raw).find((h) => names.includes(normalizeHeader(h)));
        return key ? raw[key] : null;
      };

      parsedRows.push({
        name: String(get('name & address', 'name and address', 'name') ?? '').trim() || undefined,
        address: String(get('name & address', 'name and address', 'address') ?? '').trim() || undefined,
        mobile: String(get('mobile no', 'mobile no.') ?? '').trim() || undefined,
        accountNumber,
        category: String(get('cat.', 'cat', 'category') ?? '').trim() || undefined,
        totalDue: parseAmount(get('total due (rs.)', 'total due')),
        lastPaymentDate: parseDate(get('last payment date')),
        pendingPayment: parseAmount(get('pending payment (rs.)', 'pending payment')),
        paymentDate: parseDate(get('pay date', 'payment date')),
        arrears: parseAmount(get('arrears (rs.)', 'arrears')),
      });
    });

    const worksiteCounts: Record<string, number> = {};
    for (const row of parsedRows) {
      const parsed = parseAccountNumber(row.accountNumber!);
      if (parsed) worksiteCounts[parsed.worksiteCode] = (worksiteCounts[parsed.worksiteCode] ?? 0) + 1;
    }

    return {
      fileName,
      totalRecords: rows.length,
      validRecords: parsedRows.length,
      invalidRecords: errors.length,
      rows: parsedRows,
      errors,
      worksiteCounts,
      totalArrears: parsedRows.reduce((sum, r) => sum + (r.arrears ?? 0), 0),
    };
  }

  async confirmImport(buffer: Buffer, fileName: string, reportPeriod?: string) {
    const preview = await this.preview(buffer, fileName);

    return prisma.$transaction(async (tx) => {
      const importRecord = await tx.arrearsImport.create({
        data: {
          fileName,
          reportPeriod,
          sourceRegion: '31',
          totalRecords: preview.totalRecords,
          validRecords: preview.validRecords,
          invalidRecords: preview.invalidRecords,
          status: ImportStatus.COMPLETED,
        },
      });

      for (const row of preview.rows) {
        const parsed = parseAccountNumber(row.accountNumber!);
        if (!parsed) continue;

        const worksite = await tx.worksite.findUnique({ where: { code: parsed.worksiteCode } });
        if (!worksite) continue;

        const customer = await tx.customer.upsert({
          where: { accountNumber: row.accountNumber! },
          update: {
            regionCode: parsed.regionCode,
            worksiteCode: parsed.worksiteCode,
            worksiteId: worksite.id,
            customerName: row.name,
            address: row.address,
            mobileNumber: row.mobile,
            categoryCode: row.category,
          },
          create: {
            accountNumber: row.accountNumber!,
            regionCode: parsed.regionCode,
            worksiteCode: parsed.worksiteCode,
            worksiteId: worksite.id,
            customerName: row.name,
            address: row.address,
            mobileNumber: row.mobile,
            categoryCode: row.category,
          },
        });

        await tx.arrearsSnapshot.upsert({
          where: { importId_customerId: { importId: importRecord.id, customerId: customer.id } },
          update: {
            totalDue: row.totalDue ?? undefined,
            pendingPayment: row.pendingPayment ?? undefined,
            arrearsAmount: row.arrears ?? undefined,
            lastPaymentDate: row.lastPaymentDate ?? undefined,
            paymentDate: row.paymentDate ?? undefined,
            priority: calculatePriority(row.arrears ?? null),
          },
          create: {
            importId: importRecord.id,
            customerId: customer.id,
            totalDue: row.totalDue ?? undefined,
            pendingPayment: row.pendingPayment ?? undefined,
            arrearsAmount: row.arrears ?? undefined,
            lastPaymentDate: row.lastPaymentDate ?? undefined,
            paymentDate: row.paymentDate ?? undefined,
            priority: calculatePriority(row.arrears ?? null),
          },
        });
      }

      for (const error of preview.errors) {
        await tx.importRowError.create({
          data: {
            importId: importRecord.id,
            rowNumber: error.rowNumber,
            accountNo: error.accountNo,
            errorCode: error.errorCode,
            message: error.message,
            rawData: error.rawData ? JSON.stringify(error.rawData) : null,
          },
        });
      }

      return {
        importId: importRecord.id,
        fileName,
        totalRecords: preview.totalRecords,
        validRecords: preview.validRecords,
        invalidRecords: preview.invalidRecords,
        totalArrears: preview.totalArrears,
        status: ImportStatus.COMPLETED,
      };
    });
  }

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
