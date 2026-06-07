jest.mock('../auth/auth.config', () => ({
    auth: { api: { signUpEmail: jest.fn() } },
}));

import { UsersController } from './users.controller';

const makeService = () => ({
    createUser: jest.fn().mockResolvedValue({ id: 'u1' }),
    listUsers: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    findById: jest.fn().mockResolvedValue({ id: 'u1' }),
});

describe('UsersController', () => {
    let controller: UsersController;
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService();
        controller = new UsersController(service as any);
    });

    it('create — delegates to service.createUser', async () => {
        const dto = { name: 'Alice', email: 'alice@test.com', password: 'pass', role: 'TEACHER' } as any;
        await controller.create(dto);
        expect(service.createUser).toHaveBeenCalledWith(dto);
    });

    it('list — delegates to service.listUsers', async () => {
        const query = { page: 1, limit: 10 } as any;
        await controller.list(query);
        expect(service.listUsers).toHaveBeenCalledWith(query);
    });

    it('findOne — delegates to service.findById', async () => {
        await controller.findOne('u1');
        expect(service.findById).toHaveBeenCalledWith('u1');
    });
});
