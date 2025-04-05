/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { DataService } from './data.service';
import {
  CredentialSubject,
  IIdentifier,
  IVerifyResult,
  VerifiableCredential,
  VerifiablePresentation,
  W3CVerifiableCredential,
} from '@veramo/core';
import { DIDService } from './did.service';
import { differenceInYears } from 'date-fns';
import { OPAResponse } from '../dtos/OpaDtos';
import { CREDENTIAL_KEYS } from '../constants';
import {
  IDIDCommMessage,
  IPackedDIDCommMessage,
  IUnpackedDIDCommMessage,
} from '@veramo/did-comm';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private OPA_BASE_URL: string;
  private ARIES_CLOUD_AGENT_BASE_URL: string;
  private SERVICE_ENDPOINT_BASE_URL: string;
  private readonly DELEGATOR_CREDENTIAL_KEY = 'delegatorCredentialKey';
  private delegatorIdentifier: IIdentifier;

  constructor(
    private readonly httpService: HttpService,
    private readonly dataService: DataService,
    private readonly configService: ConfigService,
    private readonly didService: DIDService,
  ) {
    const opaBaseUrl: string | undefined =
      this.configService.get<string>('OPA_BASE_URL');
    if (opaBaseUrl) {
      this.OPA_BASE_URL = opaBaseUrl;
    } else {
      throw new Error('OPA base url is not found');
    }
    const ariesBaseUrl: string | undefined = this.configService.get<string>(
      'ARIES_CLOUD_AGENT_BASE_URL',
    );
    if (ariesBaseUrl) {
      this.ARIES_CLOUD_AGENT_BASE_URL = ariesBaseUrl;
    } else {
      throw new Error('OPA base url is not found');
    }

    const serviceEndpointBaseUrl: string | undefined =
      this.configService.get<string>('SERVICE_ENDPOINT_BASE_URL');
    if (serviceEndpointBaseUrl) {
      this.SERVICE_ENDPOINT_BASE_URL = serviceEndpointBaseUrl;
    } else {
      throw new Error('Service endpoint base url is not found');
    }
  }

  async getSupervisorCredential(accessDelegationCredential: {
    [key: string]: string;
  }): Promise<{ [key: string]: any }> {
    try {
      const policyResponse: AxiosResponse<OPAResponse> = await firstValueFrom(
        this.httpService.post<OPAResponse>(
          `${this.OPA_BASE_URL}/data/supervisor`,
          { input: accessDelegationCredential },
        ),
      );

      const responseData: OPAResponse = policyResponse.data;

      if (!responseData.result.allow) {
        throw new HttpException(
          'Access Delegation Credential is not valid or owner has revoked access',
          400,
        );
      }

      return this.dataService.getData(
        CREDENTIAL_KEYS.SUPERVISOR_LIBRARY_CREDENTIAL_KEY,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log(error);
      console.log('Encountered error when checking policies');
      throw new HttpException('API request failed', 500);
    }
  }

  async getDoctorCredential(accessDelegationCredential: {
    [key: string]: string;
  }): Promise<{ [key: string]: any }> {
    try {
      const policyResponse: AxiosResponse<OPAResponse> = await firstValueFrom(
        this.httpService.post<OPAResponse>(`${this.OPA_BASE_URL}/data/doctor`, {
          input: accessDelegationCredential,
        }),
      );

      const responseData: OPAResponse = policyResponse.data;

      if (!responseData.result.allow) {
        throw new HttpException(
          'Access Delegation Credential is not valid or owner has revoked access',
          400,
        );
      }

      try {
        const credentialId: string =
          accessDelegationCredential['credentialSubject']['credentialId'];

        const credentialResponse = await firstValueFrom(
          this.httpService.get<VerifiableCredential>(
            `${this.ARIES_CLOUD_AGENT_BASE_URL}/vc/credentials/${credentialId}`,
          ),
        );

        return credentialResponse.data;
      } catch (error) {
        console.log(error);
        throw new HttpException(
          'There are no credentials with the given id, either it is removed or owner has changed the id',
          404,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log(error);
      console.log('Encountered error when checking policies');
      throw new HttpException('API request failed', 500);
    }
  }

  async getEmployeeCredential(
    employeeDID: string,
  ): Promise<VerifiableCredential> {
    this.dataService.setData(
      CREDENTIAL_KEYS.COMPANY_CREDENTIAL_KEY,
      await this.didService.getAgent().createVerifiableCredential({
        credential: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'CompanyCredential'],
          issuer: this.didService.getGovernmentIdentifier().did,
          issuanceDate: new Date().toISOString(),
          id: crypto.randomUUID(),
          credentialSubject: {
            id: this.didService.getCompanyIdentifier().did,
            name: 'ABC Company',
            address: '124/1, Kirillawala, Mahara',
          },
        },
        proofFormat: 'jwt',
      }),
    );

    return await this.didService.getAgent().createVerifiableCredential({
      credential: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'EmployeeCredential'],
        issuer: this.didService.getCompanyIdentifier().did,
        issuanceDate: new Date().toISOString(),
        id: crypto.randomUUID(),
        credentialSubject: {
          id: employeeDID,
          name: 'Saman Kumara',
          employeeId: 'E20041674',
          position: 'Manager',
          department: 'Sales',
          joinedDate: new Date('2019-01-01').toISOString(),
        },
      },
      proofFormat: 'jwt',
    });
  }

  async getAccessDelegationCredential(
    verifiablePresentation: VerifiablePresentation,
  ): Promise<VerifiableCredential> {
    const verificationResult: IVerifyResult = await this.didService
      .getAgent()
      .verifyPresentation({
        presentation: verifiablePresentation,
      });

    if (!verificationResult.verified) {
      throw new Error('Invalid verifiable presentation');
    }

    const verifiableCredentials: W3CVerifiableCredential[] | undefined =
      verifiablePresentation.verifiableCredential;

    if (!verifiableCredentials) {
      throw new Error('There are no verifiable credential');
    }

    const employeeCredential: W3CVerifiableCredential | undefined =
      verifiableCredentials.find((credential: W3CVerifiableCredential) =>
        credential['type'].includes('EmployeeCredential'),
      );

    if (!employeeCredential) {
      throw new Error('There are no university credentials present');
    }

    const credentialSubject: CredentialSubject =
      employeeCredential['credentialSubject'];

    const attributes: { [key: string]: any } = {};

    attributes['employeeId'] = credentialSubject['employeeId'];
    attributes['position'] = credentialSubject['position'];
    attributes['isSeniorEmployee'] =
      Math.abs(
        differenceInYears(
          new Date(credentialSubject['joinedDate']),
          new Date(),
        ),
      ) > 5;

    return await this.didService.getAgent().createVerifiableCredential({
      credential: {
        issuer: this.didService.getCompanyIdentifier().did,
        type: ['VerifiableCredential', 'AccessDelegationCredential'],
        credentialSubject: {
          id: verifiablePresentation.holder,
          credentialId: this.dataService.getData(
            CREDENTIAL_KEYS.COMPANY_CREDENTIAL_KEY,
          ).id,
          attributes,
          service: {
            type: 'DIDComm',
            serviceEndpoint: `${this.SERVICE_ENDPOINT_BASE_URL}/company/company-credential/get`,
          },
        },
      },
      proofFormat: 'jwt',
    });
  }

  async getCompanyCredential(
    packedMessage: any,
  ): Promise<IPackedDIDCommMessage> {
    const unpackedMessage: IUnpackedDIDCommMessage = await this.didService
      .getAgent()
      .unpackDIDCommMessage(packedMessage);

    const verifiablePresentation: VerifiablePresentation = unpackedMessage
      .message.body as VerifiablePresentation;

    const verificationResult: IVerifyResult = await this.didService
      .getAgent()
      .verifyPresentation({
        presentation: verifiablePresentation,
      });

    if (!verificationResult.verified) {
      throw new Error(
        'Credential Server: verifiable presentation is nor valid',
      );
    }

    const verifiableCredentials: W3CVerifiableCredential[] | undefined =
      verifiablePresentation.verifiableCredential;

    if (!verifiableCredentials) {
      throw new Error(
        'Credential Server: there are no valid verifiable credentials present',
      );
    }

    const accessDelegationCredential: W3CVerifiableCredential | undefined =
      verifiableCredentials.find((credential) =>
        credential['type'].includes('AccessDelegationCredential'),
      );

    if (!accessDelegationCredential) {
      throw new Error(
        'Credential Server: access delegation credential could not be found',
      );
    }

    try {
      const policyResponse: AxiosResponse<OPAResponse> = await firstValueFrom(
        this.httpService.post<OPAResponse>(
          `${this.OPA_BASE_URL}/data/company`,
          { input: accessDelegationCredential },
        ),
      );

      const responseData: OPAResponse = policyResponse.data;

      if (!responseData.result.allow) {
        throw new HttpException(
          'Access Delegation Credential is not valid or owner has revoked access',
          400,
        );
      }

      const message: IDIDCommMessage = {
        id: crypto.randomUUID(),
        type: 'Company Credential Response',
        from: this.didService.getCompanyIdentifier().did,
        to: [verifiablePresentation.holder],
        body: this.dataService.getData(CREDENTIAL_KEYS.COMPANY_CREDENTIAL_KEY),
      };

      return await this.didService.getAgent().packDIDCommMessage({
        packing: 'jws',
        message,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log(error);
      console.log('Encountered error when checking policies');
      throw new HttpException('API request failed', 500);
    }
  }

  async initializeDelegator(keyType: string) {
    this.delegatorIdentifier = await this.didService
      .getAgent()
      .didManagerGetOrCreate({
        provider: 'did:key',
        alias: `delegator_${keyType}`,
        options: {
          keyType,
        },
      });

    return {
      delegatorIdentifier: this.delegatorIdentifier.did,
    };
  }

  async issueAccessDelegationCredential(
    verifiablePresentation: VerifiablePresentation,
  ) {
    const verificationResult: IVerifyResult = await this.didService
      .getAgent()
      .verifyPresentation({
        presentation: verifiablePresentation,
      });

    if (!verificationResult.verified) {
      throw new Error('Invalid verifiable presentation');
    }

    const verifiableCredentials: W3CVerifiableCredential[] | undefined =
      verifiablePresentation.verifiableCredential;

    if (!verifiableCredentials) {
      throw new Error('There are no verifiable credential');
    }

    const performanceCredential: W3CVerifiableCredential | undefined =
      verifiableCredentials.find((credential: W3CVerifiableCredential) =>
        credential['type'].includes('PerformanceCredential'),
      );

    if (!performanceCredential) {
      throw new Error('There are no university credentials present');
    }

    const credentialSubject: CredentialSubject =
      performanceCredential['credentialSubject'];

    const attributes: { [key: string]: any } = {};

    attributes['keyType'] = credentialSubject['keyType'];
    attributes['credentialId'] = performanceCredential['id'];

    return await this.didService.getAgent().createVerifiableCredential({
      credential: {
        issuer: this.delegatorIdentifier.did,
        type: ['VerifiableCredential', 'AccessDelegationCredential'],
        credentialSubject: {
          id: verifiablePresentation.holder,
          attributes,
          service: {
            type: 'DIDComm',
            serviceEndpoint: `${this.SERVICE_ENDPOINT_BASE_URL}/performance-credential/get`,
          },
        },
      },
      proofFormat: 'jwt',
    });
  }

  async verifyPresentation(
    verifiablePresentation: VerifiablePresentation,
  ): Promise<VerifiableCredential> {
    const verificationResult: IVerifyResult = await this.didService
      .getAgent()
      .verifyPresentation({
        presentation: verifiablePresentation,
      });

    if (!verificationResult.verified) {
      throw new Error('Invalid verifiable presentation');
    }

    const verifiableCredentials: W3CVerifiableCredential[] | undefined =
      verifiablePresentation.verifiableCredential;

    if (!verifiableCredentials) {
      throw new Error('There are no verifiable credential');
    }

    const accessDelegationCredential: W3CVerifiableCredential | undefined =
      verifiableCredentials.find((credential: W3CVerifiableCredential) =>
        credential['type'].includes('AccessDelegationCredential'),
      );

    if (!accessDelegationCredential) {
      throw new Error('There are no university credentials present');
    }

    return accessDelegationCredential as VerifiableCredential;
  }

  async getPerformanceCredential(
    accessDelegationCredential: VerifiableCredential,
  ) {
    try {
      const policyResponse: AxiosResponse<OPAResponse> = await firstValueFrom(
        this.httpService.post<OPAResponse>(
          `${this.OPA_BASE_URL}/data/performance`,
          { input: accessDelegationCredential },
        ),
      );

      const responseData: OPAResponse = policyResponse.data;

      if (!responseData.result.allow) {
        throw new HttpException(
          'Access Delegation Credential is not valid or owner has revoked access',
          400,
        );
      }

      return this.dataService.getData(
        CREDENTIAL_KEYS.PERFORMANCE_TEST_CREDENTIAL_KEY,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log(error);
      console.log('Encountered error when checking policies');
      throw new HttpException('API request failed', 500);
    }
  }
}
