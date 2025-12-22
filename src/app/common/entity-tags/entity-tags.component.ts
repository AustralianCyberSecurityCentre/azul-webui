import { Dialog, DialogRef } from "@angular/cdk/dialog";
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
import { components } from "src/app/core/api/openapi";

import { Entity, Security } from "src/app/core/services";
import { escapeValue, getStatusColour } from "src/app/core/util";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

/**Displays a group of tags for the current entity.

Enables creation of new tags and deletion of existing tags.
*/
@Component({
  selector: "azco-entity-tags",
  templateUrl: "./entity-tags.component.html",
  standalone: false,
})
export class EntityTagsComponent implements OnInit {
  entityService = inject(Entity);
  private dialogService = inject(Dialog);
  private fb = inject(UntypedFormBuilder);
  securityService = inject(Security);

  help = `
  All tags relating to the current entity.
  Use these to find other binaries with a matching tag.`;

  @Input() entityType: string;
  @Input() sha256: string;
  @Input() tags: readonly components["schemas"]["EntityTag"][];
  @Input() addTag: boolean = true;

  @Output() changed = new EventEmitter<null>();

  protected dialog?: DialogRef;
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  formCreateTag: UntypedFormGroup;
  tagFormControl: FormControl<string>;
  getColour = getStatusColour;

  ngOnInit(): void {
    this.formCreateTag = this.fb.group({
      tag: ["", Validators.required],
      security: [null, Validators.required],
    });
    this.tagFormControl = this.formCreateTag.get("tag") as FormControl<string>;
  }

  protected openDialog(dialog, extra?) {
    this.dialog = this.dialogService.open(dialog, extra);
  }

  onCreateEntityTagSubmit() {
    this.entityService
      .createTag(
        this.sha256,
        this.formCreateTag.get("tag").value,
        this.formCreateTag.get("security").value,
      )
      .pipe(ops.first())
      .subscribe((_d) => {
        this.dialog.close();
        this.changed.emit();
        // Clear old tag value
        this.formCreateTag.get("tag").setValue("");
      });
  }

  onDeleteEntityTag(tag: string) {
    const result = window.confirm(
      `Are you sure you want to remove tag "${tag}" from binary "${this.sha256}"?`,
    );
    if (result) {
      this.entityService
        .deleteTag(this.sha256, tag)
        .pipe(ops.first())
        .subscribe((_d) => {
          this.dialog.close();
          this.changed.emit();
        });
    }
  }

  protected readonly escapeValue = escapeValue;
}
