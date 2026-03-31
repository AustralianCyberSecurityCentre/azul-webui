import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { AccordionPanelComponent } from "./accordion-panel.component";
import { AccordionComponent } from "./accordion.component";

@Component({
  imports: [NgClass],
  selector: "flow-accordion-title",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./accordion-title.component.html",
})
export class AccordionTitleComponent {
  readonly accordion = inject(AccordionComponent);
  readonly accordionPanel = inject(AccordionPanelComponent);
}
