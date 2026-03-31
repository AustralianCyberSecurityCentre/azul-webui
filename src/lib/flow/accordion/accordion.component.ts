import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  imports: [NgClass],
  selector: "flow-accordion",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./accordion.component.html",
})
export class AccordionComponent {
  @Input() flush?: boolean;
}
