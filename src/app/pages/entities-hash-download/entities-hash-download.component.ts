import {
  ChangeDetectionStrategy,
  Component,
  inject,
  linkedSignal,
  PipeTransform,
  signal,
  WritableSignal,
} from "@angular/core";
import {
  applyEach,
  form,
  minLength,
  pattern,
  required,
  SchemaPathTree,
} from "@angular/forms/signals";
import {
  faCheck,
  faCircleXmark,
  faSpinner,
  faSquareUpRight,
} from "@fortawesome/free-solid-svg-icons";
import { interval, Observable, timer } from "rxjs";
import * as ops from "rxjs/operators";
import { SourcePickerService } from "src/app/common/source-picker.service";
import { components } from "src/app/core/api/openapi";
import { Api } from "src/app/core/services";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

interface DownloadHashForm {
  hashes: string[];
  security: string;
  securityConfirmed: boolean;
}

const sha256Pattern = /(?:[^0-9a-f]|^)([0-9a-f]{64})(?:[^0-9a-f]|$)/;
const sha256PatternMultiLine = /(?:[^0-9a-f]|^)([0-9a-f]{64})(?:[^0-9a-f]|$)/gm;

function HashesSchema(hash: SchemaPathTree<string>) {
  if (hash) {
    pattern(hash, sha256Pattern, {
      message: (ctx) => {
        return `invalid sha256 provided in hashes: ${ctx.valueOf(hash)}`;
      },
    });
  }
}

export class ValidDownloadHashFilter implements PipeTransform {
  transform(value: string): string {
    let reverse = "";
    for (let i = value.length - 1; i >= 0; i--) {
      reverse += value[i];
    }
    return reverse;
  }
}

@Component({
  selector: "app-entities-hash-download",
  templateUrl: "./entities-hash-download.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesHashDownloadComponent {
  sourcePicker = inject(SourcePickerService);
  api = inject(Api);
  dbg = (...d) => console.debug("BinariesHashDownloadComponent:", ...d);
  err = (...d) => console.error("BinariesHashDownloadComponent:", ...d);

  // icons
  protected faSpinner = faSpinner;
  protected faCheck = faCheck;
  protected faCircleXmark = faCircleXmark;
  protected faSquareUpRight = faSquareUpRight;

  // completed status
  protected completedStatus: components["schemas"]["StatusEnum"] = "completed";
  protected completedWithErrorsStatus: components["schemas"]["StatusEnum"] =
    "completed-with-errors";

  protected RefreshIntervalSeconds: number = 10;

  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;

  protected showInvalidRefs: WritableSignal<boolean> = signal(false);
  protected hashTextAreaSignal: WritableSignal<string> = signal("");

  protected allHashDownloadRequests: WritableSignal<
    | Map<
        string,
        Observable<components["schemas"]["DownloadResponse"] | undefined>
      >
    | undefined
  > = signal(undefined);
  protected allHashDownloadStatusReports: WritableSignal<
    | Map<
        string,
        Observable<components["schemas"]["StatusEvent"][] | undefined>
      >
    | undefined
  > = signal(undefined);

  protected allHashesWithContent: WritableSignal<
    Map<string, Observable<boolean>> | undefined
  > = signal(undefined);

  setArea(event: Event) {
    const textAreaRef = event.target as HTMLTextAreaElement;
    this.hashTextAreaSignal.set(textAreaRef.value);
  }

  protected downloadModel: WritableSignal<DownloadHashForm> = linkedSignal({
    source: () => {
      return {
        hashTextArea: this.hashTextAreaSignal(),
      };
    },
    computation: ({ hashTextArea }, previous) => {
      const hashes = this.parseHashes(hashTextArea);
      // If values are already set just update the hashes field.
      if (previous?.value !== undefined) {
        return {
          ...previous?.value,
          hashes: hashes,
        };
      }
      return {
        hashes: hashes,
        security: "",
        securityConfirmed: false,
      };
    },
  });

  downloadForm = form(this.downloadModel, (f) => {
    // FUTURE - setting messages this way won't be required in angular 22.
    required(f.hashes, { message: "hashes" });
    minLength(f.hashes, 1, { message: "must be at least one hash" });
    applyEach(f.hashes, HashesSchema);
    required(f.security, { message: "security" });
    required(f.securityConfirmed, { message: "securityConfirmed" });
  });

  // Provide the emitted security value to the form.
  securityEmit(sec: string) {
    this.downloadModel.update((v) => {
      return { ...v, security: sec, securityConfirmed: false };
    });
    if (sec !== undefined && sec?.length > 0) {
      this.showInvalidRefs.set(true);
    } else {
      this.showInvalidRefs.set(false);
    }
  }

  confirmedSecurity() {
    this.downloadModel.update((v) => {
      return { ...v, securityConfirmed: true };
    });
  }

  // Validate all form fields except security confirmation and return any errors.
  getRequiredFields(): string[] {
    const invalid = [];
    // Only run this section if the form is invalid
    if (
      this.downloadForm().invalid() ||
      this.sourcePicker.sourceForm().invalid()
    ) {
      for (const err of this.sourcePicker.getFormErrors()) {
        invalid.push(err);
      }

      this.downloadForm()
        .errorSummary()
        .forEach((err) => {
          if (err.message !== "securityConfirmed") {
            invalid.push(err.message);
          }
        });
    }
    return invalid;
  }

  parseHashes(text: string) {
    text = text.toLowerCase();

    const hashes: string[] = [];
    let search = sha256PatternMultiLine.exec(text);
    while (search) {
      if (hashes.indexOf(search[1]) < 0) {
        hashes.push(search[1]);
      }
      search = sha256PatternMultiLine.exec(text);
    }
    this.dbg(`Hashes found were:`, hashes);
    return hashes;
  }

  onSubmit() {
    if (
      this.downloadForm().invalid() ||
      this.sourcePicker.sourceForm().invalid()
    ) {
      this.err("Failed to process submission as forms were invalid.");
      return;
    }

    const downloadModel = this.downloadModel();
    const sourceModel = this.sourcePicker.sourceModel();

    const references: Map<string, string> = new Map<string, string>();
    sourceModel.refs.forEach((srcRef) => {
      references.set(srcRef.name, srcRef.value);
    });

    const allHashDownloadRequestMap = new Map<
      string,
      Observable<components["schemas"]["DownloadResponse"] | undefined>
    >();
    for (const hash of downloadModel.hashes) {
      allHashDownloadRequestMap.set(
        hash,
        this.api.hashDownloadRequest({
          sha256: hash,
          security: downloadModel.security,
          source_id: sourceModel.selectedSource,
          references: Object.fromEntries(references),
          settings: {},
        }),
      );
    }

    const allHashDownloadStatusRequestsMap = new Map<
      string,
      Observable<components["schemas"]["StatusEvent"][] | undefined>
    >();

    const allHashesWithContent = new Map<string, Observable<boolean>>();

    for (const hash of downloadModel.hashes) {
      // Query for status every refresh interval.
      const statusObservable = interval(
        this.RefreshIntervalSeconds * 1000,
      ).pipe(
        ops.switchMap(() => {
          return this.api.hashDownloadStatusRequest(hash);
        }),
      );
      allHashDownloadStatusRequestsMap.set(hash, statusObservable);
      allHashesWithContent.set(
        hash,
        timer(0, this.RefreshIntervalSeconds * 1000).pipe(
          ops.switchMap(() => {
            return this.api.entityHasContent(hash);
          }),
        ),
      );
    }

    this.allHashDownloadRequests.set(allHashDownloadRequestMap);
    this.allHashDownloadStatusReports.set(allHashDownloadStatusRequestsMap);
    this.allHashesWithContent.set(allHashesWithContent);
    // reset form submission
    this.downloadModel.update((v) => {
      return { ...v, securityConfirmed: false };
    });
  }
}
