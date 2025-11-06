/**expected entropy data structure*/
export type Entropy = {
  overall: number;
  block_count: number;
  block_size: number;
  blocks: number[];
};

/**expected sandbox run info structure*/
export type Sandbox = {
  contacted_hosts: string[];
  resolved_hosts: string[];
  options: string;
  package: string;
  pcap: string;
  pcap_author: string;
  persistence: Persistence[];
  profile: string;
  report_url: string;
  route: string;
  sandbox: string;
  tags: string;
  timeout: number;
  tlsmaster: string;
  screenshot: string;
};

/**expected sandbox run info persistence objs*/
export type Persistence = {
  category: string;
  value: string;
};
