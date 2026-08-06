import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmController } from './farm.controller';
import { FarmService } from './farm.service';
import { FarmCropService } from './farm-crop.service';
import { Farm } from '../entities/farm.entity';
import { User } from '../entities/user.entity';
import { FarmCrop } from '../entities/farm-crop.entity';
import { CloudinaryService } from '../auth/cloudinary.service';

@Module({
  imports: [TypeOrmModule.forFeature([Farm, User, FarmCrop])],
  controllers: [FarmController],
  providers: [FarmService, FarmCropService, CloudinaryService],
  exports: [FarmService, FarmCropService],
})
export class FarmModule {}