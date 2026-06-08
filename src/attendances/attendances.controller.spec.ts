import { AttendancesController } from './attendances.controller';

const makeService = () => ({
    createSession: jest.fn().mockResolvedValue({ id: 'sess-1' }),
    listSessions: jest.fn().mockResolvedValue([]),
    getAttendanceRate: jest.fn().mockResolvedValue([]),
    bulkRecord: jest.fn().mockResolvedValue({ recorded: 2 }),
});

const CALLER = { id: 'teacher-1', role: 'TEACHER' } as any;

describe('AttendancesController', () => {
    let controller: AttendancesController;
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService();
        controller = new AttendancesController(service as any);
    });

    it('createSession — delegates to service.createSession', async () => {
        const dto = { date: new Date(), topic: 'Intro' } as any;
        await controller.createSession('c1', dto, CALLER);
        expect(service.createSession).toHaveBeenCalledWith('c1', dto, CALLER);
    });

    it('listSessions — delegates to service.listSessions', async () => {
        await controller.listSessions('c1', CALLER);
        expect(service.listSessions).toHaveBeenCalledWith('c1', CALLER);
    });

    it('getAttendanceRate — delegates to service.getAttendanceRate', async () => {
        await controller.getAttendanceRate('c1', CALLER);
        expect(service.getAttendanceRate).toHaveBeenCalledWith('c1', CALLER);
    });

    it('bulkRecord — delegates to service.bulkRecord', async () => {
        const dto = { attendances: [] } as any;
        await controller.bulkRecord('sess-1', dto, CALLER);
        expect(service.bulkRecord).toHaveBeenCalledWith('sess-1', dto, CALLER);
    });
});
