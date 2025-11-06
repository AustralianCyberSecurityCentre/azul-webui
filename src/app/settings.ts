import { ReplaySubject } from "rxjs";

export const enum BinaryExternalLinkType {
  Eq = "eq",
  Exists = "exists",
  Regex = "regex",
}

export type BinaryExternalLink =
  | {
      if: string;
      operator: BinaryExternalLinkType.Eq;
      match: string;

      display_name: string;
      url: string;
      url_args?: string[];
    }
  | {
      if: string;
      operator: BinaryExternalLinkType.Regex;
      match: string;

      display_name: string;
      url: string;
      url_args?: string[];
    }
  | {
      if: string;
      operator: BinaryExternalLinkType.Exists;

      display_name: string;
      url: string;
      url_args?: string[];
    };

export type GlobalExternalLinks = {
  retrohunt_url: string;
  nsrl_url: string;
};

export type DynamicConfig = {
  oauth_enabled: boolean;
  oidc_url?: string;
  oidc_client?: string;
  oidc_scopes?: string;
  oidc_debug?: boolean;

  motd_hours: number;
  motd_header: string;
  motd_body: string;
  motd_footer: string;
  deployment_title?: string;
  deployment_alticon?: boolean;
  deployment_text: string;

  unauthorized_help: string;

  banner_message?: string;
  banner_severity: "info" | "warning" | "error";
  banner_dismissable?: boolean;

  global_external_links?: GlobalExternalLinks;
  binary_external_links?: BinaryExternalLink[];
};

export let config: DynamicConfig | null = null;

export const authCode$ = new ReplaySubject<string>(1);

export function setConfig(x: DynamicConfig) {
  config = x;
  // override/cleanup/set default config here
}

// get base url (including base href)
const bases = document.getElementsByTagName("base");
export let base_url: string | null = null;

if (bases.length > 0) {
  base_url = bases[0].href;
} else {
  alert("no base url found, application will not work properly.");
}
console.log("base url is " + base_url);
