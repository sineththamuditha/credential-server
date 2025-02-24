import { Injectable } from '@nestjs/common';

@Injectable()
export class DataService {
  private tempData: { [key: string]: { [key: string]: any } } = {};

  setData(key: string, data: { [key: string]: any }): void {
    this.tempData[key] = data;
  }

  getData(key: string): { [key: string]: any } {
    return this.tempData[key];
  }
}
