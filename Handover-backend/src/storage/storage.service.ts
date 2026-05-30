import { Injectable } from '@nestjs/common';
import { CloudinaryProvider } from './providers/cloudinary.provider';

@Injectable()
export class StorageService {
  constructor(private readonly cloudinary: CloudinaryProvider) {}

  uploadBuffer(buffer: Buffer, publicId: string, mimetype: string): Promise<string> {
    return this.cloudinary.uploadBuffer(buffer, publicId, mimetype);
  }
}
