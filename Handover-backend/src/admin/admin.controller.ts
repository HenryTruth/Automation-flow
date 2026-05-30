import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { UpdateAppealDto } from './dto/update-appeal.dto';
import { UpholdAppealDto } from './dto/uphold-appeal.dto';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('appeals')
  createAppeal(@Body() dto: CreateAppealDto) {
    return this.adminService.createAppeal(dto);
  }

  @Patch('appeals/:id')
  updateAppeal(@Param('id') id: string, @Body() dto: UpdateAppealDto) {
    return this.adminService.updateAppeal(id, dto);
  }

  @Post('appeals/:id/uphold')
  @HttpCode(HttpStatus.OK)
  upholdAppeal(@Param('id') id: string, @Body() dto: UpholdAppealDto) {
    return this.adminService.upholdAppeal(id, dto);
  }

  @Post('appeals/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectAppeal(@Param('id') id: string) {
    return this.adminService.rejectAppeal(id);
  }
}
