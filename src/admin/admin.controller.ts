import { Controller, Get, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('export')
    @ApiOperation({ summary: 'Download semester results as CSV (ADMIN only)' })
    @ApiQuery({ name: 'semester', example: '2026-S1' })
    async exportSemester(
        @Query('semester') semester: string,
        @Res() res: Response,
    ) {
        const csv = await this.adminService.exportSemesterCsv(semester);
        const filename = `results-${semester ?? 'unknown'}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    }

    @Post('import/enrollments')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
        },
    })
    @ApiOperation({
        summary: 'Bulk-import enrollments from CSV (studentId,courseId). Duplicates are skipped, capacity violations are reported.',
    })
    importEnrollments(
        @UploadedFile() file: { buffer: Buffer },
    ) {
        return this.adminService.importEnrollmentsCsv(file);
    }
}
