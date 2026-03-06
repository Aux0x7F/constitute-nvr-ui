export type ConnectionConfig = {
  url: string;
  identityId: string;
  devicePk: string;
  identitySecretHex: string;
  allowUnsignedHelloMvp?: boolean;
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
export type ListSourceStatesCommand = { cmd: "list_source_states" };
export type DiscoverOnvifCommand = { cmd: "discover_onvif" };
export type DiscoverReolinkCommand = { cmd: "discover_reolink" };
export type ProbeReolinkCommand = {
  cmd: "probe_reolink";
  ip: string;
};
export type ReadReolinkStateCommand = {
  cmd: "read_reolink_state";
  request: {
    ip: string;
    username: string;
    channel: number;
    password: string;
  };
};
export type SetupReolinkCommand = {
  cmd: "setup_reolink";
  request: {
    ip: string;
    username: string;
    password: string;
    desiredPassword?: string;
    generatePassword?: boolean;
  };
};

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
  | ListSourceStatesCommand
  | DiscoverOnvifCommand
  | DiscoverReolinkCommand
  | ProbeReolinkCommand
  | ReadReolinkStateCommand
  | SetupReolinkCommand
  | ListSegmentsCommand
  | GetSegmentCommand;
