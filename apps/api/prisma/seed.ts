import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const worksites = [
  ['33', 'මාකඳුර', 'Makandura'],
  ['35', 'රදම්පල', 'Radampola'],
  ['36', 'තිහගොඩ', 'Thihagoda'],
  ['37', 'අකුරැස්ස', 'Akuressa'],
  ['38', 'පිටබැද්දර', 'Pitabeddara'],
  ['39', 'හක්මන', 'Hakmana'],
  ['60', 'මාතර/මිරිස්ස', 'Matara/Mirissa'],
  ['61', 'දෙවිනුවර', 'Devinuwara'],
  ['62', 'ගන්දර', 'Gandara'],
  ['63', 'කෝට්ටෙගොඩ', 'Kottagoda'],
  ['64', 'දික්වැල්ල', 'Dickwella'],
  ['65', 'වැලිගම', 'Weligama'],
  ['66', 'දෙණියාය', 'Deniyaya'],
  ['67', 'කඹුරුපිටිය', 'Kamburupitiya'],
  ['68', 'ඌරුබොක්ක', 'Urubokka'],
  ['69', 'මාලිම්බඩ', 'Malimbada'],
  ['70', 'කුඩාවැල්ල', 'Kudawella'],
] as const;

async function main() {
  for (const [code, nameSi, nameEn] of worksites) {
    await prisma.worksite.upsert({
      where: { code },
      update: { nameSi, nameEn, status: true },
      create: { code, nameSi, nameEn },
    });
  }
  console.log(`Seeded ${worksites.length} worksites.`);
}

main().finally(() => prisma.$disconnect());
