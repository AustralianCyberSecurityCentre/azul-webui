import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";

import { components } from "@app/core/api/openapi";
import { UserService } from "@app/core/user.service";
import { allowedToPurge } from "@app/core/util";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { Observable, of } from "rxjs";
import { BaseCard } from "../base-card.component";

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

  isParent = input<boolean>(false);

  protected faTrash = faTrash;
  protected allowedToPurge = allowedToPurge;
  protected autoLoad$: Observable<number> = of(1);

  protected familyTemplateInputType: {
    data$: Observable<
      (components["schemas"]["azul_bedrock__models_restapi__binaries__PathNode"] & {
        _localEntitySummary$: Observable<
          components["schemas"]["EntityFindItem"]
        >;
      })[]
    >;
    etype: "children" | "parents";
  };
}
