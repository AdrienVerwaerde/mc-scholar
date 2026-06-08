import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
    }),
});

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'postgresql',
    }),
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
    },
    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: 'STUDENT',
                input: false,
            },
        },
    },
    trustedOrigins: [
        process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
        'http://localhost:5173',
    ],
});