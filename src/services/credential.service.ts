import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { OPAResponse } from 'src/dtos/OpaDtos';
import { DataService } from './data.service';
import { CREDENTIAL_KEYS } from 'src/constants';
import { VerifiableCredential } from '@veramo/core';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private OPA_BASE_URL: string;
  private ARIES_CLOUD_AGENT_BASE_URL: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly dataService: DataService,
    private configService: ConfigService,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
}
