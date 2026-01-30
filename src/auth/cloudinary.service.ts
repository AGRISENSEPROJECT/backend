import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('⚠️  Cloudinary credentials not configured. Image upload will fail.');
    } else {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      console.log('✅ Cloudinary configured successfully');
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    // Check if Cloudinary is configured
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    if (!cloudName) {
      throw new BadRequestException('Image upload service not configured. Please contact administrator.');
    }

    // Validate file
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 5MB.');
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Upload timeout - please try again'));
      }, 30000); // 30 second timeout

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'agrisense/profiles',
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
          resource_type: 'image',
          timeout: 60000, // 60 seconds
        },
        (error, result) => {
          clearTimeout(timeout);
          
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(new Error(`Upload failed: ${error.message}`));
          }
          
          if (!result) {
            return reject(new Error('Upload failed - no result returned'));
          }
          
          console.log('✅ Image uploaded successfully:', result.secure_url);
          resolve(result.secure_url);
        },
      );

      try {
        const stream = Readable.from(file.buffer);
        stream.pipe(uploadStream);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error('Failed to process image file'));
      }
    });
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract public_id from URL
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder = parts[parts.length - 2];
      const publicId = `${folder}/${filename}`;

      await cloudinary.uploader.destroy(publicId);
      console.log('✅ Image deleted successfully:', publicId);
    } catch (error) {
      console.error('Failed to delete image from Cloudinary:', error);
      // Don't throw error - deletion failure shouldn't block the operation
    }
  }
}
