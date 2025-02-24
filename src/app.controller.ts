import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { DataService } from './services/data.service';
import { CredentialService } from './services/credential.service';
import { CREDENTIAL_KEYS } from './constants';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataService: DataService,
    private readonly credentialService: CredentialService,
  ) {}

  @Get('/health')
  getHello(): { [key: string]: boolean } {
    return {
      alive: true,
    };
  }

  @Post('/supervisor/library-credential/get')
  async handleSupervisorCredentialRetrieval(
    @Body() accessDelegationCredential: { [key: string]: any },
  ): Promise<{ [key: string]: any }> {
    return await this.credentialService.getSupervisorCredential(
      accessDelegationCredential,
    );
  }

  @Post('/supervisor/library-credential/set')
  saveSupervisorLibraryCredential(
    @Body() supervisorLibraryCredential: { [key: string]: any },
  ): { [key: string]: string } {
    this.dataService.setData(
      CREDENTIAL_KEYS.SUPERVISOR_LIBRARY_CREDENTIAL_KEY,
      supervisorLibraryCredential,
    );

    return {
      message: 'Credential stored successfully',
    };
  }

  @Post('/doctor/hospital-credential/get')
  async handleDoctorCredentialRetrieval(
    @Body() accessDelegationCredential: { [key: string]: any },
  ): Promise<{ [key: string]: any }> {
    return await this.credentialService.getDoctorCredential(
      accessDelegationCredential,
    );
  }
}
