import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { readFile } from 'fs/promises';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET')?.trim();

    this.configured = !!(cloudName && apiKey && apiSecret);

    if (!this.configured) {
      this.logger.warn(
        'Cloudinary credentials not configured. Image upload will fail.',
      );
    } else {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.logger.log('Cloudinary configured successfully');
    }
  }

  private async getFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (file.buffer?.length) {
      return file.buffer;
    }
    if (file.path) {
      return readFile(file.path);
    }
    throw new BadRequestException('No file provided');
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'agrisense/profiles',
    options?: {
      width?: number;
      height?: number;
      crop?: string;
      gravity?: string;
    },
  ): Promise<string> {
    if (!this.configured) {
      throw new BadRequestException(
        'Image upload service not configured. Please contact administrator.',
      );
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum size is 5MB.',
      );
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    const buffer = await this.getFileBuffer(file);
    const width = options?.width ?? 500;
    const height = options?.height ?? 500;
    const crop = options?.crop ?? 'fill';
    const gravity = options?.gravity ?? 'auto';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Upload timeout - please try again'));
      }, 30000);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [
            { width, height, crop, gravity },
            { quality: 'auto', fetch_format: 'auto' },
          ],
          resource_type: 'image',
          timeout: 60000,
        },
        (error, result) => {
          clearTimeout(timeout);

          if (error) {
            this.logger.error(
              `Cloudinary upload error: ${error.message} (http=${(error as any).http_code || 'n/a'})`,
            );
            const code = (error as any).http_code;
            if (code === 401 || code === 403) {
              return reject(
                new BadRequestException(
                  'Cloudinary rejected the upload (401/403). Check CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET match the same product environment, regenerate the API secret in the Cloudinary console, and confirm the account can upload in Media Library.',
                ),
              );
            }
            return reject(
              new BadRequestException(
                `Upload failed: ${error.message || 'unknown error'}`,
              ),
            );
          }

          if (!result) {
            return reject(new BadRequestException('Upload failed - no result returned'));
          }

          this.logger.log(`Image uploaded successfully: ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );

      try {
        Readable.from(buffer).pipe(uploadStream);
      } catch {
        clearTimeout(timeout);
        reject(new BadRequestException('Failed to process image file'));
      }
    });
  }

  /** Cover image for community posts (single landscape image). */
  uploadPostImage(file: Express.Multer.File): Promise<string> {
    return this.uploadImage(file, 'agrisense/posts', {
      width: 1200,
      height: 675,
      crop: 'fill',
      gravity: 'auto',
    });
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folderParts = parts.slice(parts.indexOf('upload') + 2, -1);
      // Drop version segment like v1234567890
      const withoutVersion = folderParts.filter((p) => !/^v\d+$/.test(p));
      const publicId = [...withoutVersion, filename].join('/');

      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Image deleted successfully: ${publicId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete image from Cloudinary: ${(error as Error).message}`,
      );
    }
  }
}
