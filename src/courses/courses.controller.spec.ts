import { CoursesController } from './courses.controller';

const makeService = () => ({
    list: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    findOne: jest.fn().mockResolvedValue({ id: 'c1' }),
    create: jest.fn().mockResolvedValue({ id: 'c1' }),
    update: jest.fn().mockResolvedValue({ id: 'c1' }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
    setWeights: jest.fn().mockResolvedValue({ id: 'c1' }),
});

const USER = { id: 'teacher-1', role: 'TEACHER' } as any;

describe('CoursesController', () => {
    let controller: CoursesController;
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService();
        controller = new CoursesController(service as any);
    });

    it('list — delegates to service.list', async () => {
        const query = { page: 1, limit: 10 } as any;
        await controller.list(query);
        expect(service.list).toHaveBeenCalledWith(query);
    });

    it('findOne — delegates to service.findOne', async () => {
        await controller.findOne('c1');
        expect(service.findOne).toHaveBeenCalledWith('c1');
    });

    it('create — passes user.id as teacherId', async () => {
        const dto = { code: 'MATH101', title: 'Math', semester: '2026-S1', capacity: 30 } as any;
        await controller.create(dto, USER);
        expect(service.create).toHaveBeenCalledWith(dto, USER.id);
    });

    it('update — delegates to service.update', async () => {
        const dto = { title: 'Updated' } as any;
        await controller.update('c1', dto);
        expect(service.update).toHaveBeenCalledWith('c1', dto);
    });

    it('remove — delegates to service.remove', async () => {
        await controller.remove('c1');
        expect(service.remove).toHaveBeenCalledWith('c1');
    });

    it('setWeights — delegates to service.setWeights', async () => {
        const dto = { weights: [{ type: 'EXAM', weight: 1.0 }] } as any;
        await controller.setWeights('c1', dto);
        expect(service.setWeights).toHaveBeenCalledWith('c1', dto);
    });
});
