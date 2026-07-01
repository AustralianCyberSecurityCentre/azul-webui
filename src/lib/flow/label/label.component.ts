import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

// https://flowbite.com/docs/forms/input-field/

@Component({
  selector: "flow-label",
  templateUrl: "./label.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class LabelComponent {
  for = input<string>("");
  noPadding = input<boolean>(false);
  fieldSize = input<"large" | "medium" | "small-nopadding" | "small">("medium");
}
