import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DataService } from './services/data.service';
import { CredentialService } from './services/credential.service';
import { CREDENTIAL_KEYS } from './constants';
import { VerifiableCredential, VerifiablePresentation } from '@veramo/core';
import { DIDService } from './services/did.service';
import { IPackedDIDCommMessage } from '@veramo/did-comm';

@Controller()
export class AppController {
  constructor(
    private readonly dataService: DataService,
    private readonly credentialService: CredentialService,
    private readonly didService: DIDService,
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
    @Body() supervisorLibraryCredential: VerifiableCredential,
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

  @Get('/credentials/:did')
  async getEmployeeCredential(
    @Param('did') did: string,
  ): Promise<VerifiableCredential> {
    return await this.credentialService.getEmployeeCredential(did);
  }

  @Post('/adc')
  async getAccessDelegationCredential(
    @Body() verifiablePresentation: VerifiablePresentation,
  ): Promise<VerifiableCredential> {
    return await this.credentialService.getAccessDelegationCredential(
      verifiablePresentation,
    );
  }

  @Get('company/did')
  getCompanyDID(): { companyDID: string } {
    return {
      companyDID: this.didService.getCompanyIdentifier().did,
    };
  }

  @Post('/company/company-credential/get')
  async getCompanyCredential(
    @Body() packedMessage: any,
  ): Promise<IPackedDIDCommMessage> {
    return await this.credentialService.getCompanyCredential(packedMessage);
  }
}
