import {
  AccountClearOptionsSchema,
  AccountConfirmationSchema,
  AccountInfoQuerySchema,
  CreateAppSpecificPasswordInputSchema,
  EventsListQuerySchema,
  FileCopyInputSchema,
  FileGetChildInputSchema,
  FileQuerySchema,
  FileSetSortInputSchema,
  FileTouchInputSchema,
  FileTypeSchema,
  FilesListQuerySchema,
  FilesSearchQuerySchema,
  JsonObjectSchema,
  OAuthAppCreateInputSchema,
  OAuthAppUpdateInputSchema,
  PaymentChangePlanSubmitSchema,
  PodcastGetLinksInputSchema,
  PublicShareListQuerySchema,
  RssFeedParamsSchema,
  SaveAccountSettingsPayloadSchema,
  SharingShareInputSchema,
  SharingUnshareInputSchema,
  TransferAddInputSchema,
  TransferAddTrackersInputSchema,
  TransferRemoveInputSchema,
  TransfersListQuerySchema,
} from "@putdotio/sdk";
import { Data, Effect, Schema, SchemaIssue } from "effect";

import type { CliSdkClient } from "./sdk.js";
import type { UnsupportedSdkOperation } from "./sdk-operations.js";

class CliSdkArgumentsError extends Data.TaggedError("CliSdkArgumentsError")<{
  readonly issue: string;
  readonly message: string;
  readonly operation: string;
}> {}

type SdkFunction = (...args: never) => void;

type OperationPath<Tree, Prefix extends string = ""> = {
  readonly [Key in keyof Tree & string]: Tree[Key] extends SdkFunction
    ? `${Prefix}${Key}`
    : OperationPath<Tree[Key], `${Prefix}${Key}.`>;
}[keyof Tree & string];

type OperationAt<Tree, Path extends string> = Path extends `${infer Head}.${infer Rest}`
  ? Head extends keyof Tree
    ? OperationAt<Tree[Head], Rest>
    : never
  : Path extends keyof Tree
    ? Tree[Path]
    : never;

type OverloadParameters<Operation> = Operation extends {
  (...args: infer A1): void;
  (...args: infer A2): void;
  (...args: infer A3): void;
  (...args: infer A4): void;
  (...args: infer A5): void;
  (...args: infer A6): void;
  (...args: infer A7): void;
  (...args: infer A8): void;
  (...args: infer A9): void;
}
  ? A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9
  : never;

type ArgsSchema = Schema.Decoder<ReadonlyArray<unknown>>;

type JsonCallablePath = Exclude<OperationPath<CliSdkClient>, UnsupportedSdkOperation>;

type MatchesOperation<Operation, Args> = [Args] extends [infer Tuple extends ReadonlyArray<unknown>]
  ? [Operation] extends [(...args: Tuple) => void]
    ? [Tuple["length"]] extends [OverloadParameters<Operation>["length"]]
      ? true
      : false
    : false
  : false;

type CheckedArgsSchemas<Schemas extends Record<JsonCallablePath, ArgsSchema>> = {
  readonly [Path in keyof Schemas]: MatchesOperation<
    OperationAt<CliSdkClient, Path & string>,
    Schema.Schema.Type<Schemas[Path]>
  > extends true
    ? Schemas[Path]
    : never;
};

const defineArgsSchemas = <const Schemas extends Record<JsonCallablePath, ArgsSchema>>(
  schemas: Schemas & CheckedArgsSchemas<Schemas>,
): Schemas => schemas;

const Id = Schema.Int;
const Ids = Schema.Array(Schema.Int);
const PerPageQuery = Schema.Struct({ per_page: Schema.optionalKey(Schema.Int) });

const none = Schema.Tuple([]);
const byId = Schema.Tuple([Id]);
const byText = Schema.Tuple([Schema.String]);
const byIds = Schema.Tuple([Ids]);
const byCursor = Schema.Tuple([Schema.String, Schema.optionalKey(PerPageQuery)]);

const bulkSelection = <const Extra extends Schema.Struct.Fields>(extra: Extra) =>
  Schema.Union([
    Schema.Struct({
      ...extra,
      cursor: Schema.String,
      excludeIds: Schema.optionalKey(Ids),
      ids: Schema.optionalKey(Ids),
    }),
    Schema.Struct({
      ...extra,
      cursor: Schema.optionalKey(Schema.String),
      excludeIds: Schema.optionalKey(Ids),
      ids: Ids,
    }),
  ]);

const FilesBulkSelectionSchema = bulkSelection({});

const DirectAccessFields = {
  downloadToken: Schema.String,
  useTunnel: Schema.optionalKey(Schema.Boolean),
};

const HlsFields = {
  maxSubtitleCount: Schema.optionalKey(Schema.Int),
  playOriginal: Schema.optionalKey(Schema.Boolean),
  subtitleLanguages: Schema.optionalKey(Schema.Array(Schema.String)),
};

const PaymentTypeSchema = Schema.Literals(["credit-card", "cryptocurrency"]);

const PaymentChangePlanPreviewInputSchema = Schema.Struct({
  coupon_code: Schema.optionalKey(Schema.String),
  payment_type: Schema.optionalKey(PaymentTypeSchema),
  plan_path: Schema.String,
});

const TrashBulkInputSchema = Schema.Union([
  Schema.Struct({ cursor: Schema.String, useCursor: Schema.Literal(true) }),
  Schema.Struct({ file_ids: Ids, useCursor: Schema.optionalKey(Schema.Literal(false)) }),
]);

const QueryValueSchema = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]);

const sdkOperationArgsSchemas = defineArgsSchemas({
  "account.appSpecificPasswords.create": Schema.Tuple([CreateAppSpecificPasswordInputSchema]),
  "account.appSpecificPasswords.delete": byId,
  "account.appSpecificPasswords.deleteAll": none,
  "account.appSpecificPasswords.list": none,
  "account.clear": Schema.Tuple([AccountClearOptionsSchema]),
  "account.getInfo": Schema.Tuple([Schema.optionalKey(AccountInfoQuerySchema)]),
  "account.getSettings": none,
  "account.listConfirmations": Schema.Tuple([
    Schema.optionalKey(AccountConfirmationSchema.fields.subject),
  ]),
  "account.listSubtitleLanguages": none,
  "account.saveSettings": Schema.Tuple([SaveAccountSettingsPayloadSchema]),
  "downloadLinks.create": Schema.Tuple([FilesBulkSelectionSchema]),
  "downloadLinks.get": byId,
  "events.clear": none,
  "events.delete": byId,
  "events.list": Schema.Tuple([Schema.optionalKey(EventsListQuerySchema)]),
  "family.createInvite": none,
  "family.join": byText,
  "family.listInvites": none,
  "family.listMembers": none,
  "family.removeMember": byText,
  "files.canWrite": byId,
  "files.continue": byCursor,
  "files.continueSearch": byCursor,
  "files.convertManyToMp4": byIds,
  "files.convertSelectionToMp4": Schema.Tuple([FilesBulkSelectionSchema]),
  "files.convertToMp4": byId,
  "files.copy": Schema.Tuple([FileCopyInputSchema]),
  "files.createFolder": Schema.Tuple([
    Schema.Struct({
      name: Schema.optionalKey(Schema.String),
      parent_id: Schema.optionalKey(Id),
      path: Schema.optionalKey(Schema.String),
    }),
  ]),
  "files.delete": Schema.Tuple([
    Ids,
    Schema.optionalKey(
      Schema.Struct({
        ignoreFileOwner: Schema.optionalKey(Schema.Boolean),
        partialDelete: Schema.optionalKey(Schema.Boolean),
        skipTrash: Schema.optionalKey(Schema.Boolean),
      }),
    ),
  ]),
  "files.deleteExtraction": byId,
  "files.deleteMp4": byId,
  "files.deleteSelection": Schema.Tuple([
    FilesBulkSelectionSchema,
    Schema.optionalKey(
      Schema.Struct({
        partialDelete: Schema.optionalKey(Schema.Boolean),
        skipTrash: Schema.optionalKey(Schema.Boolean),
      }),
    ),
  ]),
  "files.extract": Schema.Tuple([bulkSelection({ password: Schema.optionalKey(Schema.String) })]),
  "files.findNext": Schema.Tuple([Id, FileTypeSchema]),
  "files.findNextVideo": byId,
  "files.get": Schema.Tuple([
    Schema.Struct({ id: Id, query: Schema.optionalKey(FileQuerySchema) }),
  ]),
  "files.getApiContentUrl": Schema.Tuple([Id, Schema.Struct(DirectAccessFields)]),
  "files.getApiDownloadUrl": Schema.Tuple([
    Id,
    Schema.Struct({ ...DirectAccessFields, name: Schema.optionalKey(Schema.String) }),
  ]),
  "files.getApiMp4DownloadUrl": Schema.Tuple([
    Id,
    Schema.Struct({
      ...DirectAccessFields,
      convert: Schema.optionalKey(Schema.Boolean),
      name: Schema.optionalKey(Schema.String),
    }),
  ]),
  "files.getChild": Schema.Tuple([FileGetChildInputSchema]),
  "files.getDownloadUrl": byId,
  "files.getHlsMasterPlaylist": Schema.Tuple([Id, Schema.optionalKey(Schema.Struct(HlsFields))]),
  "files.getHlsStreamUrl": Schema.Tuple([
    Id,
    Schema.Struct({ ...HlsFields, downloadToken: Schema.String }),
  ]),
  "files.getMp4Status": byId,
  "files.getStartFrom": byId,
  "files.getXspfPlaylistUrl": Schema.Tuple([Id, Schema.Struct({ downloadToken: Schema.String })]),
  "files.list": Schema.Tuple([
    Schema.Union([Id, Schema.Literal("friends")]),
    Schema.optionalKey(FilesListQuerySchema),
  ]),
  "files.listActiveConversions": none,
  "files.listExtractions": none,
  "files.listSubtitles": Schema.Tuple([
    Id,
    Schema.optionalKey(
      Schema.Struct({ languages: Schema.optionalKey(Schema.Array(Schema.String)) }),
    ),
  ]),
  "files.move": Schema.Tuple([Ids, Id]),
  "files.moveSelection": Schema.Tuple([FilesBulkSelectionSchema, Id]),
  "files.putMp4ToMyFiles": byId,
  "files.rename": Schema.Tuple([Schema.Struct({ file_id: Id, name: Schema.String })]),
  "files.resetSortSettings": none,
  "files.resetStartFrom": byId,
  "files.search": Schema.Tuple([FilesSearchQuerySchema]),
  "files.setSort": Schema.Tuple([FileSetSortInputSchema]),
  "files.setStartFrom": Schema.Tuple([Schema.Struct({ file_id: Id, time: Schema.Finite })]),
  "files.setWatchStatus": Schema.Tuple([bulkSelection({ watched: Schema.Boolean })]),
  "files.touch": Schema.Tuple([FileTouchInputSchema]),
  "friendInvites.create": none,
  "friendInvites.list": none,
  "friends.approve": byText,
  "friends.countWaitingRequests": none,
  "friends.deny": byText,
  "friends.list": none,
  "friends.listSentRequests": none,
  "friends.listWaitingRequests": none,
  "friends.remove": byText,
  "friends.search": byText,
  "friends.sendRequest": byText,
  "friends.sharedFolder": byText,
  "ifttt.getStatus": none,
  "ifttt.sendEvent": Schema.Tuple([
    Schema.Struct({
      clientName: Schema.optionalKey(Schema.String),
      eventType: Schema.String,
      ingredients: JsonObjectSchema,
    }),
  ]),
  "oauth.buildAuthorizeUrl": Schema.Tuple([
    Schema.Struct({
      baseUrl: Schema.optionalKey(Schema.String),
      oauthToken: Schema.String,
      query: Schema.optionalKey(Schema.Record(Schema.String, QueryValueSchema)),
    }),
  ]),
  "oauth.buildIconUrl": Schema.Tuple([
    Schema.Struct({
      baseUrl: Schema.optionalKey(Schema.String),
      id: Id,
      oauthToken: Schema.String,
    }),
  ]),
  "oauth.create": Schema.Tuple([OAuthAppCreateInputSchema]),
  "oauth.delete": byId,
  "oauth.get": Schema.Tuple([
    Id,
    Schema.optionalKey(Schema.Struct({ edit: Schema.optionalKey(Schema.Boolean) })),
  ]),
  "oauth.getPopularApps": none,
  "oauth.query": none,
  "oauth.update": Schema.Tuple([OAuthAppUpdateInputSchema]),
  "payment.changePlan.classifyResponse": Schema.Tuple([PaymentChangePlanSubmitSchema]),
  "payment.changePlan.preview": Schema.Tuple([PaymentChangePlanPreviewInputSchema]),
  "payment.changePlan.submit": Schema.Tuple([
    Schema.Struct({
      ...PaymentChangePlanPreviewInputSchema.fields,
      confirmation_code: Schema.optionalKey(Schema.String),
    }),
  ]),
  "payment.confirmFastspringOrder": byText,
  "payment.getInfo": none,
  "payment.listHistory": Schema.Tuple([
    Schema.optionalKey(Schema.Struct({ unreported_only: Schema.optionalKey(Schema.Boolean) })),
  ]),
  "payment.listInvites": none,
  "payment.listOptions": none,
  "payment.listPlans": none,
  "payment.methods.addPaddleWaitingPayment": Schema.Tuple([
    Schema.Struct({
      checkout_id: Schema.String,
      product_id: Schema.Union([Schema.String, Schema.Int]),
    }),
  ]),
  "payment.methods.createOpenNodeCharge": byText,
  "payment.methods.createPaddleBillingUpdatePaymentMethodTransaction": byId,
  "payment.methods.getPaddleBillingInvoiceUrl": byId,
  "payment.report": byIds,
  "payment.stopSubscription": none,
  "payment.voucher.getInfo": byText,
  "payment.voucher.redeem": byText,
  "podcast.getLinks": Schema.Tuple([PodcastGetLinksInputSchema]),
  "rateLimits.removeBan": Schema.Tuple([
    Schema.Struct({ captchaToken: Schema.String, id: Schema.String }),
  ]),
  "rss.clearLogs": byId,
  "rss.create": Schema.Tuple([RssFeedParamsSchema]),
  "rss.delete": byId,
  "rss.get": byId,
  "rss.list": none,
  "rss.listItems": byId,
  "rss.pause": byId,
  "rss.resume": byId,
  "rss.retryAll": byId,
  "rss.retryItem": Schema.Tuple([Id, Id]),
  "rss.update": Schema.Tuple([Id, RssFeedParamsSchema]),
  "sharing.clone": Schema.Tuple([bulkSelection({ parentId: Schema.optionalKey(Id) })]),
  "sharing.getCloneInfo": byId,
  "sharing.getSharedWith": byId,
  "sharing.listSharedFiles": none,
  "sharing.publicAccess.continueFiles": byCursor,
  "sharing.publicAccess.get": none,
  "sharing.publicAccess.getFileUrl": byId,
  "sharing.publicAccess.listFiles": Schema.Tuple([Schema.optionalKey(PublicShareListQuerySchema)]),
  "sharing.publicShares.create": byId,
  "sharing.publicShares.delete": byId,
  "sharing.publicShares.list": none,
  "sharing.shareFiles": Schema.Tuple([
    bulkSelection({ target: SharingShareInputSchema.fields.target }),
  ]),
  "sharing.unshare": Schema.Tuple([SharingUnshareInputSchema]),
  "transfers.add": Schema.Tuple([TransferAddInputSchema]),
  "transfers.addMany": Schema.Tuple([Schema.Array(TransferAddInputSchema)]),
  "transfers.addTrackers": Schema.Tuple([TransferAddTrackersInputSchema]),
  "transfers.cancel": byIds,
  "transfers.clean": Schema.Tuple([Schema.optionalKey(Ids)]),
  "transfers.continue": Schema.Tuple([Schema.String, Schema.optionalKey(TransfersListQuerySchema)]),
  "transfers.count": none,
  "transfers.get": byId,
  "transfers.getTorrent": byId,
  "transfers.info": Schema.Tuple([Schema.Array(Schema.String)]),
  "transfers.list": Schema.Tuple([Schema.optionalKey(TransfersListQuerySchema)]),
  "transfers.reannounce": byId,
  "transfers.remove": Schema.Tuple([TransferRemoveInputSchema]),
  "transfers.retry": byId,
  "transfers.stopRecording": byId,
  "trash.continue": byCursor,
  "trash.delete": Schema.Tuple([TrashBulkInputSchema]),
  "trash.empty": none,
  "trash.list": Schema.Tuple([Schema.optionalKey(PerPageQuery)]),
  "trash.restore": Schema.Tuple([TrashBulkInputSchema]),
  "tunnel.listRoutes": none,
  "zips.cancel": byId,
  "zips.create": Schema.Tuple([
    Schema.Union([
      Schema.Struct({
        cursor: Schema.String,
        exclude_ids: Schema.optionalKey(Ids),
        file_ids: Schema.optionalKey(Ids),
      }),
      Schema.Struct({
        cursor: Schema.optionalKey(Schema.String),
        exclude_ids: Schema.optionalKey(Ids),
        file_ids: Ids,
      }),
    ]),
  ]),
  "zips.get": byId,
  "zips.list": none,
});

const argsSchemas = new Map<string, ArgsSchema>(Object.entries(sdkOperationArgsSchemas));

const formatIssue = SchemaIssue.makeFormatterDefault();

const argumentsError = (operation: string, issue: string) =>
  new CliSdkArgumentsError({
    issue,
    message: `Expected \`sdk call\` arguments to match the \`${operation}\` input schema.`,
    operation,
  });

export const decodeSdkOperationArgs = (operation: string, args: ReadonlyArray<unknown>) => {
  const schema = argsSchemas.get(operation);

  if (schema === undefined) {
    return Effect.fail(argumentsError(operation, "No argument schema is defined for it."));
  }

  return Schema.decodeUnknownEffect(schema)(args, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) =>
      argumentsError(operation, formatIssue(error.issue).replaceAll(/\n\s*/gu, " ")),
    ),
  );
};
