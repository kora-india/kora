import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'Salary', description: 'Staff and teacher salaries' },
  { name: 'Maintenance', description: 'Building and equipment maintenance' },
  { name: 'Bills', description: 'Electricity, water, internet, etc.' },
  { name: 'Transport', description: 'Vehicle running costs' },
  { name: 'Fuel', description: 'Fuel for buses and generators' },
  { name: 'Events', description: 'School events and functions' },
];

async function main() {
  const schools = await prisma.school.findMany();
  
  for (const school of schools) {
    console.log(`Seeding for school: ${school.name}`);
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.expenseCategory.upsert({
        where: {
          schoolId_name: {
            schoolId: school.id,
            name: cat.name,
          },
        },
        update: {},
        create: {
          schoolId: school.id,
          name: cat.name,
          description: cat.description,
        },
      });
    }
  }
  
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
