import { AccordionComponent } from "./accordion.component";
import { AccordionPanelComponent } from "./accordion-panel.component";
import { Component, inject } from "@angular/core";
import { NgClass } from "@angular/common";

@Component({
  imports: [NgClass],
  selector: "flow-accordion-title",
  templateUrl: "./accordion-title.component.html",
})
export class AccordionTitleComponent {
  readonly accordion = inject(AccordionComponent);
  readonly accordionPanel = inject(AccordionPanelComponent);
}
