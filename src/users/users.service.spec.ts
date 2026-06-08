import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

// Mock Better Auth before importing the service
jest.mock('../auth/auth.config', () => ({
    auth: {
        api: {
            signUpEmail: jest.fn(),
        },
    },
}));

import { UsersService } from './users.service';
import { auth } from '../auth/auth.config';

const mockSignUp = auth.api.signUpEmail as jest.Mock;

const makePrisma = () => ({
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
});

// ---------- createUser ----------

describe('UsersService.createUser', () => {
    let service: UsersService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new UsersService(prisma as any);
        mockSignUp.mockClear();
        mockSignUp.mockResolvedValue({});
    });

    const dto = { email: 'alice@test.com', password: 'pass123', name: 'Alice', role: Role.TEACHER };

    it('creates user on happy path', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.update.mockResolvedValue({ id: 'u1', ...dto });

        const result = await service.createUser(dto);

        expect(mockSignUp).toHaveBeenCalledWith({ body: { email: dto.email, password: dto.password, name: dto.name } });
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { role: Role.TEACHER } }),
        );
        expect(result).toMatchObject({ id: 'u1' });
    });

    it('throws ConflictException when email is already taken', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

        await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
        expect(mockSignUp).not.toHaveBeenCalled();
    });
});

// ---------- listUsers ----------

describe('UsersService.listUsers', () => {
    let service: UsersService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new UsersService(prisma as any);
        prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
        prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Alice' }]);
        prisma.user.count.mockResolvedValue(1);
    });

    it('returns paginated list on happy path', async () => {
        const result = await service.listUsers({ page: 1, limit: 10 } as any);

        expect(result.items).toHaveLength(1);
        expect(result.pagination).toMatchObject({ page: 1, limit: 10, total: 1 });
    });

    it('applies role filter when provided', async () => {
        await service.listUsers({ page: 1, limit: 10, role: Role.STUDENT } as any);

        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ role: Role.STUDENT }) }),
        );
    });

    it('applies search filter across name and email', async () => {
        await service.listUsers({ page: 1, limit: 10, search: 'alice' } as any);

        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
        );
    });
});

// ---------- findById ----------

describe('UsersService.findById', () => {
    let service: UsersService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(() => {
        prisma = makePrisma();
        service = new UsersService(prisma as any);
    });

    it('returns user when found', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });

        const result = await service.findById('u1');
        expect(result).toMatchObject({ id: 'u1' });
    });

    it('throws NotFoundException when user not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(service.findById('u1')).rejects.toThrow(NotFoundException);
    });
});
