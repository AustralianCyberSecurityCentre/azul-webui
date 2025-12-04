import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { formatDate } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  WritableSignal,
  inject,
  signal,
} from "@angular/core";
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
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
import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  from,
  of,
} from "rxjs";
import * as ops from "rxjs/operators";
import { ApiService } from "src/app/core/api/api.service";
import { ValidPOSTUploadPaths } from "src/app/core/api/methods";
import { components } from "src/app/core/api/openapi";
import { FileUpload } from "src/app/core/api/state";
import { SecurityService } from "src/app/core/security.service";
import { Entity } from "src/app/core/services";
import { UserService } from "src/app/core/user.service";
import { sourceRefsAsParams } from "src/app/core/util";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

interface FileWithNewName {
  file: File;
  newName: string;
}

interface CaughtHttpError {
  type: string;
}

type ChildUpload = FileUpload<
  ValidPOSTUploadPaths["/api/v0/binaries/child"]["post"]["requestBody"]["content"]["multipart/form-data"]
>;
type SourceUpload = FileUpload<
  ValidPOSTUploadPaths["/api/v0/binaries/source"]["post"]["requestBody"]["content"]["multipart/form-data"]
>;

/**page for uploading new entities for analysis*/
@Component({
  selector: "app-entities-upload",
  templateUrl: "./entities-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesUploadComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(UntypedFormBuilder);
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

  form: UntypedFormGroup;

  sources$: Observable<
    components["schemas"]["Response_dict_str__azul_bedrock.models_settings.Source_"]["data"]
  >;
  paramsSub: Subscription;
  sourceSelectChangeSub: Subscription;
  parentSub: Subscription;
  parent$: BehaviorSubject<string | null> = new BehaviorSubject<string>(null);
  extractConfirmSub: Subscription;

  @ViewChild("tplExtractWarning") tplExtractWarning: TemplateRef<Element>;
  protected dialog?: DialogRef;

  // upload status map
  uploads = new Map<number, BehaviorSubject<[number, string, boolean]>>();
  allUploadsData: Map<number, readonly components["schemas"]["BinaryData"][]>;

  readonly extensionsToRemoveOnUpload = [".cart", ".malpz"];
  readonly extensionsThatCanBeExtracted = ["zip", "gzip", "tar"];
  readonly defaultSource = "samples";
  readonly largeFileSize = 50 * 1024 * 1024;

  protected selectedSecurity$: Observable<string | undefined>;
  protected confirmedSecurity$: Observable<boolean>;
  protected largeFileSignal: WritableSignal<boolean> = signal(false);

  constructor() {
    this.form = this.fb.group({
      source: [this.defaultSource, [Validators.required]],
      refs: this.fb.array([]),
      relations: this.fb.array([]),
      parent_sha256: [""],
      security: ["", Validators.required],
      security_confirm: [false, Validators.requiredTrue],
      files: [[], Validators.required],
      extract: [false],
      password: [""],
      // Since browser is non-specific (we don't know when the file was actually sourced), we clear the time part to 00:00:00
      // Format date, for compatibility with datetime-local input type
      timestamp: [
        formatDate(new Date(), "yyyy-MM-ddTHH:mm", "en"),
        [Validators.required],
      ],
      // Submission settings
      settingsPasswords: this.fb.array([]),
    });
    // Initalise password settings
    this.addSettingsPassword();

    // this.user.userDetails$.subscribe(d => console.log('udetails', d))
    // when the source changes, populate the reference fields
    this.sources$ = this.api.sourceReadAll();
    this.sourceSelectChangeSub = combineLatest([
      this.form.get("source").valueChanges,
      this.sources$,
      this.parent$, // Parent included here because if there is a parent formRefs needs an update
    ])
      .pipe(
        ops.map(([src, srcs, _parentRef]) => {
          return { src: srcs?.[src as string] };
        }),
        ops.map((data) => {
          // add required refs
          const refs = {};
          for (const ref of data.src?.references || []) {
            refs[ref.name] = { ref: ref, key: ref.name, val: "" };
          }
          return refs;
        }),
        ops.combineLatestWith(this.route.queryParamMap, this.user.userDetails$),
        ops.map(([refs, qpm, user]) => {
          // extract references from query string
          let has_refs = false;
          for (const key of qpm.keys) {
            if (key.startsWith("ref_")) {
              has_refs = true;
              const ref = key.slice(4);
              const val = qpm.get(key);
              // if field is one that is expected for the current source, set value
              if (refs?.[ref]) {
                refs[ref].val = val;
              }
            }
          }
          // only autofill fields if nothing has been set in uri
          if (!has_refs) {
            if (refs?.["user"]) {
              refs["user"].val = user?.username;
            }
            if (refs?.["organisation"]) {
              refs["organisation"].val = user?.org;
            }
          }
          return refs;
        }),
        ops.tap((refs) => {
          const formRefs = this.form.get("refs") as UntypedFormArray;
          // remove existing refs
          while (formRefs.length !== 0) {
            formRefs.removeAt(0);
          }
          // if we are adding to a source, require source reference fields to be set
          // Updating the formsRef here is why Parent is one of the sources of the subscription.
          if (!this.form.get("parent_sha256").value) {
            for (const refk in refs) {
              const row = refs[refk];
              formRefs.push(
                this.fb.group({
                  ref: [row.ref],
                  key: [row.key, Validators.required],
                  val: [
                    row.val,
                    !row.ref.required
                      ? Validators.nullValidator
                      : Validators.required,
                  ],
                  optional: [!row.ref.required],
                }),
              );
            }
          }
        }),
      )
      .subscribe();

    this.selectedSecurity$ = this.form.valueChanges.pipe(
      ops.map((values) => values.security || undefined),
      ops.shareReplay(1),
    );
    this.confirmedSecurity$ = this.form.valueChanges.pipe(
      ops.map((values) => values.security_confirm),
      ops.shareReplay(1),
    );
  }
  ngOnDestroy(): void {
    this.paramsSub?.unsubscribe();
    this.sourceSelectChangeSub?.unsubscribe();
    this.parentSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.parentSub = this.route.params
      .pipe(
        ops.map((p) => {
          return p.sha256 as string;
        }),
        ops.tap((d) => this.form.get("parent_sha256").setValue(d || "")),
        ops.tap((d) => (d ? this.addRelation("action", "") : null)),
        ops.tap((d) => {
          if (d) {
            this.parent$.next(d);
          }
        }),
      )
      .subscribe();

    this.paramsSub = this.route.queryParamMap.subscribe((d) => {
      this.form.get("source").setValue(d.get("source") || this.defaultSource);
    });

    this.extractConfirmSub = this.form.valueChanges
      .pipe(
        ops.map((d) => d.extract),
        ops.distinctUntilChanged(),
      )
      .subscribe((extract) => {
        if (extract) {
          // The extract button was pushed; display a warning
          if (this.dialog) {
            this.dialogClose();
          }
          this.dialog = this.dialogService.open(this.tplExtractWarning, {
            disableClose: true,
          });
        }
      });
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
    this.form.controls["extract"].setValue(false);
    this.dialogClose();
  }

  get formRefs() {
    return this.form.get("refs") as UntypedFormArray;
  }

  get formRelations() {
    return this.form.get("relations") as UntypedFormArray;
  }

  addRelation(k: string = "", v: string = "") {
    const control = this.fb.group({
      key: [k, Validators.required],
      val: [v, Validators.required],
    });
    this.formRelations.push(control);
  }

  rmRelation(i: number) {
    this.formRelations.removeAt(i);
  }

  securityEmit(sec: string) {
    this.form.get("security").patchValue(sec);
    // reset security confirmation
    this.form.get("security_confirm").setValue(false);
  }

  /** Aggregates common form elements shared by children and source uploads. */
  private getCommonFormData(
    file: FileWithNewName,
  ): Pick<
    ChildUpload & SourceUpload,
    Extract<keyof ChildUpload, keyof SourceUpload>
  > {
    const fv = this.form.value;
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
    for (const passwordForm of fv.settingsPasswords as Array<{
      passwordValue: string;
    }>) {
      if (passwordForm.passwordValue.length > 0) {
        settingsPasswords.push(passwordForm.passwordValue);
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
    const fv = this.form.value;
    const relations = {};
    for (const kv of fv.relations as Array<{ key: string; val: string }>) {
      relations[kv.key] = kv.val;
    }

    const common = this.getCommonFormData(file);

    return {
      ...common,
      parent_sha256: fv.parent_sha256,
      relationship: JSON.stringify(relations),
    };
  }

  private getFormDataForSourceSubmission(file: FileWithNewName): SourceUpload {
    const fv = this.form.value;
    const refs = {};
    for (const kv of fv.refs as Array<{ key: string; val: string }>) {
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
    const fv = this.form.value;
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
      const isChild = !!fv.parent_sha256;

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
                .pipe(ops.catchError((_e) => of({ type: "error" })))
            : this.api
                .binaryUploadSource(
                  this.getFormDataForSourceSubmission(file),
                  fv.extract,
                  fv.password,
                )
                .pipe(ops.catchError((_e) => of({ type: "error" }))),
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
          let progress = 0;
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
            progress = 1000;
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
    this.form.get("security_confirm").setValue(false);
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
    if (
      this.form.value?.files != undefined &&
      this.form.value?.files != null &&
      this.form.value?.files.length > 0
    ) {
      this.form.value.files.forEach((fvf: FileWithNewName) => {
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
    const files = this.form.get("files").value;
    for (let i = 0; i < eventTarget.files.length; i++) {
      const newName = this.removeUnwantedExtensions(
        eventTarget.files[i].name,
        this.extensionsToRemoveOnUpload,
      );
      files.push({ file: eventTarget.files[i], newName: newName });
    }
    this.form.get("files").patchValue(files);
    this.checkIfFileIsGreaterThan50Mb();
    // reset security confirmation
    this.form.get("security_confirm").setValue(false);
    eventTarget.value = null;
  }

  renameFile(index: number, event: Event) {
    const files: FileWithNewName[] = this.form.get("files").value;
    files[index].newName = (event.target as HTMLInputElement).value;
    this.form.get("files").patchValue(files);
  }

  rmFile(index: number) {
    const files: FileWithNewName[] = this.form.get("files").value;
    files.splice(index, 1);
    this.form.get("files").patchValue(files);
    this.checkIfFileIsGreaterThan50Mb();
  }

  confirmSecurity() {
    this.form.get("security_confirm").setValue(true);
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

  getRequiredFields(): string[] {
    const invalid = [];
    // Only run this section if the form is invalid
    if (this.form.invalid) {
      const controlRefs = this.formRefs.controls;
      for (const ref of controlRefs) {
        if (ref.invalid) {
          invalid.push(ref.value.key);
        }
      }

      const controls = this.form.controls;
      for (const name in controls) {
        if (controls[name].invalid) {
          invalid.push(name);
        }
      }
    }

    if (this.form.value?.extract === true) {
      const files: FileWithNewName[] =
        this.form.value?.files == null ? [] : this.form.value?.files;
      files.forEach((f) => {
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
    // Filter out refs and security_confirm before presentation
    return invalid
      .filter((i) => i != "refs" && i != "security_confirm")
      .map((val) => this.toTitleCase(val, "_"));
  }

  protected openSubmissionView(i) {
    const currentSubmission = this.allUploadsData?.get(i);

    const fv = this.form.value;

    // Get current submission probably.
    const timestamp = new Date(fv.timestamp);
    const timestampString = timestamp.toISOString();
    const source = this.form.get("source").value;

    // Even more information making it better at getting current submission.
    const track_sub = currentSubmission[0]?.track_source_references;

    this.router.navigate(["/pages/binaries/explore"], {
      queryParams: {
        term: sourceRefsAsParams(source, 0, track_sub, timestampString),
      },
    });
  }

  /* Submission setting configuration. */

  // Password settings.
  get formSettingsPasswords() {
    return this.form.get("settingsPasswords") as UntypedFormArray;
  }

  addSettingsPassword(password: string = "") {
    const control = this.fb.group({
      passwordValue: [password],
    });
    this.formSettingsPasswords.push(control);
  }

  rmSettingsPassword(i: number) {
    this.formSettingsPasswords.removeAt(i);
  }
}
