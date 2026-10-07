import { Dialog, DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { form, required } from "@angular/forms/signals";
import { components } from "@app/core/api/openapi";
import { Entity, Security } from "@app/core/services";
import { escapeValue, getStatusColour } from "@app/core/util";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";
import { BehaviorSubject } from "rxjs";
import * as ops from "rxjs/operators";
import { configureTagValidation } from "../tag-picker/tag-picker.component";

interface CreateEntityTag {
  tag: string;
  security: string;
}

/**Displays a group of tags for the current entity.

Enables creation of new tags and deletion of existing tags.
*/
@Component({
  selector: "azco-entity-tags",
  templateUrl: "./entity-tags.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntityTagsComponent {
  entityService = inject(Entity);
  private dialogService = inject(Dialog);
  securityService = inject(Security);

  help = `
  All tags relating to the current entity.
  Use these to find other binaries with a matching tag.`;

  sha256 = input.required<string>();
  tags = input<readonly components["schemas"]["EntityTag"][]>([]);
  addTag = input<boolean>(true);
  changed = output<null>();

  // Form
  protected createTagModel: WritableSignal<CreateEntityTag> = signal({
    tag: "",
    security: "",
  });

  // Picker form
  protected createTagForm = form(this.createTagModel, (f) => {
    configureTagValidation(f.tag);
    required(f.security);
  });

  protected dialog?: DialogRef;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  refreshTags$: BehaviorSubject<boolean> = new BehaviorSubject(true);
  getColour = getStatusColour;

  protected openDialog(dialog, extra?) {
    this.dialog = this.dialogService.open(dialog, extra);
  }

  onCreateEntityTagSubmit() {
    this.entityService
      .createTag(
        this.sha256(),
        this.createTagModel().tag,
        this.createTagModel().security,
      )
      .pipe(ops.first())
      .subscribe((_d) => {
        this.dialog.close();
        this.changed.emit(null);
        // Clear old tag value
        this.createTagModel.update((v) => {
          return { ...v, tag: v.tag };
        });
        // Trigger tag refresh to occur, to load the new tag.
        this.refreshTags$.next(true);
      });
  }

  onDeleteEntityTag(tag: string) {
    const result = window.confirm(
      `Are you sure you want to remove tag "${tag}" from binary "${this.sha256()}"?`,
    );
    if (result) {
      this.entityService
        .deleteTag(this.sha256(), tag)
        .pipe(ops.first())
        .subscribe((_d) => {
          this.dialog.close();
          this.changed.emit(null);
        });
    }
  }

  protected readonly escapeValue = escapeValue;

  formCreateTagSecurityUpdate(event: string) {
    if (event == null) {
      return;
    }
    this.createTagModel.update((v) => {
      return { ...v, security: event };
    });
  }
}
