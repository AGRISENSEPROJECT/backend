import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/waitlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { WaitlistRoleInterest } from '../entities/waitlist-entry.entity';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @ApiOperation({
    summary: 'Join the AgriSense waitlist',
    description:
      'Public endpoint. Stores the contact and automatically sends a promotional welcome email.',
  })
  @ApiBody({ type: JoinWaitlistDto })
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlistService.join(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List waitlist entries (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'interest', required: false, enum: WaitlistRoleInterest })
  @ApiQuery({ name: 'search', required: false })
  list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('interest') interest?: string,
    @Query('search') search?: string,
  ) {
    return this.waitlistService.list(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      interest,
      search,
    );
  }

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Waitlist statistics (admin)' })
  stats() {
    return this.waitlistService.getStats();
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get one waitlist entry (admin)' })
  getOne(@Param('id') id: string) {
    return this.waitlistService.getById(id);
  }

  @Post(':id/resend-email')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resend promotional welcome email (admin)' })
  resend(@Param('id') id: string) {
    return this.waitlistService.resendWelcomeEmail(id);
  }

  @Put(':id/deactivate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate waitlist entry (admin)' })
  deactivate(@Param('id') id: string) {
    return this.waitlistService.deactivate(id);
  }
}
