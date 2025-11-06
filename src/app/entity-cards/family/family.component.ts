import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  inject,
} from "@angular/core";

import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { Observable, of } from "rxjs";
import { UserService } from "src/app/core/user.service";
import { allowedToPurge } from "src/app/core/util";
import { BaseCard } from "../base-card.component";
import { components } from "src/app/core/api/openapi";

/**card displaying parents or children of current entity*/
@Component({
  selector: "azec-family",
  templateUrl: "./family.component.html",
  styleUrls: ["./family.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FamilyComponent extends BaseCard {
  protected user = inject(UserService);

  help = ``;
  parentsHelp = `
    Displays all parents of the current entity.
    A parent is any binary extracted from your currently viewed binary by an Azul plugin.
    If the file only has 'direct' sources, it will have no parent files.
`;
  childrenHelp = `
    Displays all children of the current entity.
    A child is any binary extracted from your currently viewed binary by an Azul plugin.
    You can manually upload children to the current file by clicking the 'add child' button.
    This is useful if you have performed manual analysis on the file such as decrypting a payload.
`;

  isParentSignal = signal(false);
  @Input() set isParent(d: boolean) {
    this.isParentSignal.set(d);
  }

  protected faTrash = faTrash;
  protected allowedToPurge = allowedToPurge;
  protected autoLoad$: Observable<number> = of(1);

  protected familyTemplateInputType: {
    data$: Observable<
      (components["schemas"]["PathNode"] & {
        _localEntitySummary$: Observable<
          components["schemas"]["EntityFindItem"]
        >;
      })[]
    >;
    etype: "children" | "parents";
  };
}
