import { Component, Input } from "@angular/core";

@Component({
  imports: [],
  selector: "flow-accordion-panel",
  templateUrl: "./accordion-panel.component.html",
})
export class AccordionPanelComponent {
  @Input() open?: boolean;

  setOpen(open: boolean) {
    this.open = open;
  }
}
