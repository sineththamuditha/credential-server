import { Injectable } from '@nestjs/common';
import { VerifiableCredential } from '@veramo/core';

@Injectable()
export class DataService {
  private tempData: { [key: string]: VerifiableCredential } = {};

  setData(key: string, data: VerifiableCredential): void {
    this.tempData[key] = data;
  }

  getData(key: string): VerifiableCredential {
    return this.tempData[key];
  }
}
