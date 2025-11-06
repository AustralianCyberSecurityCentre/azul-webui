import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

// https://flowbite.com/docs/components/progress/

@Component({
  selector: "flow-progress",
  templateUrl: "./progress.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ProgressComponent {
  /**
   * Progress percentage as a floating point between 0-100.
   */
  @Input() value: number = 0;
}
