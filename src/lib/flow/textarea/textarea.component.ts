import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HostControlDirective } from "src/lib/host-control/host-control.directive";

// https://flowbite.com/docs/forms/textarea/

@Component({
  selector: "flow-textarea",
  templateUrl: "./textarea.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  hostDirectives: [HostControlDirective],
})
export class TextareaComponent {
  @Input() rows = 4;
  @Input() spellcheck: boolean | null = null;

  hcd = inject(HostControlDirective);
}
