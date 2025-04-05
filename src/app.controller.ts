import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { DataService } from './services/data.service';
import { CredentialService } from './services/credential.service';
import { CREDENTIAL_KEYS } from './constants';
import { VerifiableCredential, VerifiablePresentation } from '@veramo/core';
import { DIDService } from './services/did.service';
import { IPackedDIDCommMessage } from '@veramo/did-comm';
import * as pidusage from 'pidusage';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly dataService: DataService,
    private readonly credentialService: CredentialService,
    private readonly didService: DIDService,
  ) {}

  @Get('/health')
  getHealth(): { [key: string]: boolean } {
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

  @Post('/performance-credential/set')
  setCredentialForPerformaceTest(@Body() credential: VerifiableCredential): {
    [key: string]: string;
  } {
    this.logger.log('saving credential for the perfomance test', credential);

    this.dataService.setData(
      CREDENTIAL_KEYS.PERFORMANCE_TEST_CREDENTIAL_KEY,
      credential,
    );

    return {
      message: 'Credential stored successfully',
    };
  }

  @Post('/initialize-delegator')
  async initializeDelegator(
    @Body() payload: { keyType: string },
  ): Promise<any> {
    return await this.credentialService.initializeDelegator(payload.keyType);
  }

  @Post('/performance-credential/get-adc')
  async issueAccessDelegationCredential(@Body() vp: VerifiablePresentation) {
    const startTime = performance.now();

    const adc: VerifiableCredential =
      await this.credentialService.issueAccessDelegationCredential(vp);

    const endTime = performance.now();
    const stats = await pidusage(process.pid);
    return {
      accessDelegationCredential: adc,
      timeTaken: endTime - startTime,
      memoryUsage: stats.memory / 1024 / 1024,
      cpuUsage: stats.cpu.toFixed(2),
    };
  }

  @Post('performance-credential/get')
  async verifyVerifiablePresentationAndGetCredential(
    @Body() vp: VerifiablePresentation,
  ) {
    const verificationStartTime = performance.now();

    const accessDelegationCredential: VerifiableCredential =
      await this.credentialService.verifyPresentation(vp);

    const verificationEndTime = performance.now();
    const verificationStats = await pidusage(process.pid);

    const retrievalStartTime = performance.now();

    const performanceCredential: VerifiableCredential =
      await this.credentialService.getPerformanceCredential(
        accessDelegationCredential,
      );

    const retrievalEndTime = performance.now();
    const retrievalStats = await pidusage(process.pid);

    return {
      delegatedCredential: performanceCredential,
      verification: {
        timeTaken: verificationEndTime - verificationStartTime,
        memoryUsage: verificationStats.memory / 1024 / 1024,
        cpuUsage: verificationStats.cpu.toFixed(2),
      },
      retrieval: {
        timeTaken: retrievalEndTime - retrievalStartTime,
        memoryUsage: retrievalStats.memory / 1024 / 1024,
        cpuUsage: retrievalStats.cpu.toFixed(2),
      },
    };
  }
}
