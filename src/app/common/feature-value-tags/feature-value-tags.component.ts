import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import * as ops from "rxjs/operators";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { components } from "@app/core/api/openapi";
import { FeatureService } from "@app/core/feature.service";
import { SecurityService } from "@app/core/security.service";
import { getStatusColour } from "@app/core/util";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { BehaviorSubject } from "rxjs";
import { form, required } from "@angular/forms/signals";
import { configureTagValidation } from "../tag-picker/tag-picker.component";

interface CreateFeatureTag {
  tag: string;
  security: string;
}

/**Displays a group of tags for the current feature value.

Enables creation of new tags and deletion of existing tags.
*/
@Component({
  selector: "az-feature-value-tags",
  templateUrl: "./feature-value-tags.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeatureValueTagsComponent {
  private dialogService = inject(Dialog);
  securityService = inject(SecurityService);
  featureService = inject(FeatureService);

  row = input<
    | {
        name: string;
        value: string;
        tags: readonly components["schemas"]["FeatureValueTag"][];
      }
    | undefined
  >(undefined);
  changed = output<components["schemas"]["FeatureValueTag"]>();

  public getStatusColour = getStatusColour;

  // Form
  protected createTagModel: WritableSignal<CreateFeatureTag> = signal({
    tag: "",
    security: "",
  });

  // Picker form
  protected createTagForm = form(this.createTagModel, (f) => {
    configureTagValidation(f.tag);
    required(f.security);
  });

  refreshTags$: BehaviorSubject<boolean> = new BehaviorSubject(true);

  private dialog?: DialogRef;

  protected faPlus = faPlus;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  protected openDialog(dialog, extra?) {
    this.dialog = this.dialogService.open(dialog, extra);
    // Clear old tag value
    this.createTagForm.tag().controlValue.set("");
    // Trigger tag refresh to occur, to load the new tag.
    this.refreshTags$.next(true);
  }

  onCreateFVTagSubmit(feature: string, value: string) {
    const f = this.createTagForm().controlValue();
    this.featureService
      .createTag(feature, value, f.tag, f.security)
      .pipe(ops.first())
      .subscribe((_d) => {
        this.dialog.close();
        // Note this is emitting the value that should appear on the server but isn't actually getting the value back from opensearch.
        this.changed.emit({
          feature_name: feature,
          feature_value: value,
          type: "fv_tag", // This isn't in sync with metastore and could change in the future.
          tag: f.tag,
          owner: null,
          timestamp: null,
          security: f.security,
        });
      });
  }

  formCreateTagSecurityUpdate(event) {
    if (event == null) {
      return;
    }
    this.createTagModel.update((v) => {
      return { ...v, security: event };
    });
  }
}
