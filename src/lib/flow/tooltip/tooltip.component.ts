import { ClipboardModule } from "@angular/cdk/clipboard";
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
import {
  ButtonComponent,
  ButtonSize,
  ButtonType,
} from "../button/button.component";
// https://flowbite.com/docs/components/tooltips/
// Hover implemented using Tailwind groups instead of Flowbite vanilla JS

@Component({
  selector: "flow-tooltip",
  templateUrl: "./tooltip.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    OverlayModule,
    FaIconComponent,
    ButtonComponent,
    ClipboardModule,
  ],
})
export class TooltipComponent {
  message = input<string | undefined>(undefined);
  // Additional message that doesn't get copied
  additionalMessage = input<string | undefined>(undefined);
  subText = input<string | undefined>(undefined);
  copyText = input<boolean>(false);
  tplRef = input<TemplateRef<unknown> | null>(null);
  tplContext = input<unknown>(null);
  direction = input<"top" | "bottom">("top");

  constructor() {}
  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected hoveringRawSignal: WritableSignal<boolean> = signal(false);
  protected hoveringSignal = debounced(this.hoveringRawSignal, 250);
  protected fadeSignal = debounced(this.hoveringRawSignal, 200);

  protected fadeIn() {
    this.hoveringRawSignal.set(true);
  }

  protected fadeOut() {
    this.hoveringRawSignal.set(false);
  }

  protected readonly faCopy = faCopy;
}
