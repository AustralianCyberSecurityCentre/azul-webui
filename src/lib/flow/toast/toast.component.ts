import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faPaperclip,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { Toast } from "ngx-toastr";
import { ButtonComponent } from "../button/button.component";

// https://flowbite.com/docs/components/toast/

@Component({
  selector: "flow-toast",
  templateUrl: "./toast.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent, FontAwesomeModule],
})
export class ToastComponent extends Toast {
  protected faIcons: Map<string, IconDefinition> = new Map<
    string,
    IconDefinition
  >([
    ["toast-success", faCircleCheck],
    ["toast-info", faCircleInfo],
    ["toast-warning", faCircleExclamation],
    ["toast-error", faCircleXmark],
    ["copy", faPaperclip],
  ]);
}
