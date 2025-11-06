import { AccordionPanelComponent } from "./accordion-panel.component";
import { Component, inject } from "@angular/core";

@Component({
  imports: [],
  selector: "flow-accordion-content",
  templateUrl: "./accordion-content.component.html",
})
export class AccordionContentComponent {
  readonly accordionPanel = inject(AccordionPanelComponent);
}
