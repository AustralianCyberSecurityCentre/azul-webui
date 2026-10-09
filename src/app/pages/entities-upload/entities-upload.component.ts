import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { formatDate } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  TemplateRef,
  ViewChild,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  applyEach,
  form,
  minLength,
  required,
  SchemaPathTree,
  validate,
} from "@angular/forms/signals";
import { ActivatedRoute, Router } from "@angular/router";
import { BannerService } from "@app/common/banner.service";
import { ApiService } from "@app/core/api/api.service";
import { ValidPOSTUploadPaths } from "@app/core/api/methods";
import { components } from "@app/core/api/openapi";
import { FileUpload } from "@app/core/api/state";
import { SecurityService } from "@app/core/security.service";
import { Entity } from "@app/core/services";
import { UserService } from "@app/core/user.service";
import { sourceRefsAsParams } from "@app/core/util";
import {
  faCheck,
  faCloudArrowUp,
  faFileLines,
  faPlus,
  faSpinner,
  faSquareUpRight,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  from,
  of,
} from "rxjs";
import * as ops from "rxjs/operators";

interface CaughtHttpError {
  type: string;
}

type ChildUpload = FileUpload<
  ValidPOSTUploadPaths["/api/v0/binaries/child"]["post"]["requestBody"]["content"]["multipart/form-data"]
>;
type SourceUpload = FileUpload<
  ValidPOSTUploadPaths["/api/v0/binaries/source"]["post"]["requestBody"]["content"]["multipart/form-data"]
>;

// Form Model interfaces
interface FileWithNewName {
  file: File;
  newName: string;
}
interface ReferenceFormInterface {
  ref: components["schemas"]["SourceReference"];
  key: string;
  val: string;
}
interface NameValueEntry {
  key: string;
  value: string;
}
interface entitiesUpload {
  source: string;
  refs: ReferenceFormInterface[];
  relations: NameValueEntry[];
  security: string;
  security_confirm: boolean;
  files: FileWithNewName[];
  extract: boolean;
  password: string;
  timestamp: string;
  settingsPasswords: string[];
}

function RelationsFieldValidation(item: SchemaPathTree<NameValueEntry>) {
  validate(item.key, ({ value, valueOf }) => {
    if (value() === "" && valueOf(item.value) !== "") {
      return {
        kind: "invalidRelationsValueSetWithNoKey",
        message: "relations has a value set with no key value.",
      };
    }
    return null;
  });
  validate(item.value, ({ value, valueOf }) => {
    if (value() === "" && valueOf(item.key) !== "") {
      return {
        kind: "invalidRelationsKeySetWithNoValue",
        message: "relations has a key set with no value set.",
      };
    }
    return null;
  });
}

function ReferenceSchemaValidation(
  item: SchemaPathTree<ReferenceFormInterface>,
) {
  if (item.ref.required) {
    required(item.key, {
      message: (ctx) => {
        return `${ctx.valueOf(item.key)}`;
      },
      when: (fieldCtx) => fieldCtx.valueOf(item.ref.required) === true,
    });
    required(item.val, {
      message: (ctx) => {
        return `${ctx.valueOf(item.val)}`;
      },
      when: (fieldCtx) => fieldCtx.valueOf(item.ref.required) === true,
    });
  }
}

/**page for uploading new entities for analysis*/
@Component({
  selector: "app-entities-upload",
  templateUrl: "./entities-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesUploadComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected bannerService = inject(BannerService);
  user = inject(UserService);
  securityService = inject(SecurityService);
  api = inject(ApiService);
  entityService = inject(Entity);
  private dialogService = inject(Dialog);

  dbg = (...d) => console.debug("BinariesUploadComponent:", ...d);
  err = (...d) => console.error("BinariesUploadComponent:", ...d);

  protected faCloudArrowUp = faCloudArrowUp;
  protected faTrashCan = faTrashCan;
  protected faPlus = faPlus;
  protected faXmark = faXmark;
  protected faCheck = faCheck;
  protected faFileLines = faFileLines;
  protected faSquareUpRight = faSquareUpRight;
  protected faSpinner = faSpinner;

  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;

  readonly defaultSource = "samples";
  readonly extensionsToRemoveOnUpload = [".cart", ".malpz"];
  readonly extensionsThatCanBeExtracted = ["zip", "gzip", "tar"];
  readonly largeFileSize = 50 * 1024 * 1024;

  uploadModel: WritableSignal<entitiesUpload> = signal({
    source: this.defaultSource,
    refs: [],
    relations: [],
    security: "",
    security_confirm: false,
    files: [],
    extract: false,
    password: "",
    // Since browser is non-specific (we don't know when the file was actually sourced), we clear the time part to 00:00:00
    // Format date, for compatibility with datetime-local input type
    timestamp: formatDate(new Date(), "yyyy-MM-ddTHH:mm", "en"),
    settingsPasswords: [""],
  });
  uploadForm = form(this.uploadModel, (schemaPath) => {
    required(schemaPath.source);
    required(schemaPath.security);
    required(schemaPath.files);
    minLength(schemaPath.files, 1);
    required(schemaPath.timestamp);
    applyEach(schemaPath.refs, ReferenceSchemaValidation);
    applyEach(schemaPath.relations, RelationsFieldValidation);
    validate(schemaPath.security_confirm, ({ value }) => {
      if (value() === false) {
        return {
          kind: "securityNotConfirmed",
          message: "Must confirm security for validation to be complete.",
        };
      }
      return null;
    });
    // If a reference is set it must have a key, if the field is required it must also have a value.
    // validate(schemaPath.refs, ({ value }) => {
    //   for (const curRef of value()) {
    //     // Ensure the key is a valid string
    //     if (curRef?.key === undefined || curRef.key.length === 0) {
    //       return {
    //         kind: "refKeyRequired",
    //         message: "All reference value keys must be set to a value.",
    //       };
    //     }
    //     if (curRef.ref.required) {
    //       if (curRef?.val === undefined || curRef?.val?.length === 0) {
    //         return {
    //           kind: "refValueNotSet",
    //           message: `The reference value '${curRef.key}' isn't set and is required to be set.`,
    //         };
    //       }
    //     }
    //   }
    //   return null;
    // });
    // // Ensure if there are any relations both their key and value are set.
    // validate(schemaPath.relations, ({ value }) => {
    //   for (const kv of value()) {
    //     if (kv.key === "" || kv.value === "") {
    //       return {
    //         kind: "unsetRelation",
    //         message: `Their is an unset relation value the key and value must both be set.`,
    //       };
    //     }
    //   }
    //   return null;
    // });
  });

  sources$: Observable<components["schemas"]["Response_str_Source_"]["data"]>;
  sourcesSignal: Signal<
    components["schemas"]["Response_str_Source_"]["data"] | undefined
  >;
  parentSha256Signal: Signal<string | null> = signal(null);
  isParentSha256: Signal<boolean> = computed(() => {
    const parentSha256 = this.parentSha256Signal();
    return parentSha256 !== null && parentSha256.length > 0;
  });
  extractConfirmSub: Subscription;

  @ViewChild("tplExtractWarning") tplExtractWarning: TemplateRef<Element>;
  protected dialog: DialogRef | DialogRef<unknown, Element> | null = null;

  // upload status map
  uploads = new Map<number, BehaviorSubject<[number, string, boolean]>>();
  allUploadsData: Map<number, readonly components["schemas"]["BinaryData"][]>;

  protected largeFileSignal: WritableSignal<boolean> = signal(false);

  protected sourceReferenceField: Signal<ReferenceFormInterface[]> = computed(
    () => {
      const newRefs: ReferenceFormInterface[] = [];
      // Update source references when required.
      const sourceName = this.uploadForm.source().controlValue();
      const sources = this.sourcesSignal();
      // Exit early if sourceInfo couldn't be loaded
      if (sources === undefined) {
        return newRefs;
      }
      const sourceInfo = this.sourcesSignal()[sourceName];

      if (sourceInfo?.references !== null) {
        sourceInfo.references.forEach((ref) => {
          newRefs.push({ ref: ref, key: ref.name, val: "" });
        });
      }
      return newRefs;
    },
  );

  constructor() {
    // when the source changes, populate the reference fields
    const queryParamsSignal = toSignal(this.route.queryParamMap);
    this.sources$ = this.api.sourceReadAll();
    this.sourcesSignal = toSignal(this.sources$);

    this.parentSha256Signal = toSignal(
      this.route.params.pipe(
        ops.map((params) => {
          return params.sha256;
        }),
      ),
    );

    const userDetailsSignal = toSignal(this.user.userDetails$);

    // Update reference values based on the route.
    effect(() => {
      // Take a copy of the refs within ref to ensure they aren't mutated and remain a stable copy for future changes
      const refs: ReferenceFormInterface[] = this.sourceReferenceField().map(
        (ref) => ({ ...ref }),
      );
      const qpm = queryParamsSignal();
      const userDetails = userDetailsSignal();
      // Trigger re-calculation if parent value changes.
      const parentHash = this.parentSha256Signal();

      // Prefill references with parameters from the route if available.
      let routeHasRefs = false;
      for (const key of qpm.keys) {
        if (key.startsWith("ref_")) {
          routeHasRefs = true;
          const ref = key.slice(4);
          const val = qpm.get(key);
          // if field is one that is expected for the current source, set value
          if (refs?.[ref]) {
            refs[ref].val = val;
          }
        }
      }
      // only autofill fields if nothing has been set in uri
      if (!routeHasRefs) {
        if (refs?.["user"]) {
          refs["user"].val = userDetails?.username;
        }
        if (refs?.["organisation"]) {
          refs["organisation"].val = userDetails?.org;
        }
      }

      if (parentHash !== null && parentHash?.length > 0) {
        // Using parent refs so no refs required.
        this.uploadModel.update((orig) => {
          return {
            ...orig,
            refs: [],
            relations: [{ key: "action", value: "" }],
          };
        });
      } else {
        // Using refs because there is no parent so they need to definied.
        this.uploadModel.update((orig) => {
          return { ...orig, refs: [...refs] };
        });
      }
    });

    effect(() => {
      const curSourceValue = queryParamsSignal().get("source");
      // Update the source only if a source is present in the route.
      if (curSourceValue !== null && curSourceValue?.length > 0) {
        this.uploadModel.update((f) => {
          return { ...f, source: curSourceValue };
        });
      }
    });

    // If security is set mark all fields as touched so errors appear.
    effect(() => {
      const securityVale = this.uploadForm.security().controlValue();
      untracked(() => {
        // Confirm security has a value for if the constructor has been called and returning to the upload page with no security selected.
        if (securityVale != null && securityVale?.length > 0) {
          // Mark all form fields as touched so form errors will show up.
          Object.entries(this.uploadForm).forEach(([fieldName]) => {
            this.uploadForm[fieldName]()?.markAsTouched();
          });
        }
      });
    });
  }

  extractToggled() {
    // The extract button was pushed; display a warning
    if (this.dialog) {
      this.dialogClose();
    }
    // Only display if extract has just been set to true
    if (!this.uploadModel().extract) {
      this.dialog = this.dialogService.open(this.tplExtractWarning, {
        disableClose: true,
      });
    }
  }

  /**
   * Closes any active dialog.
   */
  protected dialogClose() {
    this.dialog.close();
    this.dialog = null;
  }

  /**
   * If a user cancels the extract warning box, revert their change to the form.
   */
  protected cancelBatch() {
    this.uploadModel.update((f) => {
      return { ...f, extract: false };
    });
    this.dialogClose();
  }

  addRelation() {
    this.uploadModel.update((f) => {
      return { ...f, relations: [...f.relations, { key: "", value: "" }] };
    });
  }

  rmRelation(i: number) {
    this.uploadModel.update((f) => {
      const newRelations = [...f.relations];
      newRelations.splice(i, 1);
      return { ...f, relations: newRelations };
    });
  }

  securityEmit(sec: string) {
    this.uploadModel.update((f) => {
      return {
        ...f,
        security: sec,
        // reset security confirmation because security value has changed
        security_confirm: false,
      };
    });
  }

  /** Aggregates common form elements shared by children and source uploads. */
  private getCommonFormData(
    file: FileWithNewName,
  ): Pick<
    ChildUpload & SourceUpload,
    Extract<keyof ChildUpload, keyof SourceUpload>
  > {
    const fv = this.uploadModel();
    const binary = file.file;
    let filename: string;
    if (fv.extract) {
      filename = file?.file.name;
    } else {
      filename = file?.newName;
    }

    // Convert timestamp to UTC
    const timestamp = new Date(fv.timestamp).toISOString();
    const security = fv.security;

    // Submission Settings
    const submissionSettings = {};

    // Additional passwords
    const settingsPasswords: string[] = [];
    for (const currentPassword of fv.settingsPasswords) {
      if (currentPassword.length > 0) {
        settingsPasswords.push(currentPassword);
      }
    }
    if (settingsPasswords.length > 0) {
      const settingsPasswordsString = settingsPasswords.join("\n");
      submissionSettings["passwords"] = settingsPasswordsString;
    }

    return {
      security: security,
      timestamp: timestamp,
      filename: filename,
      binary: binary,
      settings: JSON.stringify(submissionSettings),
    };
  }

  private getFormDataForChildSubmission(file: FileWithNewName): ChildUpload {
    const fv = this.uploadModel();
    const relations = {};
    for (const curRelation of fv.relations) {
      relations[curRelation.key] = curRelation.value;
    }

    const common = this.getCommonFormData(file);

    return {
      ...common,
      parent_sha256: this.parentSha256Signal(),
      relationship: JSON.stringify(relations),
    };
  }

  private getFormDataForSourceSubmission(file: FileWithNewName): SourceUpload {
    const fv = this.uploadModel();
    const refs = {};
    for (const kv of fv.refs) {
      if (!kv.val) {
        continue;
      }
      refs[kv.key] = kv.val;
    }

    const common = this.getCommonFormData(file);

    return {
      ...common,
      source_id: fv.source,
      stream_data: [],
      stream_labels: [],
      references: JSON.stringify(refs),
    };
  }

  onSubmit() {
    const fv = this.uploadModel();
    const files: FileWithNewName[] = fv.files;
    const allUploads: Observable<
      [
        number,
        (
          | readonly components["schemas"]["BinaryData"][]
          | CaughtHttpError
          | number
        ),
      ]
    >[] = [];
    this.allUploadsData = new Map<
      number,
      readonly components["schemas"]["BinaryData"][]
    >();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isChild = !!this.parentSha256Signal();

      this.uploads.set(
        i,
        new BehaviorSubject<[number, string, boolean]>([0, "", false]),
      );
      // create upload observable for this file
      allUploads.push(
        combineLatest([
          of(i),
          isChild
            ? this.api
                .binaryUploadChild(
                  this.getFormDataForChildSubmission(file),
                  fv.extract,
                  fv.password,
                )
                .pipe(
                  ops.catchError((_e) => of({ type: "error" })),
                  ops.take(1),
                )
            : this.api
                .binaryUploadSource(
                  this.getFormDataForSourceSubmission(file),
                  fv.extract,
                  fv.password,
                )
                .pipe(
                  ops.catchError((_e) => of({ type: "error" })),
                  ops.take(1),
                ),
        ]),
      );
    }

    // execute all upload observables
    from(allUploads)
      .pipe(
        // limit concurrency
        ops.mergeMap((x) => x, 2),
        ops.map(([i, d]) => {
          // progress of upload
          let progress = 1000;
          // sha256 of uploaded file
          let sha = "";
          // was an extracted archive (multiple submissions in one row)
          let multi = false;

          if (typeof d === "number") {
            progress = Math.min(d * 100, 100);
          } else if ("type" in d) {
            // Error
            progress = -1;
          } else {
            sha = d[0].sha256;
            this.allUploadsData.set(i, d);
            multi = d.length > 1;
          }

          this.uploads.get(i).next([progress, sha, multi]);
          return null;
        }, 2),
      )
      .subscribe();

    // reset security confirmation
    this.uploadModel.update((f) => {
      return { ...f, security_confirm: false };
    });
  }

  private removeUnwantedExtensions(value: string, extensions: string[]) {
    for (const extension of extensions) {
      if (value.endsWith(extension)) {
        const idx = value.lastIndexOf(extension);
        return value.slice(0, idx);
      }
    }
    return value;
  }

  checkIfFileIsGreaterThan50Mb() {
    let resultantSignalValue = false;
    const allFiles = this.uploadModel().files;
    if (allFiles.length > 0) {
      allFiles.forEach((fvf: FileWithNewName) => {
        if (fvf.file.size > this.largeFileSize) {
          // At least one file is large so add warning.
          resultantSignalValue = true;
          return;
        }
      });
    }
    this.largeFileSignal.set(resultantSignalValue);
  }

  onAddFiles(eventFiles: Event) {
    const eventTarget = eventFiles.target as HTMLInputElement;
    this.uploads.clear();
    const files = [...this.uploadModel().files];
    for (const curFile of eventTarget.files) {
      const newName = this.removeUnwantedExtensions(
        curFile.name,
        this.extensionsToRemoveOnUpload,
      );
      files.push({ file: curFile, newName: newName });
    }
    this.uploadModel.update((f) => {
      return {
        ...f,
        files: files,
        // reset security confirmation
        security_confirm: false,
      };
    });
    this.checkIfFileIsGreaterThan50Mb();

    eventTarget.value = null;
  }

  renameFile(index: number, event: Event) {
    const files: FileWithNewName[] = this.uploadModel().files.map((f) => ({
      ...f,
    }));
    files[index].newName = (event.target as HTMLInputElement).value;
    this.uploadModel.update((f) => {
      return { ...f, files: files };
    });
  }

  rmFile(index: number) {
    const files: FileWithNewName[] = [...this.uploadModel().files];
    files.splice(index, 1);
    this.uploadModel.update((f) => {
      return { ...f, files: files };
    });
    this.checkIfFileIsGreaterThan50Mb();
  }

  confirmSecurity() {
    // Confirm security
    this.uploadModel.update((f) => {
      return { ...f, security_confirm: true };
    });
  }

  toTitleCase(str: string, separator = " ") {
    return str
      .toLowerCase()
      .split(separator)
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  // Computed so it triggers only when the form fields change
  getRequiredFields: Signal<string[]> = computed(() => {
    const invalid = [];
    // Only run this section if the form is invalid
    if (this.uploadForm().invalid()) {
      const controlRefs = this.uploadForm.refs;
      for (const ref of controlRefs) {
        if (ref().invalid()) {
          invalid.push(ref().controlValue().key);
        }
      }

      // Get all the names of the fields that are invalid
      Object.entries(this.uploadForm).forEach(([fieldName]) => {
        if (this.uploadForm[fieldName]()?.invalid()) {
          invalid.push(fieldName);
        }
      });
    }

    const extract = this.uploadForm.extract().controlValue();
    if (extract === true) {
      let existingFiles = this.uploadForm.files().controlValue();
      if (existingFiles == null) {
        existingFiles = [];
      }
      existingFiles.forEach((f) => {
        const filename = f.file.name;
        const extension = filename.split(".").pop();
        if (!this.extensionsThatCanBeExtracted.includes(extension)) {
          invalid.push(
            `Cannot extract file named '${filename}', valid extensions that can be extracted are ${this.extensionsThatCanBeExtracted.join(
              ",",
            )}`,
          );
        }
      });
    }
    // Filter out refs and security_confirm before presentation (they are handled in other ways)
    return invalid
      .filter((i) => i != "refs" && i != "security_confirm")
      .map((val) => this.toTitleCase(val, "_"));
  });

  protected openSubmissionView(i) {
    const currentSubmission = this.allUploadsData?.get(i);

    const uploadModel = this.uploadModel();

    // Get current submission probably.
    const timestamp = new Date(uploadModel.timestamp);
    const timestampString = timestamp.toISOString();
    const source = uploadModel.source;

    // Even more information making it better at getting current submission.
    const track_sub = currentSubmission[0]?.track_source_references;

    this.router.navigate(["/pages/binaries/explore"], {
      queryParams: {
        term: sourceRefsAsParams(source, 0, track_sub, timestampString),
      },
    });
  }

  /* Submission setting configuration. */
  addSettingsPassword(password: string = "") {
    this.uploadModel.update((f) => {
      return {
        ...f,
        settingsPasswords: [...f.settingsPasswords, password],
      };
    });
  }

  rmSettingsPassword(index: number) {
    this.uploadModel.update((f) => {
      const newPasswords = [...f.settingsPasswords];
      newPasswords.splice(index, 1);
      return {
        ...f,
        settingsPasswords: newPasswords,
      };
    });
  }
}
