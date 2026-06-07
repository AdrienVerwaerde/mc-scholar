import { GradesController } from './grades.controller';

const makeService = () => ({
    create: jest.fn().mockResolvedValue({ id: 'g1' }),
    listForCaller: jest.fn().mockResolvedValue([]),
    getAverage: jest.fn().mockResolvedValue([]),
    importCsv: jest.fn().mockResolvedValue({ success: true, imported: 1, errors: [] }),
    update: jest.fn().mockResolvedValue({ id: 'g1' }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
});

const CALLER = { id: 'user-1', role: 'TEACHER' } as any;

describe('GradesController', () => {
    let controller: GradesController;
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService();
        controller = new GradesController(service as any);
    });

    it('create — delegates to service.create', async () => {
        const dto = { studentId: 's1', courseId: 'c1', type: 'EXAM', value: 14 } as any;
        await controller.create(dto, CALLER);
        expect(service.create).toHaveBeenCalledWith(dto, CALLER);
    });

    it('list — delegates to service.listForCaller', async () => {
        const query = { courseId: 'c1' } as any;
        await controller.list(query, CALLER);
        expect(service.listForCaller).toHaveBeenCalledWith(CALLER, query);
    });

    it('getAverage — delegates to service.getAverage', async () => {
        const query = { courseId: 'c1' } as any;
        await controller.getAverage(query, CALLER);
        expect(service.getAverage).toHaveBeenCalledWith(CALLER, query);
    });

    it('importCsv — delegates to service.importCsv', async () => {
        const file = { buffer: Buffer.from(''), originalname: 'f.csv' };
        await controller.importCsv('c1', file, CALLER);
        expect(service.importCsv).toHaveBeenCalledWith('c1', file, CALLER);
    });

    it('update — delegates to service.update', async () => {
        const dto = { value: 15 } as any;
        await controller.update('g1', dto, CALLER);
        expect(service.update).toHaveBeenCalledWith('g1', dto, CALLER);
    });

    it('remove — delegates to service.remove', async () => {
        await controller.remove('g1', CALLER);
        expect(service.remove).toHaveBeenCalledWith('g1', CALLER);
    });
});
