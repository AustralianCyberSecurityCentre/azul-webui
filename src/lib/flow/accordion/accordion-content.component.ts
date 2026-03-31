import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { AccordionPanelComponent } from "./accordion-panel.component";

@Component({
  imports: [],
  selector: "flow-accordion-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./accordion-content.component.html",
})
export class AccordionContentComponent {
  readonly accordionPanel = inject(AccordionPanelComponent);
}
