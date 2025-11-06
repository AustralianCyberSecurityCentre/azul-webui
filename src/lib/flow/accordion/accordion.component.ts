import { Component, Input } from "@angular/core";
import { NgClass } from "@angular/common";

@Component({
  imports: [NgClass],
  selector: "flow-accordion",
  templateUrl: "./accordion.component.html",
})
export class AccordionComponent {
  @Input() flush?: boolean;
}
