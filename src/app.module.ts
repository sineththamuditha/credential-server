import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DataService } from './services/data.service';
import { CredentialService } from './services/credential.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DIDService } from './services/did.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  controllers: [AppController],
  providers: [DataService, CredentialService, DIDService],
})
export class AppModule {}
