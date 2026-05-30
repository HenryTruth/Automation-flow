import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);

  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('cloudinary.cloudName'),
      api_key: config.get<string>('cloudinary.apiKey'),
      api_secret: config.get<string>('cloudinary.apiSecret'),
    });
  }

  async uploadBuffer(buffer: Buffer, publicId: string, mimetype: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const resourceType = mimetype.startsWith('image/') ? 'image' : 'auto';
      cloudinary.uploader
        .upload_stream({ public_id: publicId, resource_type: resourceType, overwrite: true }, (err, result: UploadApiResponse | undefined) => {
          if (err) {
            this.logger.error(`Cloudinary upload failed: ${err.message}`);
            return reject(err);
          }
          resolve(result!.secure_url);
        })
        .end(buffer);
    });
  }
}
