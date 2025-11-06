import { Component, OnDestroy, inject } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

import { Entity } from "src/app/core/services";

import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { BaseCard } from "../base-card.component";
import { faCameraRetro, faSlash } from "@fortawesome/free-solid-svg-icons";

// FUTURE update for latest cape plugin and/or remove if can be consolidated
/**card displaying sandbox/dynamic analysis results*/
@Component({
  selector: "azec-sandbox-results",
  templateUrl: "./sandbox-results.component.html",
  styleUrls: ["./sandbox-results.component.css"],
  standalone: false,
})
export class SandboxResultsComponent extends BaseCard implements OnDestroy {
  private entityService = inject(Entity);
  private sanitizer = inject(DomSanitizer);

  help = `
Displays Sandbox/Dynamic Analysis Run Summaries.
These can be produced either from locally run processing plugins or imported metadata from external sources such as VirusTotal.

Columns in table:

Screenshot - Some sandboxes can take screenshots of activity that occurs during analysis.  This may not be available if the sandbox does not take screenshots or Azul does not have a copy of image/s taken.

Sandbox - This is a name representing the source of the dynamic analysis results which may be an external system or local plugin.

Profile - Some sandboxes will submit samples for analysis in different ways, especially based on file type (eg. launching with application vs via shell).  Profile represents the setting used if applicable.

Options - Within a profile certain options may be set to control how a sample is analysed (for example specifying DLL entrypoints), these are recorded here if applicable.

Tags - Some sandboxes will use tags to control which guest image (eg. Operating System version, architecture and installed applications) is used to run a sample in.  If these were specified, the tags requested will be listed here.

Route - Different sandboxes will be configured with different network settings on how they should route any traffic from the guest.  This column details what network configuration was used.
Common Examples:
* internet - the guest could send traffic to the internet and contact actual endpoints
* inetsim|fakenet|netsink - fake services run in offline environment to elicit malware comms without contacting actual endpoints
* tor - the guest could send traffic to the internet using TOR anonymising network

Resolved - If the sandbox recorded any DNS resolution attempts for hosts they are listed here

Contacted - If the sandbox recorded any IP connection attempts to hosts:ports they are listed here

PCAP - If the sandbox provides a packet capture of the network activity it can be downloaded here.  This may not be available if Azul does not have a copy the capture file.

Persistence - If the sandbox detected the sample trying to persist across reboots on the guest, using known autorun locations/techniques (eg. services, schtasks, certain registry keys) they are listed here.

Full detailed metadata from any sandbox runs should also be available in the features table below.
  `;

  _screenshots = {};
  _cleanup = [];

  protected faCameraRetro = faCameraRetro;
  protected faSlash = faSlash;

  /** Return an object url for the given screenshot hash */
  screenshot(sha256: string): Observable<string> {
    let url = this._screenshots[sha256];
    if (url === undefined) {
      url = this.entityService.streamBlob(this.entity.sha256, sha256).pipe(
        ops.map((d) => {
          const link = this.sanitizer.bypassSecurityTrustResourceUrl(
            URL.createObjectURL(d),
          );
          this._cleanup.push(link);
          return link;
        }),
      );
      this._screenshots[sha256] = url;
    }
    return url;
  }

  /** trigger browser download of artifact */
  downloadArtifact(sha256: string, filename: string) {
    this.entityService
      .downloadStream(this.entity.sha256, sha256, filename)
      .subscribe();
  }

  /** ensure we release any created object urls */
  ngOnDestroy(): void {
    this._cleanup.forEach((val) => {
      URL.revokeObjectURL(val);
    });
    this._screenshots = {};
    this._cleanup = [];
  }
}
