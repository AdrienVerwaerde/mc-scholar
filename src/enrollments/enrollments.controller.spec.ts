import { EnrollmentsController } from './enrollments.controller';

const makeService = () => ({
    enroll: jest.fn().mockResolvedValue({ id: 'e1' }),
    unenroll: jest.fn().mockResolvedValue({ deleted: true }),
    listMine: jest.fn().mockResolvedValue([]),
});

const USER = { id: 'student-1', role: 'STUDENT' } as any;
const COURSE = { id: 'c1', capacity: 30 } as any;

describe('EnrollmentsController', () => {
    let controller: EnrollmentsController;
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService();
        controller = new EnrollmentsController(service as any);
    });

    it('enroll — delegates to service.enroll with course.id and user.id', async () => {
        await controller.enroll(COURSE, USER);
        expect(service.enroll).toHaveBeenCalledWith(COURSE.id, USER.id);
    });

    it('unenroll — delegates to service.unenroll', async () => {
        await controller.unenroll('c1', USER);
        expect(service.unenroll).toHaveBeenCalledWith('c1', USER.id);
    });

    it('listMine — delegates to service.listMine', async () => {
        await controller.listMine(USER);
        expect(service.listMine).toHaveBeenCalledWith(USER.id);
    });
});
