import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Toast } from "ngx-toastr";
import { ButtonComponent } from "../button/button.component";
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faPaperclip,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

// https://flowbite.com/docs/components/toast/

@Component({
  selector: "flow-toast",
  templateUrl: "./toast.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent, FontAwesomeModule],
})
export class ToastComponent extends Toast {
  protected faIcons = {
    "toast-success": faCircleCheck,
    "toast-info": faCircleInfo,
    "toast-warning": faCircleExclamation,
    "toast-error": faCircleXmark,
    copy: faPaperclip,
  };
}
