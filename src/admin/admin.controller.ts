import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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
}
