import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { SourcePickerService } from "../source-picker.service";

@Component({
  selector: "azco-source-picker",
  templateUrl: "./source-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SourcePickerComponent {
  sourcePicker = inject(SourcePickerService);

  protected sourceModel = this.sourcePicker.sourceModel;
  protected sourceForm = this.sourcePicker.sourceForm;
  isForceShowInvalid = input<boolean>(false);

  toTitleCase(str: string, separator = " ") {
    return str
      .toLowerCase()
      .split(separator)
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
}
