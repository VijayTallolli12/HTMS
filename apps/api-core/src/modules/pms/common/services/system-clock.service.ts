import { Injectable } from '@nestjs/common';
import { Clock } from '../contracts/clock.interface';

@Injectable()
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
