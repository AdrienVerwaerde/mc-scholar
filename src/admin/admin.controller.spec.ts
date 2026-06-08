import { AdminController } from './admin.controller';

const makeService = () => ({
    getSemesterStats: jest.fn().mockResolvedValue({ totalCourses: 1 }),
    exportSemesterCsv: jest.fn().mockResolvedValue('header\nrow'),
    importEnrollmentsCsv: jest.fn().mockResolvedValue({ enrolled: 1 }),
});

describe('AdminController', () => {
    let controller: AdminController;
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService();
        controller = new AdminController(service as any);
    });

    it('getSemesterStats — delegates to service.getSemesterStats', async () => {
        await controller.getSemesterStats('2026-S1');
        expect(service.getSemesterStats).toHaveBeenCalledWith('2026-S1');
    });

    it('exportSemester — sends CSV response', async () => {
        const res = {
            setHeader: jest.fn(),
            send: jest.fn(),
        } as any;

        await controller.exportSemester('2026-S1', res);

        expect(service.exportSemesterCsv).toHaveBeenCalledWith('2026-S1');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.send).toHaveBeenCalledWith('header\nrow');
    });

    it('importEnrollments — delegates to service.importEnrollmentsCsv', async () => {
        const file = { buffer: Buffer.from('studentId,courseId\ns1,c1') };
        await controller.importEnrollments(file);
        expect(service.importEnrollmentsCsv).toHaveBeenCalledWith(file);
    });
});
