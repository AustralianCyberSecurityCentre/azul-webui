import { OverlayModule } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  debounced,
  input,
  signal,
  TemplateRef,
  WritableSignal,
} from "@angular/core";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faCopy } from "@fortawesome/free-solid-svg-icons";

// https://flowbite.com/docs/components/tooltips/
// Hover implemented using Tailwind groups instead of Flowbite vanilla JS

@Component({
  selector: "flow-tooltip",
  templateUrl: "./tooltip.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OverlayModule, FaIconComponent],
})
export class TooltipComponent {
  message = input<string | undefined>(undefined);
  subText = input<string | undefined>(undefined);
  copyText = input<boolean>(false);
  tplRef = input<TemplateRef<unknown> | null>(null);
  tplContext = input<unknown>(null);
  direction = input<"top" | "bottom">("top");

  constructor() {}

  protected hoveringRawSignal: WritableSignal<boolean> = signal(false);
  protected hoveringSignal = debounced(this.hoveringRawSignal, 10);
  protected fadeSignal = debounced(this.hoveringRawSignal, 60);

  protected fadeIn() {
    this.hoveringRawSignal.set(true);
  }

  protected fadeOut() {
    this.hoveringRawSignal.set(false);
  }

  protected readonly faCopy = faCopy;
}
