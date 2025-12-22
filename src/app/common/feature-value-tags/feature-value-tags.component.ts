import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from "@angular/core";
import {
  FormControl,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from "@angular/forms";
import * as ops from "rxjs/operators";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { BehaviorSubject } from "rxjs";
import { components } from "src/app/core/api/openapi";
import { FeatureService } from "src/app/core/feature.service";
import { SecurityService } from "src/app/core/security.service";
import { getStatusColour } from "src/app/core/util";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

/**Displays a group of tags for the current feature value.

Enables creation of new tags and deletion of existing tags.
*/
@Component({
  selector: "az-feature-value-tags",
  templateUrl: "./feature-value-tags.component.html",
  standalone: false,
})
export class FeatureValueTagsComponent implements OnInit {
  private dialogService = inject(Dialog);
  private fb = inject(UntypedFormBuilder);
  securityService = inject(SecurityService);
  featureService = inject(FeatureService);

  @Input() row: {
    name: string;
    value: string;
    tags: readonly components["schemas"]["FeatureValueTag"][];
  };
  @Output() changed = new EventEmitter<
    components["schemas"]["FeatureValueTag"]
  >();

  public getStatusColour = getStatusColour;
  formCreateTag: UntypedFormGroup;
  tagFormControl: FormControl<string>;
  refreshTags$: BehaviorSubject<boolean> = new BehaviorSubject(true);

  private dialog?: DialogRef;

  protected faPlus = faPlus;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  ngOnInit(): void {
    this.formCreateTag = this.fb.group({
      tag: ["", Validators.required],
      security: [null, Validators.required],
    });
    this.tagFormControl = this.formCreateTag.get("tag") as FormControl<string>;
  }

  protected openDialog(dialog, extra?) {
    this.dialog = this.dialogService.open(dialog, extra);
    // Clear old tag value
    this.tagFormControl.setValue("");
    // Trigger tag refresh to occur, to load the new tag.
    this.refreshTags$.next(true);
  }

  onCreateFVTagSubmit(feature: string, value: string) {
    const f = this.formCreateTag;
    this.featureService
      .createTag(feature, value, f.get("tag").value, f.get("security").value)
      .pipe(ops.first())
      .subscribe((_d) => {
        this.dialog.close();
        this.changed.emit({
          feature_name: feature,
          feature_value: value,
          type: f.get("type")?.value,
          tag: f.get("tag").value,
          owner: null,
          timestamp: null,
          security: null,
        });
      });
  }
}
