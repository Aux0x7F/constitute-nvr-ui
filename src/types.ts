export type ConnectionConfig = {
  url: string;
  identityId: string;
  devicePk: string;
  identitySecretHex: string;
};

export type HelloRequest = {
  type: "hello";
  identityId: string;
  devicePk: string;
  clientKey: string;
  ts: number;
  proof: string;
};

export type HelloAck = {
  type: "hello_ack";
  sessionId: string;
  serverKey: string;
  ts: number;
};

export type CipherEnvelope = {
  type: "cipher";
  nonce: string;
  data: string;
};

export type ListSourcesCommand = { cmd: "list_sources" };
export type DiscoverOnvifCommand = { cmd: "discover_onvif" };
export type ListSegmentsCommand = {
  cmd: "list_segments";
  sourceId: string;
  limit?: number;
};
export type GetSegmentCommand = {
  cmd: "get_segment";
  sourceId: string;
  name: string;
};

export type ClientCommand =
  | ListSourcesCommand
  | DiscoverOnvifCommand
  | ListSegmentsCommand
  | GetSegmentCommand;
