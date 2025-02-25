/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import {
  createAgent,
  ICredentialPlugin,
  IDIDManager,
  IIdentifier,
  IKeyManager,
  IMessageHandler,
  IResolver,
  TAgent,
} from '@veramo/core';
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager';
import { getResolver as EthrDidResolver } from 'ethr-did-resolver';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { DIDComm, DIDCommMessageHandler, IDIDComm } from '@veramo/did-comm';
import {
  KeyManager,
  MemoryKeyStore,
  MemoryPrivateKeyStore,
} from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { JsonRpcProvider, Network } from 'ethers';
import { MessageHandler } from '@veramo/message-handler';
import { EthrDIDProvider } from '@veramo/did-provider-ethr';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DIDService {
  private readonly logger = new Logger(DIDService.name);
  private agent: TAgent<
    IKeyManager &
      IDIDManager &
      IResolver &
      ICredentialPlugin &
      IDIDComm &
      IMessageHandler
  >;

  private readonly GOVERNMENT_IDENTIFIER_KEY: string = 'governmentIdentifier';
  private readonly COMPANY_IDENTIFIER_KEY: string = 'companyIdentifier';
  private identifiers: { [key: string]: IIdentifier } = {};

  constructor(private configService: ConfigService) {
    const DEFAULT_KMS = 'local';
    const INFURA_PROJECT_ID: string = this.configService.get<string>(
      'INFURA_PROJECT_ID',
    ) as string;

    const MAINNET_TESTNET_CHAINID = 1;
    const MAINNET_TESTNET_RPC_URL = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
    const MAINNET_TESTNET_NAMESPACE = 'mainnet';
    const MAINNET_TESTNET_REGISTRY =
      '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b';

    this.agent = createAgent<
      IKeyManager &
        IDIDManager &
        IResolver &
        ICredentialPlugin &
        IDIDComm &
        IMessageHandler
    >({
      plugins: [
        new KeyManager({
          store: new MemoryKeyStore(),
          kms: {
            local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
          },
        }),
        new DIDManager({
          store: new MemoryDIDStore(),
          defaultProvider: 'did:key',
          providers: {
            'did:ethr': new EthrDIDProvider({
              defaultKms: DEFAULT_KMS,
              networks: [
                {
                  name: MAINNET_TESTNET_NAMESPACE,
                  provider: new JsonRpcProvider(
                    MAINNET_TESTNET_RPC_URL,
                    MAINNET_TESTNET_CHAINID,
                    { staticNetwork: Network.from(MAINNET_TESTNET_CHAINID) },
                  ),
                  rpcUrl: MAINNET_TESTNET_RPC_URL,
                  chainId: MAINNET_TESTNET_CHAINID,
                  registry: MAINNET_TESTNET_REGISTRY,
                },
              ],
            }),
          },
        }),
        new DIDResolverPlugin({
          ...EthrDidResolver({
            infuraProjectId: INFURA_PROJECT_ID,
          }),
        }),
        new CredentialPlugin(),
        new DIDComm(),
        new MessageHandler({
          messageHandlers: [new DIDCommMessageHandler()],
        }),
      ],
    });

    void this.agent
      .didManagerGetOrCreate({
        alias: 'government',
        provider: 'did:ethr',
      })
      .then((identifier: IIdentifier) => {
        this.logger.log(`Government DID: ${identifier.did}`);
        this.identifiers[this.GOVERNMENT_IDENTIFIER_KEY] = identifier;
      });

    void this.agent
      .didManagerGetOrCreate({
        alias: 'company',
        provider: 'did:ethr',
      })
      .then((identifier: IIdentifier) => {
        this.logger.log(`Company DID: ${identifier.did}`);
        this.identifiers[this.COMPANY_IDENTIFIER_KEY] = identifier;
      });
  }

  getAgent(): TAgent<
    IKeyManager &
      IDIDManager &
      IResolver &
      ICredentialPlugin &
      IDIDComm &
      IMessageHandler
  > {
    return this.agent;
  }

  getGovernmentIdentifier(): IIdentifier {
    return this.identifiers[this.COMPANY_IDENTIFIER_KEY];
  }

  getCompanyIdentifier(): IIdentifier {
    return this.identifiers[this.GOVERNMENT_IDENTIFIER_KEY];
  }
}
