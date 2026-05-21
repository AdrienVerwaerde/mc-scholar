import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { auth } from '../src/auth/auth.config';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
    const adminEmail = 'admin@mcscholar.local';
    const adminPassword = 'admin12345';

    const existing = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (existing) {
        // If admin already exists, just make sure the role is correct
        await prisma.user.update({
            where: { email: adminEmail },
            data: { role: Role.ADMIN },
        });
        console.log(`✓ Admin already exists, role reset to ADMIN: ${adminEmail}`);
        return;
    }

    // Use Better Auth's API to create the user properly (hashes password, etc.)
    await auth.api.signUpEmail({
        body: {
            email: adminEmail,
            password: adminPassword,
            name: 'Admin',
        },
    });

    // Then promote to ADMIN
    await prisma.user.update({
        where: { email: adminEmail },
        data: { role: Role.ADMIN },
    });

    console.log(`✓ Admin created: ${adminEmail} / ${adminPassword}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());