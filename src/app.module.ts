import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataService } from './services/data.service';
import { CredentialService } from './services/credential.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  controllers: [AppController],
  providers: [AppService, DataService, CredentialService],
})
export class AppModule {}
