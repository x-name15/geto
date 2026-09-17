import { IGetoAdapter, EConsumptionSemantic } from '../models/index.js';

export class BufferAdapter implements IGetoAdapter<Buffer, Buffer> {
  readonly adapterId = 'buffer';
  readonly semantic = EConsumptionSemantic.COPY;

  async consume(resource: Buffer): Promise<Buffer> {
    return Buffer.from(resource);
  }

  async restore(data: Buffer): Promise<Buffer> {
    return Buffer.from(data);
  }
}
