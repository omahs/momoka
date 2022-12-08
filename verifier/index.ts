import Utils from '@bundlr-network/client/build/common/utils';
import { getArweaveByIdAPI } from './arweave/get-arweave-by-id.api';
import { getArweaveTransactionsAPI } from './arweave/get-arweave-transactions.api';
import { ClaimableValidatorError } from './claimable-validator-errors';
import { DAActionTypes } from './data-availability-models/data-availability-action-types';
import {
  CreateCommentEIP712TypedData,
  CreateMirrorEIP712TypedData,
} from './data-availability-models/publications/data-availability-publication-typed-data';
import {
  DAEventType,
  DAStructurePublication,
  PublicationTypedData,
} from './data-availability-models/publications/data-availability-structure-publication';
import {
  DACommentCreatedEventEmittedResponse,
  DAMirrorCreatedEventEmittedResponse,
} from './data-availability-models/publications/data-availability-structure-publications-events';
import { executeSimulationTransaction, parseSignature } from './ethereum';
import { CommentWithSigRequest, MirrorWithSigRequest } from './ethereum-abi-types/LensHub';
import { checkDAPost, CheckDAPostPublication } from './post';

const sleep = (milliseconds: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

type CheckDACommentPublication = DAStructurePublication<
  DACommentCreatedEventEmittedResponse,
  CreateCommentEIP712TypedData
>;

const checkDAComment = async (publication: CheckDACommentPublication) => {
  const sigRequest: CommentWithSigRequest = {
    profileId: publication.chainProofs.thisPublication.typedData.value.profileId,
    contentURI: publication.chainProofs.thisPublication.typedData.value.contentURI,
    profileIdPointed: publication.chainProofs.thisPublication.typedData.value.profileIdPointed,
    pubIdPointed: publication.chainProofs.thisPublication.typedData.value.pubIdPointed,
    referenceModuleData:
      publication.chainProofs.thisPublication.typedData.value.referenceModuleData,
    collectModule: publication.chainProofs.thisPublication.typedData.value.collectModule,
    collectModuleInitData:
      publication.chainProofs.thisPublication.typedData.value.collectModuleInitData,
    referenceModule: publication.chainProofs.thisPublication.typedData.value.referenceModule,
    referenceModuleInitData:
      publication.chainProofs.thisPublication.typedData.value.referenceModuleInitData,
    sig: parseSignature(
      publication.chainProofs.thisPublication.signature,
      publication.chainProofs.thisPublication.typedData.value.deadline
    ),
  };

  await executeSimulationTransaction(
    'commentWithSig',
    sigRequest,
    publication.chainProofs.thisPublication.blockNumber
  );
};

type CheckDAMirrorPublication = DAStructurePublication<
  DAMirrorCreatedEventEmittedResponse,
  CreateMirrorEIP712TypedData
>;

const checkDAMirror = async (publication: CheckDAMirrorPublication) => {
  const sigRequest: MirrorWithSigRequest = {
    profileId: publication.chainProofs.thisPublication.typedData.value.profileId,
    profileIdPointed: publication.chainProofs.thisPublication.typedData.value.profileIdPointed,
    pubIdPointed: publication.chainProofs.thisPublication.typedData.value.pubIdPointed,
    referenceModuleData:
      publication.chainProofs.thisPublication.typedData.value.referenceModuleData,
    referenceModule: publication.chainProofs.thisPublication.typedData.value.referenceModule,
    referenceModuleInitData:
      publication.chainProofs.thisPublication.typedData.value.referenceModuleInitData,
    sig: parseSignature(
      publication.chainProofs.thisPublication.signature,
      publication.chainProofs.thisPublication.typedData.value.deadline
    ),
  };

  await executeSimulationTransaction(
    'mirrorWithSig',
    sigRequest,
    publication.chainProofs.thisPublication.blockNumber
  );
};

const getClosestBlock = (blockNumber: number, timestamp: number) => {
  const blocks = [blockNumber - 1, blockNumber];
  while (true) {
    blocks.push(blockNumber - 1);
  }
};

const checkDASubmisson = async (arweaveId: string) => {
  const log = (message: string, ...optionalParams: any[]) => {
    console.log(`${arweaveId} - ${message}`, ...optionalParams);
  };

  log(`Checking for submission - ${arweaveId}`);

  const daPublication = await getArweaveByIdAPI<
    DAStructurePublication<DAEventType, PublicationTypedData>
  >(arweaveId);
  log('getArweaveByIdAPI result', daPublication);

  // check if bundlr timestamp proofs are valid and verified against bundlr node
  const valid = await Utils.verifyReceipt(daPublication.timestampProofs.response);
  if (!valid) {
    log('timestamp proof invalid signature');
    throw new Error(ClaimableValidatorError.TIMESTAMP_PROOF_INVALID_SIGNATURE);
  }

  log('timestamp proof signature valid');

  // 2. fetch the `daPublication.timestampProofs.id` from arweave graphql node, checked `dataAvailabilityId` and type match!
  // 2. + also check the wallet who uploaded it is within the submittors wallet list

  // TODO: insert code here

  // 3. get the closest block to the timestamp

  // TODO: insert code here

  // 4. compare block numbers to make sure they are the same

  // the event emitted must match the same timestamp as the block number
  if (daPublication.event.timestamp !== daPublication.chainProofs.thisPublication.blockTimestamp) {
    throw new Error(ClaimableValidatorError.INVALID_EVENT_TIMESTAMP);
  }

  log('event timestamp matches up the on chain block timestamp');

  switch (daPublication.type) {
    case DAActionTypes.POST_CREATED:
      if (daPublication.chainProofs.pointer) {
        throw new Error(ClaimableValidatorError.INVALID_POINTER_SET_NOT_NEEDED);
      }
      await checkDAPost(daPublication as CheckDAPostPublication);
      break;
    case DAActionTypes.COMMENT_CREATED:
      await checkDAComment(daPublication as CheckDACommentPublication);
      break;
    case DAActionTypes.MIRROR_CREATED:
      await checkDAMirror(daPublication as CheckDAMirrorPublication);
      break;
    default:
      throw new Error('Unknown type');
  }
};

const verifier = async () => {
  console.log('Verify watcher started');

  // loop forever!
  while (true) {
    console.log('Checking for new submissions');
    const arweaveTransactions = await getArweaveTransactionsAPI();
    if (!arweaveTransactions?.edges) {
      console.log('No more transactions to check. Sleep for 5 seconds then check again');
      sleep(5000);
    }

    console.log('Found new submissions', arweaveTransactions!.edges.length);

    for (let i = 0; i < arweaveTransactions!.edges.length; i++) {
      await checkDASubmisson(arweaveTransactions!.edges[i].node.id);
    }

    // TODO remove this :)
    break;
  }
};

verifier().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});