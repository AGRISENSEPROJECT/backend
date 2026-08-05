import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../entities/user.entity';
import { NotificationService } from './notification.service';
import { ListNotificationsQueryDto } from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.FARMER,
  UserRole.SUPPLIER,
  UserRole.NGO,
  UserRole.GOVERNMENT,
  UserRole.ADMIN,
)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private getActor(req: Request): User {
    const user = req.user as User | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user;
  }

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  list(@Req() req: Request, @Query() query: ListNotificationsQueryDto) {
    return this.notificationService.listForUser(this.getActor(req).id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@Req() req: Request) {
    return this.notificationService.getUnreadCount(this.getActor(req).id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@Req() req: Request) {
    return this.notificationService.markAllAsRead(this.getActor(req).id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  markRead(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsRead(this.getActor(req).id, id);
  }
}
