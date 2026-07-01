import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";

/**Render simple text with underline to indicate that hover text exists.*/
@Component({
  selector: "az-hover-textable",
  templateUrl: "./hover-textable.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HoverTextableComponent {
  message = input<string | undefined>(undefined);
  protected questionIcon = faQuestionCircle;
  protected faCircleQuestion = faCircleQuestion;

  constructor() {}
}
