import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

/** A simple rounded text icon with support for two letters */
@Component({
  selector: "az-text-icon",
  templateUrl: "./text-icon.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class TextIconComponent {
  @Input()
  protected label: string;
}
