import { PrismaClient } from '@schoolos/db';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const email = 'kanhaiyapandey2232@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found!');
    return;
  }
  console.log('User is:', user.email);
  console.log('isActive:', user.isActive);
  console.log('Role:', user.role);
}
main().catch(console.error).finally(() => prisma.$disconnect());
