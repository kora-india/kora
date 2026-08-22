const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
async function main() {
  const email = 'kanhaiyapandey2232@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found!');
    return;
  }
  console.log('Password Hash in DB:', user.password);
  
  const isValid = await bcrypt.compare('123456789@Kp', user.password);
  console.log('Is valid with 123456789@Kp?', isValid);
}
main().catch(console.error).finally(() => prisma.$disconnect());
